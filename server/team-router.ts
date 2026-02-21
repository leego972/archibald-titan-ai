/**
 * Team Management Router — Manage team members with role-based access.
 *
 * Enterprise-only feature. Team owners can invite members, assign roles,
 * and manage access to shared credentials and jobs.
 */

import { z } from "zod";
import { protectedProcedure, router } from "./_core/trpc";
import { TRPCError } from "@trpc/server";
import { getDb } from "./db";
import { teamMembers, users } from "../drizzle/schema";
import { eq, and, desc, sql, ne } from "drizzle-orm";
import { getUserPlan, enforceFeature } from "./subscription-gate";
import { logAudit } from "./audit-log-db";
import crypto from "crypto";

const MAX_TEAM_SEATS = 25;

export const teamRouter = router({
  // List all team members (owned by current user)
  listMembers: protectedProcedure.query(async ({ ctx }) => {
    const plan = await getUserPlan(ctx.user.id);
    enforceFeature(plan.planId, "team_management", "Team Management");

    const db = await getDb();
    if (!db) return [];

    const members = await db
      .select({
        id: teamMembers.id,
        userId: teamMembers.userId,
        role: teamMembers.role,
        inviteEmail: teamMembers.inviteEmail,
        inviteStatus: teamMembers.inviteStatus,
        joinedAt: teamMembers.joinedAt,
        createdAt: teamMembers.createdAt,
        userName: users.name,
        userEmail: users.email,
      })
      .from(teamMembers)
      .leftJoin(users, eq(teamMembers.userId, users.id))
      .where(eq(teamMembers.teamOwnerId, ctx.user.id))
      .orderBy(desc(teamMembers.createdAt));

    return members;
  }),

  // Add existing user to team by email
  addMember: protectedProcedure
    .input(
      z.object({
        email: z.string().email(),
        role: z.enum(["admin", "member", "viewer"]).default("member"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const plan = await getUserPlan(ctx.user.id);
      enforceFeature(plan.planId, "team_management", "Team Management");

      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

      // Check seat limit
      const currentCount = await db
        .select({ count: sql<number>`COUNT(*)` })
        .from(teamMembers)
        .where(eq(teamMembers.teamOwnerId, ctx.user.id));

      if (currentCount[0].count >= MAX_TEAM_SEATS) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Team is at maximum capacity (${MAX_TEAM_SEATS} seats).`,
        });
      }

      // Find user by email
      const targetUser = await db
        .select()
        .from(users)
        .where(eq(users.email, input.email))
        .limit(1);

      if (targetUser.length === 0) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "No user found with that email. They must sign up first.",
        });
      }

      const target = targetUser[0];

      // Can't add yourself
      if (target.id === ctx.user.id) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "You cannot add yourself to your team." });
      }

      // Check if already a member
      const existing = await db
        .select()
        .from(teamMembers)
        .where(
          and(
            eq(teamMembers.teamOwnerId, ctx.user.id),
            eq(teamMembers.userId, target.id)
          )
        )
        .limit(1);

      if (existing.length > 0) {
        throw new TRPCError({ code: "CONFLICT", message: "This user is already a team member." });
      }

      await db.insert(teamMembers).values({
        teamOwnerId: ctx.user.id,
        userId: target.id,
        role: input.role,
        invitedByUserId: ctx.user.id,
        inviteEmail: input.email,
        inviteStatus: "accepted",
      });

      await logAudit({
        userId: ctx.user.id,
        userName: ctx.user.name || undefined,
        userEmail: ctx.user.email || undefined,
        action: "team.addMember",
        resource: "teamMember",
        details: { email: input.email, role: input.role, targetUserId: target.id },
      });

      return { success: true, memberName: target.name || input.email };
    }),

  // Update member role
  updateRole: protectedProcedure
    .input(
      z.object({
        memberId: z.number(),
        role: z.enum(["admin", "member", "viewer"]),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      await db
        .update(teamMembers)
        .set({ role: input.role })
        .where(
          and(
            eq(teamMembers.id, input.memberId),
            eq(teamMembers.teamOwnerId, ctx.user.id)
          )
        );

      await logAudit({
        userId: ctx.user.id,
        userName: ctx.user.name || undefined,
        userEmail: ctx.user.email || undefined,
        action: "team.updateRole",
        resource: "teamMember",
        resourceId: input.memberId.toString(),
        details: { newRole: input.role },
      });

      return { success: true };
    }),

  // Remove member from team
  removeMember: protectedProcedure
    .input(z.object({ memberId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      // Get member info before deletion for audit
      const member = await db
        .select()
        .from(teamMembers)
        .where(
          and(
            eq(teamMembers.id, input.memberId),
            eq(teamMembers.teamOwnerId, ctx.user.id)
          )
        )
        .limit(1);

      if (member.length === 0) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Team member not found." });
      }

      await db
        .delete(teamMembers)
        .where(
          and(
            eq(teamMembers.id, input.memberId),
            eq(teamMembers.teamOwnerId, ctx.user.id)
          )
        );

      await logAudit({
        userId: ctx.user.id,
        userName: ctx.user.name || undefined,
        userEmail: ctx.user.email || undefined,
        action: "team.removeMember",
        resource: "teamMember",
        resourceId: input.memberId.toString(),
        details: { removedUserId: member[0].userId, email: member[0].inviteEmail },
      });

      return { success: true };
    }),

  // Get team stats
  stats: protectedProcedure.query(async ({ ctx }) => {
    const plan = await getUserPlan(ctx.user.id);
    enforceFeature(plan.planId, "team_management", "Team Management");

    const db = await getDb();
    if (!db) return { totalMembers: 0, maxSeats: MAX_TEAM_SEATS, admins: 0, members: 0, viewers: 0 };

    const counts = await db
      .select({
        role: teamMembers.role,
        count: sql<number>`COUNT(*)`,
      })
      .from(teamMembers)
      .where(eq(teamMembers.teamOwnerId, ctx.user.id))
      .groupBy(teamMembers.role);

    const roleMap: Record<string, number> = {};
    counts.forEach((c) => {
      roleMap[c.role] = c.count;
    });

    const total = Object.values(roleMap).reduce((a, b) => a + b, 0);

    return {
      totalMembers: total,
      maxSeats: MAX_TEAM_SEATS,
      admins: roleMap["admin"] || 0,
      members: roleMap["member"] || 0,
      viewers: roleMap["viewer"] || 0,
    };
  }),
});

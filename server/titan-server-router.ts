import { z } from "zod";
import { router, adminProcedure } from "./_core/trpc";
import { TRPCError } from "@trpc/server";
import { getTitanServerConfig, execSSHCommand } from "./titan-server";

export const titanServerRouter = router({
  /**
   * Check if the Titan Server is configured in environment variables.
   * Only admins can see the full details, regular users just get a boolean.
   */
  getStatus: adminProcedure.query(async ({ ctx }) => {
    const config = getTitanServerConfig();
    const isConfigured = config !== null;
    
    if (ctx.user.role !== "admin" && ctx.user.role !== "head_admin") {
      return { isConfigured };
    }
    
    return {
      isConfigured,
      host: config?.host || null,
      port: config?.port || 22,
      username: config?.username || "root",
      hasPassword: !!config?.password,
      hasKey: !!config?.privateKey,
    };
  }),

  /**
   * Test connection to the Titan Server (Admins only)
   */
  testConnection: adminProcedure.mutation(async ({ ctx }) => {
    if (ctx.user.role !== "admin" && ctx.user.role !== "head_admin") {
      throw new TRPCError({ code: "FORBIDDEN", message: "Admin only" });
    }

    const config = getTitanServerConfig();
    if (!config) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "Titan Server not configured in environment variables" });
    }

    try {
      const output = await execSSHCommand(config, "uname -a && uptime", 10000);
      return { success: true, message: "Connection successful", output };
    } catch (error: any) {
      return { success: false, message: error.message || "Connection failed" };
    }
  }),
});

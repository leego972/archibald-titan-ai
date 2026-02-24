import { NOT_ADMIN_ERR_MSG, UNAUTHED_ERR_MSG } from '@shared/const';
import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import type { TrpcContext } from "./context";
import { createLogger } from "./logger.js";

const log = createLogger("tRPC");
const isProd = process.env.NODE_ENV === "production";

const t = initTRPC.context<TrpcContext>().create({
  transformer: superjson,
  errorFormatter({ shape, error }) {
    // Log the full error server-side for debugging
    if (error.code !== "UNAUTHORIZED" && error.code !== "FORBIDDEN") {
      log.error("tRPC error", {
        code: error.code,
        path: shape.data?.path,
        message: error.message,
        ...(error.cause ? { cause: String(error.cause) } : {}),
      });
    }

    return {
      ...shape,
      data: {
        ...shape.data,
        // Strip stack traces in production to prevent information leakage
        stack: isProd ? undefined : shape.data?.stack,
      },
      // In production, replace internal server error messages with a generic one
      // to prevent leaking implementation details
      message:
        isProd && error.code === "INTERNAL_SERVER_ERROR"
          ? "An internal error occurred. Please try again later."
          : shape.message,
    };
  },
});

export const router = t.router;
export const publicProcedure = t.procedure;

const requireUser = t.middleware(async opts => {
  const { ctx, next } = opts;

  if (!ctx.user) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
  }

  return next({
    ctx: {
      ...ctx,
      user: ctx.user,
    },
  });
});

export const protectedProcedure = t.procedure.use(requireUser);

export const adminProcedure = t.procedure.use(
  t.middleware(async opts => {
    const { ctx, next } = opts;

    if (!ctx.user || ctx.user.role !== 'admin') {
      throw new TRPCError({ code: "FORBIDDEN", message: NOT_ADMIN_ERR_MSG });
    }

    return next({
      ctx: {
        ...ctx,
        user: ctx.user,
      },
    });
  }),
);

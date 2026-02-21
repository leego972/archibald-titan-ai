import { afterAll, describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

afterAll(async () => {
  // Close the DB connection pool so vitest can exit cleanly
  const { getDb } = await import("./db");
  const db = await getDb();
  if (db && typeof (db as any).$client?.end === "function") {
    await (db as any).$client.end();
  }
});

// ─── Helpers ──────────────────────────────────────────────────────────

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createUserContext(role: "user" | "admin" = "user"): TrpcContext {
  const user: AuthenticatedUser = {
    id: 42,
    openId: "test-user-42",
    email: "test@example.com",
    name: "Test User",
    loginMethod: "email",
    role,
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };
  return {
    user,
    req: {
      protocol: "https",
      headers: { origin: "https://test.example.com" },
    } as TrpcContext["req"],
    res: {
      clearCookie: () => {},
      cookie: () => {},
    } as unknown as TrpcContext["res"],
  };
}

function createAdminContext(): TrpcContext {
  return createUserContext("admin");
}

function createUnauthContext(): TrpcContext {
  return {
    user: null,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: () => {},
      cookie: () => {},
    } as unknown as TrpcContext["res"],
  };
}

// ═══════════════════════════════════════════════════════════════════
// Chat Persistence Tests
// ═══════════════════════════════════════════════════════════════════

describe("Chat Persistence — Conversations", () => {
  it("should reject unauthenticated users from listing conversations", async () => {
    const ctx = createUnauthContext();
    const caller = appRouter.createCaller(ctx);
    await expect(caller.chat.listConversations({})).rejects.toThrow();
  });

  it("should allow authenticated users to list conversations", async () => {
    const ctx = createUserContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.chat.listConversations({});
    expect(result).toHaveProperty("conversations");
    expect(result).toHaveProperty("total");
    expect(Array.isArray(result.conversations)).toBe(true);
    expect(typeof result.total).toBe("number");
  });

  it("should allow creating a new conversation", async () => {
    const ctx = createUserContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.chat.createConversation({
      title: "Test Conversation",
    });
    expect(result).toHaveProperty("id");
    expect(typeof result.id).toBe("number");
  });

  it("should allow listing conversations with search filter", async () => {
    const ctx = createUserContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.chat.listConversations({
      search: "nonexistent-query-xyz",
    });
    expect(result).toHaveProperty("conversations");
    expect(Array.isArray(result.conversations)).toBe(true);
  });

  it("should allow listing conversations with limit and offset", async () => {
    const ctx = createUserContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.chat.listConversations({
      limit: 5,
      offset: 0,
    });
    expect(result).toHaveProperty("conversations");
    expect(result.conversations.length).toBeLessThanOrEqual(5);
  });

  it("should handle renaming a non-existent conversation gracefully", async () => {
    const ctx = createUserContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.chat.renameConversation({
      conversationId: 999999,
      title: "New Title",
    });
    expect(result).toHaveProperty("success", true);
  });

  it("should handle deleting a non-existent conversation gracefully", async () => {
    const ctx = createUserContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.chat.deleteConversation({ conversationId: 999999 });
    expect(result).toHaveProperty("success", true);
  });

  it("should handle pinning a non-existent conversation gracefully", async () => {
    const ctx = createUserContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.chat.pinConversation({ conversationId: 999999, pinned: true });
    expect(result).toHaveProperty("success", true);
  });

  it("should handle archiving a non-existent conversation gracefully", async () => {
    const ctx = createUserContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.chat.archiveConversation({
      conversationId: 999999,
      archived: true,
    });
    expect(result).toHaveProperty("success", true);
  });
});

describe("Chat Persistence — Messages", () => {
  it("should reject getting messages for a non-existent conversation", async () => {
    const ctx = createUserContext();
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.chat.getConversation({ conversationId: 999999 })
    ).rejects.toThrow();
  });

  it("should reject unauthenticated users from sending messages", async () => {
    const ctx = createUnauthContext();
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.chat.send({ message: "Hello", conversationId: null })
    ).rejects.toThrow();
  });
});

describe("Chat Persistence — Quick Actions", () => {
  it("should return quick actions for authenticated users", async () => {
    const ctx = createUserContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.chat.quickActions();
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBeGreaterThan(0);
    expect(result[0]).toHaveProperty("id");
    expect(result[0]).toHaveProperty("label");
    expect(result[0]).toHaveProperty("prompt");
    expect(result[0]).toHaveProperty("icon");
  });

  it("should include expected quick action IDs", async () => {
    const ctx = createUserContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.chat.quickActions();
    const ids = result.map((a: { id: string }) => a.id);
    expect(ids).toContain("status");
    expect(ids).toContain("credentials");
    expect(ids).toContain("scan");
  });
});

// ═══════════════════════════════════════════════════════════════════
// Self-Improvement Dashboard Tests
// ═══════════════════════════════════════════════════════════════════

describe("Self-Improvement Dashboard — Admin Gating", () => {
  it("should reject non-admin users from overview", async () => {
    const ctx = createUserContext("user");
    const caller = appRouter.createCaller(ctx);
    await expect(caller.selfImprovement.overview()).rejects.toThrow();
  });

  it("should reject non-admin users from listSnapshots", async () => {
    const ctx = createUserContext("user");
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.selfImprovement.listSnapshots({ limit: 10, offset: 0 })
    ).rejects.toThrow();
  });

  it("should reject non-admin users from listModifications", async () => {
    const ctx = createUserContext("user");
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.selfImprovement.listModifications({ limit: 10, offset: 0 })
    ).rejects.toThrow();
  });

  it("should reject non-admin users from healthCheck", async () => {
    const ctx = createUserContext("user");
    const caller = appRouter.createCaller(ctx);
    await expect(caller.selfImprovement.healthCheck()).rejects.toThrow();
  });

  it("should reject non-admin users from safetyConfig", async () => {
    const ctx = createUserContext("user");
    const caller = appRouter.createCaller(ctx);
    await expect(caller.selfImprovement.safetyConfig()).rejects.toThrow();
  });

  it("should reject non-admin users from rollbackToLastGood", async () => {
    const ctx = createUserContext("user");
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.selfImprovement.rollbackToLastGood()
    ).rejects.toThrow();
  });

  it("should reject non-admin users from activityTimeline", async () => {
    const ctx = createUserContext("user");
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.selfImprovement.activityTimeline({ limit: 10 })
    ).rejects.toThrow();
  });

  it("should reject non-admin users from createManualSnapshot", async () => {
    const ctx = createUserContext("user");
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.selfImprovement.createManualSnapshot({
        reason: "test",
        filePaths: ["server/test.ts"],
      })
    ).rejects.toThrow();
  });

  it("should reject unauthenticated users from overview", async () => {
    const ctx = createUnauthContext();
    const caller = appRouter.createCaller(ctx);
    await expect(caller.selfImprovement.overview()).rejects.toThrow();
  });
});

describe("Self-Improvement Dashboard — Admin Access", () => {
  it("should allow admin to get overview stats", async () => {
    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.selfImprovement.overview();
    expect(result).toHaveProperty("totalSnapshots");
    expect(result).toHaveProperty("activeSnapshots");
    expect(result).toHaveProperty("knownGoodSnapshots");
    expect(result).toHaveProperty("totalModifications");
    expect(result).toHaveProperty("appliedModifications");
    expect(result).toHaveProperty("rolledBackModifications");
    expect(result).toHaveProperty("failedValidations");
    expect(result).toHaveProperty("protectedFileCount");
    expect(result).toHaveProperty("allowedDirectoryCount");
    expect(typeof result.totalSnapshots).toBe("number");
    expect(typeof result.protectedFileCount).toBe("number");
  });

  it("should allow admin to list snapshots", async () => {
    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.selfImprovement.listSnapshots({
      limit: 10,
      offset: 0,
    });
    expect(result).toHaveProperty("snapshots");
    expect(result).toHaveProperty("total");
    expect(Array.isArray(result.snapshots)).toBe(true);
  });

  it("should allow admin to list snapshots with status filter", async () => {
    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.selfImprovement.listSnapshots({
      limit: 10,
      offset: 0,
      status: "active",
    });
    expect(result).toHaveProperty("snapshots");
    expect(Array.isArray(result.snapshots)).toBe(true);
  });

  it("should allow admin to list modifications", async () => {
    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.selfImprovement.listModifications({
      limit: 10,
      offset: 0,
    });
    expect(result).toHaveProperty("modifications");
    expect(result).toHaveProperty("total");
    expect(Array.isArray(result.modifications)).toBe(true);
  });

  it("should allow admin to list modifications with action filter", async () => {
    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.selfImprovement.listModifications({
      limit: 10,
      offset: 0,
      action: "modify_file",
    });
    expect(result).toHaveProperty("modifications");
    expect(Array.isArray(result.modifications)).toBe(true);
  });

  it("should allow admin to run health check", async () => {
    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.selfImprovement.healthCheck();
    expect(result).toHaveProperty("healthy");
    expect(result).toHaveProperty("checks");
    expect(typeof result.healthy).toBe("boolean");
    expect(Array.isArray(result.checks)).toBe(true);
    // Each check should have name and passed
    if (result.checks.length > 0) {
      expect(result.checks[0]).toHaveProperty("name");
      expect(result.checks[0]).toHaveProperty("passed");
    }
  });

  it("should allow admin to get safety config", async () => {
    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.selfImprovement.safetyConfig();
    expect(result).toHaveProperty("protectedFiles");
    expect(result).toHaveProperty("allowedDirectories");
    expect(Array.isArray(result.protectedFiles)).toBe(true);
    expect(Array.isArray(result.allowedDirectories)).toBe(true);
    expect(result.protectedFiles.length).toBeGreaterThan(0);
    expect(result.allowedDirectories.length).toBeGreaterThan(0);
  });

  it("should allow admin to get activity timeline", async () => {
    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.selfImprovement.activityTimeline({
      limit: 10,
    });
    expect(result).toHaveProperty("events");
    expect(Array.isArray(result.events)).toBe(true);
  });

  it("should reject getting a non-existent snapshot", async () => {
    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.selfImprovement.getSnapshot({ snapshotId: 999999 })
    ).rejects.toThrow();
  });
});

// ═══════════════════════════════════════════════════════════════════
// Chat Tools Definition Tests
// ═══════════════════════════════════════════════════════════════════

describe("Chat Tools Definitions", () => {
  it("should export TITAN_TOOLS array", async () => {
    const { TITAN_TOOLS } = await import("./chat-tools");
    expect(Array.isArray(TITAN_TOOLS)).toBe(true);
    expect(TITAN_TOOLS.length).toBeGreaterThan(30);
  });

  it("every tool should have type, function.name, and function.description", async () => {
    const { TITAN_TOOLS } = await import("./chat-tools");
    for (const tool of TITAN_TOOLS) {
      expect(tool).toHaveProperty("type", "function");
      expect(tool).toHaveProperty("function");
      expect(tool.function).toHaveProperty("name");
      expect(tool.function).toHaveProperty("description");
      expect(typeof tool.function.name).toBe("string");
      expect(typeof tool.function.description).toBe("string");
      expect(tool.function.name.length).toBeGreaterThan(0);
    }
  });

  it("every tool should have valid parameters schema", async () => {
    const { TITAN_TOOLS } = await import("./chat-tools");
    for (const tool of TITAN_TOOLS) {
      expect(tool.function).toHaveProperty("parameters");
      expect(tool.function.parameters).toHaveProperty("type", "object");
      expect(tool.function.parameters).toHaveProperty("properties");
    }
  });

  it("tool names should be unique", async () => {
    const { TITAN_TOOLS } = await import("./chat-tools");
    const names = TITAN_TOOLS.map((t: any) => t.function.name);
    const uniqueNames = new Set(names);
    expect(uniqueNames.size).toBe(names.length);
  });

  it("should include self-improvement tools", async () => {
    const { TITAN_TOOLS } = await import("./chat-tools");
    const names = TITAN_TOOLS.map((t: any) => t.function.name);
    expect(names).toContain("self_read_file");
    expect(names).toContain("self_list_files");
    expect(names).toContain("self_modify_file");
    expect(names).toContain("self_health_check");
    expect(names).toContain("self_rollback");
    expect(names).toContain("self_restart");
    expect(names).toContain("self_modification_history");
    expect(names).toContain("self_get_protected_files");
  });

  it("should include core action tools", async () => {
    const { TITAN_TOOLS } = await import("./chat-tools");
    const names = TITAN_TOOLS.map((t: any) => t.function.name);
    expect(names).toContain("list_credentials");
    expect(names).toContain("create_fetch_job");
    expect(names).toContain("list_api_keys");
    expect(names).toContain("start_leak_scan");
    expect(names).toContain("get_system_status");
  });
});

// ═══════════════════════════════════════════════════════════════════
// Chat Executor Tests
// ═══════════════════════════════════════════════════════════════════

describe("Chat Executor", () => {
  it("should export executeToolCall function", async () => {
    const { executeToolCall } = await import("./chat-executor");
    expect(typeof executeToolCall).toBe("function");
  });

  it("should handle unknown tool names gracefully", async () => {
    const { executeToolCall } = await import("./chat-executor");
    const result = await executeToolCall(
      "nonexistent_tool",
      {},
      42,
      "Test User",
      "test@example.com"
    );
    expect(result).toHaveProperty("success", false);
    expect(result).toHaveProperty("error");
  });

  it("should execute list_providers successfully", async () => {
    const { executeToolCall } = await import("./chat-executor");
    const result = await executeToolCall(
      "list_providers",
      {},
      42,
      "Test User",
      "test@example.com"
    );
    expect(result).toHaveProperty("success", true);
    expect(result).toHaveProperty("data");
    expect(result.data).toHaveProperty("providers");
    expect(Array.isArray(result.data.providers)).toBe(true);
  });

  it("should execute get_system_status successfully", async () => {
    const { executeToolCall } = await import("./chat-executor");
    const result = await executeToolCall(
      "get_system_status",
      {},
      42,
      "Test User",
      "test@example.com"
    );
    expect(result).toHaveProperty("success", true);
    expect(result).toHaveProperty("data");
  });

  it("should execute self_get_protected_files successfully", async () => {
    const { executeToolCall } = await import("./chat-executor");
    const result = await executeToolCall(
      "self_get_protected_files",
      {},
      42,
      "Test User",
      "test@example.com"
    );
    expect(result).toHaveProperty("success", true);
    expect(result).toHaveProperty("data");
    expect(result.data).toHaveProperty("protectedFiles");
    expect(Array.isArray(result.data.protectedFiles)).toBe(true);
  });

  it("should execute self_health_check successfully", async () => {
    const { executeToolCall } = await import("./chat-executor");
    const result = await executeToolCall(
      "self_health_check",
      {},
      42,
      "Test User",
      "test@example.com"
    );
    expect(result).toHaveProperty("success", true);
    expect(result).toHaveProperty("data");
    expect(result.data).toHaveProperty("healthy");
    expect(result.data).toHaveProperty("checks");
  });
});

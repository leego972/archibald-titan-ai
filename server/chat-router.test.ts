import { describe, expect, it, vi, beforeEach } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createAuthContext(): TrpcContext {
  const user: AuthenticatedUser = {
    id: 42,
    openId: "test-chat-user",
    email: "chat@example.com",
    name: "Chat Tester",
    loginMethod: "manus",
    role: "user",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };

  return {
    user,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: () => {},
    } as TrpcContext["res"],
  };
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
    } as TrpcContext["res"],
  };
}

describe("chat router", () => {
  it("returns quick actions for authenticated users", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const actions = await caller.chat.quickActions();
    expect(Array.isArray(actions)).toBe(true);
    expect(actions.length).toBeGreaterThan(0);

    for (const action of actions) {
      expect(action).toHaveProperty("id");
      expect(action).toHaveProperty("label");
      expect(action).toHaveProperty("prompt");
      expect(action).toHaveProperty("icon");
      expect(typeof action.id).toBe("string");
      expect(typeof action.label).toBe("string");
      expect(typeof action.prompt).toBe("string");
    }
  });

  it("lists conversations for authenticated users", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.chat.listConversations();
    expect(result).toHaveProperty("conversations");
    expect(result).toHaveProperty("total");
    expect(Array.isArray(result.conversations)).toBe(true);
  });

  it("creates a new conversation", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const conv = await caller.chat.createConversation({ title: "Test Chat" });
    expect(conv).toHaveProperty("id");
    expect(conv.title).toBe("Test Chat");
    expect(conv.userId).toBe(42);
  });

  it("creates conversation with default title", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const conv = await caller.chat.createConversation();
    expect(conv).toHaveProperty("id");
    expect(conv.title).toBe("New Conversation");
  });

  it("renames a conversation", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const conv = await caller.chat.createConversation({ title: "Old Title" });
    const result = await caller.chat.renameConversation({
      conversationId: conv.id,
      title: "New Title",
    });
    expect(result).toEqual({ success: true });
  });

  it("pins and unpins a conversation", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const conv = await caller.chat.createConversation({ title: "Pin Test" });
    const pinResult = await caller.chat.pinConversation({
      conversationId: conv.id,
      pinned: true,
    });
    expect(pinResult).toEqual({ success: true });

    const unpinResult = await caller.chat.pinConversation({
      conversationId: conv.id,
      pinned: false,
    });
    expect(unpinResult).toEqual({ success: true });
  });

  it("archives a conversation", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const conv = await caller.chat.createConversation({ title: "Archive Test" });
    const result = await caller.chat.archiveConversation({
      conversationId: conv.id,
      archived: true,
    });
    expect(result).toEqual({ success: true });
  });

  it("deletes a conversation", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const conv = await caller.chat.createConversation({ title: "Delete Me" });
    const result = await caller.chat.deleteConversation({
      conversationId: conv.id,
    });
    expect(result).toEqual({ success: true });
  });

  it("gets conversation with messages", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const conv = await caller.chat.createConversation({ title: "Messages Test" });
    const detail = await caller.chat.getConversation({
      conversationId: conv.id,
    });
    expect(detail).toHaveProperty("conversation");
    expect(detail).toHaveProperty("messages");
    expect(detail.conversation.id).toBe(conv.id);
    expect(Array.isArray(detail.messages)).toBe(true);
  });

  it("rejects unauthenticated access to chat.send", async () => {
    const ctx = createUnauthContext();
    const caller = appRouter.createCaller(ctx);

    await expect(caller.chat.send({ message: "hello" })).rejects.toThrow();
  });

  it("rejects unauthenticated access to chat.listConversations", async () => {
    const ctx = createUnauthContext();
    const caller = appRouter.createCaller(ctx);

    await expect(caller.chat.listConversations()).rejects.toThrow();
  });

  it("rejects unauthenticated access to chat.quickActions", async () => {
    const ctx = createUnauthContext();
    const caller = appRouter.createCaller(ctx);

    await expect(caller.chat.quickActions()).rejects.toThrow();
  });

  it("rejects empty messages", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    await expect(caller.chat.send({ message: "" })).rejects.toThrow();
  });

  it("rejects messages over 4000 characters", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const longMessage = "a".repeat(4001);
    await expect(caller.chat.send({ message: longMessage })).rejects.toThrow();
  });

  it("has specific quick action IDs", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const actions = await caller.chat.quickActions();
    const ids = actions.map((a) => a.id);

    expect(ids).toContain("status");
    expect(ids).toContain("credentials");
    expect(ids).toContain("scan");
    expect(ids).toContain("troubleshoot");
    expect(ids).toContain("general");
  });
});

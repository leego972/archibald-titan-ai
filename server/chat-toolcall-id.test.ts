/**
 * Tests for tool_call ID sanitization in chat-router.
 * 
 * The LLM API (Anthropic/Vertex proxy) requires tool_use IDs to match
 * the pattern ^[a-zA-Z0-9_-]+$. Some providers (Gemini) generate IDs
 * with colons, dots, or other special characters that break this.
 */
import { describe, it, expect } from "vitest";

// Replicate the sanitizeToolCallId function from chat-router.ts
// (it's not exported, so we test the logic directly)
function sanitizeToolCallId(id: string): string {
  if (!id) return `tc_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const sanitized = id.replace(/[^a-zA-Z0-9_-]/g, '_');
  return sanitized || `tc_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

const VALID_PATTERN = /^[a-zA-Z0-9_-]+$/;

describe("sanitizeToolCallId", () => {
  it("passes through already-valid IDs unchanged", () => {
    expect(sanitizeToolCallId("call_abc123")).toBe("call_abc123");
    expect(sanitizeToolCallId("toolu_01ABC-xyz")).toBe("toolu_01ABC-xyz");
    expect(sanitizeToolCallId("simple")).toBe("simple");
  });

  it("replaces colons with underscores (Gemini format)", () => {
    const result = sanitizeToolCallId("call:abc:123:def");
    expect(result).toMatch(VALID_PATTERN);
    expect(result).toBe("call_abc_123_def");
  });

  it("replaces dots with underscores", () => {
    const result = sanitizeToolCallId("call.abc.123");
    expect(result).toMatch(VALID_PATTERN);
    expect(result).toBe("call_abc_123");
  });

  it("replaces spaces and special characters", () => {
    const result = sanitizeToolCallId("call abc!@#$%^&*()");
    expect(result).toMatch(VALID_PATTERN);
  });

  it("handles mixed invalid characters", () => {
    const result = sanitizeToolCallId("gemini:call.123/tool:run");
    expect(result).toMatch(VALID_PATTERN);
    expect(result).toBe("gemini_call_123_tool_run");
  });

  it("generates a fallback for empty strings", () => {
    const result = sanitizeToolCallId("");
    expect(result).toMatch(VALID_PATTERN);
    expect(result.startsWith("tc_")).toBe(true);
  });

  it("generates a fallback for null/undefined (cast to string)", () => {
    const result = sanitizeToolCallId(null as any);
    expect(result).toMatch(VALID_PATTERN);
    expect(result.startsWith("tc_")).toBe(true);
  });

  it("preserves hyphens and underscores", () => {
    expect(sanitizeToolCallId("call_abc-def_123")).toBe("call_abc-def_123");
  });

  it("handles very long IDs", () => {
    const longId = "a".repeat(500);
    const result = sanitizeToolCallId(longId);
    expect(result).toMatch(VALID_PATTERN);
    expect(result.length).toBe(500);
  });

  it("handles IDs that are entirely invalid characters", () => {
    const result = sanitizeToolCallId("!@#$%^&*()");
    // All chars replaced with underscores
    expect(result).toMatch(VALID_PATTERN);
  });

  it("real-world Gemini tool call ID format", () => {
    // Gemini sometimes generates IDs like "call_0_self_list_files" or with colons
    const result1 = sanitizeToolCallId("call_0_self_list_files");
    expect(result1).toBe("call_0_self_list_files");
    
    // Or with special separators
    const result2 = sanitizeToolCallId("function:self_modify_file:0");
    expect(result2).toMatch(VALID_PATTERN);
    expect(result2).toBe("function_self_modify_file_0");
  });
});

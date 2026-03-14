/**
 * Titan Memory System — Maximum Memory, Zero Latency
 *
 * Design principles:
 * - ALL memory operations run AFTER the response is sent (setImmediate / fire-and-forget)
 * - Context loading is the ONLY synchronous memory operation (runs in parallel with other pre-LLM work)
 * - Long-term memory injection is a simple DB read — fast and cached-friendly
 * - Summarization and extraction never block the user
 *
 * Three-layer memory architecture:
 * 1. Context window — last 100 messages loaded per conversation
 * 2. Conversation summarization — messages beyond 100 are compressed into a rolling summary
 *    injected as a system message at the top of context
 * 3. Long-term memory — cross-conversation facts stored in user_memory table,
 *    injected into every system prompt (up to 50 facts, ~2K tokens max)
 */

import { eq, desc, and } from "drizzle-orm";
import { getDb } from "./db";
import { chatConversations, chatMessages, userMemory } from "../drizzle/schema";
import { invokeLLM, type Message } from "./_core/llm";
import { createLogger } from "./_core/logger.js";
import { getErrorMessage } from "./_core/errors.js";

const log = createLogger("TitanMemory");

// ── Constants ──────────────────────────────────────────────────────────────

/**
 * Maximum messages loaded verbatim into LLM context per turn.
 * 100 messages ≈ 40–80K tokens depending on message length.
 * gpt-4.1-mini has a 1M token context window — plenty of headroom.
 * This is loaded in parallel with other pre-LLM work, so it doesn't add latency.
 */
export const MAX_CONTEXT_MESSAGES = 100;

/**
 * When total message count exceeds this, summarize the oldest messages.
 * Summarization runs AFTER the response is sent — zero latency impact.
 */
const SUMMARIZATION_THRESHOLD = 120;

/**
 * How many recent messages to keep verbatim after summarization.
 * The rest become a compressed summary injected as a system message.
 */
const MESSAGES_TO_KEEP_VERBATIM = 80;

/**
 * Maximum long-term memory facts injected per turn.
 * 50 facts × ~20 tokens each ≈ 1,000 tokens — negligible overhead.
 * Loaded in parallel with conversation history — zero added latency.
 */
const MAX_MEMORY_FACTS = 50;

/**
 * Maximum facts extracted per conversation turn.
 * Extraction runs after the response — no latency impact.
 */
const MAX_FACTS_PER_EXTRACTION = 10;

// ── Long-Term Memory: Load ─────────────────────────────────────────────────
// Fast DB read — runs in parallel with conversation loading.
// Returns empty string if no facts exist (no latency penalty).

export async function loadUserMemory(userId: number): Promise<string> {
  try {
    const db = await getDb();
    if (!db) return "";
    const facts = await db
      .select()
      .from(userMemory)
      .where(eq(userMemory.userId, userId))
      .orderBy(desc(userMemory.updatedAt))
      .limit(MAX_MEMORY_FACTS);
    if (facts.length === 0) return "";

    // Group by category for clean injection
    const grouped: Record<string, string[]> = {};
    for (const fact of facts) {
      const cat = fact.category || "general";
      if (!grouped[cat]) grouped[cat] = [];
      grouped[cat].push(fact.fact);
    }

    const lines: string[] = [
      "--- TITAN LONG-TERM MEMORY (persistent facts about this user from previous conversations) ---",
    ];
    for (const [category, items] of Object.entries(grouped)) {
      lines.push(`[${category.toUpperCase()}]`);
      for (const item of items) lines.push(`  • ${item}`);
    }
    lines.push("--- END LONG-TERM MEMORY ---");
    return lines.join("\n");
  } catch (err) {
    log.warn("Failed to load user memory (non-fatal)", { error: getErrorMessage(err) });
    return "";
  }
}

// ── Long-Term Memory: Extract & Save (BACKGROUND — never blocks response) ──

export async function extractAndSaveMemory(
  userId: number,
  conversationMessages: Message[],
  userApiKey?: string
): Promise<void> {
  try {
    // Need at least a few exchanges to extract meaningful facts
    const relevantMessages = conversationMessages.filter(
      m => m.role === "user" || m.role === "assistant"
    );
    if (relevantMessages.length < 3) return;

    const db = await getDb();
    if (!db) return;

    // Build a compact transcript — last 30 messages, truncated for speed
    const transcript = relevantMessages
      .slice(-30)
      .map(m => {
        const content =
          typeof m.content === "string"
            ? m.content
            : Array.isArray(m.content)
            ? m.content
                .filter((p: any) => p.type === "text")
                .map((p: any) => p.text)
                .join(" ")
            : JSON.stringify(m.content);
        return `${m.role.toUpperCase()}: ${content.slice(0, 400)}`;
      })
      .join("\n\n");

    const extractionPrompt = `Extract persistent facts about the user from this conversation. Only extract facts clearly stated or strongly implied.

CONVERSATION:
${transcript}

Categories: preferences | projects | skills | context | goals | constraints | general

Return ONLY a JSON array (max ${MAX_FACTS_PER_EXTRACTION} items), no other text:
[{"fact":"concise fact under 150 chars","category":"category_name"}]

If no meaningful facts, return: []`;

    const result = await invokeLLM({
      messages: [{ role: "user", content: extractionPrompt }],
      model: "fast",
      temperature: 0.1,
      userApiKey,
    });

    const rawContent = result.choices?.[0]?.message?.content || "";
    const text = typeof rawContent === "string" ? rawContent : JSON.stringify(rawContent);
    let facts: Array<{ fact: string; category: string }> = [];
    try {
      const jsonMatch = text.match(/\[[\s\S]*?\]/);
      if (jsonMatch) facts = JSON.parse(jsonMatch[0]);
    } catch {
      return; // Silently skip malformed JSON
    }

    if (!Array.isArray(facts) || facts.length === 0) return;

    // Load existing facts to deduplicate
    const existingFacts = await db
      .select({ fact: userMemory.fact })
      .from(userMemory)
      .where(eq(userMemory.userId, userId));
    const existingSet = new Set(existingFacts.map(f => f.fact.toLowerCase()));

    const validCategories = [
      "preferences",
      "projects",
      "skills",
      "context",
      "goals",
      "constraints",
      "general",
    ];

    let saved = 0;
    for (const { fact, category } of facts) {
      if (!fact || typeof fact !== "string") continue;
      const cleanFact = fact.trim().slice(0, 500);
      if (!cleanFact || existingSet.has(cleanFact.toLowerCase())) continue;
      const cleanCategory = validCategories.includes(category) ? category : "general";
      try {
        await db.insert(userMemory).values({
          userId,
          fact: cleanFact,
          category: cleanCategory,
          confidence: 90,
          source: "auto-extracted",
        });
        existingSet.add(cleanFact.toLowerCase()); // prevent duplicate inserts in same batch
        saved++;
      } catch {
        // Ignore individual insert failures
      }
    }
    if (saved > 0) {
      log.info(`Saved ${saved} new memory facts for user ${userId}`);
    }
  } catch (err) {
    log.warn("Memory extraction failed (non-fatal)", { error: getErrorMessage(err) });
  }
}

// ── Long-Term Memory: Manual Save ─────────────────────────────────────────

export async function saveMemoryFact(
  userId: number,
  fact: string,
  category: string = "general"
): Promise<{ success: boolean; id?: number }> {
  try {
    const db = await getDb();
    if (!db) return { success: false };
    const cleanFact = fact.trim().slice(0, 500);
    if (!cleanFact) return { success: false };
    const result = await db.insert(userMemory).values({
      userId,
      fact: cleanFact,
      category,
      confidence: 100,
      source: "user-provided",
    });
    return { success: true, id: (result as any).insertId };
  } catch (err) {
    log.warn("Failed to save memory fact", { error: getErrorMessage(err) });
    return { success: false };
  }
}

// ── Long-Term Memory: Delete ───────────────────────────────────────────────

export async function deleteMemoryFact(userId: number, factId: number): Promise<boolean> {
  try {
    const db = await getDb();
    if (!db) return false;
    await db
      .delete(userMemory)
      .where(and(eq(userMemory.id, factId), eq(userMemory.userId, userId)));
    return true;
  } catch (err) {
    log.warn("Failed to delete memory fact", { error: getErrorMessage(err) });
    return false;
  }
}

// ── Long-Term Memory: List ─────────────────────────────────────────────────

export async function listMemoryFacts(userId: number): Promise<
  Array<{
    id: number;
    fact: string;
    category: string;
    confidence: number;
    createdAt: Date;
  }>
> {
  try {
    const db = await getDb();
    if (!db) return [];
    return await db
      .select({
        id: userMemory.id,
        fact: userMemory.fact,
        category: userMemory.category,
        confidence: userMemory.confidence,
        createdAt: userMemory.createdAt,
      })
      .from(userMemory)
      .where(eq(userMemory.userId, userId))
      .orderBy(desc(userMemory.updatedAt));
  } catch (err) {
    log.warn("Failed to list memory facts", { error: getErrorMessage(err) });
    return [];
  }
}

// ── Conversation Summarization (BACKGROUND — never blocks response) ────────

export async function maybeCreateConversationSummary(
  conversationId: number,
  userId: number,
  userApiKey?: string
): Promise<void> {
  try {
    const db = await getDb();
    if (!db) return;

    // Count total messages
    const allMessages = await db
      .select({
        id: chatMessages.id,
        role: chatMessages.role,
        content: chatMessages.content,
      })
      .from(chatMessages)
      .where(
        and(
          eq(chatMessages.conversationId, conversationId),
          eq(chatMessages.userId, userId)
        )
      )
      .orderBy(chatMessages.id);

    if (allMessages.length < SUMMARIZATION_THRESHOLD) return;

    // Get current summary state
    const convRows = await db
      .select({
        contextSummary: chatConversations.contextSummary,
        summarizedUpToId: chatConversations.summarizedUpToId,
      })
      .from(chatConversations)
      .where(eq(chatConversations.id, conversationId))
      .limit(1);

    const conv = convRows[0];
    const lastSummarizedId = conv?.summarizedUpToId ?? 0;

    // Only summarize messages older than what we keep verbatim
    const cutoffIndex = allMessages.length - MESSAGES_TO_KEEP_VERBATIM;
    if (cutoffIndex <= 0) return;

    const messagesToSummarize = allMessages
      .slice(0, cutoffIndex)
      .filter(m => m.id > lastSummarizedId);

    // Need at least 15 new messages to bother re-summarizing
    if (messagesToSummarize.length < 15) return;

    const existingSummary = conv?.contextSummary || "";
    const transcript = messagesToSummarize
      .filter(m => m.role === "user" || m.role === "assistant")
      .map(m => `${m.role.toUpperCase()}: ${m.content.slice(0, 600)}`)
      .join("\n\n");

    const summaryPrompt = `Summarize this conversation for context compression. Be specific about technical details.

${existingSummary ? `PREVIOUS SUMMARY (older messages):\n${existingSummary}\n\n` : ""}MESSAGES TO SUMMARIZE:
${transcript}

Write a concise summary covering:
1. What the user was building/doing
2. Decisions made and why
3. Files created (names + purpose)
4. Tech stack and architecture
5. Unresolved issues or next steps

3rd person, past tense. Max 500 words. Be specific — file names, tech choices, exact errors matter.`;

    const result = await invokeLLM({
      messages: [{ role: "user", content: summaryPrompt }],
      model: "fast",
      temperature: 0.2,
      userApiKey,
    });

    const rawSummary = result.choices?.[0]?.message?.content || "";
    const summary = (typeof rawSummary === "string" ? rawSummary : "").trim();
    if (!summary) return;

    const lastMsg = messagesToSummarize[messagesToSummarize.length - 1];
    await db
      .update(chatConversations)
      .set({ contextSummary: summary, summarizedUpToId: lastMsg.id })
      .where(eq(chatConversations.id, conversationId));

    log.info(
      `Summarized ${messagesToSummarize.length} messages for conversation ${conversationId}`
    );
  } catch (err) {
    log.warn("Conversation summarization failed (non-fatal)", { error: getErrorMessage(err) });
  }
}

// ── Enhanced Context Loading ───────────────────────────────────────────────
// This is the ONLY synchronous memory operation — runs in parallel with
// other pre-LLM work (API key lookup, user context). No added latency.

export async function loadConversationContextWithMemory(
  conversationId: number,
  userId: number
): Promise<{ messages: Message[]; hasSummary: boolean }> {
  const db = await getDb();
  if (!db) return { messages: [], hasSummary: false };

  // Load conversation summary and recent messages in parallel
  const [convRows, rows] = await Promise.all([
    db
      .select({
        contextSummary: chatConversations.contextSummary,
        summarizedUpToId: chatConversations.summarizedUpToId,
      })
      .from(chatConversations)
      .where(eq(chatConversations.id, conversationId))
      .limit(1),
    db
      .select()
      .from(chatMessages)
      .where(
        and(
          eq(chatMessages.conversationId, conversationId),
          eq(chatMessages.userId, userId)
        )
      )
      .orderBy(desc(chatMessages.id))
      .limit(MAX_CONTEXT_MESSAGES),
  ]);

  const conv = convRows[0];
  rows.reverse(); // chronological order

  const messages: Message[] = [];

  // Prepend rolling summary as a system message if it exists
  if (conv?.contextSummary) {
    messages.push({
      role: "system",
      content: `[EARLIER CONVERSATION SUMMARY — messages before this point have been compressed]\n\n${conv.contextSummary}\n\n[END SUMMARY — recent messages follow below]`,
    });
  }

  for (const row of rows) {
    if (row.role === "tool") continue;

    // Inject file manifest for assistant messages with tool calls
    if (
      row.role === "assistant" &&
      row.toolCalls &&
      Array.isArray(row.toolCalls) &&
      (row.toolCalls as any[]).length > 0
    ) {
      const toolCalls = row.toolCalls as Array<{
        name: string;
        args: Record<string, unknown>;
        result: unknown;
      }>;
      const fileCreations = toolCalls.filter(
        tc => tc.name === "create_file" || tc.name === "sandbox_write_file"
      );
      if (fileCreations.length > 0) {
        const fileList = fileCreations
          .map(tc => {
            const path =
              (tc.args as any)?.path || (tc.args as any)?.filePath || "unknown";
            const success = (tc.result as any)?.success !== false;
            return `  - ${path} ${success ? "✓" : "✗"}`;
          })
          .join("\n");
        messages.push({
          role: "assistant",
          content:
            (row.content || "") + `\n\n[Files created in this turn:\n${fileList}\n]`,
        });
        continue;
      }
    }

    // Handle vision content for user messages with images
    if (row.role === "user" && row.content.includes("[Attached image:")) {
      const imageRegex = /\[Attached image:[^\]]*\]\((https?:\/\/[^)]+)\)/g;
      const imageUrls: string[] = [];
      let m;
      while ((m = imageRegex.exec(row.content)) !== null) imageUrls.push(m[1]);
      if (imageUrls.length > 0) {
        const cleanText = row.content
          .replace(/\[Attached image:[^\]]*\]\(https?:\/\/[^)]+\)\n?/g, "")
          .replace(
            /\n*I have attached image\(s\) above\. Please analyze them using the read_uploaded_file tool\.\n?/g,
            ""
          )
          .trim();
        const parts: any[] = [];
        if (cleanText) parts.push({ type: "text", text: cleanText });
        for (const url of imageUrls)
          parts.push({ type: "image_url", image_url: { url, detail: "auto" } });
        messages.push({ role: "user", content: parts });
        continue;
      }
    }

    messages.push({
      role: row.role as "user" | "assistant" | "system",
      content: row.content,
    });
  }

  return { messages, hasSummary: !!conv?.contextSummary };
}

import { describe, it, expect, beforeAll } from "vitest";
import { getDb } from "./db";
import {
  credentialWatches,
  credentialHistory,
  bulkSyncJobs,
  fetcherCredentials,
} from "../drizzle/schema";
import { eq, and } from "drizzle-orm";

// Use a test user ID that won't conflict with real data
const TEST_USER_ID = 99900;
const TEST_CREDENTIAL_ID = 99900;

describe("V2.0 Feature: Credential Expiry Watchdog", () => {
  beforeAll(async () => {
    const db = await getDb();
    if (!db) throw new Error("Database unavailable");
    // Clean up any previous test data
    await db.delete(credentialWatches).where(eq(credentialWatches.userId, TEST_USER_ID));
  });

  it("should create a credential watch", async () => {
    const db = await getDb();
    if (!db) throw new Error("Database unavailable");

    const futureDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days from now
    const result = await db.insert(credentialWatches).values({
      userId: TEST_USER_ID,
      credentialId: TEST_CREDENTIAL_ID,
      expiresAt: futureDate,
      alertDaysBefore: 7,
    });

    expect(Number(result[0].insertId)).toBeGreaterThan(0);
  });

  it("should list watches for a user", async () => {
    const db = await getDb();
    if (!db) throw new Error("Database unavailable");

    const watches = await db
      .select()
      .from(credentialWatches)
      .where(eq(credentialWatches.userId, TEST_USER_ID));

    expect(watches.length).toBeGreaterThanOrEqual(1);
    expect(watches[0].credentialId).toBe(TEST_CREDENTIAL_ID);
    expect(watches[0].alertDaysBefore).toBe(7);
    expect(watches[0].status).toBe("active");
  });

  it("should dismiss a watch", async () => {
    const db = await getDb();
    if (!db) throw new Error("Database unavailable");

    const watches = await db
      .select()
      .from(credentialWatches)
      .where(eq(credentialWatches.userId, TEST_USER_ID));

    await db
      .update(credentialWatches)
      .set({ status: "dismissed" })
      .where(eq(credentialWatches.id, watches[0].id));

    const updated = await db
      .select()
      .from(credentialWatches)
      .where(eq(credentialWatches.id, watches[0].id));

    expect(updated[0].status).toBe("dismissed");
  });

  it("should delete a watch", async () => {
    const db = await getDb();
    if (!db) throw new Error("Database unavailable");

    await db.delete(credentialWatches).where(eq(credentialWatches.userId, TEST_USER_ID));

    const remaining = await db
      .select()
      .from(credentialWatches)
      .where(eq(credentialWatches.userId, TEST_USER_ID));

    expect(remaining.length).toBe(0);
  });
});

describe("V2.0 Feature: Bulk Provider Sync", () => {
  beforeAll(async () => {
    const db = await getDb();
    if (!db) throw new Error("Database unavailable");
    await db.delete(bulkSyncJobs).where(eq(bulkSyncJobs.userId, TEST_USER_ID));
  });

  it("should create a bulk sync job", async () => {
    const db = await getDb();
    if (!db) throw new Error("Database unavailable");

    const result = await db.insert(bulkSyncJobs).values({
      userId: TEST_USER_ID,
      totalProviders: 5,
      status: "queued",
      triggeredBy: "manual",
      linkedJobIds: [],
    });

    expect(Number(result[0].insertId)).toBeGreaterThan(0);
  });

  it("should list sync jobs for a user", async () => {
    const db = await getDb();
    if (!db) throw new Error("Database unavailable");

    const jobs = await db
      .select()
      .from(bulkSyncJobs)
      .where(eq(bulkSyncJobs.userId, TEST_USER_ID));

    expect(jobs.length).toBeGreaterThanOrEqual(1);
    expect(jobs[0].totalProviders).toBe(5);
    expect(jobs[0].status).toBe("queued");
    expect(jobs[0].triggeredBy).toBe("manual");
  });

  it("should update sync job status", async () => {
    const db = await getDb();
    if (!db) throw new Error("Database unavailable");

    const jobs = await db
      .select()
      .from(bulkSyncJobs)
      .where(eq(bulkSyncJobs.userId, TEST_USER_ID));

    await db
      .update(bulkSyncJobs)
      .set({
        status: "running",
        completedProviders: 2,
        startedAt: new Date(),
      })
      .where(eq(bulkSyncJobs.id, jobs[0].id));

    const updated = await db
      .select()
      .from(bulkSyncJobs)
      .where(eq(bulkSyncJobs.id, jobs[0].id));

    expect(updated[0].status).toBe("running");
    expect(updated[0].completedProviders).toBe(2);
  });

  it("should cancel a sync job", async () => {
    const db = await getDb();
    if (!db) throw new Error("Database unavailable");

    const jobs = await db
      .select()
      .from(bulkSyncJobs)
      .where(eq(bulkSyncJobs.userId, TEST_USER_ID));

    await db
      .update(bulkSyncJobs)
      .set({ status: "cancelled" })
      .where(eq(bulkSyncJobs.id, jobs[0].id));

    const updated = await db
      .select()
      .from(bulkSyncJobs)
      .where(eq(bulkSyncJobs.id, jobs[0].id));

    expect(updated[0].status).toBe("cancelled");
  });

  it("should clean up test data", async () => {
    const db = await getDb();
    if (!db) throw new Error("Database unavailable");

    await db.delete(bulkSyncJobs).where(eq(bulkSyncJobs.userId, TEST_USER_ID));

    const remaining = await db
      .select()
      .from(bulkSyncJobs)
      .where(eq(bulkSyncJobs.userId, TEST_USER_ID));

    expect(remaining.length).toBe(0);
  });
});

describe("V2.0 Feature: Credential Diff & History", () => {
  beforeAll(async () => {
    const db = await getDb();
    if (!db) throw new Error("Database unavailable");
    await db.delete(credentialHistory).where(eq(credentialHistory.userId, TEST_USER_ID));
  });

  it("should create a history entry", async () => {
    const db = await getDb();
    if (!db) throw new Error("Database unavailable");

    const result = await db.insert(credentialHistory).values({
      credentialId: TEST_CREDENTIAL_ID,
      userId: TEST_USER_ID,
      providerId: "aws",
      keyType: "api_key",
      encryptedValue: "encrypted_test_value_v1",
      changeType: "created",
      snapshotNote: "Initial credential creation",
    });

    expect(Number(result[0].insertId)).toBeGreaterThan(0);
  });

  it("should create a rotated entry", async () => {
    const db = await getDb();
    if (!db) throw new Error("Database unavailable");

    const result = await db.insert(credentialHistory).values({
      credentialId: TEST_CREDENTIAL_ID,
      userId: TEST_USER_ID,
      providerId: "aws",
      keyType: "api_key",
      encryptedValue: "encrypted_test_value_v2",
      changeType: "rotated",
      snapshotNote: "Key rotated after 90 days",
    });

    expect(Number(result[0].insertId)).toBeGreaterThan(0);
  });

  it("should list history for a credential", async () => {
    const db = await getDb();
    if (!db) throw new Error("Database unavailable");

    const history = await db
      .select()
      .from(credentialHistory)
      .where(
        and(
          eq(credentialHistory.credentialId, TEST_CREDENTIAL_ID),
          eq(credentialHistory.userId, TEST_USER_ID)
        )
      );

    expect(history.length).toBe(2);
    // Should have both created and rotated entries
    const changeTypes = history.map((h) => h.changeType);
    expect(changeTypes).toContain("created");
    expect(changeTypes).toContain("rotated");
  });

  it("should create a rollback entry", async () => {
    const db = await getDb();
    if (!db) throw new Error("Database unavailable");

    const result = await db.insert(credentialHistory).values({
      credentialId: TEST_CREDENTIAL_ID,
      userId: TEST_USER_ID,
      providerId: "aws",
      keyType: "api_key",
      encryptedValue: "encrypted_test_value_v1",
      changeType: "rollback",
      snapshotNote: "Rolled back to v1",
    });

    expect(Number(result[0].insertId)).toBeGreaterThan(0);

    const history = await db
      .select()
      .from(credentialHistory)
      .where(
        and(
          eq(credentialHistory.credentialId, TEST_CREDENTIAL_ID),
          eq(credentialHistory.userId, TEST_USER_ID)
        )
      );

    expect(history.length).toBe(3);
  });

  it("should create a manual_update entry with note", async () => {
    const db = await getDb();
    if (!db) throw new Error("Database unavailable");

    const result = await db.insert(credentialHistory).values({
      credentialId: TEST_CREDENTIAL_ID,
      userId: TEST_USER_ID,
      providerId: "aws",
      keyType: "api_key",
      encryptedValue: "encrypted_test_value_v3",
      changeType: "manual_update",
      snapshotNote: "Manual snapshot before security audit",
    });

    expect(Number(result[0].insertId)).toBeGreaterThan(0);
  });

  it("should clean up test data", async () => {
    const db = await getDb();
    if (!db) throw new Error("Database unavailable");

    await db.delete(credentialHistory).where(eq(credentialHistory.userId, TEST_USER_ID));

    const remaining = await db
      .select()
      .from(credentialHistory)
      .where(eq(credentialHistory.userId, TEST_USER_ID));

    expect(remaining.length).toBe(0);
  });
});

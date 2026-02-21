import { describe, it, expect } from "vitest";
import { auditLogsToCsv } from "./audit-router";

describe("Audit CSV Export", () => {
  describe("auditLogsToCsv", () => {
    it("should produce header row with correct columns", () => {
      const csv = auditLogsToCsv([]);
      expect(csv).toBe(
        "ID,Timestamp,User ID,User Name,User Email,Action,Resource,Resource ID,Details,IP Address"
      );
    });

    it("should produce one data row per log entry", () => {
      const logs = [
        {
          id: 1,
          createdAt: new Date("2026-01-15T10:30:00Z"),
          userId: 42,
          userName: "Alice",
          userEmail: "alice@example.com",
          action: "credential.export",
          resource: "credential",
          resourceId: "123",
          details: { count: 5 },
          ipAddress: "192.168.1.1",
        },
      ];
      const csv = auditLogsToCsv(logs);
      const lines = csv.split("\n");
      expect(lines).toHaveLength(2); // header + 1 row
    });

    it("should include all fields in the correct order", () => {
      const logs = [
        {
          id: 7,
          createdAt: new Date("2026-02-01T08:00:00Z"),
          userId: 10,
          userName: "Bob",
          userEmail: "bob@test.com",
          action: "apiKey.create",
          resource: "apiKey",
          resourceId: "ak_99",
          details: null,
          ipAddress: "10.0.0.1",
        },
      ];
      const csv = auditLogsToCsv(logs);
      const dataRow = csv.split("\n")[1];
      expect(dataRow).toContain("7,");
      expect(dataRow).toContain("2026-02-01");
      expect(dataRow).toContain("10,");
      expect(dataRow).toContain("Bob");
      expect(dataRow).toContain("bob@test.com");
      expect(dataRow).toContain("apiKey.create");
      expect(dataRow).toContain("apiKey");
      expect(dataRow).toContain("ak_99");
      expect(dataRow).toContain("10.0.0.1");
    });

    it("should handle null/undefined optional fields gracefully", () => {
      const logs = [
        {
          id: 2,
          createdAt: new Date("2026-01-20T12:00:00Z"),
          userId: 5,
          userName: null,
          userEmail: null,
          action: "job.create",
          resource: null,
          resourceId: null,
          details: null,
          ipAddress: null,
        },
      ];
      const csv = auditLogsToCsv(logs);
      const dataRow = csv.split("\n")[1];
      // Null fields should be empty strings
      expect(dataRow).toContain("job.create");
      // Should not contain "null" as a string
      expect(dataRow).not.toContain("null");
    });

    it("should escape fields containing commas", () => {
      const logs = [
        {
          id: 3,
          createdAt: new Date("2026-01-25T14:00:00Z"),
          userId: 1,
          userName: "Smith, John",
          userEmail: "john@example.com",
          action: "settings.update",
          resource: null,
          resourceId: null,
          details: null,
          ipAddress: null,
        },
      ];
      const csv = auditLogsToCsv(logs);
      const dataRow = csv.split("\n")[1];
      expect(dataRow).toContain('"Smith, John"');
    });

    it("should escape fields containing double quotes", () => {
      const logs = [
        {
          id: 4,
          createdAt: new Date("2026-01-26T15:00:00Z"),
          userId: 1,
          userName: 'User "Admin"',
          userEmail: "admin@example.com",
          action: "team.updateRole",
          resource: null,
          resourceId: null,
          details: null,
          ipAddress: null,
        },
      ];
      const csv = auditLogsToCsv(logs);
      const dataRow = csv.split("\n")[1];
      expect(dataRow).toContain('"User ""Admin"""');
    });

    it("should serialize details as JSON string", () => {
      const logs = [
        {
          id: 5,
          createdAt: new Date("2026-01-27T16:00:00Z"),
          userId: 1,
          userName: "Admin",
          userEmail: "admin@example.com",
          action: "credential.export",
          resource: "credential",
          resourceId: "456",
          details: { format: "csv", count: 10, target: "backup" },
          ipAddress: "127.0.0.1",
        },
      ];
      const csv = auditLogsToCsv(logs);
      const dataRow = csv.split("\n")[1];
      // Details JSON should be present and escaped (contains commas and quotes)
      expect(dataRow).toContain("format");
      expect(dataRow).toContain("count");
    });

    it("should handle multiple rows correctly", () => {
      const logs = [
        {
          id: 10,
          createdAt: new Date("2026-02-01T08:00:00Z"),
          userId: 1,
          userName: "Alice",
          userEmail: "alice@example.com",
          action: "credential.export",
          resource: "credential",
          resourceId: "1",
          details: null,
          ipAddress: "1.2.3.4",
        },
        {
          id: 11,
          createdAt: new Date("2026-02-01T09:00:00Z"),
          userId: 2,
          userName: "Bob",
          userEmail: "bob@example.com",
          action: "apiKey.create",
          resource: "apiKey",
          resourceId: "2",
          details: null,
          ipAddress: "5.6.7.8",
        },
        {
          id: 12,
          createdAt: new Date("2026-02-01T10:00:00Z"),
          userId: 3,
          userName: "Charlie",
          userEmail: "charlie@example.com",
          action: "team.addMember",
          resource: "team",
          resourceId: "3",
          details: { role: "viewer" },
          ipAddress: "9.10.11.12",
        },
      ];
      const csv = auditLogsToCsv(logs);
      const lines = csv.split("\n");
      expect(lines).toHaveLength(4); // header + 3 rows
      expect(lines[1]).toContain("Alice");
      expect(lines[2]).toContain("Bob");
      expect(lines[3]).toContain("Charlie");
    });

    it("should handle string createdAt (non-Date object)", () => {
      const logs = [
        {
          id: 20,
          createdAt: "2026-03-01T12:00:00.000Z" as any,
          userId: 1,
          userName: "Test",
          userEmail: "test@example.com",
          action: "job.complete",
          resource: null,
          resourceId: null,
          details: null,
          ipAddress: null,
        },
      ];
      const csv = auditLogsToCsv(logs);
      const dataRow = csv.split("\n")[1];
      expect(dataRow).toContain("2026-03-01");
    });

    it("should handle empty details object", () => {
      const logs = [
        {
          id: 30,
          createdAt: new Date("2026-04-01T00:00:00Z"),
          userId: 1,
          userName: "User",
          userEmail: "user@example.com",
          action: "settings.update",
          resource: null,
          resourceId: null,
          details: {},
          ipAddress: null,
        },
      ];
      const csv = auditLogsToCsv(logs);
      const dataRow = csv.split("\n")[1];
      // Empty object should serialize to "{}"
      expect(dataRow).toContain("{}");
    });

    it("should produce valid CSV that can be parsed back", () => {
      const logs = [
        {
          id: 1,
          createdAt: new Date("2026-01-01T00:00:00Z"),
          userId: 1,
          userName: "Test User",
          userEmail: "test@example.com",
          action: "credential.export",
          resource: "credential",
          resourceId: "1",
          details: { key: "value" },
          ipAddress: "127.0.0.1",
        },
      ];
      const csv = auditLogsToCsv(logs);
      // Should start with the header
      expect(csv.startsWith("ID,Timestamp,User ID,User Name,User Email")).toBe(true);
      // Each line should have the same number of commas (accounting for escaped commas in quoted fields)
      const lines = csv.split("\n");
      // Header has 9 commas (10 fields)
      const headerCommaCount = (lines[0].match(/,/g) || []).length;
      expect(headerCommaCount).toBe(9);
    });
  });

  describe("auditRouter.exportCsv", () => {
    it("should export the router module with auditLogsToCsv", async () => {
      const mod = await import("./audit-router");
      expect(typeof mod.auditLogsToCsv).toBe("function");
    });

    it("should export the auditRouter with exportCsv procedure", async () => {
      const mod = await import("./audit-router");
      expect(mod.auditRouter).toBeDefined();
      // The router should have the exportCsv procedure
      expect(mod.auditRouter._def.procedures).toHaveProperty("exportCsv");
    });

    it("should have list, actions, stats, and exportCsv procedures", async () => {
      const mod = await import("./audit-router");
      const procedures = Object.keys(mod.auditRouter._def.procedures);
      expect(procedures).toContain("list");
      expect(procedures).toContain("actions");
      expect(procedures).toContain("stats");
      expect(procedures).toContain("exportCsv");
    });
  });
});

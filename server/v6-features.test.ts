/**
 * V6.0 Feature Tests — Builder Activity Feed, CI/CD Badges, Electron Desktop App
 */
import { describe, it, expect } from "vitest";
import { builderActivityLog } from "../drizzle/schema";
import { selfImprovementDashboardRouter } from "./self-improvement-dashboard-router";
import fs from "fs";
import path from "path";

// ─── Schema Tests ───────────────────────────────────────────────────

describe("V6.0: builder_activity_log schema", () => {
  it("should have the table defined", () => {
    expect(builderActivityLog).toBeDefined();
  });

  it("should define the correct table name", () => {
    const tableName = (builderActivityLog as any)[Symbol.for("drizzle:Name")];
    expect(tableName).toBe("builder_activity_log");
  });

  it("should have required columns", () => {
    const cols = (builderActivityLog as any)[Symbol.for("drizzle:Columns")];
    if (cols) {
      const colNames = Object.keys(cols);
      expect(colNames).toContain("id");
      expect(colNames).toContain("userId");
      expect(colNames).toContain("tool");
      expect(colNames).toContain("status");
      expect(colNames).toContain("summary");
      expect(colNames).toContain("durationMs");
      expect(colNames).toContain("details");
      expect(colNames).toContain("createdAt");
    } else {
      expect(builderActivityLog).toBeDefined();
    }
  });
});

// ─── Dashboard Router Tests ─────────────────────────────────────────

describe("V6.0: Self-Improvement Dashboard Router", () => {
  it("should export the router", () => {
    expect(selfImprovementDashboardRouter).toBeDefined();
  });

  it("should have builderActivity procedure", () => {
    const procedures = Object.keys(selfImprovementDashboardRouter);
    expect(procedures).toContain("builderActivity");
  });

  it("should have builderStats procedure", () => {
    const procedures = Object.keys(selfImprovementDashboardRouter);
    expect(procedures).toContain("builderStats");
  });

  it("should have overview procedure", () => {
    const procedures = Object.keys(selfImprovementDashboardRouter);
    expect(procedures).toContain("overview");
  });

  it("should have healthCheck procedure", () => {
    const procedures = Object.keys(selfImprovementDashboardRouter);
    expect(procedures).toContain("healthCheck");
  });
});

// ─── Electron Desktop App Tests ─────────────────────────────────────

describe("V6.0: Electron Desktop App", () => {
  const electronDir = path.join(__dirname, "..", "electron");

  it("should have electron directory", () => {
    expect(fs.existsSync(electronDir)).toBe(true);
  });

  it("should have package.json with correct version", () => {
    const pkg = JSON.parse(fs.readFileSync(path.join(electronDir, "package.json"), "utf-8"));
    expect(pkg.name).toBe("archibald-titan");
    expect(pkg.version).toBe("7.1.0");
    expect(pkg.main).toBe("main.js");
  });

  it("should have main.js with BrowserWindow and Tray", () => {
    const main = fs.readFileSync(path.join(electronDir, "main.js"), "utf-8");
    expect(main).toContain("BrowserWindow");
    expect(main).toContain("Tray");
    expect(main).toContain("createWindow");
    expect(main).toContain("createTray");
  });

  it("should have preload.js with contextBridge", () => {
    const preload = fs.readFileSync(path.join(electronDir, "preload.js"), "utf-8");
    expect(preload).toContain("contextBridge");
    expect(preload).toContain("titanDesktop");
  });

  it("should have splash.html", () => {
    const splash = fs.readFileSync(path.join(electronDir, "splash.html"), "utf-8");
    expect(splash).toContain("Archibald Titan");
  });

  it("should have icon files", () => {
    expect(fs.existsSync(path.join(electronDir, "icon.png"))).toBe(true);
    expect(fs.existsSync(path.join(electronDir, "icon.ico"))).toBe(true);
  });

  it("should have electron-builder config for all platforms", () => {
    const pkg = JSON.parse(fs.readFileSync(path.join(electronDir, "package.json"), "utf-8"));
    expect(pkg.build).toBeDefined();
    expect(pkg.build.appId).toBe("com.archibald.titan");
    expect(pkg.build.linux).toBeDefined();
    expect(pkg.build.win).toBeDefined();
    expect(pkg.build.mac).toBeDefined();
  });

  it("should have build scripts for all platforms", () => {
    const pkg = JSON.parse(fs.readFileSync(path.join(electronDir, "package.json"), "utf-8"));
    expect(pkg.scripts["build:linux"]).toContain("AppImage");
    expect(pkg.scripts["build:win"]).toContain("nsis");
    expect(pkg.scripts["build:mac"]).toContain("zip");
  });

  it("should have security settings in main.js", () => {
    const main = fs.readFileSync(path.join(electronDir, "main.js"), "utf-8");
    expect(main).toContain("contextIsolation: true");
    expect(main).toContain("nodeIntegration: false");
    expect(main).toContain("sandbox: true");
  });

  it("should have single instance lock", () => {
    const main = fs.readFileSync(path.join(electronDir, "main.js"), "utf-8");
    expect(main).toContain("requestSingleInstanceLock");
  });

  it("should have minimize-to-tray behavior", () => {
    const main = fs.readFileSync(path.join(electronDir, "main.js"), "utf-8");
    expect(main).toContain("isQuitting");
    expect(main).toContain("mainWindow.hide()");
  });

  it("should have local-server.js with SQLite and Express", () => {
    const localServer = fs.readFileSync(path.join(electronDir, "local-server.js"), "utf-8");
    expect(localServer).toContain("sql.js");
    expect(localServer).toContain("express");
    expect(localServer).toContain("startServer");
    expect(localServer).toContain("aes-256-gcm");
    expect(localServer).toContain("/api/local/credentials");
  });

  it("should have build.sh script", () => {
    expect(fs.existsSync(path.join(electronDir, "build.sh"))).toBe(true);
  });

  it("should have README.md with build instructions", () => {
    const readme = fs.readFileSync(path.join(electronDir, "README.md"), "utf-8");
    expect(readme).toContain("Build Instructions");
    expect(readme).toContain("sql.js");
  });

  it("should have local-server.js referenced in main.js", () => {
    const main = fs.readFileSync(path.join(electronDir, "main.js"), "utf-8");
    expect(main).toContain("local-server");
    expect(main).toContain("startServer");
  });

  it("should have local-server.js listed in package.json files", () => {
    const pkg = JSON.parse(fs.readFileSync(path.join(electronDir, "package.json"), "utf-8"));
    expect(pkg.build.files).toContain("local-server.js");
    expect(pkg.dependencies["sql.js"]).toBeDefined();
    expect(pkg.dependencies["express"]).toBeDefined();
  });
});

describe("V6.0: Desktop Detection Utility", () => {
  it("should have desktop.ts utility", () => {
    const desktopPath = path.join(__dirname, "..", "client", "src", "lib", "desktop.ts");
    expect(fs.existsSync(desktopPath)).toBe(true);
  });

  it("should export isDesktop and getDesktopInfo", () => {
    const desktop = fs.readFileSync(path.join(__dirname, "..", "client", "src", "lib", "desktop.ts"), "utf-8");
    expect(desktop).toContain("isDesktop");
    expect(desktop).toContain("getDesktopInfo");
    expect(desktop).toContain("titanDesktop");
  });
});

// ─── Executor Logging Tests ─────────────────────────────────────────

describe("V6.0: Builder Executor Activity Logging", () => {
  it("should import builderActivityLog in chat-executor", () => {
    const executor = fs.readFileSync(path.join(__dirname, "chat-executor.ts"), "utf-8");
    expect(executor).toContain("builderActivityLog");
  });

  it("should log type check results", () => {
    const executor = fs.readFileSync(path.join(__dirname, "chat-executor.ts"), "utf-8");
    expect(executor).toContain('tool: "self_type_check"');
    expect(executor).toContain("db.insert(builderActivityLog)");
  });

  it("should log test run results", () => {
    const executor = fs.readFileSync(path.join(__dirname, "chat-executor.ts"), "utf-8");
    expect(executor).toContain('tool: "self_run_tests"');
  });

  it("should log multi-file modify results", () => {
    const executor = fs.readFileSync(path.join(__dirname, "chat-executor.ts"), "utf-8");
    expect(executor).toContain('tool: "self_multi_file_modify"');
  });

  it("should track duration in milliseconds", () => {
    const executor = fs.readFileSync(path.join(__dirname, "chat-executor.ts"), "utf-8");
    expect(executor).toContain("durationMs");
  });
});

import { describe, expect, it, vi, beforeEach } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

// Mock the replicate-engine module
vi.mock("./replicate-engine", () => ({
  createProject: vi.fn(),
  getProject: vi.fn(),
  listProjects: vi.fn(),
  deleteProject: vi.fn(),
  researchTarget: vi.fn(),
  generateBuildPlan: vi.fn(),
  executeBuild: vi.fn(),
  updateBranding: vi.fn(),
  updateStripeConfig: vi.fn(),
}));

import {
  createProject,
  getProject,
  listProjects,
  deleteProject,
  researchTarget,
  generateBuildPlan,
  executeBuild,
  updateBranding,
  updateStripeConfig,
} from "./replicate-engine";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createAuthContext(): TrpcContext {
  const user: AuthenticatedUser = {
    id: 42,
    openId: "test-user-42",
    email: "test@example.com",
    name: "Test User",
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
      clearCookie: vi.fn(),
    } as unknown as TrpcContext["res"],
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
      clearCookie: vi.fn(),
    } as unknown as TrpcContext["res"],
  };
}

const mockProject = {
  id: 1,
  userId: 42,
  targetUrl: "https://notion.so",
  targetName: "Notion Clone",
  targetDescription: "A productivity app",
  status: "researching",
  priority: "mvp",
  currentStep: 0,
  totalSteps: 0,
  statusMessage: null,
  errorMessage: null,
  sandboxId: null,
  brandName: null,
  brandColors: null,
  brandLogo: null,
  brandTagline: null,
  stripePublishableKey: null,
  stripeSecretKey: null,
  stripePriceIds: null,
  researchData: null,
  buildPlan: null,
  buildLog: [],
  createdAt: new Date(),
  updatedAt: new Date(),
};

const mockResearch = {
  appName: "Notion",
  description: "An all-in-one workspace for notes, tasks, and collaboration",
  targetAudience: "Knowledge workers and teams",
  coreFeatures: ["Rich text editor", "Database views", "Templates"],
  uiPatterns: ["Sidebar navigation", "Block-based editor"],
  techStackGuess: ["React", "Node.js"],
  dataModels: ["Page: title, content, parentId", "Block: type, content, pageId"],
  apiEndpoints: ["/api/pages", "/api/blocks"],
  authMethod: "Email + Google OAuth",
  monetization: "Freemium with paid plans",
  keyDifferentiators: ["Block-based editing", "Flexible databases"],
  suggestedTechStack: "React + Node.js + SQLite",
  estimatedComplexity: "high",
  mvpFeatures: ["Rich text editor", "Page hierarchy"],
  fullFeatures: ["Rich text editor", "Database views", "Templates", "Collaboration"],
};

const mockBuildPlan = {
  projectName: "notion-clone",
  description: "A Notion-like workspace",
  techStack: { frontend: "React", backend: "Express", database: "SQLite", other: "Vite" },
  fileStructure: [{ path: "src/App.tsx", description: "Main app", priority: 1 }],
  buildSteps: [{ step: 1, description: "Init project", files: ["package.json"], commands: ["npm init -y"] }],
  dataModels: [{ name: "Page", fields: ["id: number", "title: string"] }],
  apiRoutes: [{ method: "GET", path: "/api/pages", description: "List pages" }],
  estimatedFiles: 10,
  estimatedTimeMinutes: 30,
};

describe("replicate router", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("replicate.list", () => {
    it("returns projects for authenticated user", async () => {
      const ctx = createAuthContext();
      (listProjects as ReturnType<typeof vi.fn>).mockResolvedValue([mockProject]);

      const caller = appRouter.createCaller(ctx);
      const result = await caller.replicate.list();

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual(mockProject);
      expect(listProjects).toHaveBeenCalledWith(42);
    });

    it("rejects unauthenticated requests", async () => {
      const ctx = createUnauthContext();
      const caller = appRouter.createCaller(ctx);

      await expect(caller.replicate.list()).rejects.toThrow();
    });
  });

  describe("replicate.get", () => {
    it("returns a specific project", async () => {
      const ctx = createAuthContext();
      (getProject as ReturnType<typeof vi.fn>).mockResolvedValue(mockProject);

      const caller = appRouter.createCaller(ctx);
      const result = await caller.replicate.get({ projectId: 1 });

      expect(result).toEqual(mockProject);
      expect(getProject).toHaveBeenCalledWith(1, 42);
    });

    it("throws when project not found", async () => {
      const ctx = createAuthContext();
      (getProject as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      const caller = appRouter.createCaller(ctx);
      await expect(caller.replicate.get({ projectId: 999 })).rejects.toThrow("Project not found");
    });
  });

  describe("replicate.create", () => {
    it("creates a new project with minimal params", async () => {
      const ctx = createAuthContext();
      (createProject as ReturnType<typeof vi.fn>).mockResolvedValue(mockProject);

      const caller = appRouter.createCaller(ctx);
      const result = await caller.replicate.create({
        targetUrl: "https://notion.so",
        targetName: "Notion Clone",
      });

      expect(result).toEqual(mockProject);
      expect(createProject).toHaveBeenCalledWith(
        42,
        "https://notion.so",
        "Notion Clone",
        expect.objectContaining({
          priority: undefined,
          branding: expect.any(Object),
        })
      );
    });

    it("creates a project with full branding", async () => {
      const ctx = createAuthContext();
      (createProject as ReturnType<typeof vi.fn>).mockResolvedValue({
        ...mockProject,
        brandName: "MyApp",
        brandTagline: "Better than Notion",
      });

      const caller = appRouter.createCaller(ctx);
      const result = await caller.replicate.create({
        targetUrl: "https://notion.so",
        targetName: "Notion Clone",
        priority: "full",
        brandName: "MyApp",
        brandTagline: "Better than Notion",
        brandColors: {
          primary: "#6366f1",
          secondary: "#8b5cf6",
          accent: "#a855f7",
          background: "#0f172a",
          text: "#f8fafc",
        },
      });

      expect(result.brandName).toBe("MyApp");
      expect(createProject).toHaveBeenCalledWith(
        42,
        "https://notion.so",
        "Notion Clone",
        expect.objectContaining({
          priority: "full",
          branding: expect.objectContaining({
            brandName: "MyApp",
            brandTagline: "Better than Notion",
          }),
        })
      );
    });
  });

  describe("replicate.research", () => {
    it("runs research on a project", async () => {
      const ctx = createAuthContext();
      (researchTarget as ReturnType<typeof vi.fn>).mockResolvedValue(mockResearch);

      const caller = appRouter.createCaller(ctx);
      const result = await caller.replicate.research({ projectId: 1 });

      expect(result).toEqual(mockResearch);
      expect(researchTarget).toHaveBeenCalledWith(1, 42);
    });
  });

  describe("replicate.plan", () => {
    it("generates a build plan", async () => {
      const ctx = createAuthContext();
      (generateBuildPlan as ReturnType<typeof vi.fn>).mockResolvedValue(mockBuildPlan);

      const caller = appRouter.createCaller(ctx);
      const result = await caller.replicate.plan({ projectId: 1 });

      expect(result).toEqual(mockBuildPlan);
      expect(generateBuildPlan).toHaveBeenCalledWith(1, 42, {
        features: undefined,
        techStack: undefined,
      });
    });

    it("passes custom features and tech stack", async () => {
      const ctx = createAuthContext();
      (generateBuildPlan as ReturnType<typeof vi.fn>).mockResolvedValue(mockBuildPlan);

      const caller = appRouter.createCaller(ctx);
      await caller.replicate.plan({
        projectId: 1,
        features: ["Editor", "Auth"],
        techStack: "Vue + Express",
      });

      expect(generateBuildPlan).toHaveBeenCalledWith(1, 42, {
        features: ["Editor", "Auth"],
        techStack: "Vue + Express",
      });
    });
  });

  describe("replicate.build", () => {
    it("executes the build", async () => {
      const ctx = createAuthContext();
      (executeBuild as ReturnType<typeof vi.fn>).mockResolvedValue({
        success: true,
        message: "Build complete: 5 steps executed",
      });

      const caller = appRouter.createCaller(ctx);
      const result = await caller.replicate.build({ projectId: 1 });

      expect(result).toEqual({ success: true, message: "Build complete: 5 steps executed" });
      expect(executeBuild).toHaveBeenCalledWith(1, 42);
    });
  });

  describe("replicate.updateBranding", () => {
    it("updates branding configuration", async () => {
      const ctx = createAuthContext();
      (updateBranding as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);

      const caller = appRouter.createCaller(ctx);
      const result = await caller.replicate.updateBranding({
        projectId: 1,
        brandName: "NewBrand",
        brandTagline: "New tagline",
      });

      expect(result).toEqual({ success: true });
      expect(updateBranding).toHaveBeenCalledWith(1, 42, {
        brandName: "NewBrand",
        brandColors: undefined,
        brandLogo: undefined,
        brandTagline: "New tagline",
      });
    });
  });

  describe("replicate.updateStripe", () => {
    it("updates Stripe configuration", async () => {
      const ctx = createAuthContext();
      (updateStripeConfig as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);

      const caller = appRouter.createCaller(ctx);
      const result = await caller.replicate.updateStripe({
        projectId: 1,
        publishableKey: "pk_test_123",
        secretKey: "sk_test_456",
      });

      expect(result).toEqual({ success: true });
      expect(updateStripeConfig).toHaveBeenCalledWith(1, 42, {
        publishableKey: "pk_test_123",
        secretKey: "sk_test_456",
        priceIds: undefined,
      });
    });
  });

  describe("replicate.delete", () => {
    it("deletes a project", async () => {
      const ctx = createAuthContext();
      (deleteProject as ReturnType<typeof vi.fn>).mockResolvedValue(true);

      const caller = appRouter.createCaller(ctx);
      const result = await caller.replicate.delete({ projectId: 1 });

      expect(result).toEqual({ success: true });
      expect(deleteProject).toHaveBeenCalledWith(1, 42);
    });

    it("returns false when project not found", async () => {
      const ctx = createAuthContext();
      (deleteProject as ReturnType<typeof vi.fn>).mockResolvedValue(false);

      const caller = appRouter.createCaller(ctx);
      const result = await caller.replicate.delete({ projectId: 999 });

      expect(result).toEqual({ success: false });
    });
  });
});

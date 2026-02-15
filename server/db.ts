import { eq, and, gte, lte, like, desc, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { InsertUser, users, companies, InsertCompany, businessPlans, InsertBusinessPlan, grantOpportunities, InsertGrantOpportunity, grantApplications, InsertGrantApplication, grantMatches, InsertGrantMatch, crowdfundingCampaigns, InsertCrowdfundingCampaign, crowdfundingRewards, InsertCrowdfundingReward, crowdfundingContributions, InsertCrowdfundingContribution, crowdfundingUpdates, InsertCrowdfundingUpdate } from "../drizzle/schema";
import { ENV } from './_core/env';

let _db: ReturnType<typeof drizzle> | null = null;

// Lazily create the drizzle instance so local tooling can run without a DB.
export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = 'admin';
      updateSet.role = 'admin';
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);

  return result.length > 0 ? result[0] : undefined;
}

// ==========================================
// GRANT FINDER DB FUNCTIONS
// ==========================================

// --- Company functions ---
export async function createCompany(data: InsertCompany) {
  const db = await getDb(); if (!db) throw new Error("DB not available");
  const result = await db.insert(companies).values(data);
  return { id: result[0].insertId };
}
export async function getCompaniesByUser(userId: number) {
  const db = await getDb(); if (!db) return [];
  return db.select().from(companies).where(eq(companies.userId, userId));
}
export async function getCompanyById(id: number) {
  const db = await getDb(); if (!db) return undefined;
  const result = await db.select().from(companies).where(eq(companies.id, id));
  return result[0];
}
export async function updateCompany(id: number, data: Partial<InsertCompany>) {
  const db = await getDb(); if (!db) throw new Error("DB not available");
  await db.update(companies).set(data).where(eq(companies.id, id));
}
export async function deleteCompany(id: number) {
  const db = await getDb(); if (!db) throw new Error("DB not available");
  await db.delete(companies).where(eq(companies.id, id));
}

// --- Business Plan functions ---
export async function createBusinessPlan(data: InsertBusinessPlan) {
  const db = await getDb(); if (!db) throw new Error("DB not available");
  const result = await db.insert(businessPlans).values(data);
  return { id: result[0].insertId };
}
export async function getBusinessPlansByCompany(companyId: number) {
  const db = await getDb(); if (!db) return [];
  return db.select().from(businessPlans).where(eq(businessPlans.companyId, companyId)).orderBy(desc(businessPlans.createdAt));
}
export async function getBusinessPlanById(id: number) {
  const db = await getDb(); if (!db) return undefined;
  const result = await db.select().from(businessPlans).where(eq(businessPlans.id, id));
  return result[0];
}
export async function updateBusinessPlan(id: number, data: Partial<InsertBusinessPlan>) {
  const db = await getDb(); if (!db) throw new Error("DB not available");
  await db.update(businessPlans).set(data).where(eq(businessPlans.id, id));
}

// --- Grant Opportunity functions ---
export async function listGrantOpportunities(filters?: { region?: string; agency?: string; minAmount?: number; maxAmount?: number; status?: string; search?: string }) {
  const db = await getDb(); if (!db) return [];
  const conditions: any[] = [];
  if (filters?.region) conditions.push(eq(grantOpportunities.region, filters.region));
  if (filters?.agency) conditions.push(eq(grantOpportunities.agency, filters.agency));
  if (filters?.minAmount) conditions.push(gte(grantOpportunities.maxAmount, filters.minAmount));
  if (filters?.maxAmount) conditions.push(lte(grantOpportunities.minAmount, filters.maxAmount));
  if (filters?.status) conditions.push(eq(grantOpportunities.status, filters.status as any));
  if (filters?.search) conditions.push(like(grantOpportunities.title, `%${filters.search}%`));
  if (conditions.length > 0) {
    return db.select().from(grantOpportunities).where(and(...conditions)).orderBy(desc(grantOpportunities.createdAt));
  }
  return db.select().from(grantOpportunities).orderBy(desc(grantOpportunities.createdAt));
}
export async function getGrantOpportunityById(id: number) {
  const db = await getDb(); if (!db) return undefined;
  const result = await db.select().from(grantOpportunities).where(eq(grantOpportunities.id, id));
  return result[0];
}
export async function createGrantOpportunity(data: InsertGrantOpportunity) {
  const db = await getDb(); if (!db) throw new Error("DB not available");
  const result = await db.insert(grantOpportunities).values(data);
  return { id: result[0].insertId };
}
export async function seedGrantOpportunities(grants: InsertGrantOpportunity[]) {
  const db = await getDb(); if (!db) throw new Error("DB not available");
  for (const grant of grants) {
    await db.insert(grantOpportunities).values(grant);
  }
  return { count: grants.length };
}

// --- Grant Application functions ---
export async function createGrantApplication(data: InsertGrantApplication) {
  const db = await getDb(); if (!db) throw new Error("DB not available");
  const result = await db.insert(grantApplications).values(data);
  return { id: result[0].insertId };
}
export async function getGrantApplicationsByCompany(companyId: number) {
  const db = await getDb(); if (!db) return [];
  return db.select().from(grantApplications).where(eq(grantApplications.companyId, companyId)).orderBy(desc(grantApplications.createdAt));
}
export async function getGrantApplicationById(id: number) {
  const db = await getDb(); if (!db) return undefined;
  const result = await db.select().from(grantApplications).where(eq(grantApplications.id, id));
  return result[0];
}
export async function updateGrantApplication(id: number, data: Partial<InsertGrantApplication>) {
  const db = await getDb(); if (!db) throw new Error("DB not available");
  await db.update(grantApplications).set(data).where(eq(grantApplications.id, id));
}

// --- Grant Match functions ---
export async function createGrantMatch(data: InsertGrantMatch) {
  const db = await getDb(); if (!db) throw new Error("DB not available");
  const result = await db.insert(grantMatches).values(data);
  return { id: result[0].insertId };
}
export async function getGrantMatchesByCompany(companyId: number) {
  const db = await getDb(); if (!db) return [];
  return db.select().from(grantMatches).where(eq(grantMatches.companyId, companyId)).orderBy(desc(grantMatches.matchScore));
}

// --- Crowdfunding Campaign functions ---
export async function createCampaign(data: InsertCrowdfundingCampaign) {
  const db = await getDb(); if (!db) throw new Error("DB not available");
  const result = await db.insert(crowdfundingCampaigns).values(data);
  return { id: result[0].insertId };
}
export async function listCampaigns(filters?: { status?: string; category?: string; userId?: number }) {
  const db = await getDb(); if (!db) return [];
  const conditions: any[] = [];
  if (filters?.status) conditions.push(eq(crowdfundingCampaigns.status, filters.status as any));
  if (filters?.category) conditions.push(eq(crowdfundingCampaigns.category, filters.category));
  if (filters?.userId) conditions.push(eq(crowdfundingCampaigns.userId, filters.userId));
  if (conditions.length > 0) {
    return db.select().from(crowdfundingCampaigns).where(and(...conditions)).orderBy(desc(crowdfundingCampaigns.createdAt));
  }
  return db.select().from(crowdfundingCampaigns).orderBy(desc(crowdfundingCampaigns.createdAt));
}
export async function getCampaignById(id: number) {
  const db = await getDb(); if (!db) return undefined;
  const result = await db.select().from(crowdfundingCampaigns).where(eq(crowdfundingCampaigns.id, id));
  return result[0];
}
export async function getCampaignBySlug(slug: string) {
  const db = await getDb(); if (!db) return undefined;
  const result = await db.select().from(crowdfundingCampaigns).where(eq(crowdfundingCampaigns.slug, slug));
  return result[0];
}
export async function updateCampaign(id: number, data: Partial<InsertCrowdfundingCampaign>) {
  const db = await getDb(); if (!db) throw new Error("DB not available");
  await db.update(crowdfundingCampaigns).set(data).where(eq(crowdfundingCampaigns.id, id));
}

// --- Crowdfunding Rewards ---
export async function createReward(data: InsertCrowdfundingReward) {
  const db = await getDb(); if (!db) throw new Error("DB not available");
  const result = await db.insert(crowdfundingRewards).values(data);
  return { id: result[0].insertId };
}
export async function getRewardsByCampaign(campaignId: number) {
  const db = await getDb(); if (!db) return [];
  return db.select().from(crowdfundingRewards).where(eq(crowdfundingRewards.campaignId, campaignId));
}

// --- Crowdfunding Contributions ---
export async function createContribution(data: InsertCrowdfundingContribution) {
  const db = await getDb(); if (!db) throw new Error("DB not available");
  const result = await db.insert(crowdfundingContributions).values(data);
  // Update campaign totals
  await db.update(crowdfundingCampaigns).set({
    currentAmount: sql`${crowdfundingCampaigns.currentAmount} + ${data.amount}`,
    backerCount: sql`${crowdfundingCampaigns.backerCount} + 1`,
  }).where(eq(crowdfundingCampaigns.id, data.campaignId));
  return { id: result[0].insertId };
}
export async function getContributionsByCampaign(campaignId: number) {
  const db = await getDb(); if (!db) return [];
  return db.select().from(crowdfundingContributions).where(eq(crowdfundingContributions.campaignId, campaignId)).orderBy(desc(crowdfundingContributions.createdAt));
}

// --- Crowdfunding Updates ---
export async function createCampaignUpdate(data: InsertCrowdfundingUpdate) {
  const db = await getDb(); if (!db) throw new Error("DB not available");
  const result = await db.insert(crowdfundingUpdates).values(data);
  return { id: result[0].insertId };
}
export async function getUpdatesByCampaign(campaignId: number) {
  const db = await getDb(); if (!db) return [];
  return db.select().from(crowdfundingUpdates).where(eq(crowdfundingUpdates.campaignId, campaignId)).orderBy(desc(crowdfundingUpdates.createdAt));
}

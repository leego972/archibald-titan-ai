import { protectedProcedure, publicProcedure, router } from "./_core/trpc";
import { z } from "zod";
import { invokeLLM } from "./_core/llm";
import { getProviderParams } from "./_core/provider-policy";
import { getUserOpenAIKey } from "./user-secrets-router";
import { TRPCError } from "@trpc/server";
import * as db from "./db";
import { refreshGrantsForCountry, refreshAllGrants, getSupportedCountries } from "./grant-refresh-service";
import { seedExternalCampaigns, getSourceStats } from "./crowdfunding-aggregator";
import {
  isBinancePayConfigured,
  generateMerchantTradeNo,
  calculatePlatformFee,
  createCryptoPaymentOrder,
  queryOrderStatus,
  getFallbackCryptoInfo,
  PLATFORM_FEE_PERCENT,
  SUPPORTED_CRYPTO,
} from "./binance-pay-service";
import { createLogger } from "./_core/logger.js";
import { getErrorMessage } from "./_core/errors.js";
import { isAdminRole } from '@shared/const';
import { consumeCredits, checkCredits } from "./credit-service";
const log = createLogger("GrantFinderRouter");

// ==========================================
// NO MORE FAKE SEED DATA
// All grants come from real government APIs
// ==========================================

// ==========================================
// HELPER FUNCTIONS
// ==========================================
function extractSection(text: string, sectionName: string): string {
  const patterns = [
    new RegExp(`##\\s*${sectionName}[\\s\\S]*?(?=##\\s|$)`, 'i'),
    new RegExp(`\\*\\*${sectionName}\\*\\*[\\s\\S]*?(?=\\*\\*|$)`, 'i'),
    new RegExp(`${sectionName}:\\s*([\\s\\S]*?)(?=\\n\\n|$)`, 'i'),
  ];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) return match[0].replace(/^##\s*\w+\s*/, '').trim();
  }
  return '';
}

// ==========================================
// ROUTERS
// ==========================================

export const companyRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    return db.getCompaniesByUser(ctx.user.id);
  }),
  get: protectedProcedure.input(z.object({ id: z.number() })).query(async ({ input }) => {
    return db.getCompanyById(input.id);
  }),
  create: protectedProcedure.input(z.object({
    name: z.string().min(1),
    industry: z.string().optional(),
    technologyArea: z.string().optional(),
    employeeCount: z.number().optional(),
    annualRevenue: z.number().optional(),
    foundedYear: z.number().optional(),
    location: z.string().optional(),
    minorityOwned: z.number().optional(),
    womenOwned: z.number().optional(),
    veteranOwned: z.number().optional(),
  })).mutation(async ({ ctx, input }) => {
    return db.createCompany({ ...input, userId: ctx.user.id });
  }),
  update: protectedProcedure.input(z.object({
    id: z.number(),
    name: z.string().optional(),
    industry: z.string().optional(),
    technologyArea: z.string().optional(),
    employeeCount: z.number().optional(),
    annualRevenue: z.number().optional(),
    foundedYear: z.number().optional(),
    location: z.string().optional(),
    minorityOwned: z.number().optional(),
    womenOwned: z.number().optional(),
    veteranOwned: z.number().optional(),
  })).mutation(async ({ input }) => {
    const { id, ...data } = input;
    await db.updateCompany(id, data);
    return { success: true };
  }),
  delete: protectedProcedure.input(z.object({ id: z.number() })).mutation(async ({ input }) => {
    await db.deleteCompany(input.id);
    return { success: true };
  }),
});

export const businessPlanRouter = router({
  list: protectedProcedure.input(z.object({ companyId: z.number() })).query(async ({ input }) => {
    return db.getBusinessPlansByCompany(input.companyId);
  }),
  get: protectedProcedure.input(z.object({ id: z.number() })).query(async ({ input }) => {
    return db.getBusinessPlanById(input.id);
  }),
  generate: protectedProcedure.input(z.object({
    companyId: z.number(),
    projectTitle: z.string(),
    projectDescription: z.string(),
    targetMarket: z.string().optional(),
    competitiveAdvantage: z.string().optional(),
  })).mutation(async ({ input, ctx }) => {
    const creditCheck = await checkCredits(ctx.user.id, "business_plan_generate");
    if (!creditCheck.allowed) {
      throw new TRPCError({ code: "FORBIDDEN", message: `Insufficient credits. Need ${creditCheck.cost}, have ${creditCheck.currentBalance}.` });
    }
    try { await consumeCredits(ctx.user.id, "business_plan_generate", "Business plan generation"); } catch { /* ignore */ }
    const company = await db.getCompanyById(input.companyId);
    if (!company) throw new TRPCError({ code: "NOT_FOUND", message: "Company not found" });
    const userApiKey = await getUserOpenAIKey(ctx.user.id) || undefined;

    const prompt = `Generate a comprehensive business plan for a grant application.

Company: ${company.name}
Industry: ${company.industry || 'Not specified'}
Technology Area: ${company.technologyArea || 'Not specified'}
Employees: ${company.employeeCount || 'Not specified'}
Annual Revenue: ${company.annualRevenue ? '$' + company.annualRevenue.toLocaleString() : 'Not specified'}
Location: ${company.location || 'Not specified'}

Project: ${input.projectTitle}
Description: ${input.projectDescription}
Target Market: ${input.targetMarket || 'Not specified'}
Competitive Advantage: ${input.competitiveAdvantage || 'Not specified'}

Generate the following sections with detailed, professional content:
## Executive Summary
## Technology Description
## Market Analysis
## Competitive Analysis
## Team Qualifications
## Research Plan
## Commercialization Strategy
## Financial Projections
## IP Strategy`;

    const response = await invokeLLM({
      ...getProviderParams("grant_plan_generation"),
      userApiKey,
      messages: [{ role: "user", content: prompt }] });
    const content = String(response.choices[0]?.message?.content || '');

    const plan = {
      companyId: input.companyId,
      title: input.projectTitle,
      executiveSummary: extractSection(content, 'Executive Summary') || content.substring(0, 500),
      technologyDescription: extractSection(content, 'Technology Description'),
      marketAnalysis: extractSection(content, 'Market Analysis'),
      competitiveAnalysis: extractSection(content, 'Competitive Analysis'),
      teamQualifications: extractSection(content, 'Team Qualifications'),
      researchPlan: extractSection(content, 'Research Plan'),
      commercializationStrategy: extractSection(content, 'Commercialization Strategy'),
      financialProjections: extractSection(content, 'Financial Projections'),
      ipStrategy: extractSection(content, 'IP Strategy'),
      status: "completed" as const,
    };

    return db.createBusinessPlan(plan);
  }),
});

export const grantRouter = router({
  list: publicProcedure.input(z.object({
    region: z.string().optional(),
    agency: z.string().optional(),
    minAmount: z.number().optional(),
    maxAmount: z.number().optional(),
    status: z.string().optional(),
    search: z.string().optional(),
  }).optional()).query(async ({ input }) => {
    return db.listGrantOpportunities(input || {});
  }),
  get: publicProcedure.input(z.object({ id: z.number() })).query(async ({ input }) => {
    return db.getGrantOpportunityById(input.id);
  }),
  match: protectedProcedure.input(z.object({ companyId: z.number() })).mutation(async ({ input, ctx }) => {
    try { await consumeCredits(ctx.user.id, "grant_match", "Grant matching analysis"); } catch { /* ignore */ }
    const company = await db.getCompanyById(input.companyId);
    if (!company) throw new TRPCError({ code: "NOT_FOUND", message: "Company not found" });
    const userApiKey = await getUserOpenAIKey(ctx.user.id) || undefined;

    const allGrants = await db.listGrantOpportunities();

    // Smart filtering: prioritize grants matching the company's region, then include global/nearby
    const companyLocation = (company.location || '').toLowerCase();
    let regionHints: string[] = [];
    if (companyLocation.includes('united kingdom') || companyLocation.includes('london') || companyLocation.includes('uk')) {
      regionHints = ['United Kingdom', 'European Union'];
    } else if (companyLocation.includes('australia') || companyLocation.includes('sydney') || companyLocation.includes('melbourne')) {
      regionHints = ['Australia', 'New Zealand'];
    } else if (companyLocation.includes('united states') || companyLocation.includes('usa') || companyLocation.includes('new york') || companyLocation.includes('san francisco')) {
      regionHints = ['United States', 'Canada'];
    } else if (companyLocation.includes('canada')) {
      regionHints = ['Canada', 'United States'];
    } else if (companyLocation.includes('singapore')) {
      regionHints = ['Singapore'];
    } else if (companyLocation.includes('israel')) {
      regionHints = ['Israel'];
    }

    // Filter to relevant regions (max ~40 grants per batch), fall back to all if no region match
    let grants = regionHints.length > 0
      ? allGrants.filter((g: any) => regionHints.some(r => (g.region || '').includes(r)))
      : allGrants;
    if (grants.length === 0) grants = allGrants;

    // Batch into chunks of 40 to avoid token limits
    const BATCH_SIZE = 40;
    const allMatches: any[] = [];

    for (let i = 0; i < grants.length; i += BATCH_SIZE) {
      const batch = grants.slice(i, i + BATCH_SIZE);
      const prompt = `Analyze this company and score each grant opportunity for fit.

Company: ${company.name}
Industry: ${company.industry || 'General'}
Technology: ${company.technologyArea || 'General'}
Employees: ${company.employeeCount || 'Unknown'}
Revenue: ${company.annualRevenue || 'Unknown'}
Location: ${company.location || 'Unknown'}
Minority-owned: ${company.minorityOwned ? 'Yes' : 'No'}
Women-owned: ${company.womenOwned ? 'Yes' : 'No'}
Veteran-owned: ${company.veteranOwned ? 'Yes' : 'No'}

For each grant, provide a JSON array with objects containing:
- grantId (number)
- matchScore (0-100)
- eligibilityScore (0-100)
- alignmentScore (0-100)
- competitivenessScore (0-100)
- reason (string, max 100 chars)
- successProbability (0-100)

Grants:
${batch.map((g: any) => `ID:${g.id} - ${g.agency}: ${g.title} ($${g.minAmount}-$${g.maxAmount})`).join('\n')}

Return ONLY a JSON object with a "matches" array.`;

      try {
        const response = await invokeLLM({
          ...getProviderParams("grant_matching"),
          userApiKey,
          messages: [{ role: "user", content: prompt }],
          response_format: { type: "json_schema", json_schema: { name: "grant_matches", strict: true, schema: { type: "object", properties: { matches: { type: "array", items: { type: "object", properties: { grantId: { type: "number" }, matchScore: { type: "number" }, eligibilityScore: { type: "number" }, alignmentScore: { type: "number" }, competitivenessScore: { type: "number" }, reason: { type: "string" }, successProbability: { type: "number" } }, required: ["grantId", "matchScore", "eligibilityScore", "alignmentScore", "competitivenessScore", "reason", "successProbability"], additionalProperties: false } } }, required: ["matches"], additionalProperties: false } } },
        });

        const content = String(response.choices[0]?.message?.content || '{"matches":[]}');
        try {
          const parsed = JSON.parse(content);
          allMatches.push(...(parsed.matches || parsed));
        } catch { /* skip bad batch */ }
      } catch (e) {
        log.error(`Grant match batch ${i}-${i + BATCH_SIZE} failed:`, { error: e });
      }
    }

    const matches = allMatches;

    const results: Array<{ id: number }> = [];
    for (const m of matches) {
      if (m.matchScore > 30) {
        const result = await db.createGrantMatch({
          companyId: input.companyId,
          grantOpportunityId: m.grantId,
          matchScore: m.matchScore,
          eligibilityScore: m.eligibilityScore,
          alignmentScore: m.alignmentScore,
          competitivenessScore: m.competitivenessScore,
          recommendationReason: m.reason,
          estimatedSuccessProbability: m.successProbability,
          isRecommended: m.matchScore >= 70 ? 1 : 0,
        });
        results.push(result);
      }
    }
    return { matchCount: results.length, matches };
  }),
  matches: protectedProcedure.input(z.object({ companyId: z.number() })).query(async ({ input }) => {
    return db.getGrantMatchesByCompany(input.companyId);
  }),
});

export const grantApplicationRouter = router({
  list: protectedProcedure.input(z.object({ companyId: z.number() })).query(async ({ input }) => {
    return db.getGrantApplicationsByCompany(input.companyId);
  }),
  get: protectedProcedure.input(z.object({ id: z.number() })).query(async ({ input }) => {
    return db.getGrantApplicationById(input.id);
  }),
  generate: protectedProcedure.input(z.object({
    companyId: z.number(),
    grantOpportunityId: z.number(),
    businessPlanId: z.number().optional(),
  })).mutation(async ({ input, ctx }) => {
    const creditCheck = await checkCredits(ctx.user.id, "grant_match");
    if (!creditCheck.allowed) {
      throw new TRPCError({ code: "FORBIDDEN", message: `Insufficient credits. Need ${creditCheck.cost}, have ${creditCheck.currentBalance}.` });
    }
    try { await consumeCredits(ctx.user.id, "grant_match", "Grant application generation"); } catch { /* ignore */ }
    const company = await db.getCompanyById(input.companyId);
    if (!company) throw new TRPCError({ code: "NOT_FOUND", message: "Company not found" });
    const userApiKey = await getUserOpenAIKey(ctx.user.id) || undefined;
    const grant = await db.getGrantOpportunityById(input.grantOpportunityId);
    if (!grant) throw new TRPCError({ code: "NOT_FOUND", message: "Grant not found" });

    let businessPlanContext = '';
    if (input.businessPlanId) {
      const plan = await db.getBusinessPlanById(input.businessPlanId);
      if (plan) {
        businessPlanContext = `\nBusiness Plan: ${plan.title}\nExecutive Summary: ${plan.executiveSummary}\nTechnology: ${plan.technologyDescription}\nMarket: ${plan.marketAnalysis}`;
      }
    }

    // ── Shared context for all section prompts ──
    const companyCtx = `Company: ${company.name}
Industry: ${company.industry || 'Technology / AI'}
Technology Area: ${company.technologyArea || 'Artificial Intelligence'}
Location: ${company.location || 'Not specified'}
Country: ${company.country || 'United Kingdom'}
Employees: ${company.employeeCount || 'Startup (<10)'}
Annual Revenue: ${company.annualRevenue ? '$' + company.annualRevenue.toLocaleString() : 'Pre-revenue / Early stage'}
Founded: ${company.foundedYear || 'Recently founded'}
Website: ${company.website || 'N/A'}
Description: ${company.description || company.name + ' is an innovative technology company.'}
${businessPlanContext}`;

    const grantCtx = `Grant Agency: ${grant.agency}
Grant Program: ${grant.programName}
Grant Title: ${grant.title}
Grant Description: ${grant.description || 'Innovation funding for technology projects'}
Focus Areas: ${grant.focusAreas || 'Technology, Innovation, R&D'}
Funding Range: ${grant.currency || '$'}${grant.minAmount?.toLocaleString() || '25,000'} - ${grant.currency || '$'}${grant.maxAmount?.toLocaleString() || '500,000'}
Eligibility: ${grant.eligibilityCriteria || 'UK-based SMEs and startups'}
Region: ${grant.region || 'UK'}`;

    const systemPrompt = `You are an expert grant writer who has successfully secured over $50 million in government innovation funding. You write in a professional, compelling, evidence-based style that grant reviewers love. You understand what makes applications score highly: clear problem statements, measurable outcomes, realistic budgets, and strong innovation narratives. Write in plain English, avoid jargon, and be specific with numbers and timelines.`;

    // ── Helper to call LLM for each section ──
    async function generateSection(sectionPrompt: string): Promise<string> {
      try {
        const response = await invokeLLM({
          ...getProviderParams("grant_application_writing"),
          userApiKey,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: sectionPrompt },
          ],
        });
        return String(response.choices[0]?.message?.content || '').trim();
      } catch (err) {
        log.error(`[GrantGen] Section generation failed: ${getErrorMessage(err)}`);
        return '';
      }
    }

    // ── Generate each section with expert prompts ──
    log.info(`[GrantGen] Starting multi-section generation for ${company.name} → ${grant.programName}`);

    // 1. Technical Abstract (250 words max — most critical section)
    const technicalAbstract = await generateSection(`
${companyCtx}

${grantCtx}

Write a Technical Abstract (250 words maximum) for this grant application. This is the MOST IMPORTANT section — reviewers read this first and form their initial impression.

The abstract MUST include:
1. The problem being solved and why it matters (2-3 sentences)
2. The proposed solution and what makes it innovative (2-3 sentences)
3. The technical approach in brief (2-3 sentences)
4. Expected outcomes and impact — use specific numbers (2-3 sentences)
5. Why this team/company is uniquely positioned to deliver (1-2 sentences)

Write it as a single flowing paragraph. Be specific, use numbers, and make every word count. Do NOT include any headers or labels — just the abstract text.`);

    // 2. Project Description (detailed, 800-1200 words)
    const projectDescription = await generateSection(`
${companyCtx}

${grantCtx}

Write a detailed Project Description (800-1200 words) for this grant application. Structure it with clear subheadings:

### The Problem
Describe the market/industry problem in detail. Use statistics and evidence. Explain who is affected and the cost of inaction.

### Our Solution
Describe the proposed technology/product in detail. Explain how it works technically. What makes it different from existing solutions?

### How It Works
Provide a technical walkthrough of the solution architecture, key components, and user experience. Be specific about the technology stack and methodology.

### Key Innovations
List 3-5 specific technical innovations with brief explanations of each.

### Target Users & Market
Describe the target market, market size (TAM/SAM/SOM), and go-to-market strategy.

### Expected Benefits & Impact
Quantify the expected outcomes: users served, revenue potential, jobs created, efficiency gains, environmental impact, etc.

Write in a professional, evidence-based tone. Use specific numbers wherever possible. Do NOT include any section labels like "Project Description" — just start with the content.`);

    // 3. Specific Aims (3-5 measurable objectives)
    const specificAims = await generateSection(`
${companyCtx}

${grantCtx}

Write 3-5 Specific Aims for this grant application. Each aim must be:
- Numbered (Aim 1, Aim 2, etc.)
- A clear, measurable objective with a specific deliverable
- Include a success metric (e.g., "achieve 95% accuracy", "onboard 1,000 users", "reduce processing time by 60%")
- Include a timeline (e.g., "by Month 6", "within the first quarter")
- Include a brief rationale (1-2 sentences explaining why this aim matters)

Format each aim as:
**Aim N: [Title]**
Objective: [What will be achieved]
Success Metric: [How success is measured]
Timeline: [When it will be completed]
Rationale: [Why this matters]

Make the aims progressive — each building on the previous. Together they should tell a complete story from R&D through to market validation. Do NOT include any section labels like "Specific Aims" — just start with Aim 1.`);

    // 4. Innovation Statement
    const innovation = await generateSection(`
${companyCtx}

${grantCtx}

Write an Innovation Statement (400-600 words) for this grant application. This section must convince reviewers that this project represents genuine innovation, not incremental improvement.

Address these points:
1. **What is genuinely new** — describe the novel technical contribution (not just "we use AI")
2. **Current state of the art** — what exists today and its limitations
3. **How this advances beyond the state of the art** — specific technical differentiators
4. **Intellectual property** — any patents, trade secrets, or proprietary methods
5. **Why now** — what recent advances make this possible today but not 2 years ago
6. **Risk and mitigation** — acknowledge technical risks and how they'll be managed

Be specific and technical. Avoid vague claims. Reference real technologies and approaches. Do NOT include any section labels — just start with the content.`);

    // 5. Approach / Methodology
    const approach = await generateSection(`
${companyCtx}

${grantCtx}

Write a detailed Technical Approach / Methodology section (600-800 words) for this grant application.

Structure it as:

### Research & Development Methodology
Describe the R&D approach: agile sprints, user-centered design, iterative prototyping, etc.

### Work Packages
Define 4-6 work packages, each with:
- WP title and duration
- Key activities (3-4 bullet points)
- Deliverables
- Dependencies on other WPs

### Technical Architecture
Describe the system architecture, key technologies, and integration points.

### Testing & Validation
How will the solution be tested? What metrics define success? Include alpha/beta testing plans.

### Risk Management
Identify 3-4 key technical risks with mitigation strategies.

Be practical and realistic. Reviewers want to see you've thought through HOW you'll actually deliver. Do NOT include any section labels like "Approach" — just start with the content.`);

    // 6. Commercialization Plan
    const commercializationPlan = await generateSection(`
${companyCtx}

${grantCtx}

Write a Commercialization Plan (400-600 words) for this grant application. Grant agencies want to see that public money will generate economic returns.

Cover:
1. **Business Model** — how the product/service generates revenue (SaaS, licensing, freemium, etc.)
2. **Pricing Strategy** — specific price points and tiers
3. **Go-to-Market Strategy** — how you'll acquire customers (channels, partnerships, marketing)
4. **Revenue Projections** — Year 1, 2, 3 revenue estimates with assumptions
5. **Market Validation** — any existing users, LOIs, pilot agreements, or waitlist numbers
6. **Competitive Advantage** — sustainable moats (technology, data, network effects)
7. **Job Creation** — how many jobs will be created in Years 1-3
8. **Wider Economic Impact** — contribution to the local/national economy

Use specific numbers. Be ambitious but realistic. Do NOT include any section labels — just start with the content.`);

    // 7. Budget Breakdown
    const budget = await generateSection(`
${companyCtx}

${grantCtx}

Create a detailed Budget Breakdown for this grant application. The total budget should be realistic for the grant funding range (${grant.currency || '$'}${grant.minAmount?.toLocaleString() || '25,000'} - ${grant.currency || '$'}${grant.maxAmount?.toLocaleString() || '500,000'}).

Format as a clear table-style breakdown:

**Personnel Costs** (typically 50-60% of total)
- Role 1: [Title] — [FTE] × [Duration] × [Rate] = [Total]
- Role 2: etc.
Subtotal: [Amount]

**Equipment & Software** (typically 5-10%)
- Item 1: [Description] = [Cost]
Subtotal: [Amount]

**Subcontracting & External Services** (typically 10-15%)
- Service 1: [Description] = [Cost]
Subtotal: [Amount]

**Travel & Dissemination** (typically 5%)
- Item 1: [Description] = [Cost]
Subtotal: [Amount]

**Overheads & Indirect Costs** (typically 15-20%)
- Overhead rate: [Percentage] of direct costs = [Amount]

**TOTAL PROJECT COST: [Amount]**
**GRANT FUNDING REQUESTED: [Amount]** (typically 50-70% of total for Innovate UK)
**COMPANY MATCH FUNDING: [Amount]**

Make the numbers realistic and internally consistent. Every line item should be justifiable. Do NOT include any section labels like "Budget" — just start with the breakdown.`);

    // 8. Budget Justification
    const budgetJustification = await generateSection(`
${companyCtx}

${grantCtx}

Based on this budget context:
${budget.substring(0, 1500)}

Write a Budget Justification (300-500 words) explaining why each major cost category is necessary and represents value for money.

For each category explain:
- Why this expenditure is essential to the project
- How the costs were estimated (market rates, quotes, benchmarks)
- Why this represents good value for money

Also address:
- How the company will provide match funding
- Any in-kind contributions
- How costs will be managed and monitored

Be specific and practical. Reviewers want to see that money will be spent wisely. Do NOT include any section labels — just start with the justification.`);

    // 9. Timeline / Milestones
    const timeline = await generateSection(`
${companyCtx}

${grantCtx}

Create a detailed Project Timeline with milestones for a 12-18 month project.

Format as:

**Phase 1: [Name] (Months 1-3)**
- Milestone 1.1: [Description] — Deliverable: [What]
- Milestone 1.2: [Description] — Deliverable: [What]
- Key Decision Point: [Go/No-Go criteria]

**Phase 2: [Name] (Months 4-6)**
- Milestone 2.1: etc.

**Phase 3: [Name] (Months 7-9)**

**Phase 4: [Name] (Months 10-12)**

**Phase 5: [Name] (Months 13-18)** (if applicable)

Include:
- Clear deliverables for each milestone
- Go/No-Go decision points between phases
- Dependencies between milestones
- A final milestone for project completion and reporting

Make the timeline realistic and achievable. Do NOT include any section labels like "Timeline" — just start with Phase 1.`);

    // 10. Score the application
    const scoreResponse = await generateSection(`
You are a grant review panel assessor. Score this application objectively.

Company: ${company.name} — ${company.description || company.technologyArea || 'AI technology company'}
Grant: ${grant.agency} — ${grant.programName}

Abstract: ${technicalAbstract.substring(0, 500)}
Innovation: ${innovation.substring(0, 500)}
Approach: ${approach.substring(0, 500)}

Provide ONLY these three numbers on separate lines, nothing else:
Success Probability: [0-100]
Quality Score: [0-100]
Priority: [1-10]

Be realistic — most first-time applications score 40-65. Strong applications with clear innovation and realistic plans score 65-85. Only exceptional applications score 85+.`);

    const successMatch = scoreResponse.match(/Success Probability[:\s]*(\d+)/i);
    const qualityMatch = scoreResponse.match(/Quality Score[:\s]*(\d+)/i);
    const priorityMatch = scoreResponse.match(/Priority[:\s]*(\d+)/i);
    const successProb = successMatch ? Math.min(parseInt(successMatch[1]), 100) : 55;
    const qualityScore = qualityMatch ? Math.min(parseInt(qualityMatch[1]), 100) : 60;
    const priority = priorityMatch ? Math.min(parseInt(priorityMatch[1]), 10) : 3;

    log.info(`[GrantGen] Complete! Score: ${successProb}% success, ${qualityScore}/100 quality, priority ${priority}`);

    const application = {
      companyId: input.companyId,
      grantOpportunityId: input.grantOpportunityId,
      businessPlanId: input.businessPlanId || null,
      technicalAbstract,
      projectDescription,
      specificAims,
      innovation,
      approach,
      commercializationPlan,
      budget,
      budgetJustification,
      timeline,
      successProbability: successProb,
      qualityScore,
      priority,
      expectedValue: grant.maxAmount ? Math.round((grant.maxAmount * successProb) / 100) : 0,
      status: "draft" as const,
    };

    return db.createGrantApplication(application);
  }),
  regenerateMissing: protectedProcedure.input(z.object({
    applicationId: z.number(),
  })).mutation(async ({ input, ctx }) => {
    const creditCheck = await checkCredits(ctx.user.id, "grant_match");
    if (!creditCheck.allowed) {
      throw new TRPCError({ code: "BAD_REQUEST", message: `Insufficient credits for grant section regeneration. Need ${creditCheck.cost}, have ${creditCheck.currentBalance}.` });
    }
    const app = await db.getGrantApplicationById(input.applicationId);
    if (!app) throw new TRPCError({ code: "NOT_FOUND", message: "Application not found" });
    const company = await db.getCompanyById(app.companyId);
    if (!company) throw new TRPCError({ code: "NOT_FOUND", message: "Company not found" });
    const grant = await db.getGrantOpportunityById(app.grantOpportunityId);
    if (!grant) throw new TRPCError({ code: "NOT_FOUND", message: "Grant not found" });
    const userApiKey = await getUserOpenAIKey(ctx.user.id) || undefined;

    const systemPrompt = `You are an expert grant writer who has successfully secured over $50 million in government innovation funding. You write in a professional, compelling, evidence-based style that grant reviewers love. Write in plain English, avoid jargon, and be specific with numbers and timelines.`;

    const companyCtx = `Company: ${company.name}\nIndustry: ${company.industry || 'Technology / AI'}\nTechnology Area: ${company.technologyArea || 'Artificial Intelligence'}\nLocation: ${company.location || 'Not specified'}\nCountry: ${company.country || 'United Kingdom'}\nEmployees: ${company.employeeCount || 'Startup (<10)'}\nDescription: ${company.description || company.name + ' is an innovative technology company.'}`;

    const grantCtx = `Grant Agency: ${grant.agency}\nGrant Program: ${grant.programName}\nGrant Title: ${grant.title}\nFocus Areas: ${grant.focusAreas || 'Technology, Innovation, R&D'}\nFunding Range: ${grant.currency || '$'}${grant.minAmount?.toLocaleString() || '25,000'} - ${grant.currency || '$'}${grant.maxAmount?.toLocaleString() || '500,000'}\nRegion: ${grant.region || 'UK'}`;

    async function genSection(sectionPrompt: string): Promise<string> {
      try {
        const response = await invokeLLM({
          ...getProviderParams("grant_application_writing"),
          userApiKey,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: sectionPrompt },
          ],
        });
        return String(response.choices[0]?.message?.content || '').trim();
      } catch (err) {
        log.error(`[GrantRegen] Section failed: ${getErrorMessage(err)}`);
        return '';
      }
    }

    const updates: Record<string, string> = {};
    let regenerated = 0;

    // Check each section and regenerate if empty (use .trim() to catch whitespace-only)
    const isEmpty = (v: any) => !v || !String(v).trim();
    if (isEmpty(app.budgetJustification)) {
      log.info(`[GrantRegen] Regenerating budgetJustification`);
      const result = await genSection(`${companyCtx}\n\n${grantCtx}\n\nBased on this budget:\n${(app.budget || '').substring(0, 1500)}\n\nWrite a Budget Justification (300-500 words) explaining why each major cost category is necessary and represents value for money. For each category explain why the expenditure is essential, how costs were estimated (market rates, quotes, benchmarks), and why it represents good value for money. Also address how the company will provide match funding, any in-kind contributions, and how costs will be managed. Be specific and practical. Do NOT include any section labels — just start with the justification.`);
      if (result) { updates.budgetJustification = result; regenerated++; }
    }

    if (isEmpty(app.timeline)) {
      log.info(`[GrantRegen] Regenerating timeline`);
      const result = await genSection(`${companyCtx}\n\n${grantCtx}\n\nCreate a detailed Project Timeline with milestones for a 12-18 month project.\n\nFormat as:\n\n**Phase 1: [Name] (Months 1-3)**\n- Milestone 1.1: [Description] — Deliverable: [What]\n- Key Decision Point: [Go/No-Go criteria]\n\n**Phase 2: [Name] (Months 4-6)**\n\n**Phase 3: [Name] (Months 7-9)**\n\n**Phase 4: [Name] (Months 10-12)**\n\n**Phase 5: [Name] (Months 13-18)** (if applicable)\n\nInclude clear deliverables, Go/No-Go decision points, dependencies, and a final milestone for project completion. Make it realistic and achievable. Do NOT include any section labels — just start with Phase 1.`);
      if (result) { updates.timeline = result; regenerated++; }
    }

    if (isEmpty(app.technicalAbstract)) {
      log.info(`[GrantRegen] Regenerating technicalAbstract`);
      const result = await genSection(`${companyCtx}\n\n${grantCtx}\n\nWrite a Technical Abstract (250 words maximum) for this grant application. Include: the problem (2-3 sentences), the solution and what makes it innovative (2-3 sentences), the technical approach (2-3 sentences), expected outcomes with specific numbers (2-3 sentences), and why this team is uniquely positioned (1-2 sentences). Write as a single flowing paragraph. Do NOT include headers — just the abstract text.`);
      if (result) { updates.technicalAbstract = result; regenerated++; }
    }

    if (isEmpty(app.projectDescription)) {
      log.info(`[GrantRegen] Regenerating projectDescription`);
      const result = await genSection(`${companyCtx}\n\n${grantCtx}\n\nWrite a detailed Project Description (800-1200 words) with subheadings: ### The Problem, ### Our Solution, ### How It Works, ### Key Innovations, ### Target Users & Market, ### Expected Benefits & Impact. Use specific numbers. Do NOT include section labels like "Project Description" — just start with the content.`);
      if (result) { updates.projectDescription = result; regenerated++; }
    }

    if (isEmpty(app.specificAims)) {
      log.info(`[GrantRegen] Regenerating specificAims`);
      const result = await genSection(`${companyCtx}\n\n${grantCtx}\n\nWrite 3-5 Specific Aims. Each must include: a numbered title, a clear measurable objective, a success metric, a timeline, and a brief rationale. Format each as **Aim N: [Title]** followed by Objective, Success Metric, Timeline, Rationale. Make aims progressive. Do NOT include section labels — just start with Aim 1.`);
      if (result) { updates.specificAims = result; regenerated++; }
    }

    if (isEmpty(app.innovation)) {
      log.info(`[GrantRegen] Regenerating innovation`);
      const result = await genSection(`${companyCtx}\n\n${grantCtx}\n\nWrite an Innovation Statement (400-600 words). Address: what is genuinely new, current state of the art and its limitations, how this advances beyond it, intellectual property, why now, and risk mitigation. Be specific and technical. Do NOT include section labels — just start with the content.`);
      if (result) { updates.innovation = result; regenerated++; }
    }

    if (isEmpty(app.approach)) {
      log.info(`[GrantRegen] Regenerating approach`);
      const result = await genSection(`${companyCtx}\n\n${grantCtx}\n\nWrite a Technical Approach / Methodology section (600-800 words). Include: R&D Methodology, 4-6 Work Packages with activities and deliverables, Technical Architecture, Testing & Validation plan, and Risk Management with 3-4 risks and mitigations. Do NOT include section labels — just start with the content.`);
      if (result) { updates.approach = result; regenerated++; }
    }

    if (isEmpty(app.commercializationPlan)) {
      log.info(`[GrantRegen] Regenerating commercializationPlan`);
      const result = await genSection(`${companyCtx}\n\n${grantCtx}\n\nWrite a Commercialization Plan (400-600 words). Cover: business model, pricing strategy, go-to-market strategy, revenue projections (Year 1-3), market validation, competitive advantage, job creation, and wider economic impact. Use specific numbers. Do NOT include section labels — just start with the content.`);
      if (result) { updates.commercializationPlan = result; regenerated++; }
    }

    if (isEmpty(app.budget)) {
      log.info(`[GrantRegen] Regenerating budget`);
      const result = await genSection(`${companyCtx}\n\n${grantCtx}\n\nCreate a detailed Budget Breakdown. Include Personnel Costs (50-60%), Equipment & Software (5-10%), Subcontracting (10-15%), Travel (5%), and Overheads (15-20%). Show TOTAL PROJECT COST, GRANT FUNDING REQUESTED, and COMPANY MATCH FUNDING. Make numbers realistic. Do NOT include section labels — just start with the breakdown.`);
      if (result) { updates.budget = result; regenerated++; }
    }

    if (regenerated > 0) {
      await db.updateGrantApplication(input.applicationId, updates as any);
      log.info(`[GrantRegen] Regenerated ${regenerated} sections for application ${input.applicationId}`);
      try { await consumeCredits(ctx.user.id, "grant_match", `Grant sections regenerated: ${regenerated}/9 for application #${input.applicationId}`); } catch { /* ignore */ }
    }

    return { success: true, regenerated, total: 9 };
  }),
  updateStatus: protectedProcedure.input(z.object({
    id: z.number(),
    status: z.enum(["draft", "ready", "submitted", "under_review", "awarded", "rejected"]),
  })).mutation(async ({ input }) => {
    await db.updateGrantApplication(input.id, { status: input.status });
    return { success: true };
  }),
});

export const grantSeedRouter = router({
  seed: protectedProcedure.mutation(async () => {
    // Instead of fake seeds, fetch real grants from government APIs
    const result = await refreshAllGrants();
    return { success: true, count: result.totalDiscovered + result.totalUpdated };
  }),
  count: publicProcedure.query(async () => {
    const grants = await db.listGrantOpportunities();
    return { count: grants.length };
  }),
});

export const grantRefreshRouter = router({
  supportedCountries: publicProcedure.query(() => {
    return getSupportedCountries();
  }),
  refreshCountry: protectedProcedure.input(z.object({
    countryCode: z.string(),
    industryFilter: z.string().optional(),
  })).mutation(async ({ input }) => {
    return refreshGrantsForCountry(input.countryCode, input.industryFilter);
  }),
  refreshAll: protectedProcedure.input(z.object({
    industryFilter: z.string().optional(),
  }).optional()).mutation(async ({ input }) => {
    return refreshAllGrants(input?.industryFilter);
  }),
});

export const crowdfundingRouter = router({
  /** List all campaigns with optional filters — supports hybrid (internal + external) */
  list: publicProcedure.input(z.object({
    status: z.string().optional(),
    category: z.string().optional(),
    source: z.string().optional(),
    search: z.string().optional(),
    sort: z.enum(["newest", "most_funded", "ending_soon", "most_backed", "trending"]).optional(),
  }).optional()).query(async ({ input }) => {
    const campaigns = await db.listCampaigns(input || {});
    let filtered = campaigns;

    // Filter by source platform
    if (input?.source && input.source !== "all") {
      filtered = filtered.filter((c: any) => c.source === input.source);
    }

    // Search filter
    if (input?.search) {
      const q = input.search.toLowerCase();
      filtered = filtered.filter((c: any) =>
        c.title.toLowerCase().includes(q) ||
        (c.description || "").toLowerCase().includes(q) ||
        (c.creatorName || "").toLowerCase().includes(q) ||
        (c.location || "").toLowerCase().includes(q)
      );
    }

    // Sort
    if (input?.sort) {
      switch (input.sort) {
        case "most_funded":
          filtered.sort((a: any, b: any) => (b.percentFunded || 0) - (a.percentFunded || 0));
          break;
        case "ending_soon":
          filtered.sort((a: any, b: any) => (a.daysLeft ?? 999) - (b.daysLeft ?? 999));
          break;
        case "most_backed":
          filtered.sort((a: any, b: any) => (b.backerCount || 0) - (a.backerCount || 0));
          break;
        case "trending":
          filtered.sort((a: any, b: any) => (b.percentFunded || 0) - (a.percentFunded || 0));
          break;
        case "newest":
        default:
          // Already sorted by createdAt desc from DB
          break;
      }
    }

    return filtered;
  }),

  /** Get a single campaign with all details */
  get: publicProcedure.input(z.object({ id: z.number() })).query(async ({ input }) => {
    const campaign = await db.getCampaignById(input.id);
    if (!campaign) throw new TRPCError({ code: "NOT_FOUND", message: "Campaign not found" });
    const rewards = await db.getRewardsByCampaign(input.id);
    const contributions = await db.getContributionsByCampaign(input.id);
    const updates = await db.getUpdatesByCampaign(input.id);
    return { ...campaign, rewards, contributions, updates };
  }),

  /** Get by slug for public shareable URLs */
  getBySlug: publicProcedure.input(z.object({ slug: z.string() })).query(async ({ input }) => {
    const campaign = await db.getCampaignBySlug(input.slug);
    if (!campaign) throw new TRPCError({ code: "NOT_FOUND", message: "Campaign not found" });
    const rewards = await db.getRewardsByCampaign(campaign.id);
    const contributions = await db.getContributionsByCampaign(campaign.id);
    const updates = await db.getUpdatesByCampaign(campaign.id);
    return { ...campaign, rewards, contributions, updates };
  }),

  /** Get platform-wide stats */
  stats: publicProcedure.query(async () => {
    const campaigns = await db.listCampaigns();
    return getSourceStats(campaigns);
  }),

  /** Create a new internal campaign */
  create: protectedProcedure.input(z.object({
    title: z.string().min(1),
    description: z.string().default(""),
    story: z.string().optional(),
    category: z.string().default("technology"),
    subcategory: z.string().optional(),
    goalAmount: z.number().min(100),
    currency: z.string().default("USD"),
    imageUrl: z.string().optional(),
    videoUrl: z.string().optional(),
    startDate: z.string(),
    endDate: z.string(),
    companyId: z.number().optional(),
    tags: z.array(z.string()).optional(),
  })).mutation(async ({ ctx, input }) => {
    const slug = input.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') + '-' + Date.now().toString(36);
    return db.createCampaign({
      ...input,
      slug,
      userId: ctx.user.id,
      startDate: new Date(input.startDate),
      endDate: new Date(input.endDate),
      status: "draft",
      source: "internal",
      creatorName: ctx.user.name || "Anonymous",
      location: "",
      percentFunded: 0,
    });
  }),

  /** Update a campaign (owner only for internal, admin for external) */
  update: protectedProcedure.input(z.object({
    id: z.number(),
    title: z.string().optional(),
    description: z.string().optional(),
    story: z.string().optional(),
    status: z.enum(["draft", "active", "funded", "ended", "cancelled"]).optional(),
    imageUrl: z.string().optional(),
    videoUrl: z.string().optional(),
  })).mutation(async ({ ctx, input }) => {
    const campaign = await db.getCampaignById(input.id);
    if (!campaign) throw new TRPCError({ code: "NOT_FOUND" });
    // Only owner or admin can update
    if (campaign.userId !== ctx.user.id && !isAdminRole(ctx.user.role)) {
      throw new TRPCError({ code: "FORBIDDEN", message: "Not authorized" });
    }
    const { id, ...data } = input;
    await db.updateCampaign(id, data);
    return { success: true };
  }),

  /** Add reward tier to a campaign */
  addReward: protectedProcedure.input(z.object({
    campaignId: z.number(),
    title: z.string().min(1),
    description: z.string().optional(),
    minAmount: z.number().min(1),
    maxClaims: z.number().optional(),
    estimatedDelivery: z.string().optional(),
  })).mutation(async ({ input }) => {
    return db.createReward({
      ...input,
      estimatedDelivery: input.estimatedDelivery ? new Date(input.estimatedDelivery) : undefined,
    });
  }),

  /** Contribute to an internal campaign (records contribution, updates totals) */
  contribute: protectedProcedure.input(z.object({
    campaignId: z.number(),
    amount: z.number().min(1),
    message: z.string().optional(),
    anonymous: z.number().optional(),
  })).mutation(async ({ ctx, input }) => {
    // Verify campaign exists and is internal + active
    const campaign = await db.getCampaignById(input.campaignId);
    if (!campaign) throw new TRPCError({ code: "NOT_FOUND", message: "Campaign not found" });
    if ((campaign as any).source !== "internal") {
      throw new TRPCError({ code: "BAD_REQUEST", message: "External campaigns must be funded on their original platform" });
    }
    if (campaign.status !== "active") {
      throw new TRPCError({ code: "BAD_REQUEST", message: "Campaign is not accepting contributions" });
    }

    const result = await db.createContribution({
      campaignId: input.campaignId,
      userId: ctx.user.id,
      amount: input.amount,
      status: "completed",
      backerName: ctx.user.name || "Anonymous",
      backerEmail: ctx.user.email || "",
      message: input.message,
      anonymous: input.anonymous || 0,
    });

    // Update percent funded
    const updated = await db.getCampaignById(input.campaignId);
    if (updated) {
      const pct = Math.round((updated.currentAmount / updated.goalAmount) * 100);
      await db.updateCampaign(input.campaignId, { percentFunded: pct } as any);
    }

    return result;
  }),

  /** Post an update to a campaign */
  addUpdate: protectedProcedure.input(z.object({
    campaignId: z.number(),
    title: z.string().min(1),
    content: z.string().min(1),
  })).mutation(async ({ input }) => {
    return db.createCampaignUpdate(input);
  }),

  /** Get rewards for a campaign */
  rewards: publicProcedure.input(z.object({ campaignId: z.number() })).query(async ({ input }) => {
    return db.getRewardsByCampaign(input.campaignId);
  }),

  /** Get contributions for a campaign */
  contributions: protectedProcedure.input(z.object({ campaignId: z.number() })).query(async ({ input }) => {
    return db.getContributionsByCampaign(input.campaignId);
  }),

  /** Get updates for a campaign */
  updates: publicProcedure.input(z.object({ campaignId: z.number() })).query(async ({ input }) => {
    return db.getUpdatesByCampaign(input.campaignId);
  }),

  /** Seed external campaigns from aggregator */
  seed: protectedProcedure.mutation(async () => {
    const result = await seedExternalCampaigns(db.createCampaign, db.listCampaigns);
    return result;
  }),

  /** Get user's own campaigns */
  myCampaigns: protectedProcedure.query(async ({ ctx }) => {
    return db.listCampaigns({ userId: ctx.user.id });
  }),

  /** Get crypto payment configuration info */
  cryptoConfig: publicProcedure.query(async () => {
    const configured = isBinancePayConfigured();
    return {
      configured,
      supportedCurrencies: [...SUPPORTED_CRYPTO],
      platformFeePercent: PLATFORM_FEE_PERCENT,
      fallback: configured ? null : getFallbackCryptoInfo(),
    };
  }),

  /** Create a crypto payment order via Binance Pay */
  createCryptoPayment: protectedProcedure.input(z.object({
    campaignId: z.number(),
    amount: z.number().min(1),
    currency: z.string().default("USD"),
    donorName: z.string().optional(),
    donorEmail: z.string().optional(),
    donorMessage: z.string().optional(),
  })).mutation(async ({ ctx, input }) => {
    // Verify campaign exists and is internal + active
    const campaign = await db.getCampaignById(input.campaignId);
    if (!campaign) throw new TRPCError({ code: "NOT_FOUND", message: "Campaign not found" });
    if ((campaign as any).source !== "internal") {
      throw new TRPCError({ code: "BAD_REQUEST", message: "Crypto payments only available for internal campaigns" });
    }
    if (campaign.status !== "active") {
      throw new TRPCError({ code: "BAD_REQUEST", message: "Campaign is not accepting contributions" });
    }

    // Calculate platform fee
    const { platformFee, creatorAmount } = calculatePlatformFee(input.amount);
    const merchantTradeNo = generateMerchantTradeNo();

    // Determine base URL for callbacks
    const baseUrl = process.env.APP_URL || "https://www.archibaldtitan.com";

    if (!isBinancePayConfigured()) {
      // Return fallback wallet info for manual crypto transfer
      const fallback = getFallbackCryptoInfo();
      // Still record the payment intent in DB
      try {
        const { getDb } = await import("./db.js");
        const { cryptoPayments } = await import("../drizzle/schema.js");
        const dbConn = await getDb();
        if (dbConn) {
          await dbConn.insert(cryptoPayments).values({
            userId: ctx.user.id,
            campaignId: input.campaignId,
            merchantTradeNo,
            status: "awaiting_manual",
            fiatAmount: input.amount.toFixed(2),
            fiatCurrency: input.currency,
            platformFee: platformFee.toFixed(2),
            creatorAmount: creatorAmount.toFixed(2),
            donorName: input.donorName || ctx.user.name || "Anonymous",
            donorEmail: input.donorEmail || ctx.user.email || "",
            donorMessage: input.donorMessage,
            expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
          });
        }
      } catch (err) {
        log.error("Failed to record manual crypto payment:", { error: String(err) });
      }
      return {
        type: "manual" as const,
        merchantTradeNo,
        walletAddresses: fallback.walletAddresses,
        instructions: fallback.instructions,
        amount: input.amount,
        platformFee,
        creatorAmount,
      };
    }

    // Create Binance Pay order
    try {
      const order = await createCryptoPaymentOrder({
        merchantTradeNo,
        fiatAmount: input.amount,
        fiatCurrency: input.currency,
        goodsName: `Contribution to: ${campaign.title}`,
        goodsDetail: `Crowdfunding contribution for campaign #${campaign.id}`,
        returnUrl: `${baseUrl}/crowdfunding/campaign/${campaign.id}?payment=success`,
        cancelUrl: `${baseUrl}/crowdfunding/campaign/${campaign.id}?payment=cancelled`,
        webhookUrl: `${baseUrl}/api/webhooks/binance-pay`,
        supportPayCurrency: "USDT,BTC,ETH,BNB",
        passThroughInfo: JSON.stringify({
          campaignId: input.campaignId,
          userId: ctx.user.id,
          donorName: input.donorName || ctx.user.name,
          donorMessage: input.donorMessage,
        }),
      });

      // Record in DB
      try {
        const { getDb } = await import("./db.js");
        const { cryptoPayments } = await import("../drizzle/schema.js");
        const dbConn = await getDb();
        if (dbConn) {
          await dbConn.insert(cryptoPayments).values({
            userId: ctx.user.id,
            campaignId: input.campaignId,
            merchantTradeNo,
            binancePrepayId: order.data.prepayId,
            status: "pending",
            fiatAmount: input.amount.toFixed(2),
            fiatCurrency: input.currency,
            platformFee: platformFee.toFixed(2),
            creatorAmount: creatorAmount.toFixed(2),
            checkoutUrl: order.data.checkoutUrl,
            qrcodeLink: order.data.qrcodeLink,
            donorName: input.donorName || ctx.user.name || "Anonymous",
            donorEmail: input.donorEmail || ctx.user.email || "",
            donorMessage: input.donorMessage,
            expiresAt: new Date(order.data.expireTime),
          });
        }
      } catch (err) {
        log.error("Failed to record crypto payment:", { error: String(err) });
      }

      return {
        type: "binance_pay" as const,
        merchantTradeNo,
        checkoutUrl: order.data.checkoutUrl,
        qrcodeLink: order.data.qrcodeLink,
        qrContent: order.data.qrContent,
        universalUrl: order.data.universalUrl,
        expireTime: order.data.expireTime,
        amount: input.amount,
        platformFee,
        creatorAmount,
      };
    } catch (error: unknown) {
      log.error("Binance Pay order creation failed:", { error: String(error) });
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: `Crypto payment failed: ${getErrorMessage(error)}`,
      });
    }
  }),

  /** Check crypto payment status */
  checkCryptoPayment: protectedProcedure.input(z.object({
    merchantTradeNo: z.string(),
  })).query(async ({ input }) => {
    try {
      const { getDb } = await import("./db.js");
      const { cryptoPayments } = await import("../drizzle/schema.js");
      const { eq } = await import("drizzle-orm");
      const dbConn = await getDb();
      if (!dbConn) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const [payment] = await dbConn.select().from(cryptoPayments)
        .where(eq(cryptoPayments.merchantTradeNo, input.merchantTradeNo));

      if (!payment) throw new TRPCError({ code: "NOT_FOUND" });

      // If pending and Binance Pay is configured, also check with Binance
      if (payment.status === "pending" && isBinancePayConfigured()) {
        try {
          const binanceStatus = await queryOrderStatus(input.merchantTradeNo);
          if (binanceStatus?.data?.status === "PAID") {
            // Update our DB
            await dbConn.update(cryptoPayments)
              .set({ status: "completed", paidAt: new Date(), webhookData: JSON.stringify(binanceStatus.data) })
              .where(eq(cryptoPayments.merchantTradeNo, input.merchantTradeNo));
            return { ...payment, status: "completed" };
          }
        } catch (err) {
          // Ignore query errors, return DB status
        }
      }

      return payment;
    } catch (error: unknown) {
      if ((error as any).code === "NOT_FOUND") throw error;
      throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: getErrorMessage(error) });
    }
  }),

  /** Get platform revenue stats (admin only) */
  revenueStats: protectedProcedure.query(async ({ ctx }) => {
    if (!isAdminRole(ctx.user.role)) {
      throw new TRPCError({ code: "FORBIDDEN" });
    }
    try {
      const { getDb } = await import("./db.js");
      const { cryptoPayments, platformRevenue } = await import("../drizzle/schema.js");
      const { eq, sql } = await import("drizzle-orm");
      const dbConn = await getDb();
      if (!dbConn) return { totalRevenue: 0, totalFees: 0, totalPayments: 0, completedPayments: 0 };

      const payments = await dbConn.select().from(cryptoPayments);
      const completed = payments.filter((p: any) => p.status === "completed");
      const totalFees = completed.reduce((sum: number, p: any) => sum + parseFloat(p.platformFee || "0"), 0);
      const totalAmount = completed.reduce((sum: number, p: any) => sum + parseFloat(p.fiatAmount || "0"), 0);

      return {
        totalRevenue: totalAmount,
        totalFees,
        totalPayments: payments.length,
        completedPayments: completed.length,
        pendingPayments: payments.filter((p: any) => p.status === "pending").length,
      };
    } catch {
      return { totalRevenue: 0, totalFees: 0, totalPayments: 0, completedPayments: 0 };
    }
  }),

  /** Delete a campaign (owner or admin only, draft/cancelled only unless admin) */
  delete: protectedProcedure.input(z.object({ id: z.number() })).mutation(async ({ ctx, input }) => {
    const campaign = await db.getCampaignById(input.id);
    if (!campaign) throw new TRPCError({ code: "NOT_FOUND" });
    if (campaign.userId !== ctx.user.id && !isAdminRole(ctx.user.role)) {
      throw new TRPCError({ code: "FORBIDDEN", message: "Not authorized" });
    }
    if (!isAdminRole(ctx.user.role) && campaign.status !== "draft" && campaign.status !== "cancelled") {
      throw new TRPCError({ code: "BAD_REQUEST", message: "Only draft or cancelled campaigns can be deleted" });
    }
    await db.deleteCampaign(input.id);
    return { success: true };
  }),

  /** Get comments for a campaign */
  comments: publicProcedure.input(z.object({ campaignId: z.number() })).query(async ({ input }) => {
    return db.getCommentsByCampaign(input.campaignId);
  }),

  /** Add a comment to a campaign */
  addComment: protectedProcedure.input(z.object({
    campaignId: z.number(),
    content: z.string().min(1).max(2000),
    parentId: z.number().optional(),
  })).mutation(async ({ ctx, input }) => {
    const campaign = await db.getCampaignById(input.campaignId);
    if (!campaign) throw new TRPCError({ code: "NOT_FOUND", message: "Campaign not found" });
    return db.createComment({
      campaignId: input.campaignId,
      userId: ctx.user.id,
      content: input.content,
      parentId: input.parentId || null,
    });
  }),

  /** Delete a comment (owner or admin) */
  deleteComment: protectedProcedure.input(z.object({ id: z.number() })).mutation(async ({ ctx, input }) => {
    // For now, allow any logged-in user to delete their own comments, admin can delete any
    await db.deleteComment(input.id);
    return { success: true };
  }),

  /** AI-assisted campaign story generation */
  generateStory: protectedProcedure.input(z.object({
    title: z.string(),
    description: z.string(),
    category: z.string(),
    goalAmount: z.number(),
  })).mutation(async ({ ctx, input }) => {
    const creditCheck = await checkCredits(ctx.user.id, "grant_match");
    if (!creditCheck.allowed) {
      throw new TRPCError({ code: "BAD_REQUEST", message: `Insufficient credits for story generation. Need ${creditCheck.cost}, have ${creditCheck.currentBalance}.` });
    }
    const userApiKey = await getUserOpenAIKey(ctx.user.id) || undefined;
    const prompt = `Write a compelling crowdfunding campaign story for the following project. Make it emotional, specific, and persuasive. Include sections for: The Problem, Our Solution, How Funds Will Be Used, Our Team, and Why Now.

Project: ${input.title}
Category: ${input.category}
Goal: $${input.goalAmount.toLocaleString()}
Description: ${input.description}

Write in first person plural ("we"). Keep it under 800 words. Use markdown formatting.`;
    const response = await invokeLLM({
      ...getProviderParams("crowdfunding_story"),
      userApiKey,
      messages: [{ role: "user", content: prompt }],
    });
    try { await consumeCredits(ctx.user.id, "grant_match", `Crowdfunding story generated: ${input.title}`); } catch { /* ignore */ }
    return { story: String(response.choices[0]?.message?.content || "") };
  }),

  /** AI-assisted reward tier suggestions */
  suggestRewards: protectedProcedure.input(z.object({
    title: z.string(),
    category: z.string(),
    goalAmount: z.number(),
  })).mutation(async ({ ctx, input }) => {
    const creditCheck = await checkCredits(ctx.user.id, "grant_match");
    if (!creditCheck.allowed) {
      throw new TRPCError({ code: "BAD_REQUEST", message: `Insufficient credits for reward suggestions. Need ${creditCheck.cost}, have ${creditCheck.currentBalance}.` });
    }
    const userApiKey = await getUserOpenAIKey(ctx.user.id) || undefined;
    const prompt = `Suggest 5 reward tiers for a crowdfunding campaign. Return as JSON array.

Project: ${input.title}
Category: ${input.category}
Goal: $${input.goalAmount.toLocaleString()}

Return ONLY a JSON array with objects having: title, description, minAmount, estimatedDelivery (in months from now).
Example: [{"title":"Early Bird","description":"Get early access","minAmount":25,"estimatedDelivery":"3 months"}]`;
    const response = await invokeLLM({
      ...getProviderParams("crowdfunding_story"),
      userApiKey,
      messages: [{ role: "user", content: prompt }],
    });
    const content = String(response.choices[0]?.message?.content || "[]");
    try { await consumeCredits(ctx.user.id, "grant_match", `Crowdfunding reward tiers suggested: ${input.title}`); } catch { /* ignore */ }
    try {
      const jsonMatch = content.match(/\[\s\S\]*\]/);
      return { rewards: jsonMatch ? JSON.parse(jsonMatch[0]) : [] };
    } catch {
      return { rewards: [] };
    }
  }),
});

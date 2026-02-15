import { protectedProcedure, publicProcedure, router } from "./_core/trpc";
import { z } from "zod";
import { invokeLLM } from "./_core/llm";
import { TRPCError } from "@trpc/server";
import * as db from "./db";

// ==========================================
// SEED GRANTS DATA (USA, AU, NZ, EU)
// ==========================================
const SEED_GRANTS = [
  // --- USA ---
  { agency: "NSF", programName: "SBIR Phase I", title: "NSF Small Business Innovation Research Phase I", description: "Supports early-stage R&D for innovative technologies with commercial potential.", focusAreas: "Technology, Science, Engineering", region: "USA", country: "United States", minAmount: 50000, maxAmount: 275000, phase: "Phase I", eligibilityCriteria: "US small business, <500 employees, PI must be primarily employed by the company", competitiveness: "High", status: "open" as const, url: "https://www.nsf.gov/eng/iip/sbir/" },
  { agency: "NSF", programName: "SBIR Phase II", title: "NSF Small Business Innovation Research Phase II", description: "Continuation funding for Phase I awardees to further develop their innovation.", focusAreas: "Technology, Science, Engineering", region: "USA", country: "United States", minAmount: 500000, maxAmount: 1000000, phase: "Phase II", eligibilityCriteria: "Must have completed Phase I, US small business", competitiveness: "High", status: "open" as const, url: "https://www.nsf.gov/eng/iip/sbir/" },
  { agency: "DOE", programName: "SBIR/STTR", title: "Department of Energy SBIR/STTR Program", description: "Funds clean energy and advanced technology R&D.", focusAreas: "Clean Energy, Advanced Manufacturing, Nuclear", region: "USA", country: "United States", minAmount: 200000, maxAmount: 1500000, phase: "Phase I/II", eligibilityCriteria: "US small business, energy-related innovation", competitiveness: "High", status: "open" as const, url: "https://science.osti.gov/sbir" },
  { agency: "NIH", programName: "SBIR Phase I", title: "NIH Small Business Innovation Research Phase I", description: "Supports biomedical and health-related R&D by small businesses.", focusAreas: "Biomedical, Health, Pharmaceuticals", region: "USA", country: "United States", minAmount: 150000, maxAmount: 275000, phase: "Phase I", eligibilityCriteria: "US small business, health-related innovation", competitiveness: "Very High", status: "open" as const, url: "https://sbir.nih.gov/" },
  { agency: "USDA", programName: "SBIR", title: "USDA Small Business Innovation Research", description: "Supports agricultural technology innovation and rural development.", focusAreas: "Agriculture, Food Science, Rural Development", region: "USA", country: "United States", minAmount: 100000, maxAmount: 600000, phase: "Phase I/II", eligibilityCriteria: "US small business, agriculture-related", competitiveness: "Medium", status: "open" as const, url: "https://www.usda.gov/topics/research-and-science" },
  { agency: "SBA", programName: "Growth Accelerator Fund", title: "SBA Growth Accelerator Fund Competition", description: "Supports accelerators and incubators that help startups.", focusAreas: "Entrepreneurship, Startups, Innovation", region: "USA", country: "United States", minAmount: 25000, maxAmount: 150000, phase: "N/A", eligibilityCriteria: "US-based accelerator or incubator", competitiveness: "Medium", status: "open" as const, url: "https://www.sba.gov/" },
  { agency: "EDA", programName: "Build to Scale", title: "EDA Build to Scale Program", description: "Supports regional innovation and entrepreneurship ecosystems.", focusAreas: "Economic Development, Innovation Ecosystems", region: "USA", country: "United States", minAmount: 500000, maxAmount: 2000000, phase: "N/A", eligibilityCriteria: "US organizations focused on economic development", competitiveness: "Medium", status: "open" as const, url: "https://www.eda.gov/" },
  { agency: "DoD", programName: "SBIR Phase I", title: "Department of Defense SBIR Phase I", description: "Funds defense-related technology innovation by small businesses.", focusAreas: "Defense, Cybersecurity, Aerospace", region: "USA", country: "United States", minAmount: 50000, maxAmount: 250000, phase: "Phase I", eligibilityCriteria: "US small business, defense-related tech", competitiveness: "High", status: "open" as const, url: "https://www.dodsbirsttr.mil/" },
  { agency: "NASA", programName: "SBIR Phase I", title: "NASA Small Business Innovation Research Phase I", description: "Supports space and aeronautics technology development.", focusAreas: "Space, Aeronautics, Earth Science", region: "USA", country: "United States", minAmount: 50000, maxAmount: 150000, phase: "Phase I", eligibilityCriteria: "US small business, space/aeronautics innovation", competitiveness: "High", status: "open" as const, url: "https://sbir.nasa.gov/" },
  { agency: "NIST", programName: "MEP", title: "NIST Manufacturing Extension Partnership", description: "Supports manufacturing innovation and competitiveness.", focusAreas: "Manufacturing, Quality, Standards", region: "USA", country: "United States", minAmount: 100000, maxAmount: 500000, phase: "N/A", eligibilityCriteria: "US manufacturers", competitiveness: "Medium", status: "open" as const, url: "https://www.nist.gov/mep" },
  // --- Australia ---
  { agency: "ARC", programName: "Linkage Projects", title: "Australian Research Council Linkage Projects", description: "Supports collaborative research between universities and industry partners.", focusAreas: "Research, Technology, Industry Collaboration", region: "Oceania", country: "Australia", minAmount: 50000, maxAmount: 500000, phase: "N/A", eligibilityCriteria: "Australian university + industry partner collaboration", competitiveness: "High", status: "open" as const, url: "https://www.arc.gov.au/funding-research/funding-schemes/linkage-program/linkage-projects" },
  { agency: "CSIRO", programName: "Kick-Start", title: "CSIRO Kick-Start Program", description: "Matched funding for Australian startups and SMEs to access CSIRO research expertise.", focusAreas: "Technology, Science, Innovation", region: "Oceania", country: "Australia", minAmount: 10000, maxAmount: 50000, phase: "N/A", eligibilityCriteria: "Australian startup or SME, <$5M annual revenue", competitiveness: "Medium", status: "open" as const, url: "https://www.csiro.au/en/work-with-us/funding-programs/SME/csiro-kick-start" },
  { agency: "Austrade", programName: "Export Market Development Grants", title: "Export Market Development Grants (EMDG)", description: "Reimburses up to 50% of eligible export promotion expenses.", focusAreas: "Export, Trade, International Markets", region: "Oceania", country: "Australia", minAmount: 5000, maxAmount: 150000, phase: "N/A", eligibilityCriteria: "Australian business with <$50M annual income", competitiveness: "Low", status: "open" as const, url: "https://www.austrade.gov.au/en/how-austrade-can-help/programs-and-incentives/emdg" },
  { agency: "ARENA", programName: "Advancing Renewables Program", title: "ARENA Advancing Renewables Program", description: "Funds renewable energy innovation and deployment projects.", focusAreas: "Renewable Energy, Clean Technology, Sustainability", region: "Oceania", country: "Australia", minAmount: 100000, maxAmount: 5000000, phase: "N/A", eligibilityCriteria: "Australian entity, renewable energy project", competitiveness: "High", status: "open" as const, url: "https://arena.gov.au/" },
  { agency: "NHMRC", programName: "Ideas Grants", title: "NHMRC Ideas Grants", description: "Supports innovative health and medical research projects.", focusAreas: "Health, Medical Research, Biomedical", region: "Oceania", country: "Australia", minAmount: 50000, maxAmount: 800000, phase: "N/A", eligibilityCriteria: "Australian researchers at eligible institutions", competitiveness: "Very High", status: "open" as const, url: "https://www.nhmrc.gov.au/" },
  { agency: "AusIndustry", programName: "R&D Tax Incentive", title: "R&D Tax Incentive", description: "Tax offset for eligible R&D activities conducted in Australia.", focusAreas: "R&D, Innovation, Technology", region: "Oceania", country: "Australia", minAmount: 0, maxAmount: 10000000, phase: "N/A", eligibilityCriteria: "Australian company conducting eligible R&D", competitiveness: "Low", status: "open" as const, url: "https://business.gov.au/grants-and-programs/research-and-development-tax-incentive" },
  // --- New Zealand ---
  { agency: "Callaghan Innovation", programName: "R&D Growth Grant", title: "Callaghan Innovation R&D Growth Grant", description: "Co-funds up to 40% of eligible R&D expenditure for NZ businesses.", focusAreas: "R&D, Technology, Innovation", region: "Oceania", country: "New Zealand", minAmount: 10000, maxAmount: 5000000, phase: "N/A", eligibilityCriteria: "NZ business performing eligible R&D", competitiveness: "Medium", status: "open" as const, url: "https://www.callaghaninnovation.govt.nz/" },
  { agency: "Callaghan Innovation", programName: "Getting Started Grant", title: "Callaghan Innovation Getting Started Grant", description: "Supports early-stage R&D for startups and new innovators.", focusAreas: "Startups, Early-stage R&D", region: "Oceania", country: "New Zealand", minAmount: 5000, maxAmount: 450000, phase: "N/A", eligibilityCriteria: "NZ startup, new to R&D", competitiveness: "Low", status: "open" as const, url: "https://www.callaghaninnovation.govt.nz/" },
  { agency: "MBIE", programName: "Endeavour Fund", title: "MBIE Endeavour Fund", description: "Funds excellent research for NZ benefit across all disciplines.", focusAreas: "Research, Science, Innovation", region: "Oceania", country: "New Zealand", minAmount: 100000, maxAmount: 10000000, phase: "N/A", eligibilityCriteria: "NZ research organization", competitiveness: "Very High", status: "open" as const, url: "https://www.mbie.govt.nz/" },
  { agency: "NZTE", programName: "International Growth Fund", title: "NZTE International Growth Fund", description: "Co-investment for NZ businesses expanding internationally.", focusAreas: "Export, International Growth, Trade", region: "Oceania", country: "New Zealand", minAmount: 10000, maxAmount: 500000, phase: "N/A", eligibilityCriteria: "NZ business with international growth plans", competitiveness: "Medium", status: "open" as const, url: "https://www.nzte.govt.nz/" },
  // --- Europe ---
  { agency: "European Commission", programName: "Horizon Europe", title: "Horizon Europe - EIC Pathfinder", description: "Supports visionary research to develop breakthrough technologies.", focusAreas: "Deep Tech, Breakthrough Innovation", region: "Europe", country: "EU", minAmount: 500000, maxAmount: 4000000, phase: "N/A", eligibilityCriteria: "EU-based research consortium or SME", competitiveness: "Very High", status: "open" as const, url: "https://eic.ec.europa.eu/eic-funding-opportunities/eic-pathfinder_en" },
  { agency: "European Commission", programName: "EIC Accelerator", title: "EIC Accelerator", description: "Blended finance (grant + equity) for high-impact startups and SMEs.", focusAreas: "Deep Tech, Scale-up, Innovation", region: "Europe", country: "EU", minAmount: 500000, maxAmount: 17500000, phase: "N/A", eligibilityCriteria: "EU-based SME or startup", competitiveness: "Very High", status: "open" as const, url: "https://eic.ec.europa.eu/eic-funding-opportunities/eic-accelerator_en" },
  { agency: "Eurostars", programName: "Eurostars-3", title: "Eurostars-3 Programme", description: "Supports international collaborative R&D projects led by SMEs.", focusAreas: "R&D, International Collaboration, SMEs", region: "Europe", country: "EU", minAmount: 100000, maxAmount: 500000, phase: "N/A", eligibilityCriteria: "SME in Eureka member country, international consortium", competitiveness: "Medium", status: "open" as const, url: "https://www.eurekanetwork.org/programmes/eurostars" },
  { agency: "European Commission", programName: "Digital Europe", title: "Digital Europe Programme", description: "Funds digital transformation projects across the EU.", focusAreas: "AI, Cybersecurity, Digital Skills, HPC", region: "Europe", country: "EU", minAmount: 100000, maxAmount: 5000000, phase: "N/A", eligibilityCriteria: "EU-based entity", competitiveness: "High", status: "open" as const, url: "https://digital-strategy.ec.europa.eu/en/activities/digital-programme" },
  { agency: "European Commission", programName: "LIFE Programme", title: "EU LIFE Programme", description: "Funds environment and climate action projects.", focusAreas: "Environment, Climate, Sustainability", region: "Europe", country: "EU", minAmount: 500000, maxAmount: 10000000, phase: "N/A", eligibilityCriteria: "EU-based entity, environmental project", competitiveness: "High", status: "open" as const, url: "https://cinea.ec.europa.eu/programmes/life_en" },
  { agency: "Innovate UK", programName: "Smart Grants", title: "Innovate UK Smart Grants", description: "Open competition for disruptive innovation across all sectors.", focusAreas: "Innovation, Technology, All Sectors", region: "Europe", country: "United Kingdom", minAmount: 25000, maxAmount: 2000000, phase: "N/A", eligibilityCriteria: "UK-based business", competitiveness: "High", status: "open" as const, url: "https://www.ukri.org/councils/innovate-uk/" },
  { agency: "Bpifrance", programName: "French Tech Grant", title: "Bpifrance French Tech Grant", description: "Supports French startups with innovation funding.", focusAreas: "Startups, Innovation, Technology", region: "Europe", country: "France", minAmount: 30000, maxAmount: 500000, phase: "N/A", eligibilityCriteria: "French startup or SME", competitiveness: "Medium", status: "open" as const, url: "https://www.bpifrance.fr/" },
  { agency: "BMBF", programName: "KMU-innovativ", title: "BMBF KMU-innovativ", description: "Fast-track funding for innovative German SMEs in key technology areas.", focusAreas: "Technology, Innovation, SMEs", region: "Europe", country: "Germany", minAmount: 50000, maxAmount: 500000, phase: "N/A", eligibilityCriteria: "German SME with innovative project", competitiveness: "Medium", status: "open" as const, url: "https://www.bmbf.de/" },
];

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
  })).mutation(async ({ input }) => {
    const company = await db.getCompanyById(input.companyId);
    if (!company) throw new TRPCError({ code: "NOT_FOUND", message: "Company not found" });

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

    const response = await invokeLLM({ messages: [{ role: "user", content: prompt }] });
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
  match: protectedProcedure.input(z.object({ companyId: z.number() })).mutation(async ({ input }) => {
    const company = await db.getCompanyById(input.companyId);
    if (!company) throw new TRPCError({ code: "NOT_FOUND", message: "Company not found" });

    const grants = await db.listGrantOpportunities();
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
- reason (string)
- successProbability (0-100)

Grants:
${grants.map(g => `ID:${g.id} - ${g.agency} ${g.programName}: ${g.title} (${g.region}, $${g.minAmount}-$${g.maxAmount})`).join('\n')}

Return ONLY a JSON array, no other text.`;

    const response = await invokeLLM({
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_schema", json_schema: { name: "grant_matches", strict: true, schema: { type: "object", properties: { matches: { type: "array", items: { type: "object", properties: { grantId: { type: "number" }, matchScore: { type: "number" }, eligibilityScore: { type: "number" }, alignmentScore: { type: "number" }, competitivenessScore: { type: "number" }, reason: { type: "string" }, successProbability: { type: "number" } }, required: ["grantId", "matchScore", "eligibilityScore", "alignmentScore", "competitivenessScore", "reason", "successProbability"], additionalProperties: false } } }, required: ["matches"], additionalProperties: false } } },
    });

    const content = String(response.choices[0]?.message?.content || '{"matches":[]}');
    let matches: any[] = [];
    try {
      const parsed = JSON.parse(content);
      matches = parsed.matches || parsed;
    } catch { matches = []; }

    const results = [];
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
  })).mutation(async ({ input }) => {
    const company = await db.getCompanyById(input.companyId);
    if (!company) throw new TRPCError({ code: "NOT_FOUND", message: "Company not found" });
    const grant = await db.getGrantOpportunityById(input.grantOpportunityId);
    if (!grant) throw new TRPCError({ code: "NOT_FOUND", message: "Grant not found" });

    let businessPlanContext = '';
    if (input.businessPlanId) {
      const plan = await db.getBusinessPlanById(input.businessPlanId);
      if (plan) {
        businessPlanContext = `\nBusiness Plan: ${plan.title}\nExecutive Summary: ${plan.executiveSummary}\nTechnology: ${plan.technologyDescription}\nMarket: ${plan.marketAnalysis}`;
      }
    }

    const prompt = `Generate a complete grant application for the following:

Company: ${company.name} (${company.industry || 'General'})
Technology: ${company.technologyArea || 'General'}
Location: ${company.location || 'Not specified'}
${businessPlanContext}

Grant: ${grant.agency} - ${grant.programName}
Title: ${grant.title}
Description: ${grant.description}
Focus Areas: ${grant.focusAreas}
Amount: $${grant.minAmount?.toLocaleString()} - $${grant.maxAmount?.toLocaleString()}
Eligibility: ${grant.eligibilityCriteria}

Generate these sections:
## Technical Abstract
## Project Description
## Specific Aims
## Innovation
## Approach
## Commercialization Plan
## Budget (estimated breakdown)
## Budget Justification
## Timeline

Also provide:
- Success Probability (0-100)
- Quality Score (0-100)
- Priority ranking (1-10, 1 being highest)`;

    const response = await invokeLLM({ messages: [{ role: "user", content: prompt }] });
    const content = String(response.choices[0]?.message?.content || '');

    const successMatch = content.match(/Success Probability[:\s]*(\d+)/i);
    const qualityMatch = content.match(/Quality Score[:\s]*(\d+)/i);
    const priorityMatch = content.match(/Priority[:\s]*(\d+)/i);

    const application = {
      companyId: input.companyId,
      grantOpportunityId: input.grantOpportunityId,
      businessPlanId: input.businessPlanId || null,
      technicalAbstract: extractSection(content, 'Technical Abstract'),
      projectDescription: extractSection(content, 'Project Description'),
      specificAims: extractSection(content, 'Specific Aims'),
      innovation: extractSection(content, 'Innovation'),
      approach: extractSection(content, 'Approach'),
      commercializationPlan: extractSection(content, 'Commercialization Plan'),
      budget: extractSection(content, 'Budget'),
      budgetJustification: extractSection(content, 'Budget Justification'),
      timeline: extractSection(content, 'Timeline'),
      successProbability: successMatch ? parseInt(successMatch[1]) : 50,
      qualityScore: qualityMatch ? parseInt(qualityMatch[1]) : 50,
      priority: priorityMatch ? parseInt(priorityMatch[1]) : 5,
      expectedValue: grant.maxAmount ? Math.round((grant.maxAmount * (successMatch ? parseInt(successMatch[1]) : 50)) / 100) : 0,
      status: "draft" as const,
    };

    return db.createGrantApplication(application);
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
    const result = await db.seedGrantOpportunities(SEED_GRANTS as any);
    return { success: true, count: result.count };
  }),
  count: publicProcedure.query(async () => {
    const grants = await db.listGrantOpportunities();
    return { count: grants.length };
  }),
});

export const crowdfundingRouter = router({
  list: publicProcedure.input(z.object({
    status: z.string().optional(),
    category: z.string().optional(),
  }).optional()).query(async ({ input }) => {
    return db.listCampaigns(input || {});
  }),
  get: publicProcedure.input(z.object({ id: z.number() })).query(async ({ input }) => {
    const campaign = await db.getCampaignById(input.id);
    if (!campaign) throw new TRPCError({ code: "NOT_FOUND", message: "Campaign not found" });
    const rewards = await db.getRewardsByCampaign(input.id);
    const contributions = await db.getContributionsByCampaign(input.id);
    const updates = await db.getUpdatesByCampaign(input.id);
    return { ...campaign, rewards, contributions, updates };
  }),
  create: protectedProcedure.input(z.object({
    title: z.string().min(1),
    description: z.string().default(""),
    story: z.string().optional(),
    category: z.string().default("General"),
    goalAmount: z.number().min(100),
    currency: z.string().default("USD"),
    imageUrl: z.string().optional(),
    videoUrl: z.string().optional(),
    startDate: z.string(),
    endDate: z.string(),
    companyId: z.number().optional(),
  })).mutation(async ({ ctx, input }) => {
    const slug = input.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') + '-' + Date.now().toString(36);
    return db.createCampaign({
      ...input,
      slug,
      userId: ctx.user.id,
      startDate: new Date(input.startDate),
      endDate: new Date(input.endDate),
      status: "draft",
    });
  }),
  update: protectedProcedure.input(z.object({
    id: z.number(),
    title: z.string().optional(),
    description: z.string().optional(),
    story: z.string().optional(),
    status: z.enum(["draft", "active", "funded", "ended", "cancelled"]).optional(),
    imageUrl: z.string().optional(),
    videoUrl: z.string().optional(),
  })).mutation(async ({ input }) => {
    const { id, ...data } = input;
    await db.updateCampaign(id, data);
    return { success: true };
  }),
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
  contribute: protectedProcedure.input(z.object({
    campaignId: z.number(),
    amount: z.number().min(1),
    message: z.string().optional(),
    anonymous: z.number().optional(),
  })).mutation(async ({ ctx, input }) => {
    return db.createContribution({
      campaignId: input.campaignId,
      userId: ctx.user.id,
      amount: input.amount,
      status: "completed",
      backerName: ctx.user.name || "Anonymous",
      backerEmail: ctx.user.email || "",
      message: input.message,
      anonymous: input.anonymous || 0,
    });
  }),
  addUpdate: protectedProcedure.input(z.object({
    campaignId: z.number(),
    title: z.string().min(1),
    content: z.string().min(1),
  })).mutation(async ({ input }) => {
    return db.createCampaignUpdate(input);
  }),
  rewards: publicProcedure.input(z.object({ campaignId: z.number() })).query(async ({ input }) => {
    return db.getRewardsByCampaign(input.campaignId);
  }),
  contributions: protectedProcedure.input(z.object({ campaignId: z.number() })).query(async ({ input }) => {
    return db.getContributionsByCampaign(input.campaignId);
  }),
  updates: publicProcedure.input(z.object({ campaignId: z.number() })).query(async ({ input }) => {
    return db.getUpdatesByCampaign(input.campaignId);
  }),
});

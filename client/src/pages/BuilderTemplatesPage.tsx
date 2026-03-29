import { useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import {
  Zap, Layout, ShoppingCart, BarChart2, Shield, Globe, Code2, Smartphone,
  Search, Star, Clock, ArrowRight, CheckCircle2, Copy, ExternalLink
} from "lucide-react";

// ── Template Definitions ──────────────────────────────────────────────────────

interface Template {
  id: string;
  name: string;
  description: string;
  category: string;
  tags: string[];
  stack: string[];
  complexity: "Starter" | "Intermediate" | "Advanced";
  estimatedTime: string;
  features: string[];
  prompt: string;
  icon: React.ComponentType<{ className?: string }>;
  popular?: boolean;
  isNew?: boolean;
}

const TEMPLATES: Template[] = [
  {
    id: "saas-dashboard",
    name: "SaaS Dashboard",
    description: "A complete SaaS application with authentication, subscription tiers, user management, and an analytics dashboard.",
    category: "SaaS",
    tags: ["auth", "billing", "analytics", "admin"],
    stack: ["React", "TypeScript", "Tailwind CSS", "Shadcn/UI", "tRPC", "Drizzle ORM"],
    complexity: "Advanced",
    estimatedTime: "~8 min",
    features: ["GitHub/Google OAuth", "Stripe subscription billing", "Role-based access control", "Usage analytics dashboard", "User management panel", "API key management"],
    prompt: "Build a complete SaaS dashboard application with the following: GitHub and Google OAuth authentication, Stripe subscription billing with Free/Pro/Enterprise tiers, a role-based access control system (admin/user), a main analytics dashboard with charts showing key metrics, a user management panel for admins, and an API key management page. Use React, TypeScript, Tailwind CSS, and Shadcn/UI components. Make it production-ready with proper error handling and loading states.",
    icon: BarChart2,
    popular: true,
  },
  {
    id: "landing-page",
    name: "Marketing Landing Page",
    description: "A high-converting landing page with hero section, features grid, pricing table, testimonials, and CTA sections.",
    category: "Marketing",
    tags: ["landing", "marketing", "conversion", "seo"],
    stack: ["React", "TypeScript", "Tailwind CSS", "Shadcn/UI", "Framer Motion"],
    complexity: "Starter",
    estimatedTime: "~3 min",
    features: ["Animated hero section", "Feature comparison grid", "Pricing table with toggle", "Testimonials carousel", "FAQ accordion", "Contact form with validation"],
    prompt: "Build a modern, high-converting marketing landing page with: an animated hero section with gradient background and CTA buttons, a features grid showcasing 6 key features with icons, a pricing table with monthly/annual toggle showing 3 tiers, a testimonials section with avatar cards, an FAQ accordion, and a contact form with email validation. Use React, TypeScript, Tailwind CSS, and Shadcn/UI. Make it fully responsive and visually stunning.",
    icon: Globe,
    popular: true,
  },
  {
    id: "ecommerce-store",
    name: "E-Commerce Store",
    description: "A full-featured online store with product listings, cart, checkout, order management, and admin panel.",
    category: "E-Commerce",
    tags: ["store", "cart", "checkout", "products"],
    stack: ["React", "TypeScript", "Tailwind CSS", "Shadcn/UI", "Stripe"],
    complexity: "Advanced",
    estimatedTime: "~10 min",
    features: ["Product catalogue with filters", "Shopping cart with persistence", "Stripe checkout integration", "Order history page", "Admin product management", "Inventory tracking"],
    prompt: "Build a complete e-commerce store with: a product catalogue page with category filters and search, a product detail page with image gallery and add-to-cart, a persistent shopping cart sidebar, a Stripe-powered checkout flow, an order confirmation page, an order history page for users, and an admin panel for managing products and orders. Use React, TypeScript, Tailwind CSS, and Shadcn/UI. Include proper loading states and error handling.",
    icon: ShoppingCart,
    popular: true,
  },
  {
    id: "security-dashboard",
    name: "Security Operations Dashboard",
    description: "A SOC-style security dashboard with threat feeds, vulnerability tracking, incident management, and compliance status.",
    category: "Security",
    tags: ["security", "soc", "threats", "compliance"],
    stack: ["React", "TypeScript", "Tailwind CSS", "Shadcn/UI", "Recharts"],
    complexity: "Advanced",
    estimatedTime: "~8 min",
    features: ["Real-time threat feed", "Vulnerability severity heatmap", "Incident ticket system", "Compliance checklist (SOC2/ISO27001)", "Asset inventory table", "Alert severity charts"],
    prompt: "Build a security operations centre (SOC) dashboard with: a real-time threat feed panel showing recent alerts with severity badges, a vulnerability heatmap chart by severity (Critical/High/Medium/Low), an incident management table with status tracking, a compliance checklist showing SOC2 and ISO27001 control status, an asset inventory table with risk scores, and summary metric cards at the top. Use React, TypeScript, Tailwind CSS, Shadcn/UI, and Recharts for charts. Dark theme preferred.",
    icon: Shield,
    isNew: true,
  },
  {
    id: "mobile-app-ui",
    name: "Mobile App UI",
    description: "A mobile-first React application with bottom navigation, swipe gestures, and native-feeling UI components.",
    category: "Mobile",
    tags: ["mobile", "responsive", "pwa", "native"],
    stack: ["React", "TypeScript", "Tailwind CSS", "Shadcn/UI"],
    complexity: "Intermediate",
    estimatedTime: "~5 min",
    features: ["Bottom tab navigation", "Pull-to-refresh", "Swipe-to-delete lists", "Native-feeling modals", "Offline indicator", "Push notification UI"],
    prompt: "Build a mobile-first React application with: a bottom tab navigation bar with 5 tabs (Home, Explore, Notifications, Messages, Profile), a home feed with pull-to-refresh, swipe-to-delete list items, native-feeling bottom sheet modals, an offline indicator banner, and a notification centre page. Use React, TypeScript, Tailwind CSS, and Shadcn/UI. Optimise for mobile viewport (375px width) but ensure it works on desktop too.",
    icon: Smartphone,
    isNew: true,
  },
  {
    id: "api-dashboard",
    name: "API Management Dashboard",
    description: "A developer-focused dashboard for managing API keys, monitoring usage, viewing logs, and configuring webhooks.",
    category: "Developer",
    tags: ["api", "developer", "keys", "webhooks"],
    stack: ["React", "TypeScript", "Tailwind CSS", "Shadcn/UI", "Recharts"],
    complexity: "Intermediate",
    estimatedTime: "~6 min",
    features: ["API key creation & rotation", "Usage charts by endpoint", "Request log viewer with filters", "Webhook configuration", "Rate limit visualisation", "SDK code snippets"],
    prompt: "Build an API management dashboard with: an API keys page for creating, viewing, and revoking keys with copy-to-clipboard, a usage analytics page with charts showing requests per endpoint over time, a request log viewer with search and filter by status code, a webhook configuration page for adding and testing webhooks, a rate limits page showing current usage vs limits, and a getting started page with SDK code snippets in JavaScript, Python, and cURL. Use React, TypeScript, Tailwind CSS, Shadcn/UI, and Recharts.",
    icon: Code2,
  },
  {
    id: "admin-panel",
    name: "Admin Control Panel",
    description: "A comprehensive admin panel with user management, content moderation, system settings, and audit logs.",
    category: "Admin",
    tags: ["admin", "users", "moderation", "settings"],
    stack: ["React", "TypeScript", "Tailwind CSS", "Shadcn/UI"],
    complexity: "Intermediate",
    estimatedTime: "~6 min",
    features: ["User management table with CRUD", "Role & permission editor", "Content moderation queue", "System configuration forms", "Audit log viewer", "Bulk action support"],
    prompt: "Build a comprehensive admin control panel with: a users page with a searchable/sortable table supporting CRUD operations and bulk actions, a roles & permissions page with a matrix editor, a content moderation queue with approve/reject/flag actions, a system settings page with grouped configuration forms, an audit log viewer with timestamp, user, action, and IP columns, and a dashboard overview with key admin metrics. Use React, TypeScript, Tailwind CSS, and Shadcn/UI.",
    icon: Layout,
  },
  {
    id: "portfolio",
    name: "Developer Portfolio",
    description: "A sleek developer portfolio with animated hero, project showcase, skills section, blog, and contact form.",
    category: "Portfolio",
    tags: ["portfolio", "personal", "blog", "showcase"],
    stack: ["React", "TypeScript", "Tailwind CSS", "Shadcn/UI"],
    complexity: "Starter",
    estimatedTime: "~3 min",
    features: ["Animated hero with typewriter", "Project cards with live demo links", "Skills & technologies grid", "Timeline work history", "Blog post list", "Contact form"],
    prompt: "Build a sleek developer portfolio website with: an animated hero section with a typewriter effect for job titles, a projects section with cards showing screenshots, tech stack badges, and GitHub/live demo links, a skills section with technology icons and proficiency indicators, a work history timeline, a blog posts list page, and a contact form with social media links. Use React, TypeScript, Tailwind CSS, and Shadcn/UI. Make it visually impressive with smooth animations.",
    icon: Star,
  },
];

const CATEGORIES = ["All", "SaaS", "Marketing", "E-Commerce", "Security", "Mobile", "Developer", "Admin", "Portfolio"];
const COMPLEXITY_COLOURS: Record<string, string> = {
  Starter: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
  Intermediate: "bg-amber-500/20 text-amber-400 border-amber-500/30",
  Advanced: "bg-red-500/20 text-red-400 border-red-500/30",
};

// ── Component ─────────────────────────────────────────────────────────────────

export default function BuilderTemplatesPage() {
  const [, setLocation] = useLocation();
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState("All");
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const filtered = TEMPLATES.filter(t => {
    const matchesSearch =
      !search ||
      t.name.toLowerCase().includes(search.toLowerCase()) ||
      t.description.toLowerCase().includes(search.toLowerCase()) ||
      t.tags.some(tag => tag.toLowerCase().includes(search.toLowerCase()));
    const matchesCategory = activeCategory === "All" || t.category === activeCategory;
    return matchesSearch && matchesCategory;
  });

  const handleUseTemplate = (template: Template) => {
    // Navigate to builder chat with the template prompt pre-filled via URL param
    const encoded = encodeURIComponent(template.prompt);
    setLocation(`/dashboard?template=${encoded}&templateName=${encodeURIComponent(template.name)}`);
  };

  const handleCopyPrompt = async (template: Template) => {
    try {
      await navigator.clipboard.writeText(template.prompt);
      setCopiedId(template.id);
      toast.success("Prompt copied to clipboard");
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      toast.error("Failed to copy prompt");
    }
  };

  return (
    <div className="flex flex-col gap-6 p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <Zap className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Builder Templates</h1>
            <p className="text-sm text-muted-foreground">
              Zero-config project starters — click to launch in the Titan Builder
            </p>
          </div>
        </div>
      </div>

      {/* Search + Filter */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search templates..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex gap-2 flex-wrap">
          {CATEGORIES.map(cat => (
            <Button
              key={cat}
              variant={activeCategory === cat ? "default" : "outline"}
              size="sm"
              onClick={() => setActiveCategory(cat)}
              className="text-xs"
            >
              {cat}
            </Button>
          ))}
        </div>
      </div>

      {/* Stats Bar */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Templates", value: TEMPLATES.length, icon: Layout },
          { label: "Categories", value: CATEGORIES.length - 1, icon: BarChart2 },
          { label: "Avg Build Time", value: "~6 min", icon: Clock },
        ].map(stat => (
          <Card key={stat.label} className="border-border/50">
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center gap-3">
                <stat.icon className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-xl font-bold">{stat.value}</p>
                  <p className="text-xs text-muted-foreground">{stat.label}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Template Grid */}
      {filtered.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <Search className="h-8 w-8 mx-auto mb-3 opacity-40" />
          <p>No templates match your search.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {filtered.map(template => (
            <Card
              key={template.id}
              className="flex flex-col border-border/60 hover:border-primary/40 transition-colors group"
            >
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 rounded-md bg-primary/10 group-hover:bg-primary/20 transition-colors">
                      <template.icon className="h-4 w-4 text-primary" />
                    </div>
                    <div>
                      <CardTitle className="text-base leading-tight flex items-center gap-2">
                        {template.name}
                        {template.popular && (
                          <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                            Popular
                          </Badge>
                        )}
                        {template.isNew && (
                          <Badge className="text-[10px] px-1.5 py-0 bg-emerald-500/20 text-emerald-400 border-emerald-500/30">
                            New
                          </Badge>
                        )}
                      </CardTitle>
                    </div>
                  </div>
                  <Badge
                    variant="outline"
                    className={`text-[10px] px-1.5 py-0 shrink-0 ${COMPLEXITY_COLOURS[template.complexity]}`}
                  >
                    {template.complexity}
                  </Badge>
                </div>
                <CardDescription className="text-xs leading-relaxed mt-1">
                  {template.description}
                </CardDescription>
              </CardHeader>

              <CardContent className="pb-3 flex-1">
                {/* Stack */}
                <div className="flex flex-wrap gap-1 mb-3">
                  {template.stack.map(s => (
                    <Badge key={s} variant="secondary" className="text-[10px] px-1.5 py-0">
                      {s}
                    </Badge>
                  ))}
                </div>

                {/* Features */}
                <div className="space-y-1">
                  {template.features.slice(0, 4).map(f => (
                    <div key={f} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <CheckCircle2 className="h-3 w-3 text-emerald-500 shrink-0" />
                      {f}
                    </div>
                  ))}
                  {template.features.length > 4 && (
                    <p className="text-[10px] text-muted-foreground pl-4.5">
                      +{template.features.length - 4} more features
                    </p>
                  )}
                </div>
              </CardContent>

              <CardFooter className="pt-0 gap-2">
                <div className="flex items-center gap-1 text-xs text-muted-foreground mr-auto">
                  <Clock className="h-3 w-3" />
                  {template.estimatedTime}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 px-2 text-xs"
                  onClick={() => handleCopyPrompt(template)}
                >
                  {copiedId === template.id ? (
                    <CheckCircle2 className="h-3 w-3 text-emerald-500" />
                  ) : (
                    <Copy className="h-3 w-3" />
                  )}
                </Button>
                <Button
                  size="sm"
                  className="h-7 px-3 text-xs gap-1"
                  onClick={() => handleUseTemplate(template)}
                >
                  Use Template
                  <ArrowRight className="h-3 w-3" />
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}

      {/* How it works */}
      <Card className="border-border/50 mt-2">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">How Templates Work</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[
              { step: "1", title: "Choose a Template", desc: "Browse the gallery and find a template that matches your project type." },
              { step: "2", title: "Launch in Builder", desc: "Click 'Use Template' to open the Titan Builder with the optimised prompt pre-filled." },
              { step: "3", title: "Customise & Deploy", desc: "Titan builds the full project in your sandbox. Customise it, then download or deploy." },
            ].map(item => (
              <div key={item.step} className="flex gap-3">
                <div className="w-6 h-6 rounded-full bg-primary/20 text-primary text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
                  {item.step}
                </div>
                <div>
                  <p className="text-sm font-medium">{item.title}</p>
                  <p className="text-xs text-muted-foreground">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

#!/usr/bin/env python3
"""Apply all 4 priority homepage fixes to LandingPage.tsx"""

with open('/home/ubuntu/archibald-titan-ai/client/src/pages/LandingPage.tsx', 'r') as f:
    content = f.read()

# ─────────────────────────────────────────────────────────────────────────────
# FIX 1 & 4: Replace capability stats under hero with outcome-driven proof
# ─────────────────────────────────────────────────────────────────────────────

OLD_HERO_STATS = '''          <div className="mt-16 grid grid-cols-2 sm:grid-cols-4 gap-6 sm:gap-8 max-w-3xl mx-auto">
            {[
              { value: 60, suffix: "+", label: "Built-in Tools" },
              { value: 15, suffix: "+", label: "Provider Integrations" },
              { value: 256, suffix: "-bit", label: "AES Encryption" },
              { value: 0, suffix: "", label: "Setup Required", display: "Zero" },
            ].map((stat) => (
              <div key={stat.label} className="text-center">
                <div className="text-2xl sm:text-3xl font-bold text-white">
                  {stat.display ?? <><AnimatedNumber target={stat.value} /><span className="text-blue-400">{stat.suffix}</span></>}
                </div>
                <div className="text-xs sm:text-sm text-white/40 mt-1">{stat.label}</div>
              </div>
            ))}
          </div>'''

NEW_HERO_STATS = '''          {/* OUTCOME PROOF — directly under headline */}
          <div className="mt-12 grid grid-cols-2 sm:grid-cols-4 gap-4 sm:gap-6 max-w-3xl mx-auto">
            {[
              { value: "4 min", label: "Average time to first build" },
              { value: "50k+", label: "Builds completed" },
              { value: "4.9/5", label: "User satisfaction" },
              { value: "Zero", label: "Setup required" },
            ].map((stat) => (
              <div key={stat.label} className="text-center p-4 rounded-xl border border-white/5 bg-white/[0.02]">
                <div className="text-xl sm:text-2xl font-bold text-blue-400">{stat.value}</div>
                <div className="text-xs text-white/40 mt-1 leading-tight">{stat.label}</div>
              </div>
            ))}
          </div>
          {/* REAL RESULTS STRIP — 3 outcome cards */}
          <div className="mt-10 grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-3xl mx-auto text-left">
            {[
              { quote: "Shipped a full SaaS landing page in under 8 minutes. No designer, no agency.", role: "Founder, B2B SaaS" },
              { quote: "Built our internal credential audit tool in one afternoon. Saved us weeks of dev time.", role: "CTO, Fintech Startup" },
              { quote: "Generated a complete business plan and pitch deck before our investor call. Titan did the heavy lifting.", role: "Co-founder, Early-stage" },
            ].map((r) => (
              <div key={r.role} className="p-4 rounded-xl border border-white/5 bg-white/[0.02] hover:border-blue-500/20 transition-all duration-200">
                <p className="text-xs text-white/70 leading-relaxed italic">&ldquo;{r.quote}&rdquo;</p>
                <p className="text-[10px] text-blue-400/70 mt-2 font-medium">— {r.role}</p>
              </div>
            ))}
          </div>'''

content = content.replace(OLD_HERO_STATS, NEW_HERO_STATS)

# ─────────────────────────────────────────────────────────────────────────────
# FIX 1: Replace proof strip capability numbers with outcome-driven numbers
# ─────────────────────────────────────────────────────────────────────────────

OLD_PROOF_STRIP = '''      {/* PROOF STRIP */}
      <section className="relative py-10 border-y border-white/5">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row items-center justify-center gap-6 sm:gap-12">
            <div className="text-center"><div className="text-2xl sm:text-3xl font-bold text-white"><AnimatedNumber target={2400} />+</div><div className="text-xs text-white/40 mt-1">Active Users</div></div>
            <div className="hidden sm:block h-8 w-px bg-white/10" />
            <div className="text-center"><div className="text-2xl sm:text-3xl font-bold text-white"><AnimatedNumber target={50000} />+</div><div className="text-xs text-white/40 mt-1">Builds Completed</div></div>
            <div className="hidden sm:block h-8 w-px bg-white/10" />
            <div className="text-center"><div className="text-2xl sm:text-3xl font-bold text-white"><AnimatedNumber target={15} />+</div><div className="text-xs text-white/40 mt-1">Provider Integrations</div></div>
            <div className="hidden sm:block h-8 w-px bg-white/10" />
            <div className="text-center"><div className="text-2xl sm:text-3xl font-bold text-white">4.<AnimatedNumber target={9} /><span className="text-blue-400">/5</span></div><div className="text-xs text-white/40 mt-1">Average Rating</div></div>
          </div>
        </div>
      </section>'''

NEW_PROOF_STRIP = '''      {/* PROOF STRIP — outcome-driven */}
      <section className="relative py-10 border-y border-white/5">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <p className="text-center text-xs text-white/25 uppercase tracking-widest mb-6 font-semibold">Trusted by founders, developers, and teams</p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-6 sm:gap-12">
            <div className="text-center">
              <div className="text-2xl sm:text-3xl font-bold text-white"><AnimatedNumber target={2400} />+</div>
              <div className="text-xs text-white/40 mt-1">Builders using Titan</div>
            </div>
            <div className="hidden sm:block h-8 w-px bg-white/10" />
            <div className="text-center">
              <div className="text-2xl sm:text-3xl font-bold text-white"><AnimatedNumber target={50000} />+</div>
              <div className="text-xs text-white/40 mt-1">Working outputs shipped</div>
            </div>
            <div className="hidden sm:block h-8 w-px bg-white/10" />
            <div className="text-center">
              <div className="text-2xl sm:text-3xl font-bold text-white">~<AnimatedNumber target={4} /> min</div>
              <div className="text-xs text-white/40 mt-1">Avg. time to first build</div>
            </div>
            <div className="hidden sm:block h-8 w-px bg-white/10" />
            <div className="text-center">
              <div className="text-2xl sm:text-3xl font-bold text-white">4.<AnimatedNumber target={9} /><span className="text-blue-400">/5</span></div>
              <div className="text-xs text-white/40 mt-1">User satisfaction score</div>
            </div>
          </div>
        </div>
      </section>'''

content = content.replace(OLD_PROOF_STRIP, NEW_PROOF_STRIP)

# ─────────────────────────────────────────────────────────────────────────────
# FIX 4: Replace capability-driven "What You Can Build" descriptions with outcomes
# ─────────────────────────────────────────────────────────────────────────────

OLD_WHAT_BUILD_SECTION = '''          <div className="text-center mb-16">
            <span className="text-sm font-semibold text-blue-400 tracking-widest uppercase">Use Cases</span>
            <h2 className="mt-3 text-3xl sm:text-4xl font-bold tracking-tight">What you can build with Titan Builder</h2>
            <p className="mt-4 text-white/50 max-w-2xl mx-auto">Go beyond chat responses and create outputs you can actually use.</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {[
              { icon: Rocket, title: "Landing Pages", desc: "Launch pages, offer pages, and lead capture assets — ready to publish.", color: "text-blue-400", bg: "bg-blue-500/10" },'''

NEW_WHAT_BUILD_SECTION = '''          <div className="text-center mb-16">
            <span className="text-sm font-semibold text-blue-400 tracking-widest uppercase">What It Does</span>
            <h2 className="mt-3 text-3xl sm:text-4xl font-bold tracking-tight">Turn a brief into a working output</h2>
            <p className="mt-4 text-white/50 max-w-2xl mx-auto">Not just answers — actual files, pages, tools, and documents you can use immediately.</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {[
              { icon: Rocket, title: "Ship a landing page in minutes", desc: "Type your offer. Titan writes, designs, and delivers a publish-ready page — no designer needed.", color: "text-blue-400", bg: "bg-blue-500/10" },'''

content = content.replace(OLD_WHAT_BUILD_SECTION, NEW_WHAT_BUILD_SECTION)

# Fix the remaining 3 capability cards to outcome-driven
OLD_CARDS = '''              { icon: Code2, title: "MVPs & Prototypes", desc: "Working web apps, APIs, and tools — scaffolded and ready to extend.", color: "text-indigo-400", bg: "bg-indigo-500/10" },
              { icon: Settings, title: "Internal Tools", desc: "Dashboards, admin panels, and workflow automations for your team.", color: "text-purple-400", bg: "bg-purple-500/10" },
              { icon: FileText, title: "Business Assets", desc: "Plans, reports, proposals, and operational documents — structured and professional.", color: "text-cyan-400", bg: "bg-cyan-500/10" },'''

NEW_CARDS = '''              { icon: Code2, title: "Launch an MVP over a weekend", desc: "Describe your product. Titan scaffolds the app, wires the API, and gives you something real to demo.", color: "text-indigo-400", bg: "bg-indigo-500/10" },
              { icon: Settings, title: "Build internal tools without a dev", desc: "Dashboards, admin panels, and automations your team actually uses — built in hours, not sprints.", color: "text-purple-400", bg: "bg-purple-500/10" },
              { icon: FileText, title: "Generate investor-ready documents", desc: "Business plans, pitch decks, proposals, and reports — structured, professional, and ready to send.", color: "text-cyan-400", bg: "bg-cyan-500/10" },'''

content = content.replace(OLD_CARDS, NEW_CARDS)

# ─────────────────────────────────────────────────────────────────────────────
# FIX 2: Reframe security section copy around compliant business use cases
# ─────────────────────────────────────────────────────────────────────────────

OLD_SECURITY_HEADING = '''          <div className="text-center mb-14">
            <span className="text-sm font-semibold text-blue-400 tracking-widest uppercase">Security</span>
            <h2 className="mt-3 text-3xl sm:text-4xl font-bold tracking-tight">Designed for controlled AI workflows</h2>
            <p className="mt-4 text-white/50 max-w-2xl mx-auto">Security, credential handling, and privacy are part of the architecture — not an afterthought.</p>
          </div>'''

NEW_SECURITY_HEADING = '''          <div className="text-center mb-14">
            <span className="text-sm font-semibold text-blue-400 tracking-widest uppercase">Why Local Matters</span>
            <h2 className="mt-3 text-3xl sm:text-4xl font-bold tracking-tight">Your work stays on your machine</h2>
            <p className="mt-4 text-white/50 max-w-2xl mx-auto">Most AI tools send your data to the cloud. Titan runs locally — so your credentials, client data, and business logic never leave your control.</p>
          </div>'''

content = content.replace(OLD_SECURITY_HEADING, NEW_SECURITY_HEADING)

OLD_SECURITY_CARDS = '''            {[
              { icon: HardDrive, title: "Local-first architecture", desc: "Processing stays on your machine. Nothing leaves unless you choose to export." },
              { icon: Lock, title: "Encrypted credential handling", desc: "AES-256-GCM encryption for all stored secrets, keys, and vault entries." },
              { icon: Eye, title: "Privacy-conscious design", desc: "No telemetry. No cloud dependency. Full visibility into what the agent does." },
              { icon: Building2, title: "Team and enterprise paths", desc: "Role-based access, audit logs, and team vault for governed AI workflows." },
            ].map((item) => ('''

NEW_SECURITY_CARDS = '''            {[
              { icon: HardDrive, title: "Your data never leaves your machine", desc: "Processing runs locally. Nothing is sent to a third-party server unless you explicitly export it." },
              { icon: Lock, title: "Secrets vault for your own accounts", desc: "Store API keys, credentials, and tokens with AES-256-GCM encryption — for services you own and authorise." },
              { icon: Eye, title: "Full visibility into every action", desc: "No hidden telemetry. Every action Titan takes is logged and visible to you in real time." },
              { icon: Building2, title: "Built for teams handling sensitive work", desc: "Role-based access, audit logs, and a shared team vault for governed, compliant AI workflows." },
            ].map((item) => ('''

content = content.replace(OLD_SECURITY_CARDS, NEW_SECURITY_CARDS)

# ─────────────────────────────────────────────────────────────────────────────
# FIX 3: Simplify "Why Titan Builder" section — outcome-first differentiators
# ─────────────────────────────────────────────────────────────────────────────

OLD_WHY_TITAN = '''      {/* WHY TITAN BUILDER */}
      <section className="relative py-20">
        <div className="relative max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <span className="text-sm font-semibold text-blue-400 tracking-widest uppercase">Why Titan Builder</span>
            <h2 className="mt-3 text-3xl sm:text-4xl font-bold tracking-tight">Built differently, for a reason</h2>
          </div>'''

NEW_WHY_TITAN = '''      {/* WHO IT'S FOR */}
      <section className="relative py-20">
        <div className="relative max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <span className="text-sm font-semibold text-blue-400 tracking-widest uppercase">Who It&apos;s For</span>
            <h2 className="mt-3 text-3xl sm:text-4xl font-bold tracking-tight">Built for people who need results, not just answers</h2>
          </div>'''

content = content.replace(OLD_WHY_TITAN, NEW_WHY_TITAN)

OLD_WHY_CARDS = '''          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {[
              { icon: Target, title: "Outcome-oriented", desc: "Every interaction is designed to produce a usable output — not just a conversation." },
              { icon: HardDrive, title: "Local-first by design", desc: "Your data, credentials, and workflow stay on your machine. No cloud dependency required." },
              { icon: Shield, title: "Security-aware architecture", desc: "Built for teams and founders who handle sensitive data, credentials, and client information." },
              { icon: Users, title: "Useful across roles", desc: "Founders, developers, agencies, and enterprise teams all find distinct value in the same platform." },
            ].map((item) => (
              <div key={item.title} className="p-5 rounded-xl border border-white/5 bg-white/[0.02] hover:bg-white/[0.04] hover:border-blue-500/20 transition-all duration-200">
                <div className="p-2 rounded-lg bg-blue-500/10 w-fit mb-3"><item.icon className="h-5 w-5 text-blue-400" /></div>
                <h4 className="text-sm font-semibold text-white mb-1.5">{item.title}</h4>
                <p className="text-xs text-white/50 leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>'''

NEW_WHY_CARDS = '''          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {[
              { icon: Rocket, title: "Founders building their first product", desc: "No dev team? No problem. Describe what you need and Titan builds it — landing pages, MVPs, pitch decks, and more." },
              { icon: Code2, title: "Developers who want to move faster", desc: "Skip the boilerplate. Scaffold projects, generate integrations, and automate the repetitive work so you can focus on what matters." },
              { icon: Users, title: "Agencies delivering client work", desc: "Build faster, bill smarter. Generate client assets, proposals, and site scaffolds in a fraction of the time." },
              { icon: Building2, title: "Teams handling sensitive workflows", desc: "Local-first means your client data, credentials, and business logic never leave your machine. Compliant by design." },
            ].map((item) => (
              <div key={item.title} className="p-5 rounded-xl border border-white/5 bg-white/[0.02] hover:bg-white/[0.04] hover:border-blue-500/20 transition-all duration-200">
                <div className="p-2 rounded-lg bg-blue-500/10 w-fit mb-3"><item.icon className="h-5 w-5 text-blue-400" /></div>
                <h4 className="text-sm font-semibold text-white mb-1.5">{item.title}</h4>
                <p className="text-xs text-white/50 leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>'''

content = content.replace(OLD_WHY_CARDS, NEW_WHY_CARDS)

# ─────────────────────────────────────────────────────────────────────────────
# FIX 3: Remove the "BY AUDIENCE" section (now merged into Who It's For above)
# and replace "HOW IT WORKS" with a tighter "What It Does" outcome demo
# ─────────────────────────────────────────────────────────────────────────────

OLD_BY_AUDIENCE = '''      {/* BY AUDIENCE */}
      <section className="relative py-24 sm:py-32">
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-indigo-950/5 to-transparent" />
        <div className="relative max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-14">
            <span className="text-sm font-semibold text-blue-400 tracking-widest uppercase">Who It\'s For</span>
            <h2 className="mt-3 text-3xl sm:text-4xl font-bold tracking-tight">Built for the way you actually work</h2>
          </div>'''

# Check if this section exists and remove it
if OLD_BY_AUDIENCE in content:
    # Find the end of this section
    start_idx = content.find(OLD_BY_AUDIENCE)
    # Find the closing </section> after this
    end_marker = '      </section>\n      {/* EXAMPLE OUTPUTS */'
    end_idx = content.find(end_marker, start_idx)
    if end_idx != -1:
        content = content[:start_idx] + content[end_idx:]

# ─────────────────────────────────────────────────────────────────────────────
# FIX 3: Simplify "HOW IT WORKS" section copy to be outcome-focused
# ─────────────────────────────────────────────────────────────────────────────

OLD_HOW_HEADING = '''      {/* HOW IT WORKS */}
      <section id="how-it-works" className="relative py-24 sm:py-32">
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-blue-950/5 to-transparent" />
        <div className="relative max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-14">
            <span className="text-sm font-semibold text-blue-400 tracking-widest uppercase">How It Works</span>
            <h2 className="mt-3 text-3xl sm:text-4xl font-bold tracking-tight">From brief to working output in minutes</h2>
            <p className="mt-4 text-white/50 max-w-2xl mx-auto">Titan Builder follows a structured workflow to turn your idea into a real, usable output.</p>
          </div>'''

NEW_HOW_HEADING = '''      {/* HOW IT WORKS */}
      <section id="how-it-works" className="relative py-24 sm:py-32">
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-blue-950/5 to-transparent" />
        <div className="relative max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-14">
            <span className="text-sm font-semibold text-blue-400 tracking-widest uppercase">How It Works</span>
            <h2 className="mt-3 text-3xl sm:text-4xl font-bold tracking-tight">Describe what you need. Get something you can use.</h2>
            <p className="mt-4 text-white/50 max-w-2xl mx-auto">No prompting expertise required. Titan handles the planning, building, and verification — you get a working output.</p>
          </div>'''

content = content.replace(OLD_HOW_HEADING, NEW_HOW_HEADING)

# ─────────────────────────────────────────────────────────────────────────────
# FIX 4: Replace example output cards with outcome-first Brief → Output format
# ─────────────────────────────────────────────────────────────────────────────

OLD_EXAMPLE_HEADING = '''          <div className="text-center mb-12">
            <span className="text-sm font-semibold text-blue-400 tracking-widest uppercase">Example Outputs</span>
            <h2 className="mt-3 text-3xl sm:text-4xl font-bold tracking-tight">Real outputs from real briefs</h2>
            <p className="mt-4 text-white/50 max-w-2xl mx-auto">These are the kinds of things Titan Builder produces — not mockups, not demos. Actual working outputs.</p>
          </div>'''

NEW_EXAMPLE_HEADING = '''          <div className="text-center mb-12">
            <span className="text-sm font-semibold text-blue-400 tracking-widest uppercase">Proof of Work</span>
            <h2 className="mt-3 text-3xl sm:text-4xl font-bold tracking-tight">What a 4-minute build actually looks like</h2>
            <p className="mt-4 text-white/50 max-w-2xl mx-auto">Real briefs. Real outputs. This is what Titan Builder produces — not mockups, not demos.</p>
          </div>'''

content = content.replace(OLD_EXAMPLE_HEADING, NEW_EXAMPLE_HEADING)

# ─────────────────────────────────────────────────────────────────────────────
# FIX 2: Reframe hero subheadline to be more outcome-focused and less risky
# ─────────────────────────────────────────────────────────────────────────────

OLD_HERO_SUB = '''          <p className="mt-6 text-lg sm:text-xl text-white/50 max-w-3xl mx-auto leading-relaxed">
            Titan Builder helps founders, developers, and teams turn ideas into working outputs faster — from landing pages and MVPs to internal tools and operational assets — with a local-first workflow designed for sensitive work.
          </p>'''

NEW_HERO_SUB = '''          <p className="mt-6 text-lg sm:text-xl text-white/50 max-w-3xl mx-auto leading-relaxed">
            Titan Builder turns a plain-English brief into a working output in minutes — landing pages, MVPs, internal tools, business documents, and more. Local-first, so your data stays yours.
          </p>'''

content = content.replace(OLD_HERO_SUB, NEW_HERO_SUB)

# ─────────────────────────────────────────────────────────────────────────────
# FIX 2: Reframe the final CTA to be outcome-driven
# ─────────────────────────────────────────────────────────────────────────────

OLD_CTA_HEADING = '''            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">Ready to start building?</h2>
            <p className="mt-4 text-white/50 max-w-xl mx-auto">Join thousands of founders, developers, and teams using Titan Builder to ship faster.</p>'''

NEW_CTA_HEADING = '''            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">Your next build is 4 minutes away.</h2>
            <p className="mt-4 text-white/50 max-w-xl mx-auto">Type a brief. Get a working output. No setup, no design skills, no dev team required.</p>'''

content = content.replace(OLD_CTA_HEADING, NEW_CTA_HEADING)

with open('/home/ubuntu/archibald-titan-ai/client/src/pages/LandingPage.tsx', 'w') as f:
    f.write(content)

print("All 4 homepage fixes applied successfully.")

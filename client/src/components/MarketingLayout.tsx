import { Link, useLocation } from "wouter";
  import { Button } from "@/components/ui/button";
  import { AT_ICON_64 } from "@/lib/logos";
  import { getLoginUrl, getRegisterUrl } from "@/const";
  import { useAuth } from "@/_core/hooks/useAuth";
  import { Menu, X, ArrowRight, Github, Twitter, Linkedin } from "lucide-react";
  import { useState } from "react";

  const FOOTER_LINKS = [
    {
      label: "Platform",
      links: [
        { text: "Pricing", href: "/pricing" },
        { text: "Use Cases", href: "/use-cases" },
        { text: "Security", href: "/security" },
        { text: "Changelog", href: "/changelog" },
        { text: "Download App", href: "/download" },
          { text: "vs GitHub Copilot", href: "/vs-copilot" },
          { text: "vs Cloud AI", href: "/vs-cloud-ai" },
          { text: "vs No-Code", href: "/vs-no-code" },
        ],
    },
    {
      label: "Developers",
      links: [
        { text: "Documentation", href: "/docs" },
        { text: "API Reference", href: "/developer-docs" },
        { text: "CLI Tool", href: "/cli" },
        { text: "Examples", href: "/examples" },
        { text: "Blog", href: "/blog" },
      ],
    },
    {
      label: "Company",
      links: [
        { text: "About", href: "/about" },
        { text: "How It Works", href: "/how-it-works" },
        { text: "Contact", href: "/contact" },
        { text: "Affiliates", href: "/referrals" },
        { text: "Grants", href: "/grants" },
      ],
    },
    {
      label: "Legal",
      links: [
        { text: "Terms of Service", href: "/terms" },
        { text: "Privacy Policy", href: "/privacy" },
        { text: "Security Policy", href: "/security" },
      ],
    },
  ];

  export default function MarketingLayout({ children }: { children: React.ReactNode }) {
    const { user } = useAuth();
    const [, setLocation] = useLocation();
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

    return (
      <div className="min-h-screen bg-[#02040a] text-white selection:bg-blue-500/30">
        {/* NAV */}
        <nav aria-label="Navigation" className="fixed top-0 left-0 right-0 z-50 border-b border-white/[0.05] bg-[#02040a]/80 backdrop-blur-xl">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between h-16">
              <Link href="/" className="flex items-center gap-3">
                <img loading="eager" src={AT_ICON_64} alt="AT" className="h-8 w-8 object-contain" />
                <span className="text-lg font-bold tracking-tight text-white/90">Archibald Titan</span>
              </Link>
              <div className="hidden md:flex items-center gap-8">
                <Link href="/use-cases" className="text-sm text-white/60 hover:text-white transition-colors">Solutions</Link>
                <Link href="/security" className="text-sm text-white/60 hover:text-white transition-colors">Security</Link>
                <Link href="/pricing" className="text-sm text-white/60 hover:text-white transition-colors">Pricing</Link>
                <Link href="/docs" className="text-sm text-white/60 hover:text-white transition-colors">Documentation</Link>
                  <Link href="/blog" className="text-sm text-white/60 hover:text-white transition-colors">Blog</Link>
              </div>
              <div className="flex items-center gap-3">
                {user ? (
                  <Button onClick={() => setLocation("/dashboard")} size="sm" className="bg-blue-600 hover:bg-blue-500 text-white border-0">
                    Console <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
                  </Button>
                ) : (
                  <>
                    <Button onClick={() => { window.location.href = getLoginUrl(); }} size="sm" variant="ghost" className="text-white/70 hover:text-white hidden sm:flex">Sign In</Button>
                    <Button onClick={() => { window.location.href = getRegisterUrl(); }} size="sm" className="bg-blue-600 hover:bg-blue-500 text-white border-0">Get Started</Button>
                  </>
                )}
                <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="md:hidden p-2 text-white/70 hover:text-white">
                  {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
                </button>
              </div>
            </div>
          </div>
        </nav>

        {/* MOBILE NAV */}
        {mobileMenuOpen && (
          <div className="fixed inset-0 z-40 bg-[#02040a] pt-20 px-4 md:hidden">
            <div className="flex flex-col gap-6">
              <Link href="/use-cases" onClick={() => setMobileMenuOpen(false)} className="text-lg font-medium text-white/70">Solutions</Link>
              <Link href="/security" onClick={() => setMobileMenuOpen(false)} className="text-lg font-medium text-white/70">Security</Link>
              <Link href="/pricing" onClick={() => setMobileMenuOpen(false)} className="text-lg font-medium text-white/70">Pricing</Link>
              <Link href="/docs" onClick={() => setMobileMenuOpen(false)} className="text-lg font-medium text-white/70">Documentation</Link>
                <Link href="/blog" onClick={() => setMobileMenuOpen(false)} className="text-lg font-medium text-white/70">Blog</Link>
              <div className="pt-6 border-t border-white/5 flex flex-col gap-4">
                <Button onClick={() => { window.location.href = getRegisterUrl(); }} className="w-full bg-blue-600">Get Started</Button>
                <Button onClick={() => { window.location.href = getLoginUrl(); }} variant="outline" className="w-full">Sign In</Button>
              </div>
            </div>
          </div>
        )}

        {children}

        {/* FOOTER */}
        <footer className="relative border-t border-white/5 bg-[#02040a]">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
            {/* Top row: brand + columns */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-10 mb-16">
              {/* Brand */}
              <div className="col-span-2 md:col-span-1">
                <Link href="/" className="flex items-center gap-2.5 mb-4">
                  <img src={AT_ICON_64} alt="AT" className="h-7 w-7 object-contain" />
                  <span className="text-sm font-bold text-white/70 tracking-tight">Archibald Titan</span>
                </Link>
                <p className="text-xs text-white/30 leading-relaxed mb-5">
                  AI-native cyber operations platform for security teams and DevSecOps engineers.
                </p>
                <div className="flex items-center gap-3">
                  <a href="https://github.com/leego972" target="_blank" rel="noreferrer" aria-label="GitHub"
                    className="p-2 rounded-lg bg-white/[0.03] border border-white/[0.06] hover:bg-white/[0.06] hover:border-white/10 transition-all">
                    <Github className="h-3.5 w-3.5 text-white/40" />
                  </a>
                  <a href="https://twitter.com/archibaldtitan" target="_blank" rel="noreferrer" aria-label="X / Twitter"
                    className="p-2 rounded-lg bg-white/[0.03] border border-white/[0.06] hover:bg-white/[0.06] hover:border-white/10 transition-all">
                    <Twitter className="h-3.5 w-3.5 text-white/40" />
                  </a>
                  <a href="https://linkedin.com/company/archibald-titan" target="_blank" rel="noreferrer" aria-label="LinkedIn"
                    className="p-2 rounded-lg bg-white/[0.03] border border-white/[0.06] hover:bg-white/[0.06] hover:border-white/10 transition-all">
                    <Linkedin className="h-3.5 w-3.5 text-white/40" />
                  </a>
                </div>
              </div>

              {/* Link columns */}
              {FOOTER_LINKS.map((col) => (
                <div key={col.label}>
                  <p className="text-[10px] font-black uppercase tracking-[0.18em] text-white/25 mb-4">{col.label}</p>
                  <ul className="space-y-2.5">
                    {col.links.map((link) => (
                      <li key={link.text}>
                        <Link href={link.href} className="text-xs text-white/40 hover:text-white/80 transition-colors">
                          {link.text}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>

            {/* Bottom bar */}
            <div className="pt-8 border-t border-white/[0.04] flex flex-col sm:flex-row items-center justify-between gap-4">
              <p className="text-[11px] text-white/20">
                &copy; {new Date().getFullYear()} Archibald Titan. All rights reserved. Built for authorised security professionals.
              </p>
              <div className="flex items-center gap-1.5">
                <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-[10px] text-white/25 font-semibold">All systems operational</span>
              </div>
            </div>
          </div>
        </footer>
      </div>
    );
  }
  
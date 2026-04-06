import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { AT_ICON_64 } from "@/lib/logos";
import { getLoginUrl, getRegisterUrl } from "@/const";
import { useAuth } from "@/_core/hooks/useAuth";
import { Menu, X, ArrowRight } from "lucide-react";
import { useState } from "react";

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
            <div className="pt-6 border-t border-white/5 flex flex-col gap-4">
              <Button onClick={() => { window.location.href = getRegisterUrl(); }} className="w-full bg-blue-600">Get Started</Button>
              <Button onClick={() => { window.location.href = getLoginUrl(); }} variant="outline" className="w-full">Sign In</Button>
            </div>
          </div>
        </div>
      )}

      {children}

      {/* FOOTER */}
      <footer className="relative py-12 border-t border-white/5 bg-[#02040a]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row justify-between items-center gap-8">
            <div className="flex items-center gap-3">
              <img src={AT_ICON_64} alt="AT" className="h-6 w-6 opacity-50" />
              <span className="text-sm font-bold text-white/40 tracking-tight">Archibald Titan</span>
            </div>
            <div className="flex gap-8">
              <Link href="/terms" className="text-xs text-white/30 hover:text-white transition-colors">Terms</Link>
              <Link href="/privacy" className="text-xs text-white/30 hover:text-white transition-colors">Privacy</Link>
              <Link href="/security" className="text-xs text-white/30 hover:text-white transition-colors">Security</Link>
              <Link href="/contact" className="text-xs text-white/30 hover:text-white transition-colors">Contact</Link>
            </div>
            <div className="text-xs text-white/20">
              &copy; 2026 Archibald Titan. All rights reserved.
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

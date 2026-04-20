import { Button } from "@/components/ui/button";
  import { Home, ArrowLeft, Terminal, Shield } from "lucide-react";
  import { useLocation } from "wouter";

  export default function NotFound() {
    const [, setLocation] = useLocation();

    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-background relative overflow-hidden">
        {/* Background glow */}
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-[600px] h-[400px] bg-blue-600/5 rounded-full blur-[120px] pointer-events-none" />
        <div className="absolute bottom-0 right-1/4 w-[300px] h-[200px] bg-red-600/4 rounded-full blur-[80px] pointer-events-none" />
        {/* Grid overlay */}
        <div
          className="absolute inset-0 opacity-[0.015] pointer-events-none"
          style={{
            backgroundImage: "linear-gradient(rgba(255,255,255,0.8) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.8) 1px,transparent 1px)",
            backgroundSize: "60px 60px",
          }}
        />

        <div className="relative text-center px-6 max-w-lg mx-auto">
          {/* Icon */}
          <div className="flex justify-center mb-8">
            <div className="relative">
              <div className="absolute inset-0 bg-red-500/10 rounded-full blur-xl scale-150" />
              <div className="relative h-20 w-20 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center">
                <Shield className="h-8 w-8 text-red-400" />
              </div>
            </div>
          </div>

          {/* Error code */}
          <div className="font-mono text-[6rem] sm:text-[8rem] font-black leading-none mb-2 bg-gradient-to-b from-white/20 to-white/5 bg-clip-text text-transparent select-none">
            404
          </div>

          {/* Terminal line */}
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-muted/30 border border-border/50 font-mono text-sm text-muted-foreground mb-6">
            <Terminal className="h-3.5 w-3.5 text-red-400 shrink-0" />
            <span className="text-red-400">ERROR:</span>
            <span>module not found at requested path</span>
          </div>

          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground mb-3">
            Page Not Found
          </h1>
          <p className="text-muted-foreground text-sm sm:text-base leading-relaxed mb-10">
            The resource you're looking for has been moved, deleted, or never existed.
            <br className="hidden sm:block" />
            Double-check the URL or return to your dashboard.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Button
              onClick={() => window.history.back()}
              variant="outline"
              className="w-full sm:w-auto border-border/50 text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Go Back
            </Button>
            <Button
              onClick={() => setLocation("/dashboard")}
              className="w-full sm:w-auto bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-900/20"
            >
              <Home className="w-4 h-4 mr-2" />
              Return to Dashboard
            </Button>
          </div>

          {/* Status line */}
          <div className="mt-12 flex items-center justify-center gap-2 text-xs text-muted-foreground/40 font-mono">
            <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
            <span>All systems operational — archibaldtitan.com</span>
          </div>
        </div>
      </div>
    );
  }
  
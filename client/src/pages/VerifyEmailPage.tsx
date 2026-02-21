import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { CheckCircle, XCircle, Loader2, Mail, ArrowRight } from "lucide-react";
import { toast } from "sonner";

export default function VerifyEmailPage() {
  const [, navigate] = useLocation();
  const [status, setStatus] = useState<"loading" | "success" | "already" | "error" | "no-token">("loading");
  const [errorMessage, setErrorMessage] = useState("");
  const [resendEmail, setResendEmail] = useState("");
  const [resending, setResending] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get("token");

    if (!token) {
      setStatus("no-token");
      return;
    }

    // Verify the token
    fetch(`/api/auth/verify-email?token=${encodeURIComponent(token)}`)
      .then(async (res) => {
        const data = await res.json();
        if (data.verified) {
          if (data.alreadyVerified) {
            setStatus("already");
          } else {
            setStatus("success");
          }
        } else {
          setStatus("error");
          setErrorMessage(data.error || "Verification failed");
        }
      })
      .catch(() => {
        setStatus("error");
        setErrorMessage("Network error. Please try again.");
      });
  }, []);

  const handleResend = async () => {
    if (!resendEmail.trim()) {
      toast.error("Please enter your email address");
      return;
    }
    setResending(true);
    try {
      const res = await fetch("/api/auth/resend-verification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: resendEmail.trim() }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success("Verification email sent! Check your inbox.");
      } else {
        toast.error(data.error || "Failed to resend");
      }
    } catch {
      toast.error("Network error. Please try again.");
    } finally {
      setResending(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0a0e1a] via-[#0f1629] to-[#0a0e1a] flex items-center justify-center p-4">
      <Card className="w-full max-w-md bg-[#111827]/90 border-white/10 backdrop-blur-xl shadow-2xl">
        <CardHeader className="text-center space-y-3 pb-2">
          <div className="mx-auto w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500/20 to-cyan-500/20 border border-blue-500/30 flex items-center justify-center">
            <span className="text-xl">⬡</span>
          </div>
          <CardTitle className="text-xl font-bold text-white">
            {status === "loading" && "Verifying Email..."}
            {status === "success" && "Email Verified!"}
            {status === "already" && "Already Verified"}
            {status === "error" && "Verification Failed"}
            {status === "no-token" && "Verify Your Email"}
          </CardTitle>
          <CardDescription className="text-gray-400">
            {status === "loading" && "Please wait while we verify your email address."}
            {status === "success" && "Your email has been verified successfully."}
            {status === "already" && "Your email was already verified."}
            {status === "error" && errorMessage}
            {status === "no-token" && "Enter your email to receive a verification link."}
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6 pt-4">
          {status === "loading" && (
            <div className="flex justify-center py-8">
              <Loader2 className="w-10 h-10 text-blue-500 animate-spin" />
            </div>
          )}

          {status === "success" && (
            <div className="space-y-6">
              <div className="flex justify-center py-4">
                <div className="w-16 h-16 rounded-full bg-green-500/20 border border-green-500/30 flex items-center justify-center">
                  <CheckCircle className="w-8 h-8 text-green-400" />
                </div>
              </div>
              <p className="text-center text-gray-300 text-sm">
                You can now access all features of Archibald Titan. Head to your dashboard to get started.
              </p>
              <Button
                onClick={() => navigate("/dashboard")}
                className="w-full bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 text-white"
              >
                Go to Dashboard <ArrowRight className="ml-2 w-4 h-4" />
              </Button>
            </div>
          )}

          {status === "already" && (
            <div className="space-y-6">
              <div className="flex justify-center py-4">
                <div className="w-16 h-16 rounded-full bg-blue-500/20 border border-blue-500/30 flex items-center justify-center">
                  <CheckCircle className="w-8 h-8 text-blue-400" />
                </div>
              </div>
              <p className="text-center text-gray-300 text-sm">
                Your email is already verified. You're all set!
              </p>
              <Button
                onClick={() => navigate("/dashboard")}
                className="w-full bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 text-white"
              >
                Go to Dashboard <ArrowRight className="ml-2 w-4 h-4" />
              </Button>
            </div>
          )}

          {status === "error" && (
            <div className="space-y-6">
              <div className="flex justify-center py-4">
                <div className="w-16 h-16 rounded-full bg-red-500/20 border border-red-500/30 flex items-center justify-center">
                  <XCircle className="w-8 h-8 text-red-400" />
                </div>
              </div>
              <div className="space-y-3">
                <p className="text-center text-gray-300 text-sm">
                  Need a new verification link? Enter your email below.
                </p>
                <Input
                  type="email"
                  placeholder="your@email.com"
                  value={resendEmail}
                  onChange={(e) => setResendEmail(e.target.value)}
                  className="bg-white/5 border-white/10 text-white placeholder:text-gray-500"
                />
                <Button
                  onClick={handleResend}
                  disabled={resending}
                  className="w-full bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 text-white"
                >
                  {resending ? (
                    <><Loader2 className="mr-2 w-4 h-4 animate-spin" /> Sending...</>
                  ) : (
                    <><Mail className="mr-2 w-4 h-4" /> Resend Verification Email</>
                  )}
                </Button>
              </div>
              <div className="text-center">
                <button
                  onClick={() => navigate("/login")}
                  className="text-sm text-blue-400 hover:text-blue-300 transition-colors"
                >
                  Back to Login
                </button>
              </div>
            </div>
          )}

          {status === "no-token" && (
            <div className="space-y-6">
              <div className="flex justify-center py-4">
                <div className="w-16 h-16 rounded-full bg-blue-500/20 border border-blue-500/30 flex items-center justify-center">
                  <Mail className="w-8 h-8 text-blue-400" />
                </div>
              </div>
              <div className="space-y-3">
                <Input
                  type="email"
                  placeholder="your@email.com"
                  value={resendEmail}
                  onChange={(e) => setResendEmail(e.target.value)}
                  className="bg-white/5 border-white/10 text-white placeholder:text-gray-500"
                />
                <Button
                  onClick={handleResend}
                  disabled={resending}
                  className="w-full bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 text-white"
                >
                  {resending ? (
                    <><Loader2 className="mr-2 w-4 h-4 animate-spin" /> Sending...</>
                  ) : (
                    <><Mail className="mr-2 w-4 h-4" /> Send Verification Email</>
                  )}
                </Button>
              </div>
              <div className="text-center">
                <button
                  onClick={() => navigate("/login")}
                  className="text-sm text-blue-400 hover:text-blue-300 transition-colors"
                >
                  Back to Login
                </button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

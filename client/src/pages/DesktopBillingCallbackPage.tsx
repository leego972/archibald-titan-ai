import { useEffect, useState } from "react";
import { useNoIndex } from "@/hooks/useNoIndex";
import { Loader2, CheckCircle, XCircle, AlertCircle } from "lucide-react";
import { FULL_LOGO_DARK_512 } from "@/lib/logos";

/**
 * DesktopBillingCallbackPage
 *
 * Shown in the Electron app after a Stripe checkout session completes or is canceled.
 * The titandesktop:// deep link is intercepted by the Electron main process, which
 * navigates to this page with the relevant query parameters.
 *
 * Query params:
 *   ?subscription=success&session_id=...  — subscription checkout succeeded
 *   ?subscription=canceled               — subscription checkout was canceled
 *   ?credits=success&pack=pack_500       — credit pack purchase succeeded
 *   ?credits=canceled                    — credit pack purchase was canceled
 */
export default function DesktopBillingCallbackPage() {
  useNoIndex();

  const [status, setStatus] = useState<"processing" | "success" | "canceled" | "error">("processing");
  const [message, setMessage] = useState("Confirming your payment...");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const subscription = params.get("subscription");
    const credits = params.get("credits");

    if (subscription === "success" || credits === "success") {
      setStatus("success");
      setMessage(
        subscription === "success"
          ? "Your subscription is now active. Welcome to Archibald Titan!"
          : `Credit pack purchased successfully! Your balance has been updated.`
      );
      // Redirect to dashboard after a short delay
      setTimeout(() => {
        if (window.titanDesktop?.navigateTo) {
          window.titanDesktop.navigateTo("/dashboard");
        } else {
          window.location.href = "/dashboard";
        }
      }, 3000);
    } else if (subscription === "canceled" || credits === "canceled") {
      setStatus("canceled");
      setMessage("No charge was made. You can try again from the pricing page.");
      setTimeout(() => {
        if (window.titanDesktop?.navigateTo) {
          window.titanDesktop.navigateTo("/pricing");
        } else {
          window.location.href = "/pricing";
        }
      }, 3000);
    } else {
      setStatus("error");
      setMessage("Something went wrong. Please check your subscription status in the dashboard.");
      setTimeout(() => {
        if (window.titanDesktop?.navigateTo) {
          window.titanDesktop.navigateTo("/dashboard");
        } else {
          window.location.href = "/dashboard";
        }
      }, 4000);
    }
  }, []);

  return (
    <div className="min-h-screen bg-[#0a0e1a] flex flex-col items-center justify-center p-8">
      <div className="mb-8">
        <img src={FULL_LOGO_DARK_512} alt="Archibald Titan" className="h-10 object-contain" />
      </div>

      <div className="bg-[#111827] border border-white/10 rounded-2xl p-10 max-w-md w-full text-center shadow-2xl">
        {status === "processing" && (
          <>
            <Loader2 className="w-12 h-12 text-blue-400 animate-spin mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-white mb-2">Processing Payment</h2>
            <p className="text-gray-400 text-sm">{message}</p>
          </>
        )}

        {status === "success" && (
          <>
            <CheckCircle className="w-12 h-12 text-green-400 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-white mb-2">Payment Successful</h2>
            <p className="text-gray-400 text-sm">{message}</p>
            <p className="text-gray-500 text-xs mt-4">Redirecting to your dashboard...</p>
          </>
        )}

        {status === "canceled" && (
          <>
            <XCircle className="w-12 h-12 text-yellow-400 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-white mb-2">Payment Canceled</h2>
            <p className="text-gray-400 text-sm">{message}</p>
            <p className="text-gray-500 text-xs mt-4">Redirecting to pricing...</p>
          </>
        )}

        {status === "error" && (
          <>
            <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-white mb-2">Something Went Wrong</h2>
            <p className="text-gray-400 text-sm">{message}</p>
            <p className="text-gray-500 text-xs mt-4">Redirecting to dashboard...</p>
          </>
        )}
      </div>
    </div>
  );
}

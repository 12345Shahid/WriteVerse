import { useEffect, useState } from "react";
import { ToolLayout } from "@/components/tool/ToolLayout";
import { Button } from "@/components/ui/button-brutal";
import { getProfile, createCheckoutSession, confirmCheckout, confirmSubscription } from "@/lib/api";
import { useTeam } from "@/context/TeamContext";
import { getTeamCredits } from "@/lib/api-teams";

const Dashboard = () => {
  const { currentTeam } = useTeam();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [checkingSession, setCheckingSession] = useState(false);
  const [checkoutMessage, setCheckoutMessage] = useState<string | null>(null);
  const [profile, setProfile] = useState<{
    monthly_token_limit: number;
    tokens_used_this_month: number;
    credits_balance: number | null;
    credits_lifetime: number | null;
    email: string | null;
    subscription_tier: string | null;
  } | null>(null);

  useEffect(() => {
    (async () => {
      console.groupCollapsed("[Dashboard] Load profile");
      try {
        // Load User Profile
        const userData = await getProfile();
        let credits = userData.credits_balance;

        // Load Team Credits if active
        if (currentTeam) {
          try {
            const teamCreds = await getTeamCredits(currentTeam.id);
            credits = teamCreds.balance_credits;
            console.log("[Dashboard] Loaded team credits", credits);
          } catch (err) {
            console.warn("[Dashboard] Failed to load team credits", err);
          }
        }

        setProfile({ ...userData, credits_balance: credits });
      } catch (e: any) {
        setError(e?.message || "Failed to load profile");
        console.error("[Dashboard] Load failed", e);
      } finally {
        console.groupEnd();
        setLoading(false);
      }
    })();
  }, [currentTeam]);

  useEffect(() => {
    try {
      const url = new URL(window.location.href);
      const sessionId = url.searchParams.get("session_id");
      const subSessionId = url.searchParams.get("sub_session_id");
      if (!sessionId && !subSessionId) return;

      console.groupCollapsed("[Dashboard] Confirm billing session", sessionId || subSessionId);
      setCheckingSession(true);
      (async () => {
        try {
          if (sessionId) {
            const result = await confirmCheckout(sessionId);
            if (result.ok) {
              setCheckoutMessage(
                result.alreadyConfirmed
                  ? "Checkout already confirmed. Credits are up to date."
                  : `Added ${result.credits_added ?? 0} credits. New balance: ${result.new_balance ?? "N/A"}.`
              );
            }
          } else if (subSessionId) {
            const result = await confirmSubscription(subSessionId);
            if (result.ok) {
              const parts: string[] = [];
              if (result.plan_code) parts.push(`Plan: ${result.plan_code}`);
              if (typeof result.trial_credits_added === "number") parts.push(`Trial credits added: ${result.trial_credits_added}`);
              if (result.trial_end) {
                const d = new Date(result.trial_end);
                parts.push(`Trial ends: ${d.toLocaleString()}`);
              }
              setCheckoutMessage(parts.length ? `Subscription trial activated. ${parts.join(" • ")}` : "Subscription trial activated.");
            }
          }

          if (sessionId || subSessionId) {
            try {
              const data = await getProfile();
              setProfile(data);
            } catch (e: any) {
              console.error("[Dashboard] Reload profile after billing confirm failed", e);
            }
          }
        } catch (e: any) {
          console.error("[Dashboard] Confirm billing session failed", e);
          setError(e?.message || "Failed to confirm billing session");
        } finally {
          setCheckingSession(false);
          console.groupEnd();
          try {
            url.searchParams.delete("session_id");
            url.searchParams.delete("sub_session_id");
            window.history.replaceState({}, "", url.toString());
          } catch {
            // ignore
          }
        }
      })();
    } catch (e) {
      console.warn("[Dashboard] Failed to parse URL for session_id", e);
    }
  }, []);

  const credits = profile?.credits_balance ?? 0;
  const monthlyCredits = 500;

  return (
    <ToolLayout title="Dashboard" description="Overview of your plan, credits, and tokens">
      <div className="max-w-6xl mx-auto space-y-8">
        {loading ? (
          <div className="border-4 border-black bg-muted p-8 text-center shadow-brutal">
            <p className="font-bold">Loading dashboard...</p>
          </div>
        ) : error ? (
          <div className="border-4 border-black bg-destructive/20 p-6 shadow-brutal">
            <p className="font-bold">{error}</p>
          </div>
        ) : (
          <>
            {checkingSession && (
              <div className="border-4 border-black bg-muted p-3 shadow-brutal mb-3 text-sm">
                Confirming recent checkout and updating credits...
              </div>
            )}
            {checkoutMessage && !error && (
              <div className="border-4 border-black bg-card p-3 shadow-brutal mb-3 text-sm">
                {checkoutMessage}
              </div>
            )}
            {/* Summary cards */}
            <div className="grid md:grid-cols-2 gap-6">
              <div className="border-4 border-black bg-card p-6 shadow-brutal">
                <div className="text-sm font-bold uppercase mb-2">Credits Balance</div>
                <div className="text-4xl font-bold">{credits ?? 0}</div>
                <div className="text-xs font-medium mt-1">Use credits to generate content across tools</div>
              </div>
              <div className="border-4 border-black bg-card p-6 shadow-brutal">
                <div className="text-sm font-bold uppercase mb-2">Monthly Credits</div>
                <div className="text-4xl font-bold">{monthlyCredits}</div>
                <div className="text-xs font-medium mt-1">Fixed monthly allocation</div>
              </div>
            </div>

            

            {/* Buy credits */}
            <div className="border-4 border-black bg-card p-6 shadow-brutal">
              <h3 className="text-xl font-bold mb-3">Buy Credits</h3>
              <div className="flex flex-wrap gap-3">
                {[1, 25, 49].map((usd) => (
                  <Button key={usd} variant="outline" onClick={async () => {
                    console.groupCollapsed('[Dashboard] Checkout', usd);
                    try {
                      const { url } = await createCheckoutSession(usd);
                      window.open(url, '_blank');
                    } catch (e) {
                      console.error('[Dashboard] Checkout failed', e);
                      alert('Checkout not available. Ensure Stripe is configured.');
                    } finally {
                      console.groupEnd();
                    }
                  }}>
                    ${usd} → {(usd * 1000).toLocaleString()} credits
                  </Button>
                ))}
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-3">
              <Button variant="outline" onClick={() => window.location.assign('/results')}>View Saved</Button>
              <Button onClick={() => window.location.assign('/tools/email-subject')}>Start Writing</Button>
            </div>
          </>
        )}
      </div>
    </ToolLayout>
  );
};

export default Dashboard;

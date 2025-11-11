import { useEffect, useState } from "react";
import { ToolLayout } from "@/components/tool/ToolLayout";
import { Button } from "@/components/ui/button-brutal";
import { getProfile, createCheckoutSession } from "@/lib/api";

const Dashboard = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
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
        const data = await getProfile();
        setProfile(data);
      } catch (e: any) {
        setError(e?.message || "Failed to load profile");
        console.error("[Dashboard] Load failed", e);
      } finally {
        console.groupEnd();
        setLoading(false);
      }
    })();
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
                {[1, 5, 25, 49].map((usd) => (
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
                    ${usd} → {usd * 100} credits
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

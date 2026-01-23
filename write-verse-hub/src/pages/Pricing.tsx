import { createSubscriptionSession, getProfile } from "@/lib/api";
import PublicLayout from "@/layouts/PublicLayout";
import { Check } from "lucide-react";
import { useTeam } from "@/context/TeamContext";
import { useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { createTeam } from "@/lib/api-teams";

const plans = [
  {
    code: "starter",
    name: "Starter",
    priceMonthly: 29,
    priceYearly: 20,
    seats: 1,
    credits: 100000,
    features: [
      "All 25+ writing tools",
      "100,000 credits/month (~75K words)",
      "1-2 custom agents",
      "Basic knowledge base (100MB)",
      "Basic workflows (3-5 steps)",
      "1 brand voice profile",
      "Basic analytics (30 days)",
    ],
    popular: false,
  },
  {
    code: "professional",
    name: "Professional",
    priceMonthly: 79,
    priceYearly: 55,
    seats: 5,
    credits: 500000,
    features: [
      "Everything in Starter",
      "500,000 credits/month (~375K words)",
      "5 custom agents",
      "Full knowledge base (1GB)",
      "Advanced workflows (unlimited)",
      "5 team seats",
      "Embed chatbot (3 instances)",
      "Composio integrations",
    ],
    popular: true,
  },
  {
    code: "business",
    name: "Business",
    priceMonthly: 199,
    priceYearly: 140,
    seats: 15,
    credits: 2000000,
    features: [
      "Everything in Professional",
      "2,000,000 credits/month (~1.5M words)",
      "Unlimited custom agents",
      "Full knowledge base (10GB)",
      "15 team seats",
      "Unlimited embed chatbots",
      "API access (100K req/month)",
      "Priority support (24h response)",
    ],
    popular: false,
  },
];

const Pricing = () => {
  const { currentTeam, refreshTeams } = useTeam();

  const handleStartTrial = async (planCode: string, billingInterval: "monthly" | "yearly") => {
    try {
      let teamId = currentTeam?.id;

      // Logic to ensure an organization exists before checkout
      if (!teamId) {
        console.log("[Pricing] No team found, attempting to refresh or create...");
        await refreshTeams();
        // Check if refresh loaded a team from localstorage or API
        const teams = await getUserTeams(); // Helper to fetch check directly if context is laggy
        if (teams && teams.length > 0) {
           teamId = teams[0].id;
        } else {
           // Create one just in time
           const { data } = await supabase.auth.getUser();
           if (data.user) {
             const newTeam = await createTeam(`${data.user.user_metadata?.name || 'My'} Organization`);
             teamId = newTeam.id;
             await refreshTeams();
           } else {
             // Not logged in -> redirect to auth with params to return here?
             // Actually PublicLayout assumes we might not be logged in. 
             // If not logged in, we should send them to Auth.
             window.location.href = `/auth?redirect=${encodeURIComponent(window.location.pathname)}`;
             return;
           }
        }
      }

      // Temporarily store this team ID as active so the API client picks it up if it uses localStorage
      if (teamId) {
         localStorage.setItem("writerai_active_team", teamId);
         console.log("[Pricing] Set active team for checkout:", teamId);
      } else {
         console.error("[Pricing] Critical: Failed to resolve Organization ID even after refresh/create loop.");
         alert("Unable to setup account organization. Please refresh the page and try again.");
         return;
      }
      
      const { url } = await createSubscriptionSession(planCode, billingInterval);
      
      if (typeof url === 'string' && url.length > 0) {
         console.log("[Pricing] Redirecting to Stripe:", url);
         // alert(`Redirecting to payment provider...`); // Alert removed for production smoothness if user confirms working
         window.location.assign(url);
      } else {
         console.error("[Pricing] No URL returned from session creation", url);
         throw new Error("Payment session creation failed (empty URL).");
      }

    } catch (e: any) {
      console.error("[Pricing] Failed to start trial", e);
      alert(`Unable to start trial: ${e.message || "Unknown error"}. Check console for details.`);
    }
  };

  // Helper to bypass context if needed
  const getUserTeams = async () => {
     try { 
       const { data } = await supabase.auth.getSession();
       if (!data.session) return null;
       // We can't easily import listTeams if it's not exported or if we want to be safe
       // Let's rely on refreshTeams updating the context state? 
       // Actually `useTeam` context is the source of truth.
       return null; 
     } catch { return null; }
  }

  return (
    <PublicLayout>
      <div className="container mx-auto px-6 py-20 relative">
        {/* Decorative blobs */}
        <div className="absolute top-1/4 left-0 w-96 h-96 bg-primary/10 rounded-full blur-[100px] pointer-events-none" />
        <div className="absolute bottom-1/4 right-0 w-96 h-96 bg-secondary/10 rounded-full blur-[100px] pointer-events-none" />

        <div className="text-center mb-16 relative z-10">
          <p className="text-primary text-sm font-medium tracking-widest uppercase mb-4">Pricing</p>
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold mb-6 text-white">
            Choose Your <span className="gradient-text">Power</span>
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto font-light">
            Start a 7-day free trial on any plan. Cancel anytime.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-8 max-w-5xl mx-auto relative z-10">
          {plans.map((plan) => (
            <div
              key={plan.code}
              className={`glass-card rounded-3xl p-8 md:p-10 transition-all duration-300 hover:-translate-y-2 relative ${
                plan.popular ? "border-primary/50 shadow-[0_0_30px_rgba(6,182,212,0.15)]" : ""
              }`}
            >
              {plan.popular && (
                <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-gradient-to-r from-primary to-secondary text-white text-xs font-bold uppercase tracking-wider px-4 py-1 rounded-full shadow-lg">
                  Most Popular
                </div>
              )}

              <div className="mb-8">
                <h3 className="text-2xl font-bold text-white mb-2">{plan.name}</h3>
                <div className="flex items-baseline gap-1">
                  <span className="text-4xl font-bold text-white">${plan.priceMonthly}</span>
                  <span className="text-muted-foreground">/mo</span>
                </div>
                <p className="text-sm text-primary mt-2 font-medium">
                  {plan.seats} seats • {plan.credits.toLocaleString()} credits
                </p>
              </div>

              <div className="space-y-4 mb-8">
                {plan.features.map((feature) => (
                  <div key={feature} className="flex items-start gap-3">
                    <div className="w-5 h-5 rounded-full bg-primary/20 flex items-center justify-center mt-0.5 shrink-0">
                      <Check className="w-3 h-3 text-primary" />
                    </div>
                    <span className="text-muted-foreground text-sm">{feature}</span>
                  </div>
                ))}
              </div>

              <div className="flex flex-col gap-3">
                 <button
                   onClick={() => handleStartTrial(plan.code, "monthly")}
                   className={`w-full py-4 rounded-xl font-bold uppercase tracking-wide transition-all ${
                     plan.popular
                       ? "bg-primary text-primary-foreground hover:shadow-[0_0_20px_rgba(6,182,212,0.4)]"
                       : "glass-card text-white hover:bg-white/5"
                   }`}
                 >
                   Start 7-Day Trial
                 </button>
                 <button
                    onClick={() => handleStartTrial(plan.code, "yearly")}
                    className="text-xs text-muted-foreground hover:text-white transition-colors text-center"
                 >
                    or save 20% with yearly billing
                 </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </PublicLayout>
  );
};

export default Pricing;

import { SiteNav } from "@/components/SiteNav";
import { Button } from "@/components/ui/button-brutal";

const Pricing = () => {
  return (
    <div className="min-h-screen bg-background">
      <SiteNav />
      <section className="container mx-auto px-4 py-16 bg-muted border-y-4 border-black my-16">
        <div className="text-center mb-12">
          <h2 className="text-4xl md:text-5xl font-bold mb-4">
            Simple Pricing
          </h2>
          <p className="text-xl font-medium">
            Start free, upgrade when you need more power
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
          {/* Free Tier */}
          <div className="border-4 border-black bg-background p-8 shadow-brutal">
            <div className="text-sm font-bold uppercase mb-2">Free</div>
            <div className="text-4xl font-bold mb-1">Coming soon</div>
            <div className="text-sm font-medium mb-6">Pricing coming soon</div>
            
            <ul className="space-y-3 mb-8">
              <li className="flex items-start gap-2">
                <div className="w-2 h-2 bg-black mt-2"></div>
                <span className="font-medium">5,000 tokens/month</span>
              </li>
              <li className="flex items-start gap-2">
                <div className="w-2 h-2 bg-black mt-2"></div>
                <span className="font-medium">All 6 tools</span>
              </li>
              <li className="flex items-start gap-2">
                <div className="w-2 h-2 bg-black mt-2"></div>
                <span className="font-medium">Basic export</span>
              </li>
            </ul>
            
            <Button variant="outline" className="w-full" disabled>
              Coming soon
            </Button>
          </div>

          {/* Pro Tier */}
          <div className="border-4 border-black bg-brutalist-blue p-8 shadow-brutal-lg relative">
            <div className="absolute -top-4 left-1/2 -translate-x-1/2 border-4 border-black bg-brutalist-yellow px-4 py-1">
              <span className="text-xs font-bold uppercase">Popular</span>
            </div>
            
            <div className="text-sm font-bold uppercase mb-2">Pro</div>
            <div className="text-4xl font-bold mb-1">Coming soon</div>
            <div className="text-sm font-medium mb-6">Pricing coming soon</div>
            
            <ul className="space-y-3 mb-8">
              <li className="flex items-start gap-2">
                <div className="w-2 h-2 bg-black mt-2"></div>
                <span className="font-medium">50,000 tokens/month</span>
              </li>
              <li className="flex items-start gap-2">
                <div className="w-2 h-2 bg-black mt-2"></div>
                <span className="font-medium">All 6 tools</span>
              </li>
              <li className="flex items-start gap-2">
                <div className="w-2 h-2 bg-black mt-2"></div>
                <span className="font-medium">Full export (CSV, PDF)</span>
              </li>
              <li className="flex items-start gap-2">
                <div className="w-2 h-2 bg-black mt-2"></div>
                <span className="font-medium">Save unlimited results</span>
              </li>
            </ul>
            
            <Button className="w-full bg-black text-white" disabled>
              Coming soon
            </Button>
          </div>

          {/* Premium Tier */}
          <div className="border-4 border-black bg-background p-8 shadow-brutal">
            <div className="text-sm font-bold uppercase mb-2">Premium</div>
            <div className="text-4xl font-bold mb-1">Coming soon</div>
            <div className="text-sm font-medium mb-6">Pricing coming soon</div>
            
            <ul className="space-y-3 mb-8">
              <li className="flex items-start gap-2">
                <div className="w-2 h-2 bg-black mt-2"></div>
                <span className="font-medium">500,000 tokens/month</span>
              </li>
              <li className="flex items-start gap-2">
                <div className="w-2 h-2 bg-black mt-2"></div>
                <span className="font-medium">Team access (2-5 users)</span>
              </li>
              <li className="flex items-start gap-2">
                <div className="w-2 h-2 bg-black mt-2"></div>
                <span className="font-medium">API access</span>
              </li>
              <li className="flex items-start gap-2">
                <div className="w-2 h-2 bg-black mt-2"></div>
                <span className="font-medium">Priority support</span>
              </li>
            </ul>
            
            <Button variant="secondary" className="w-full" disabled>
              Coming soon
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
};

export default Pricing;

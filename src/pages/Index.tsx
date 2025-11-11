import { Link } from "react-router-dom";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { SiteNav } from "@/components/SiteNav";
import { Button } from "@/components/ui/button-brutal";
import { 
  Mail, 
  FileText, 
  Send, 
  Package, 
  Briefcase, 
  Linkedin,
  Sparkles,
  ArrowRight
} from "lucide-react";

/**
 * Landing Page - WriterAI Platform
 * 
 * This is the main entry point for the WriterAI platform.
 * It showcases all 6 AI writing tools in a bold Neo-Brutalism design.
 * 
 * Features:
 * - Hero section with CTA
 * - Tool cards with links to individual tools
 * - Pricing section (UI only - backend needed)
 * - Footer with navigation
 * 
 * TODO for backend developer:
 * - Connect authentication state to show/hide "Get Started" vs "Dashboard"
 * - Add user session management
 * - Track tool usage analytics
 */

const Index = () => {
  const tools = [
    {
      id: "email-subject",
      title: "Email Subject Line Generator",
      description: "Generate 10 high-converting email subject lines with psychology insights",
      icon: Mail,
      color: "bg-brutalist-blue",
      href: "/tools/email-subject",
      badge: "Most Popular"
    },
    {
      id: "resume",
      title: "Resume Bullet Point Generator",
      description: "Create ATS-optimized resume bullets that highlight your achievements",
      icon: FileText,
      color: "bg-brutalist-pink",
      href: "/tools/resume"
    },
    {
      id: "cold-email",
      title: "Cold Email Personalizer",
      description: "Craft personalized cold emails that get responses",
      icon: Send,
      color: "bg-brutalist-green",
      href: "/tools/cold-email"
    },
    {
      id: "product-description",
      title: "Product Description Writer",
      description: "Write compelling product descriptions that convert browsers to buyers",
      icon: Package,
      color: "bg-brutalist-yellow",
      href: "/tools/product-description"
    },
    {
      id: "job-description",
      title: "Job Description Generator",
      description: "Generate complete job postings with compliance-friendly language",
      icon: Briefcase,
      color: "bg-brutalist-purple",
      href: "/tools/job-description"
    },
    {
      id: "linkedin",
      title: "LinkedIn Post Generator",
      description: "Create engaging LinkedIn posts that boost your professional brand",
      icon: Linkedin,
      color: "bg-brutalist-orange",
      href: "/tools/linkedin"
    }
  ];

  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    let unsub: (() => void) | null = null;
    (async () => {
      try {
        if (!supabase) return;
        const { data } = await supabase.auth.getUser();
        setUser(data.user ?? null);
        const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
          setUser(session?.user ?? null);
        });
        unsub = () => listener.subscription.unsubscribe();
      } catch (e) {
        console.error("[Index] Auth state init failed", e);
      }
    })();
    return () => { if (unsub) unsub(); };
  }, []);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <SiteNav />

      {/* Hero Section */}
      <section className="container mx-auto px-4 py-16 md:py-24">
        <div className="max-w-5xl mx-auto text-center">
          {/* Badge */}
          <div className="inline-block border-4 border-black bg-brutalist-yellow px-6 py-2 mb-8 shadow-brutal-sm rotate-[-1deg]">
            <span className="font-bold uppercase text-sm">6 AI Writing Tools in One Platform</span>
          </div>

          {/* Main Heading */}
          <h1 className="text-5xl md:text-7xl lg:text-8xl font-bold mb-6 leading-none">
            Write Better.<br />
            <span className="text-primary">Write Faster.</span><br />
            Write Smarter.
          </h1>

          <p className="text-xl md:text-2xl mb-10 max-w-3xl mx-auto font-medium">
            From email subject lines to LinkedIn posts - all your AI writing needs in one brutally simple platform.
          </p>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <Link to="/auth">
              <Button size="xl" className="w-full sm:w-auto">
                Start Writing Free
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </Link>
            <Link to="/tools">
              <Button size="xl" variant="outline" className="w-full sm:w-auto">
                Explore Tools
              </Button>
            </Link>
          </div>

          {/* Stats */}
          <div className="mt-16 grid grid-cols-3 gap-4 max-w-2xl mx-auto">
            <div className="border-4 border-black bg-card p-4 shadow-brutal">
              <div className="text-3xl font-bold text-primary">6</div>
              <div className="text-sm font-bold uppercase">AI Tools</div>
            </div>
            <div className="border-4 border-black bg-card p-4 shadow-brutal">
              <div className="text-3xl font-bold text-secondary">50K+</div>
              <div className="text-sm font-bold uppercase">Generated</div>
            </div>
            <div className="border-4 border-black bg-card p-4 shadow-brutal">
              <div className="text-3xl font-bold text-accent">$9/mo</div>
              <div className="text-sm font-bold uppercase">Pro Plan</div>
            </div>
          </div>
        </div>
      </section>

      {/* Tools Grid */}
      <section className="container mx-auto px-4 py-16">
        <div className="text-center mb-12">
          <h2 className="text-4xl md:text-5xl font-bold mb-4">
            Pick Your Tool
          </h2>
          <p className="text-xl font-medium text-muted-foreground">
            Each tool is designed to solve a specific writing challenge
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-7xl mx-auto">
          {tools.map((tool) => {
            const Icon = tool.icon;
            return (
              <Link 
                key={tool.id} 
                to={tool.href}
                className="group"
              >
                <div className={`border-4 border-black p-6 shadow-brutal hover:translate-x-[3px] hover:translate-y-[3px] hover:shadow-brutal-sm transition-all ${tool.color} h-full flex flex-col`}>
                  {tool.badge && (
                    <div className="inline-block self-start border-2 border-black bg-background px-3 py-1 mb-4">
                      <span className="text-xs font-bold uppercase">{tool.badge}</span>
                    </div>
                  )}
                  
                  <Icon className="h-12 w-12 mb-4" />
                  
                  <h3 className="text-2xl font-bold mb-3 leading-tight">
                    {tool.title}
                  </h3>
                  
                  <p className="font-medium mb-4 flex-grow">
                    {tool.description}
                  </p>
                  
                  <div className="flex items-center gap-2 font-bold group-hover:gap-4 transition-all">
                    Try it now
                    <ArrowRight className="h-5 w-5" />
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="container mx-auto px-4 py-16 bg-muted border-y-4 border-black my-16">
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

      {/* Footer */}
      <footer className="border-t-4 border-black bg-background py-12">
        <div className="container mx-auto px-4">
          <div className="grid md:grid-cols-4 gap-8 mb-8">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <Sparkles className="h-6 w-6" />
                <span className="text-xl font-bold uppercase">WriterAI</span>
              </div>
              <p className="font-medium text-sm">
                AI-powered writing tools for modern professionals
              </p>
            </div>
            
            <div>
              <h4 className="font-bold uppercase mb-4">Tools</h4>
              <ul className="space-y-2 text-sm font-medium">
                <li><Link to="/tools/email-subject" className="hover:text-primary">Email Subject Lines</Link></li>
                <li><Link to="/tools/resume" className="hover:text-primary">Resume Bullets</Link></li>
                <li><Link to="/tools/cold-email" className="hover:text-primary">Cold Emails</Link></li>
              </ul>
            </div>
            
            <div>
              <h4 className="font-bold uppercase mb-4">Company</h4>
              <ul className="space-y-2 text-sm font-medium">
                <li><Link to="/about" className="hover:text-primary">About</Link></li>
                <li><Link to="/#pricing" className="hover:text-primary">Pricing</Link></li>
              </ul>
            </div>
            
            <div>
              <h4 className="font-bold uppercase mb-4">Legal</h4>
              <ul className="space-y-2 text-sm font-medium">
                <li><Link to="/privacy" className="hover:text-primary">Privacy Policy</Link></li>
                <li><Link to="/terms" className="hover:text-primary">Terms of Service</Link></li>
              </ul>
            </div>
          </div>
          
          <div className="border-t-4 border-black pt-8 text-center">
            <p className="font-bold text-sm">
              © 2025 WriterAI. All rights reserved. Built with brutalist love.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Index;

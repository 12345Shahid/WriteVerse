import PublicLayout from "@/layouts/PublicLayout";
import { Link } from "react-router-dom";
import { Sparkles, Mail, FileText, ShoppingBag, Briefcase, Linkedin, ShieldCheck, Zap, Layers, Bot as Robot, Database, Users } from "lucide-react";
import { useEffect, useRef } from 'react';
import gsap from 'gsap';

const FEATURE_CARDS = [
  {
    icon: Layers,
    title: "32+ Specialized Tools",
    description: "A comprehensive suite of niche AI tools for every writing task imaginable.",
    features: ["SEO Blog Post Writers & Optimizers", "Cold Outreach & Follow-up Suite", "E-commerce & Ad Copy Generators"],
    color: "from-blue-500/20 to-cyan-500/20",
    iconColor: "text-blue-400"
  },
  {
    icon: Robot,
    title: "Autonomous AI Agents",
    description: "Deploy custom AI agents that understand your brand and execute complex tasks.",
    features: ["Custom instructions & Brand voice", "Multi-agent collaboration", "Role-based AI personalities"],
    color: "from-purple-500/20 to-pink-500/20",
    iconColor: "text-purple-400"
  },
  {
    icon: Zap,
    title: "Multi-Step Workflows",
    description: "Automate your entire content pipeline from research to final polished draft.",
    features: ["Sequential task automation", "Smart triggers & conditional logic", "Bulk content generation"],
    color: "from-orange-500/20 to-yellow-500/20",
    iconColor: "text-orange-400"
  },
  {
    icon: Database,
    title: "Shared Knowledge Base",
    description: "Centralize your company context, documents, and data for AI to reference.",
    features: ["Upload PDF, Docs, & Web links", "Instant semantic search", "Team-wide context syncing"],
    color: "from-green-500/20 to-emerald-500/20",
    iconColor: "text-green-400"
  },
  {
    icon: ShieldCheck,
    title: "Brand Voice & Governance",
    description: "Ensure every piece of content matches your unique tone and standards.",
    features: ["Custom tone of voice profiles", "Style guide enforcement", "Compliance & Quality checks"],
    color: "from-red-500/20 to-orange-500/20",
    iconColor: "text-red-400"
  },
  {
    icon: Users,
    title: "Team Collaboration",
    description: "Built for high-performing teams to create, review, and publish together.",
    features: ["Shared workspaces & projects", "Real-time editing & comments", "Granular access controls"],
    color: "from-blue-600/20 to-indigo-600/20",
    iconColor: "text-blue-500"
  }
];

const Features = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const cardRefs = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap.from(".feature-header", {
        opacity: 0,
        y: 30,
        duration: 0.8,
        ease: "power3.out"
      });

      cardRefs.current.forEach((card, index) => {
        if (card) {
          gsap.from(card, {
            opacity: 0,
            y: 50,
            duration: 0.8,
            delay: 0.1 * index,
            scrollTrigger: {
              trigger: card,
              start: "top 85%",
              toggleActions: "play none none reverse"
            }
          });
        }
      });
    }, containerRef);
    return () => ctx.revert();
  }, []);

  return (
    <PublicLayout>
      <div ref={containerRef} className="pb-24">
        {/* Hero Section for Features */}
        <div className="feature-header text-center mb-20 px-6">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-bold uppercase tracking-widest mb-8">
            <Zap className="w-3 h-3" /> All-in-One AI Suite
          </div>
          <h1 className="text-4xl md:text-6xl font-bold mb-6 text-white tracking-tight">
            The World's Most <span className="gradient-text">Feature-Rich</span> Platform
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto font-light leading-relaxed">
            Everything you need to automate your content pipeline. From professional research to viral social copies, we've built it all.
          </p>
        </div>

        {/* Feature Grid */}
        <div className="container mx-auto px-6">
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {FEATURE_CARDS.map((item, index) => (
              <div
                key={index}
                ref={(el) => (cardRefs.current[index] = el)}
                className="group relative"
              >
                <div className={`absolute inset-0 bg-gradient-to-br ${item.color} rounded-3xl blur-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 -z-10`} />
                <div className="glass-card h-full p-8 rounded-3xl border border-white/10 hover:border-primary/30 transition-all duration-300">
                  <div className={`w-14 h-14 rounded-2xl bg-white/5 flex items-center justify-center mb-6 border border-white/10 ${item.iconColor} group-hover:scale-110 transition-transform duration-300`}>
                    <item.icon size={28} />
                  </div>
                  <h3 className="text-2xl font-bold mb-4 text-white">{item.title}</h3>
                  <p className="text-muted-foreground mb-8 leading-relaxed">
                    {item.description}
                  </p>
                  <ul className="space-y-3">
                    {item.features.map((feat, fIdx) => (
                      <li key={fIdx} className="flex items-center gap-3 text-sm text-white/80">
                        <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                        {feat}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* CTA Section */}
        <div className="container mx-auto px-6 mt-32">
          <div className="relative p-1 rounded-3xl overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-r from-primary to-secondary opacity-20" />
            <div className="glass-card relative rounded-[22px] p-12 text-center border border-white/10">
              <h2 className="text-3xl md:text-5xl font-bold mb-6 text-white">Ready to automate your workflow?</h2>
              <p className="text-xl text-muted-foreground max-w-2xl mx-auto mb-10 font-light">
                Join thousands of high-performing creators and teams using WriteVerse Hub today.
              </p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                <Link to="/auth" className="btn-premium px-10 py-4 rounded-xl text-lg w-full sm:w-auto">
                  Get Started Free
                </Link>
                <Link to="/pricing" className="btn-glass px-10 py-4 rounded-xl text-lg w-full sm:w-auto">
                  View Pricing
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </PublicLayout>
  );
};

export default Features;

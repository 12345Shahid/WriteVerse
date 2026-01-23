import PublicLayout from "@/layouts/PublicLayout";
import { CheckCircle2, Zap, BarChart3, Users, Mail, PenTool } from "lucide-react";

const UseCases = () => {
  const categories = [
    {
      title: "Sales",
      icon: <BarChart3 className="w-6 h-6 text-primary" />,
      items: [
        "Prospecting Cockpit",
        "Inbound Lead Processing",
        "Deal Coaching & Forecasting",
        "Cold Outreach Generation"
      ]
    },
    {
      title: "Marketing",
      icon: <Zap className="w-6 h-6 text-secondary" />,
      items: [
        "Account Based Marketing",
        "Content Creation",
        "Translation & Localization",
        "Social Media Campaigns"
      ]
    },
    {
      title: "Operations",
      icon: <Users className="w-6 h-6 text-accent" />,
      items: [
        "Lead + Account Intelligence",
        "CRM Enrichment",
        "GTM Systems Integrations",
        "Internal Knowledge Base"
      ]
    },
    {
      title: "Writing",
      icon: <PenTool className="w-6 h-6 text-pink-500" />,
      items: [
        "Blog Post Generation",
        "Email Writing Assistant",
        "Copywriting Helper",
        "Script Writing"
      ]
    }
  ];

  return (
    <PublicLayout>
      <div className="container mx-auto px-6 py-20 relative">
        <div className="absolute top-1/4 left-0 w-96 h-96 bg-primary/10 rounded-full blur-[100px] pointer-events-none" />
        
        <div className="text-center mb-20 relative z-10">
           <h1 className="text-4xl md:text-6xl font-bold mb-6 text-white">
             One Platform, <span className="gradient-text">Endless Possibilities</span>
           </h1>
           <p className="text-xl text-muted-foreground max-w-2xl mx-auto font-light">
             Discover how teams use WriteVerse Hub to automate workflows and scale impact.
           </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8 relative z-10">
           {categories.map((cat) => (
             <div key={cat.title} className="glass-card rounded-2xl p-6 hover:-translate-y-2 transition-transform duration-300">
               <div className="flex items-center gap-3 mb-6">
                 <div className="w-12 h-12 rounded-xl bg-white/5 flex items-center justify-center border border-white/10">
                   {cat.icon}
                 </div>
                 <h3 className="text-xl font-bold text-white">{cat.title}</h3>
               </div>
               <ul className="space-y-4">
                 {cat.items.map((item) => (
                   <li key={item} className="flex items-start gap-2 text-muted-foreground text-sm">
                     <CheckCircle2 className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                     {item}
                   </li>
                 ))}
               </ul>
             </div>
           ))}
        </div>

        <div className="mt-20 text-center">
          <a href="/auth" className="btn-premium inline-flex px-8 py-4 rounded-xl text-white font-bold tracking-wide shadow-lg shadow-primary/20 hover:shadow-primary/40">
            Start Your Free Trial
          </a>
        </div>
      </div>
    </PublicLayout>
  );
};

export default UseCases;

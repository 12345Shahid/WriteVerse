import PublicLayout from "@/layouts/PublicLayout";

const Privacy = () => {
  return (
    <PublicLayout>
      <div className="container mx-auto px-6 py-12 md:py-20 animate-fade-in">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="text-center mb-16">
            <h1 className="text-4xl md:text-6xl font-bold mb-6">
              Privacy <span className="gradient-text">Policy</span>
            </h1>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto font-light">
              Your privacy is paramount. Here's how we protect and manage your data.
            </p>
          </div>

          <div className="space-y-8">
            <section className="glass-card rounded-2xl p-8 border-l-4 border-l-primary/50">
              <h2 className="text-2xl font-bold mb-4 text-white">Information We Collect</h2>
              <ul className="space-y-3 text-muted-foreground">
                <li className="flex gap-3 items-start">
                  <span className="text-primary mt-1">•</span>
                  <span><strong>Account Data:</strong> Email address, name, and profile information you provide during signup.</span>
                </li>
                <li className="flex gap-3 items-start">
                  <span className="text-primary mt-1">•</span>
                  <span><strong>Usage Data:</strong> Information about how you use our tools, saved projects, and preferences.</span>
                </li>
                <li className="flex gap-3 items-start">
                  <span className="text-primary mt-1">•</span>
                  <span><strong>Analytic Data:</strong> Aggregated, anonymous data to help us improve system performance.</span>
                </li>
              </ul>
            </section>

            <section className="glass-card rounded-2xl p-8 border-l-4 border-l-secondary/50">
              <h2 className="text-2xl font-bold mb-4 text-white">How We Use Your Data</h2>
              <ul className="space-y-3 text-muted-foreground">
                <li className="flex gap-3 items-start">
                  <span className="text-secondary mt-1">•</span>
                  <span>To provide and maintain the WriteVerse Hub service.</span>
                </li>
                <li className="flex gap-3 items-start">
                  <span className="text-secondary mt-1">•</span>
                  <span>To improve our AI models and user experience (anonymized only).</span>
                </li>
                <li className="flex gap-3 items-start">
                  <span className="text-secondary mt-1">•</span>
                  <span>To communicate with you about updates, security, and support.</span>
                </li>
              </ul>
            </section>

            <section className="glass-card rounded-2xl p-8 border-l-4 border-l-accent/50">
              <h2 className="text-2xl font-bold mb-4 text-white">Data Storage & Security</h2>
              <p className="text-muted-foreground leading-relaxed mb-4">
                We utilize industry-standard encryption and security practices. Authentication is handled via Supabase, and payments are processed securely through Stripe. We do not sell your personal data to third parties.
              </p>
              <p className="text-muted-foreground leading-relaxed">
                Please note that AI generation involves sending prompts to LLM providers. Do not input sensitive personal information (PII) into the generation tools.
              </p>
            </section>

            <section className="mt-12 text-center border-t border-white/10 pt-8">
              <p className="text-muted-foreground">
                Questions? Contact us at <a href="mailto:support@writeverse.com" className="text-primary hover:underline">support@writeverse.com</a>
              </p>
            </section>
          </div>
        </div>
      </div>
    </PublicLayout>
  );
};

export default Privacy;

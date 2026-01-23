import PublicLayout from "@/layouts/PublicLayout";

const Terms = () => {
  return (
    <PublicLayout>
      <div className="container mx-auto px-6 py-12 md:py-20 animate-fade-in">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="text-center mb-16">
            <h1 className="text-4xl md:text-6xl font-bold mb-6">
              Terms of <span className="gradient-text">Service</span>
            </h1>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto font-light">
              Guidelines for using the WriteVerse Hub platform.
            </p>
          </div>

          <div className="space-y-8">
            <section className="glass-card rounded-2xl p-8">
              <h2 className="text-xl font-bold mb-4 text-white border-b border-white/10 pb-4">1. Acceptance of Terms</h2>
              <p className="text-muted-foreground leading-relaxed">
                By accessing or using WriteVerse Hub, you agree to be bound by these Terms. If you disagree with any part of the terms, you may not access the service.
              </p>
            </section>

            <section className="glass-card rounded-2xl p-8">
              <h2 className="text-xl font-bold mb-4 text-white border-b border-white/10 pb-4">2. Usage Guidelines</h2>
              <p className="text-muted-foreground leading-relaxed mb-4">
                You agree not to use the platform for any illegal purpose or to generate harmful content. We reserve the right to suspend accounts that violate our usage policies.
              </p>
              <ul className="list-disc pl-5 space-y-2 text-muted-foreground">
                 <li>Do not attempt to reverse engineer the platform.</li>
                 <li>Do not use automated bots to access the service.</li>
                 <li>Do not share your account credentials.</li>
              </ul>
            </section>

            <section className="glass-card rounded-2xl p-8">
              <h2 className="text-xl font-bold mb-4 text-white border-b border-white/10 pb-4">3. Intellectual Property</h2>
              <p className="text-muted-foreground leading-relaxed">
                You retain ownership of the content you generate using functionality on the platform, subject to the terms of underlying AI model providers. WriteVerse Hub claims no ownership over your generated outputs.
              </p>
            </section>

            <section className="glass-card rounded-2xl p-8">
              <h2 className="text-xl font-bold mb-4 text-white border-b border-white/10 pb-4">4. Subscriptions & Billing</h2>
              <p className="text-muted-foreground leading-relaxed">
                Paid services are billed in advance. You may cancel your subscription at any time; however, there are no refunds for partial months or unused credits.
              </p>
            </section>

            <div className="mt-8 text-sm text-muted-foreground text-center">
              Last Updated: January 2025
            </div>
          </div>
        </div>
      </div>
    </PublicLayout>
  );
};

export default Terms;

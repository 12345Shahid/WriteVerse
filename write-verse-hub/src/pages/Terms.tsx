import { SiteNav } from "@/components/SiteNav";

const Terms = () => {
  return (
    <div className="min-h-screen bg-background">
      <SiteNav />

      <header className="border-b-4 border-black bg-muted">
        <div className="container mx-auto px-4 py-12">
          <h1 className="text-4xl md:text-5xl font-bold mb-3">Terms of Service</h1>
          <p className="text-lg font-medium text-muted-foreground max-w-3xl">
            Please read these terms carefully before using WriterAI.
          </p>
        </div>
      </header>

      <main className="container mx-auto px-4 py-12 space-y-8 max-w-4xl">
        <section className="border-4 border-black bg-card p-6 shadow-brutal">
          <h2 className="text-2xl font-bold mb-2">Using WriterAI</h2>
          <p className="font-medium">
            You must comply with applicable laws and avoid submitting harmful, illegal, or infringing content. We may rate-limit or suspend accounts to protect the service.
          </p>
        </section>

        <section className="border-4 border-black bg-card p-6 shadow-brutal">
          <h2 className="text-2xl font-bold mb-2">Accounts</h2>
          <p className="font-medium">
            You are responsible for safeguarding your account. Do not share credentials. If you suspect unauthorized access, notify us.
          </p>
        </section>

        <section className="border-4 border-black bg-card p-6 shadow-brutal">
          <h2 className="text-2xl font-bold mb-2">Content & AI Outputs</h2>
          <p className="font-medium">
            AI outputs may be inaccurate. Review and edit before use. You retain rights to your inputs and outputs, subject to third-party model providers’ policies.
          </p>
        </section>

        <section className="border-4 border-black bg-card p-6 shadow-brutal">
          <h2 className="text-2xl font-bold mb-2">Payments</h2>
          <p className="font-medium">
            If you choose paid plans or credit packs, charges are handled via Stripe. Taxes may apply. Refunds are not guaranteed except as required by law.
          </p>
        </section>

        <section className="border-4 border-black bg-card p-6 shadow-brutal">
          <h2 className="text-2xl font-bold mb-2">Changes</h2>
          <p className="font-medium">
            We may update these terms and will indicate the latest effective date. Continued use means acceptance of updated terms.
          </p>
        </section>
      </main>

      <footer className="border-t-4 border-black bg-background py-10 mt-8">
        <div className="container mx-auto px-4 text-center">
          <p className="font-bold text-sm text-muted-foreground">© 2025 WriterAI</p>
        </div>
      </footer>
    </div>
  );
};

export default Terms;

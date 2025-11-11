import { SiteNav } from "@/components/SiteNav";

const Terms = () => {
  return (
    <div className="min-h-screen bg-background">
      <SiteNav />
      <header className="border-b-4 border-black bg-muted">
        <div className="container mx-auto px-4 py-12">
          <h1 className="text-4xl md:text-5xl font-bold mb-3">Terms of Service</h1>
          <p className="text-lg font-medium text-muted-foreground max-w-3xl">
            The terms that govern your use of WriterAI.
          </p>
        </div>
      </header>

      <main className="container mx-auto px-4 py-12 max-w-5xl space-y-8">
        <section className="border-4 border-black bg-card p-6 shadow-brutal">
          <h2 className="text-2xl font-bold mb-2">Use of Service</h2>
          <ul className="list-disc pl-6 font-medium space-y-2">
            <li>Do not abuse, spam, or misuse the platform</li>
            <li>Respect applicable laws and third-party rights</li>
            <li>We may rate-limit to protect service reliability</li>
          </ul>
        </section>

        <section className="border-4 border-black bg-card p-6 shadow-brutal">
          <h2 className="text-2xl font-bold mb-2">Accounts</h2>
          <ul className="list-disc pl-6 font-medium space-y-2">
            <li>Authentication handled by Supabase</li>
            <li>You are responsible for actions taken under your account</li>
          </ul>
        </section>

        <section className="border-4 border-black bg-card p-6 shadow-brutal">
          <h2 className="text-2xl font-bold mb-2">Content</h2>
          <ul className="list-disc pl-6 font-medium space-y-2">
            <li>You own your input and generated outputs</li>
            <li>Public links are opt-in per saved item</li>
          </ul>
        </section>

        <section className="border-4 border-black bg-card p-6 shadow-brutal">
          <h2 className="text-2xl font-bold mb-2">Changes</h2>
          <p className="font-medium">We may update these terms as the product evolves.</p>
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

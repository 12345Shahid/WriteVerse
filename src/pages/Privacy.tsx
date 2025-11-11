import { SiteNav } from "@/components/SiteNav";

const Privacy = () => {
  return (
    <div className="min-h-screen bg-background">
      <SiteNav />
      <header className="border-b-4 border-black bg-muted">
        <div className="container mx-auto px-4 py-12">
          <h1 className="text-4xl md:text-5xl font-bold mb-3">Privacy Policy</h1>
          <p className="text-lg font-medium text-muted-foreground max-w-3xl">
            Your privacy matters. This page explains what data we collect and how we use it.
          </p>
        </div>
      </header>

      <main className="container mx-auto px-4 py-12 max-w-5xl space-y-8">
        <section className="border-4 border-black bg-card p-6 shadow-brutal">
          <h2 className="text-2xl font-bold mb-2">Information We Collect</h2>
          <ul className="list-disc pl-6 font-medium space-y-2">
            <li>Account information (email) via Supabase Auth</li>
            <li>Saved generations you choose to store</li>
            <li>Basic usage metrics for reliability and abuse prevention</li>
          </ul>
        </section>

        <section className="border-4 border-black bg-card p-6 shadow-brutal">
          <h2 className="text-2xl font-bold mb-2">How We Use Data</h2>
          <ul className="list-disc pl-6 font-medium space-y-2">
            <li>Provide and improve AI writing features</li>
            <li>Maintain account access and security</li>
            <li>Detect abuse (e.g., rate limiting)</li>
          </ul>
        </section>

        <section className="border-4 border-black bg-card p-6 shadow-brutal">
          <h2 className="text-2xl font-bold mb-2">Sharing</h2>
          <p className="font-medium">We do not sell personal data. Public links are opt-in per saved item.</p>
        </section>

        <section className="border-4 border-black bg-card p-6 shadow-brutal">
          <h2 className="text-2xl font-bold mb-2">Contact</h2>
          <p className="font-medium">Questions? Use the Dashboard contact or open an issue in our repository.</p>
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

export default Privacy;

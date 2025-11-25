import { SiteNav } from "@/components/SiteNav";

const Privacy = () => {
  return (
    <div className="min-h-screen bg-background">
      <SiteNav />

      <header className="border-b-4 border-black bg-muted">
        <div className="container mx-auto px-4 py-12">
          <h1 className="text-4xl md:text-5xl font-bold mb-3">Privacy Policy</h1>
          <p className="text-lg font-medium text-muted-foreground max-w-3xl">
            Your privacy matters. This policy explains what we collect and how we use it.
          </p>
        </div>
      </header>

      <main className="container mx-auto px-4 py-12 space-y-8 max-w-4xl">
        <section className="border-4 border-black bg-card p-6 shadow-brutal">
          <h2 className="text-2xl font-bold mb-2">Information We Collect</h2>
          <ul className="list-disc pl-6 font-medium space-y-2">
            <li>Account data: email address and basic profile info you provide.</li>
            <li>Usage data: tool interactions and saved results you choose to store.</li>
            <li>Technical data: device, browser, and analytics events (aggregated).</li>
          </ul>
        </section>

        <section className="border-4 border-black bg-card p-6 shadow-brutal">
          <h2 className="text-2xl font-bold mb-2">How We Use Data</h2>
          <ul className="list-disc pl-6 font-medium space-y-2">
            <li>To operate the app and deliver writing features.</li>
            <li>To improve quality, reliability, and user experience.</li>
            <li>To prevent abuse and ensure platform security.</li>
          </ul>
        </section>

        <section className="border-4 border-black bg-card p-6 shadow-brutal">
          <h2 className="text-2xl font-bold mb-2">Storage & Processors</h2>
          <p className="font-medium">
            We use Supabase for authentication and database. AI generation may call external LLM APIs. Do not submit confidential or sensitive data you are not comfortable sharing with these processors.
          </p>
        </section>

        <section className="border-4 border-black bg-card p-6 shadow-brutal">
          <h2 className="text-2xl font-bold mb-2">Your Choices</h2>
          <ul className="list-disc pl-6 font-medium space-y-2">
            <li>You can delete saved results and revoke sharing links at any time.</li>
            <li>You can request account deletion by contacting support.</li>
          </ul>
        </section>

        <section className="border-4 border-black bg-card p-6 shadow-brutal">
          <h2 className="text-2xl font-bold mb-2">Contact</h2>
          <p className="font-medium">Questions about privacy? Reach out via the Dashboard contact link.</p>
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

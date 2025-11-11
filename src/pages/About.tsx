import { SiteNav } from "@/components/SiteNav";

const About = () => {
  return (
    <div className="min-h-screen bg-background">
      <SiteNav />

      <header className="border-b-4 border-black bg-muted">
        <div className="container mx-auto px-4 py-12">
          <h1 className="text-4xl md:text-5xl font-bold mb-3">About WriterAI</h1>
          <p className="text-lg font-medium text-muted-foreground max-w-3xl">
            WriterAI unifies twelve focused AI writing tools into one fast, approachable platform.
          </p>
        </div>
      </header>

      <main className="container mx-auto px-4 py-12 space-y-10 max-w-5xl">
        <section className="border-4 border-black bg-card p-6 shadow-brutal">
          <h2 className="text-2xl font-bold mb-2">Our Mission</h2>
          <p className="font-medium">
            Help individuals and teams communicate clearly and grow faster by removing friction in everyday writing tasks.
          </p>
        </section>

        <section className="border-4 border-black bg-card p-6 shadow-brutal">
          <h2 className="text-2xl font-bold mb-2">What We Build</h2>
          <ul className="list-disc pl-6 font-medium space-y-2">
            <li>Email subject lines that are optimized for opens and easy A/B testing.</li>
            <li>ATS-friendly resume bullets that highlight measurable impact.</li>
            <li>Personalized cold emails with tips and follow-up templates.</li>
            <li>Conversion-focused product descriptions with SEO elements.</li>
            <li>Structured, compliant job descriptions, exportable to PDF.</li>
            <li>Engaging LinkedIn posts with emoji suggestions and hashtag help.</li>
            <li>Social media ad copy with platform awareness and CTR cues.</li>
            <li>Paragraph summarizer with key points and readability.</li>
            <li>Cover letter generator with ATS score and strong openings.</li>
            <li>Twitter/X thread composer with hashtags and engagement prediction.</li>
            <li>FAQ generator with optional SEO schema markup.</li>
            <li>Script/voiceover writer with time-stamped segments and pacing.</li>
          </ul>
        </section>

        <section className="grid md:grid-cols-2 gap-6">
          <div className="border-4 border-black bg-card p-6 shadow-brutal">
            <h3 className="text-xl font-bold mb-2">Principles</h3>
            <ul className="list-disc pl-6 font-medium space-y-2">
              <li>Clarity over complexity</li>
              <li>Speed and reliability</li>
              <li>Respect for user time and data</li>
            </ul>
          </div>
        </section>

        <section className="border-4 border-black bg-card p-6 shadow-brutal">
          <h2 className="text-2xl font-bold mb-2">Contact</h2>
          <p className="font-medium">Questions or ideas? Reach out via the Dashboard or open an issue on our repository.</p>
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

export default About;

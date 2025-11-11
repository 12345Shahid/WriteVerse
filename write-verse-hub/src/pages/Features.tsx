import { Link } from "react-router-dom";
import { SiteNav } from "@/components/SiteNav";
import { Button } from "@/components/ui/button-brutal";

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <section className="container mx-auto px-4 py-10">
    <div className="max-w-5xl mx-auto">
      <h2 className="text-3xl md:text-4xl font-bold mb-4">{title}</h2>
      <div className="border-4 border-black bg-card p-6 shadow-brutal">
        {children}
      </div>
    </div>
  </section>
);

const Features = () => {
  return (
    <div className="min-h-screen bg-background">
      <SiteNav />

      <header className="border-b-4 border-black bg-muted">
        <div className="container mx-auto px-4 py-10">
          <h1 className="text-4xl md:text-5xl font-bold mb-3">Features</h1>
          <p className="text-lg font-medium text-muted-foreground max-w-3xl">
            Six focused AI writing tools in one place. Built for speed, clarity, and results.
          </p>
          <div className="mt-6">
            <Link to="/tools/email-subject">
              <Button>Start Writing</Button>
            </Link>
          </div>
        </div>
      </header>

      <Section title="Email Subject Line Generator">
        <div className="space-y-3 text-lg font-medium">
          <p>Generate 10 subject lines with predicted open-rate, psychology trigger, and character guidance (mobile vs desktop). Includes A/B testing workflow.</p>
          <ul className="list-disc pl-6 text-base">
            <li>A/B test picker and winner selection</li>
            <li>Mobile/desktop character badges</li>
            <li>CSV export and Saved results</li>
          </ul>
          <p className="text-sm text-muted-foreground mt-3">
            Sources: <a className="underline" target="_blank" href="https://vwo.com/blog/email-ab-testing/">VWO</a>, <a className="underline" target="_blank" href="https://blog.hubspot.com/sales/subject-line-stats-open-rates-slideshare">HubSpot</a>
          </p>
        </div>
      </Section>

      <Section title="Cold Email Personalizer">
        <div className="space-y-3 text-lg font-medium">
          <p>Create 3 variations with hooks (Curiosity, Pain-Point, Value-First), plus personalization tips and follow-up templates.</p>
          <ul className="list-disc pl-6 text-base">
            <li>Short actionable personalization tips</li>
            <li>Two follow-up templates per variation</li>
            <li>CSV export and Saved results</li>
          </ul>
          <p className="text-sm text-muted-foreground mt-3">
            Sources: <a className="underline" target="_blank" href="https://www.klenty.com/blog/cold-email-statistics/">Klenty</a>, <a className="underline" target="_blank" href="https://stripo.email/blog/cold-email-statistics-key-insights-to-improve-your-outreach-strategy/">Stripo</a>
          </p>
        </div>
      </Section>

      <Section title="Product Description Writer">
        <div className="space-y-3 text-lg font-medium">
          <p>Write persuasive descriptions with SEO keywords, meta description, and CTA. Optional bullet-mode for listings.</p>
          <ul className="list-disc pl-6 text-base">
            <li>SEO keywords bundle and concise meta description</li>
            <li>Clear call-to-action suggestions</li>
            <li>Bullet-mode to generate 5 crisp bullets</li>
          </ul>
          <p className="text-sm text-muted-foreground mt-3">
            Sources: <a className="underline" target="_blank" href="https://www.shopify.com/blog/ecommerce-product-page-seo">Shopify</a>
          </p>
        </div>
      </Section>

      <Section title="Job Description Generator">
        <div className="space-y-3 text-lg font-medium">
          <p>Produces structured sections (summary, responsibilities, qualifications, salary, culture) and a side panel with compliance notes. Export to PDF.</p>
          <ul className="list-disc pl-6 text-base">
            <li>Inclusive, compliance-friendly language notes</li>
            <li>Sectioned output for easy editing</li>
            <li>One-click PDF export</li>
          </ul>
          <p className="text-sm text-muted-foreground mt-3">
            Sources: <a className="underline" target="_blank" href="https://www.eeoc.gov/eeoc-guidance">EEOC Guidance</a>
          </p>
        </div>
      </Section>

      <Section title="LinkedIn Post Generator">
        <div className="space-y-3 text-lg font-medium">
          <p>Create 3 post variations with hashtag suggestions, emoji recommendations, and an engagement gauge.</p>
          <ul className="list-disc pl-6 text-base">
            <li>Emoji suggestions with apply button</li>
            <li>Simple engagement visualization</li>
            <li>Export and Saved management</li>
          </ul>
          <p className="text-sm text-muted-foreground mt-3">
            Sources: <a className="underline" target="_blank" href="https://metricool.com/linkedin-industries/">Metricool 2024 LinkedIn Study</a>
          </p>
        </div>
      </Section>

      <Section title="Saved, Sharing, and Export">
        <div className="space-y-3 text-lg font-medium">
          <ul className="list-disc pl-6 text-base">
            <li>Filter saved results by tool and date</li>
            <li>Public sharing links with one-click toggle</li>
            <li>CSV/TXT/PDF export where available</li>
          </ul>
        </div>
      </Section>

      <footer className="border-t-4 border-black bg-background py-10 mt-8">
        <div className="container mx-auto px-4 text-center">
          <p className="font-bold text-sm text-muted-foreground">© 2025 WriterAI</p>
        </div>
      </footer>
    </div>
  );
};

export default Features;

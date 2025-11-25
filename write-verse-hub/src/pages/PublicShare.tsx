import { useEffect, useMemo, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { ToolLayout } from "@/components/tool/ToolLayout";
import { Button } from "@/components/ui/button-brutal";

interface SavedPublic {
  id: string;
  tool_name: string;
  input_data: any;
  results: any;
  created_at: string;
  public_slug: string;
}

const Section: React.FC<{ title: string; children: any }> = ({ title, children }) => (
  <div className="border-4 border-black bg-background p-4 shadow-brutal">
    <div className="text-xs font-bold uppercase mb-3">{title}</div>
    {children}
  </div>
);

const PublicShare = () => {
  const { slug } = useParams<{ slug: string }>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<SavedPublic | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function run() {
      if (!slug) return;
      console.groupCollapsed("[PublicShare] fetch", slug);
      try {
        setLoading(true);
        setError(null);
        const res = await fetch(`/api/public-get?slug=${encodeURIComponent(slug)}`);
        const text = await res.text();
        let json: any = null;
        try { json = JSON.parse(text); } catch {}
        console.debug("status", res.status);
        console.debug("body", json ?? text.slice(0, 400));
        if (!res.ok) throw new Error(json?.message || `HTTP ${res.status}`);
        if (!cancelled) setData(json.result as SavedPublic);
      } catch (e: any) {
        console.error("[PublicShare] error", e);
        if (!cancelled) setError(e?.message || "Failed to load public result");
      } finally {
        console.groupEnd();
        if (!cancelled) setLoading(false);
      }
    }
    run();
    return () => { cancelled = true; };
  }, [slug]);

  const shareUrl = useMemo(() => `${window.location.origin}/public/${slug ?? ""}`,[slug]);

  const renderBody = (tool: string, results: any) => {
    switch (tool) {
      case "email_subject": {
        const arr = Array.isArray(results) ? results : [];
        return (
          <div className="space-y-3">{arr.map((r: any, i: number) => (
            <div key={i} className="border-2 border-black bg-muted p-3">
              <div className="font-bold">{r.text}</div>
              <div className="text-xs font-medium mt-1">Open: {r.openRate} • Trigger: {r.trigger} • {r.charCount} chars</div>
            </div>
          ))}</div>
        );
      }
      case "resume": {
        const arr = Array.isArray(results) ? results : [];
        return (
          <ul className="list-disc pl-6 space-y-2">{arr.map((r: any, i:number) => (
            <li key={i}><span className="font-semibold">{r.actionVerb}:</span> {r.text} <span className="text-xs opacity-70">(ATS {r.score})</span></li>
          ))}</ul>
        );
      }
      case "cold_email": {
        const arr = Array.isArray(results) ? results : [];
        return (
          <div className="space-y-4">{arr.map((r: any, i:number) => (
            <div key={i} className="border-2 border-black p-3 bg-background">
              <div className="text-xs font-bold uppercase mb-2">{r.hook}</div>
              <pre className="whitespace-pre-wrap text-sm">{r.text}</pre>
            </div>
          ))}</div>
        );
      }
      case "product_description": {
        const arr = Array.isArray(results) ? results : [];
        return (
          <div className="space-y-4">{arr.map((r:any, i:number) => (
            <div key={i} className="border-2 border-black p-4">
              <div className="text-sm font-semibold mb-1">{r.tone}</div>
              <p className="mb-2 whitespace-pre-wrap">{r.text}</p>
              {r.bullets?.length ? (
                <ul className="list-disc pl-6 space-y-1">
                  {r.bullets.map((b:string, idx:number) => (<li key={idx}>{b}</li>))}
                </ul>
              ) : null}
              <div className="text-xs mt-2 opacity-70">SEO: {r.seoKeywords?.join(', ')}</div>
              <div className="text-xs opacity-70">Meta: {r.metaDescription}</div>
              <div className="text-xs opacity-70">CTA: {r.cta}</div>
            </div>
          ))}</div>
        );
      }
      case "job_description": {
        const r = results || {};
        return (
          <div className="space-y-4">
            <Section title="Summary"><p className="whitespace-pre-wrap">{r.roleSummary}</p></Section>
            <Section title="Responsibilities">
              <ul className="list-disc pl-6 space-y-1">{(r.responsibilities||[]).map((x:string, i:number)=>(<li key={i}>{x}</li>))}</ul>
            </Section>
            <Section title="Required">
              <ul className="list-disc pl-6 space-y-1">{(r.requiredQualifications||[]).map((x:string,i:number)=>(<li key={i}>{x}</li>))}</ul>
            </Section>
            {r.niceToHave?.length ? (
              <Section title="Nice to have">
                <ul className="list-disc pl-6 space-y-1">{(r.niceToHave||[]).map((x:string,i:number)=>(<li key={i}>{x}</li>))}</ul>
              </Section>
            ) : null}
            <Section title="Other">
              <div className="text-sm">Salary: {r.salaryRange}</div>
              <div className="text-sm">Culture: {r.culture}</div>
              <div className="text-sm">EEO: {r.eeoStatement}</div>
            </Section>
          </div>
        );
      }
      case "linkedin": {
        const arr = Array.isArray(results) ? results : [];
        return (
          <div className="space-y-4">{arr.map((r:any,i:number) => (
            <div key={i} className="border-2 border-black p-3">
              <pre className="whitespace-pre-wrap text-sm">{r.text}</pre>
              <div className="text-xs mt-1 opacity-70">{r.engagementScore} • {r.hashtags}</div>
            </div>
          ))}</div>
        );
      }
      case "social_ad": {
        const arr = Array.isArray(results) ? results : [];
        return (
          <div className="space-y-3">{arr.map((r:any,i:number) => (
            <div key={i} className="border-2 border-black p-3 bg-muted">
              <div className="font-semibold">{r.text}</div>
              <div className="text-xs opacity-70 mt-1">{r.platform} • CTR {r.predictedCtr} • {r.trigger} • {r.charCount} chars</div>
            </div>
          ))}</div>
        );
      }
      case "summarizer": {
        const r = results || {};
        return (
          <div className="space-y-3">
            <Section title="Summary"><p className="whitespace-pre-wrap">{r.summary}</p></Section>
            <Section title="Key Points">
              <ul className="list-disc pl-6 space-y-1">{(r.keyPoints||[]).map((x:string,i:number)=>(<li key={i}>{x}</li>))}</ul>
            </Section>
            <div className="grid md:grid-cols-2 gap-3">
              <Section title="Readability">{r.readability}</Section>
              <Section title="Reading Time">{r.readingTime} • {r.timeSaved}</Section>
            </div>
          </div>
        );
      }
      case "cover_letter": {
        const r = results || {};
        return (
          <div className="space-y-3">
            <Section title="Letter"><pre className="whitespace-pre-wrap text-sm">{r.text}</pre></Section>
            <div className="grid md:grid-cols-3 gap-3">
              <Section title="ATS Score">{r.atsScore}</Section>
              <Section title="Opening Hook">{r.openingHook}</Section>
              <Section title="Closing">{r.closing}</Section>
            </div>
          </div>
        );
      }
      case "twitter_thread": {
        const r = results || {};
        const tweets = Array.isArray(r.tweets) ? r.tweets : [];
        return (
          <div className="space-y-2">
            {tweets.map((t:string, i:number)=> (
              <div key={i} className="border-2 border-black p-3 bg-background font-medium whitespace-pre-wrap">{t}</div>
            ))}
            <div className="text-xs mt-1 opacity-70">{r.engagementPrediction} • {r.hashtags}</div>
          </div>
        );
      }
      case "faq": {
        const r = results || {};
        const items = Array.isArray(r.items) ? r.items : [];
        return (
          <div className="space-y-3">
            {items.map((it:any, i:number) => (
              <div key={i} className="border-2 border-black p-3">
                <div className="font-bold">Q: {it.question}</div>
                <div className="mt-1">A: {it.answer}</div>
              </div>
            ))}
          </div>
        );
      }
      case "script": {
        const r = results || {};
        const segs = Array.isArray(r.segments) ? r.segments : [];
        return (
          <div className="space-y-3">
            <div className="grid md:grid-cols-3 gap-3">
              <Section title="Pacing">{r.pacingWpm} wpm</Section>
              <Section title="Word Count">{r.wordCount}</Section>
              <Section title="Read Time">{r.readTime}</Section>
            </div>
            {segs.map((s:any, i:number) => (
              <div key={i} className="border-2 border-black bg-background p-3 font-medium whitespace-pre-wrap">
                <span className="uppercase text-xs font-bold mr-2">{s.time}</span>{s.line}
              </div>
            ))}
          </div>
        );
      }
      case "blog_post": {
        const r = results || {};
        const outline = Array.isArray(r.outline) ? r.outline : [];
        return (
          <article className="border-4 border-black bg-card p-6 shadow-brutal space-y-4">
            {r.title && (
              <header className="space-y-2">
                <h2 className="text-2xl font-bold">{r.title}</h2>
                {r.meta_description && (
                  <p className="text-sm text-muted-foreground">{r.meta_description}</p>
                )}
              </header>
            )}
            {outline.length > 0 && (
              <section className="border-2 border-black bg-background p-3">
                <div className="text-xs font-bold uppercase mb-2">Outline</div>
                <ul className="list-disc pl-5 space-y-1">
                  {outline.map((h: string, i: number) => (
                    <li key={i} className="text-sm">{h}</li>
                  ))}
                </ul>
              </section>
            )}
            {r.body && (
              <section className="prose max-w-none whitespace-pre-wrap text-sm leading-relaxed">
                {r.body}
              </section>
            )}
          </article>
        );
      }
      case "article_from_outline": {
        const r = results || {};
        const outline = Array.isArray(r.outline) ? r.outline : [];
        return (
          <article className="border-4 border-black bg-card p-6 shadow-brutal space-y-4">
            {r.title && (
              <header className="space-y-2">
                <h2 className="text-2xl font-bold">{r.title}</h2>
              </header>
            )}
            {outline.length > 0 && (
              <section className="border-2 border-black bg-background p-3">
                <div className="text-xs font-bold uppercase mb-2">Outline</div>
                <ul className="list-disc pl-5 space-y-1">
                  {outline.map((h: string, i: number) => (
                    <li key={i} className="text-sm">{h}</li>
                  ))}
                </ul>
              </section>
            )}
            {r.body && (
              <section className="prose max-w-none whitespace-pre-wrap text-sm leading-relaxed">
                {r.body}
              </section>
            )}
          </article>
        );
      }
      case "seo_blog_optimizer": {
        const r = results || {};
        const headings = Array.isArray(r.suggested_headings) ? r.suggested_headings : [];
        const notes = Array.isArray(r.keyword_usage_notes) ? r.keyword_usage_notes : [];
        return (
          <div className="space-y-4">
            <article className="border-4 border-black bg-card p-6 shadow-brutal space-y-4">
              {r.optimized_title && (
                <header className="space-y-2">
                  <h2 className="text-2xl font-bold">{r.optimized_title}</h2>
                  {r.optimized_meta_description && (
                    <p className="text-sm text-muted-foreground">{r.optimized_meta_description}</p>
                  )}
                </header>
              )}
              {headings.length > 0 && (
                <section className="border-2 border-black bg-background p-3">
                  <div className="text-xs font-bold uppercase mb-2">Suggested Headings</div>
                  <ul className="list-disc pl-5 space-y-1">
                    {headings.map((h: string, i: number) => (
                      <li key={i} className="text-sm">{h}</li>
                    ))}
                  </ul>
                </section>
              )}
              {r.optimized_body && (
                <section className="prose max-w-none whitespace-pre-wrap text-sm leading-relaxed">
                  {r.optimized_body}
                </section>
              )}
            </article>
            {(notes.length > 0 || r.improvements_summary) && (
              <section className="border-4 border-black bg-background p-4 shadow-brutal">
                <div className="text-xs font-bold uppercase mb-2">SEO Notes</div>
                {r.improvements_summary && (
                  <p className="text-sm mb-2">{r.improvements_summary}</p>
                )}
                {notes.length > 0 && (
                  <ul className="list-disc pl-5 space-y-1 text-sm">
                    {notes.map((n: string, i: number) => (
                      <li key={i}>{n}</li>
                    ))}
                  </ul>
                )}
              </section>
            )}
          </div>
        );
      }
      case "case_study_writer": {
        const r = results || {};
        return (
          <article className="border-4 border-black bg-card p-6 shadow-brutal space-y-4">
            {r.headline && (
              <header className="space-y-2">
                <h2 className="text-2xl font-bold">{r.headline}</h2>
                {r.summary && (
                  <p className="text-sm text-muted-foreground">{r.summary}</p>
                )}
              </header>
            )}
            {r.background && (
              <section className="space-y-1">
                <h3 className="text-lg font-bold">Background</h3>
                <p className="whitespace-pre-wrap text-sm">{r.background}</p>
              </section>
            )}
            {r.challenge && (
              <section className="space-y-1">
                <h3 className="text-lg font-bold">Challenge</h3>
                <p className="whitespace-pre-wrap text-sm">{r.challenge}</p>
              </section>
            )}
            {r.solution && (
              <section className="space-y-1">
                <h3 className="text-lg font-bold">Solution</h3>
                <p className="whitespace-pre-wrap text-sm">{r.solution}</p>
              </section>
            )}
            {r.results && (
              <section className="space-y-1">
                <h3 className="text-lg font-bold">Results</h3>
                <p className="whitespace-pre-wrap text-sm">{r.results}</p>
              </section>
            )}
            {r.quote && (
              <section className="space-y-1 border-l-4 border-black pl-4">
                <h3 className="text-xs font-bold uppercase">Client Quote</h3>
                <p className="italic text-sm">“{r.quote}”</p>
              </section>
            )}
          </article>
        );
      }
      case "landing_page_writer": {
        const r = results || {};
        const sections = Array.isArray(r.sections) ? r.sections : [];
        const faqs = Array.isArray(r.faq_items) ? r.faq_items : [];
        return (
          <article className="border-4 border-black bg-card p-6 shadow-brutal space-y-4">
            {(r.hero_headline || r.hero_subheadline || r.hero_cta) && (
              <header className="space-y-2">
                {r.hero_headline && (
                  <h2 className="text-3xl font-bold">{r.hero_headline}</h2>
                )}
                {r.hero_subheadline && (
                  <p className="text-lg text-muted-foreground">{r.hero_subheadline}</p>
                )}
                {r.hero_cta && (
                  <p className="text-sm font-semibold">Primary CTA: {r.hero_cta}</p>
                )}
              </header>
            )}
            {sections.length > 0 && (
              <div className="space-y-4">
                {sections.map((s: any, i: number) => (
                  <section key={i} className="space-y-1">
                    {s.title && <h3 className="text-lg font-bold">{s.title}</h3>}
                    <p className="whitespace-pre-wrap text-sm">{s.body}</p>
                  </section>
                ))}
              </div>
            )}
            {faqs.length > 0 && (
              <section className="border-t-2 border-black pt-4 mt-2">
                <h3 className="text-lg font-bold mb-2">FAQ</h3>
                <div className="space-y-2">
                  {faqs.map((f: any, i: number) => (
                    <div key={i} className="border-2 border-black bg-background p-3">
                      <div className="font-bold">Q: {f.question}</div>
                      <div className="text-sm mt-1">A: {f.answer}</div>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </article>
        );
      }
      case "report_writer": {
        const r = results || {};
        const sections = Array.isArray(r.sections) ? r.sections : [];
        return (
          <article className="border-4 border-black bg-card p-6 shadow-brutal space-y-4">
            {r.title && (
              <header className="space-y-2">
                <h2 className="text-2xl font-bold">{r.title}</h2>
                {r.abstract && (
                  <p className="text-sm text-muted-foreground">{r.abstract}</p>
                )}
              </header>
            )}
            {sections.length > 0 && (
              <div className="space-y-4">
                {sections.map((s: any, i: number) => (
                  <section key={i} className="space-y-1">
                    {s.heading && <h3 className="text-lg font-bold">{s.heading}</h3>}
                    <p className="whitespace-pre-wrap text-sm">{s.body}</p>
                  </section>
                ))}
              </div>
            )}
          </article>
        );
      }
      case "blog_helper":
      case "copy_helper":
      case "social_helper":
      case "email_writer":
      case "rewrite_helper": {
        const arr = Array.isArray(results) ? results : results ? [results] : [];
        return (
          <div className="space-y-3">
            {arr.map((r:any, i:number) => {
              const text = typeof r === "string"
                ? r
                : typeof r?.text === "string"
                  ? r.text
                  : JSON.stringify(r, null, 2);
              return (
                <div key={i} className="border-2 border-black bg-muted p-3">
                  <div className="text-xs font-bold uppercase mb-1">Variation #{i + 1}</div>
                  <p className="whitespace-pre-wrap text-sm">{text}</p>
                </div>
              );
            })}
          </div>
        );
      }
      default:
        return (
          <pre className="whitespace-pre-wrap text-sm p-4 border-2 border-black bg-background">{JSON.stringify(results, null, 2)}</pre>
        );
    }
  };

  if (loading) {
    return (
      <ToolLayout title="Public Result" description="Loading...">
        <div className="border-4 border-black bg-muted p-8 text-center shadow-brutal">
          <p className="font-bold">Loading public content...</p>
        </div>
      </ToolLayout>
    );
  }
  if (error || !data) {
    return (
      <ToolLayout title="Public Result" description="Not found or unavailable">
        <div className="border-4 border-black bg-muted p-8 text-center shadow-brutal">
          <p className="font-bold">This shared result is not available.</p>
          <p className="font-medium">It may have been unshared or deleted.</p>
          <div className="mt-4">
            <Link to="/">
              <Button>Go Home</Button>
            </Link>
          </div>
        </div>
      </ToolLayout>
    );
  }

  return (
    <ToolLayout title="Public Result" description={`Shared content • ${new Date(data.created_at).toLocaleString()}`}>
      <div className="max-w-5xl mx-auto space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-block border-2 border-black bg-background px-3 py-1">
            <span className="text-xs font-bold uppercase">{data.tool_name}</span>
          </div>
          <Button
            variant="outline"
            onClick={() => navigator.clipboard.writeText(shareUrl)}
          >Copy Link</Button>
        </div>

        {/* Results */}
        <div className="space-y-2">
          {renderBody(data.tool_name, data.results)}
        </div>
      </div>
    </ToolLayout>
  );
};

export default PublicShare;

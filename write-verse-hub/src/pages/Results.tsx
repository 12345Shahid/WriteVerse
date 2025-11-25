import { useEffect, useState } from "react";
import { useTeam } from "@/context/TeamContext";
import { ToolLayout } from "@/components/tool/ToolLayout";
import { Button } from "@/components/ui/button-brutal";
import { getSavedResults, deleteSavedResult, shareSavedResult, unshareSavedResult } from "@/lib/api";
import { exportCsv, exportTxt } from "@/lib/export";

interface SavedItem {
  id: string;
  tool_name: string;
  input_data: any;
  results: any;
  created_at: string;
  is_public?: boolean;
  public_slug?: string | null;
}

const Results = () => {
  const { currentTeam } = useTeam();
  const isViewer = currentTeam?.role === 'viewer';

  const [items, setItems] = useState<SavedItem[]>([]);
  const [openId, setOpenId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [toolFilter, setToolFilter] = useState<string>("all");
  const [dateSort, setDateSort] = useState<'newest' | 'oldest'>("newest");

  const load = async () => {
    console.groupCollapsed("[Results] Load");
    try {
      setLoading(true);
      const data = await getSavedResults();
      console.debug("count", data.results?.length ?? 0);
      setItems(data.results as SavedItem[]);
    } catch (e) {
      console.error("[Results] Load failed", e);
      alert((e as any)?.message || "Failed to load saved results. See console for details.");
    } finally {
      console.groupEnd();
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleDelete = async (id: string) => {
    console.groupCollapsed("[Results] Delete", id);
    try {
      await deleteSavedResult(id);
      setItems((prev) => prev.filter((x) => x.id !== id));
    } catch (e) {
      console.error("[Results] Delete failed", e);
      alert((e as any)?.message || "Delete failed. See console for details.");
    } finally {
      console.groupEnd();
    }
  };

  const renderExport = (item: SavedItem) => {
    try {
      if (Array.isArray(item.results)) {
        exportCsv(
          `writerai-${item.tool_name}-${item.id}.csv`,
          item.results.map((r: any) => ({ ...r }))
        );
      } else if (typeof item.results === "string") {
        exportTxt(`writerai-${item.tool_name}-${item.id}.txt`, item.results);
      } else {
        exportTxt(`writerai-${item.tool_name}-${item.id}.txt`, JSON.stringify(item.results, null, 2));
      }
    } catch (e) {
      console.error("[Results] Export failed", e);
      alert("Export failed. See console for details.");
    }
  };

  const renderBody = (item: SavedItem) => {
    const r = item.results as any;
    if (typeof r === 'string') {
      return (
        <pre className="whitespace-pre-wrap font-mono text-sm p-4 border-2 border-black bg-background">
          {r}
        </pre>
      );
    }
    if (Array.isArray(r)) {
      return (
        <div className="space-y-3">
          {r.map((row: any, idx: number) => (
            <div key={idx} className="border-2 border-black p-3 bg-muted">
              {typeof row === 'string' ? (
                <pre className="whitespace-pre-wrap text-sm">{row}</pre>
              ) : (
                <>
                  {Object.entries(row || {}).map(([k, v]) => (
                    <div key={k} className="text-sm font-medium">
                      <span className="uppercase text-xs font-bold mr-2">{k}:</span>
                      <span>{String(v)}</span>
                    </div>
                  ))}
                </>
              )}
            </div>
          ))}
        </div>
      );
    }
    return (
      <pre className="whitespace-pre-wrap font-mono text-sm p-4 border-2 border-black bg-background">
        {JSON.stringify(r, null, 2)}
      </pre>
    );
  };

  return (
    <ToolLayout title="Saved Results" description="View and manage your saved generations">
      <div className="max-w-5xl mx-auto">
        {loading ? (
          <div className="border-4 border-black bg-muted p-8 text-center shadow-brutal">
            <p className="font-bold">Loading saved results...</p>
          </div>
        ) : items.length === 0 ? (
          <div className="border-4 border-black bg-muted p-8 text-center shadow-brutal">
            <p className="font-bold">No saved results yet</p>
            <p className="font-medium">Generate content in any tool and it will appear here.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Filters */}
            <div className="border-4 border-black bg-background p-4 shadow-brutal flex flex-wrap items-center gap-3">
              <div className="text-xs font-bold uppercase">Filters:</div>
              <select
                className="border-2 border-black px-2 py-1 text-sm font-medium bg-white"
                value={toolFilter}
                onChange={(e) => setToolFilter(e.target.value)}
              >
                <option value="all">All Tools</option>
                <option value="email_subject">Email Subject</option>
                <option value="resume">Resume</option>
                <option value="cold_email">Cold Email</option>
                <option value="product_description">Product Description</option>
                <option value="job_description">Job Description</option>
                <option value="linkedin">LinkedIn</option>
                <option value="social_ad">Social Ad</option>
                <option value="summarizer">Summarizer</option>
                <option value="cover_letter">Cover Letter</option>
                <option value="twitter_thread">Twitter Thread</option>
                <option value="faq">FAQ</option>
                <option value="script">Script/Voiceover</option>
              </select>
              <select
                className="border-2 border-black px-2 py-1 text-sm font-medium bg-white"
                value={dateSort}
                onChange={(e) => setDateSort(e.target.value as any)}
              >
                <option value="newest">Newest first</option>
                <option value="oldest">Oldest first</option>
              </select>
            </div>

            {items
              .filter((x) => toolFilter === 'all' ? true : x.tool_name === toolFilter)
              .sort((a, b) => dateSort === 'newest'
                ? new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
                : new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
              .map((item) => (
              <div key={item.id} className="border-4 border-black bg-card p-6 shadow-brutal">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                  <div>
                    <div className="inline-block border-2 border-black bg-background px-3 py-1 mb-2">
                      <span className="text-xs font-bold uppercase">{item.tool_name}</span>
                    </div>
                    <div className="text-sm font-medium text-muted-foreground">
                      Saved on {new Date(item.created_at).toLocaleString()}
                    </div>
                    {item.is_public && item.public_slug ? (
                      <div className="mt-1 text-xs font-medium">
                        Public Link: <a className="underline" href={`/public/${item.public_slug}`} target="_blank">{window.location.origin}/public/{item.public_slug}</a>
                      </div>
                    ) : null}
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" onClick={() => setOpenId(openId === item.id ? null : item.id)}>
                      {openId === item.id ? 'Hide' : 'View'}
                    </Button>
                    {/* TODO: Future - Permission check for download could be added here */}
                    <Button variant="outline" onClick={() => renderExport(item)}>
                      Export
                    </Button>
                    {item.is_public ? (
                      <Button variant="outline" disabled={isViewer} onClick={async () => {
                        try {
                          await unshareSavedResult(item.id);
                          setItems((prev) => prev.map((it) => it.id === item.id ? { ...it, is_public: false, public_slug: null } : it));
                        } catch (e) {
                          alert('Unshare failed');
                        }
                      }}>
                        Unshare
                      </Button>
                    ) : (
                      <Button variant="outline" disabled={isViewer} onClick={async () => {
                        try {
                          const { public_slug } = await shareSavedResult(item.id);
                          setItems((prev) => prev.map((it) => it.id === item.id ? { ...it, is_public: true, public_slug } : it));
                        } catch (e) {
                          alert('Share failed');
                        }
                      }}>
                        Share Public
                      </Button>
                    )}
                    <Button variant="destructive" disabled={isViewer} onClick={() => handleDelete(item.id)}>
                      Delete
                    </Button>
                  </div>
                </div>
                {openId === item.id && (
                  <div className="mt-4">
                    {renderBody(item)}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </ToolLayout>
  );
};

export default Results;

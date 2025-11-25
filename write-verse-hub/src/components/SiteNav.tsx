import { Link } from "react-router-dom";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button-brutal";
import { Sparkles, ArrowLeft, ChevronDown } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { TOOL_CATEGORIES } from "@/config/tools";

export const SiteNav = () => {
  const [tokensLeft, setTokensLeft] = useState<number | null>(null);
  const [user, setUser] = useState<any>(null);
  const [openCategoryId, setOpenCategoryId] = useState<string | null>(
    TOOL_CATEGORIES[0]?.id ?? null,
  );

  useEffect(() => {
    let unsub: (() => void) | null = null;
    (async () => {
      try {
        if (supabase) {
          const { data } = await supabase.auth.getUser();
          setUser(data.user ?? null);
          const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
            setUser(session?.user ?? null);
          });
          unsub = () => listener.subscription.unsubscribe();

          
        }
      } catch (e) {
        console.error("[SiteNav] init failed", e);
      }
    })();
    return () => { if (unsub) unsub(); };
  }, []);

  return (
    <header className="border-b-4 border-black bg-background sticky top-0 z-50">
      <div className="container mx-auto px-4 py-4">
        <div className="flex items-center justify-between">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2">
            <Sparkles className="h-6 w-6" />
            <span className="text-xl font-bold uppercase tracking-tight">WriterAI</span>
          </Link>

          {/* Actions */}
          <div className="flex items-center gap-4">
            

            {/* All Tools dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  All Tools
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-72 max-h-[70vh] overflow-y-auto">
                {TOOL_CATEGORIES.map((category, index) => {
                  const isOpen = openCategoryId === category.id;
                  return (
                    <div key={category.id} className="py-1">
                      <button
                        type="button"
                        className="flex w-full items-center justify-between px-2 py-1.5 text-xs font-bold uppercase tracking-wide text-muted-foreground hover:bg-accent focus:bg-accent"
                        onClick={() => setOpenCategoryId(isOpen ? null : category.id)}
                      >
                        <span>{category.label}</span>
                        <ChevronDown
                          className={`h-3 w-3 transition-transform ${
                            isOpen ? "rotate-180" : ""
                          }`}
                        />
                      </button>
                      {isOpen && (
                        <div className="mt-1 space-y-1">
                          {category.tools.map((tool) => (
                            <DropdownMenuItem asChild key={tool.id}>
                              <Link to={tool.path}>{tool.label}</Link>
                            </DropdownMenuItem>
                          ))}
                        </div>
                      )}
                      {index < TOOL_CATEGORIES.length - 1 && <DropdownMenuSeparator />}
                    </div>
                  );
                })}
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Right-side links */}
            {user ? (
              <>
                <Link to="/dashboard">
                  <Button variant="outline" size="sm">Dashboard</Button>
                </Link>
                <Link to="/projects">
                  <Button variant="outline" size="sm">Projects</Button>
                </Link>
                <Link to="/chat">
                  <Button variant="outline" size="sm">Chat</Button>
                </Link>
                <Link to="/files">
                  <Button variant="outline" size="sm">Files</Button>
                </Link>
                <Link to="/settings">
                  <Button variant="outline" size="sm">Settings</Button>
                </Link>
                <Link to="/results">
                  <Button size="sm">Saved</Button>
                </Link>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={async () => {
                    try {
                      if (supabase) {
                        await supabase.auth.signOut();
                        window.location.assign('/');
                      }
                    } catch (e) {
                      console.error('[SiteNav] logout failed', e);
                    }
                  }}
                >
                  Logout
                </Button>
              </>
            ) : (
              <>
                <Link to="/auth">
                  <Button variant="outline" size="sm">Sign In</Button>
                </Link>
                <Link to="/auth">
                  <Button size="sm">Get Started</Button>
                </Link>
              </>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};

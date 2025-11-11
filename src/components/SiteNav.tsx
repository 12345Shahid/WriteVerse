import { Link } from "react-router-dom";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button-brutal";
import { Sparkles, ArrowLeft } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export const SiteNav = () => {
  const [tokensLeft, setTokensLeft] = useState<number | null>(null);
  const [user, setUser] = useState<any>(null);

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
              <DropdownMenuContent>
                <DropdownMenuItem asChild>
                  <Link to="/tools/email-subject">Email Subject Lines</Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link to="/tools/resume">Resume Bullets</Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link to="/tools/cold-email">Cold Emails</Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link to="/tools/product-description">Product Descriptions</Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link to="/tools/job-description">Job Descriptions</Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link to="/tools/linkedin">LinkedIn Posts</Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link to="/tools/social-ad">Social Ad Copy</Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link to="/tools/summarizer">Summarizer</Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link to="/tools/cover-letter">Cover Letter</Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link to="/tools/twitter-thread">Twitter/X Thread</Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link to="/tools/faq">FAQ Generator</Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link to="/tools/script">Script/Voiceover</Link>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Right-side links */}
            {user ? (
              <>
                <Link to="/dashboard">
                  <Button variant="outline" size="sm">Dashboard</Button>
                </Link>
                <Link to="/results">
                  <Button size="sm">Saved</Button>
                </Link>
              </>
            ) : (
              <>
                <Link to="/#pricing" className="hidden md:block font-bold hover:text-primary transition-colors">
                  Pricing
                </Link>
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

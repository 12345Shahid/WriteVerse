import { Link, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button-brutal";
import { Sparkles, ArrowLeft, ChevronDown, Lock } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { TOOL_CATEGORIES } from "@/config/tools";
import { useTeam } from "@/context/TeamContext";

export const SiteNav = () => {
  const navigate = useNavigate();
  const { currentTeam } = useTeam();
  const [user, setUser] = useState<any>(null);
  const [hasSubscription, setHasSubscription] = useState<boolean | null>(null);
  const [openCategoryId, setOpenCategoryId] = useState<string | null>(
    TOOL_CATEGORIES[0]?.id ?? null,
  );

  // Check auth state
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

  // Check subscription status
  useEffect(() => {
    if (!currentTeam?.id || !supabase) {
      setHasSubscription(null);
      return;
    }

    const checkSubscription = async () => {
      try {
        const { data, error } = await supabase
          .from('organization_subscriptions')
          .select('status')
          .eq('organization_id', currentTeam.id)
          .single();

        if (error || !data) {
          setHasSubscription(false);
          return;
        }

        // Active subscription statuses
        const activeStatuses = ['active', 'trialing'];
        setHasSubscription(activeStatuses.includes(data.status));
      } catch (e) {
        console.error("[SiteNav] subscription check failed", e);
        setHasSubscription(false);
      }
    };

    checkSubscription();
  }, [currentTeam?.id]);

  // Fallback: If we have a user but no team is loaded after a delay/check, treat as blocked
  useEffect(() => {
     if (user && hasSubscription === null && !currentTeam && !window.location.pathname.includes('/auth')) {
         // If no team, they can't have a sub. Block 'em. Easiest way is to set hasSubscription false
         // But we need to distinguish "loading" from "no team found".
         // The TeamContext usually handles loading. If it's done loading (not exposed here?)
         // Let's assume if currentTeam is null for a logged in user, they are effectively sub-less.
         const t = setTimeout(() => {
             if (!currentTeam) setHasSubscription(false);
         }, 2000);
         return () => clearTimeout(t);
     }
  }, [user, currentTeam, hasSubscription]);

  // Handle navigation click when no subscription
  const handleProtectedClick = (e: React.MouseEvent, path: string) => {
    if (user && hasSubscription === false) {
      e.preventDefault();
      e.stopPropagation();
      // Show a toast or redirect to pricing
      navigate('/subscription/pricing');
    }
  };

  // Wrapper for protected links
  const ProtectedLink = ({ to, children, className = "" }: { to: string; children: React.ReactNode; className?: string }) => {
    const isBlocked = user && hasSubscription === false;
    
    if (isBlocked) {
      return (
        <span 
          className={`${className} opacity-50 cursor-not-allowed flex items-center gap-1`}
          onClick={(e) => handleProtectedClick(e, to)}
        >
          {children}
          <Lock className="w-3 h-3 text-gray-400" />
        </span>
      );
    }
    
    return <Link to={to} className={className}>{children}</Link>;
  };

  // Check if tools dropdown should be blurred
  const isToolsBlocked = user && hasSubscription === false;

  return (
    <header className="border-b-4 border-black bg-background sticky top-0 z-50">
      <div className="container mx-auto px-4 py-4">
        <div className="flex items-center justify-between">
          {/* Logo - always accessible */}
          <Link to="/" className="flex items-center gap-2">
            <Sparkles className="h-6 w-6" />
            <span className="text-xl font-bold uppercase tracking-tight">WriterAI</span>
          </Link>

          {/* Actions */}
          <div className="flex items-center gap-4">
            

            {/* All Tools dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button 
                  variant="outline" 
                  size="sm"
                  className={isToolsBlocked ? "opacity-50" : ""}
                  onClick={(e) => {
                    if (isToolsBlocked) {
                      e.preventDefault();
                      navigate('/subscription/pricing');
                    }
                  }}
                >
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  All Tools
                  {isToolsBlocked && <Lock className="ml-1 h-3 w-3" />}
                </Button>
              </DropdownMenuTrigger>
              {!isToolsBlocked && (
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
              )}
            </DropdownMenu>

            {/* Right-side links */}
            {user ? (
              <div className="flex items-center gap-2">
                {/* Show subscription status badge */}
                {hasSubscription === false && (
                  <Button 
                    size="sm" 
                    onClick={() => navigate('/subscription/pricing')}
                    className="bg-gradient-to-r from-purple-600 to-pink-500 text-white"
                  >
                    Start Free Trial
                  </Button>
                )}
                
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm" className="gap-2">
                      <span className="font-bold">Menu</span>
                      <ChevronDown className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56">
                    <DropdownMenuLabel>My Account</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    
                    {/* Protected menu items */}
                    <DropdownMenuItem asChild disabled={hasSubscription === false}>
                      <ProtectedLink to="/dashboard">Dashboard</ProtectedLink>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild disabled={hasSubscription === false}>
                      <ProtectedLink to="/projects">Projects</ProtectedLink>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild disabled={hasSubscription === false}>
                      <ProtectedLink to="/chat">Chat</ProtectedLink>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild disabled={hasSubscription === false}>
                      <ProtectedLink to="/files">Files</ProtectedLink>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild disabled={hasSubscription === false}>
                      <ProtectedLink to="/image-generator">Image Generator</ProtectedLink>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild disabled={hasSubscription === false}>
                      <ProtectedLink to="/results">Saved Results</ProtectedLink>
                    </DropdownMenuItem>
                    
                    <DropdownMenuSeparator />
                    
                    {/* Settings is protected, Subscription is always accessible */}
                    <DropdownMenuItem asChild disabled={hasSubscription === false}>
                      <ProtectedLink to="/settings">Settings</ProtectedLink>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link to="/subscription/pricing">Pricing</Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link to="/subscription">Subscription</Link>
                    </DropdownMenuItem>
                    
                    <DropdownMenuSeparator />
                    <DropdownMenuItem asChild disabled={hasSubscription === false}>
                      <ProtectedLink to="/notifications" className="flex items-center justify-between">
                        Notifications
                        <span className="bg-red-500 text-white text-[10px] px-1.5 rounded-full">New</span>
                      </ProtectedLink>
                    </DropdownMenuItem>
                    
                    <DropdownMenuSeparator />
                    <DropdownMenuItem 
                      className="text-red-500 focus:text-red-500"
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
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
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

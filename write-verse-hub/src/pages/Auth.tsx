import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Sparkles } from "lucide-react";
import { createTeam, listTeams } from "@/lib/api-teams";
import PublicLayout from "@/layouts/PublicLayout";

const Auth = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [formData, setFormData] = useState({
    email: "",
    password: "",
    name: ""
  });
  const [showPassword, setShowPassword] = useState(false);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const redirect = searchParams.get("redirect");
  const returnTo = redirect || "/dashboard"; // Changed: Auto-trial means we go to dashboard directly

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        if (!supabase) return;
        const { data } = await supabase.auth.getUser();
        if (mounted && data.user?.id) {
          navigate(returnTo, { replace: true });
        }
      } catch (e) {
        console.error("[Auth] Session check failed", e);
      }
    })();
    return () => { mounted = false; };
  }, [navigate, returnTo]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (!supabase) {
        alert("Auth not configured.");
        return;
      }
      const { data, error } = await supabase.auth.signInWithPassword({
        email: formData.email,
        password: formData.password,
      });
      if (error) {
        alert(error.message || "Login failed");
        return;
      }
      navigate(returnTo, { replace: true });
    } catch (err: any) {
      alert(err?.message || "Unexpected error");
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (!supabase) return;
      
      // Attempt generic signup
      const { data, error } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password,
        options: { data: { name: formData.name } },
      });
      
      if (error) {
        alert(error.message);
        return;
      }
      
      if (data?.session) {
        // Wait for organization to be created (by DB trigger or create it)
        // The DB trigger handle_new_user() should create one, but we ensure it exists
        let teamReady = false;
        let retries = 0;
        const maxRetries = 5;
        
        while (!teamReady && retries < maxRetries) {
          try {
            const teams = await listTeams();
            if (teams && teams.length > 0) {
              teamReady = true;
              console.log("[Auth] Team found after signup:", teams[0].id);
            } else {
              // No team yet, try creating one (in case trigger didn't fire)
              if (retries === 1) {
                try {
                  await createTeam(`${formData.name || 'User'}'s Organization`);
                  console.log("[Auth] Created team manually");
                } catch (e) {
                  console.warn("[Auth] Team creation failed (may already exist)", e);
                }
              }
              // Wait and retry
              await new Promise(resolve => setTimeout(resolve, 500));
              retries++;
            }
          } catch (e) {
            console.warn("[Auth] Error checking teams, retrying...", e);
            await new Promise(resolve => setTimeout(resolve, 500));
            retries++;
          }
        }
        
        // Auto-activate trial for new signups (no credit card required)
        const teamId = (await listTeams())?.[0]?.id;
        if (teamId) {
          try {
            const { data: { session: authSession } } = await supabase.auth.getSession();
            const trialRes = await fetch(`${import.meta.env.VITE_API_URL || ''}/api/subscriptions/start-trial`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'x-user-id': authSession?.user?.id || '',
              },
              body: JSON.stringify({
                organizationId: teamId,
                plan: 'professional' // Default trial plan with full features
              })
            });
            if (trialRes.ok) {
              console.log("[Auth] Trial auto-activated for new user");
            } else {
              console.warn("[Auth] Trial activation failed, user can start trial manually");
            }
          } catch (trialErr) {
            console.warn("[Auth] Trial activation error:", trialErr);
          }
        }
        
        // Navigate to dashboard after ensuring team and trial exist
        setTimeout(() => {
          navigate('/dashboard', { replace: true });
        }, 300);
      } else {
        alert("Please check your email for confirmation link.");
        // Try auto-login if no confirmation required
        await supabase.auth.signInWithPassword({
          email: formData.email,
          password: formData.password
        }).then(async ({ data: loginData }) => {
          if (loginData.session) {
            // Same team-ready logic as above
            let teamReady = false;
            let retries = 0;
            while (!teamReady && retries < 5) {
              const teams = await listTeams();
              if (teams && teams.length > 0) {
                teamReady = true;
              } else {
                if (retries === 1) {
                  try {
                    await createTeam(`${formData.name || 'User'}'s Organization`);
                  } catch (e) { console.warn("Org creation failed", e); }
                }
                await new Promise(resolve => setTimeout(resolve, 500));
                retries++;
              }
            }
            // Auto-activate trial for new signups (no credit card required)
            const latestTeams = await listTeams();
            const teamId = latestTeams?.[0]?.id;
            if (teamId) {
              try {
                const trialRes = await fetch(`${import.meta.env.VITE_API_URL || ''}/api/subscriptions/start-trial`, {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    'x-user-id': loginData.session?.user?.id || '',
                  },
                  body: JSON.stringify({
                    organizationId: teamId,
                    plan: 'professional'
                  })
                });
                if (trialRes.ok) {
                  console.log("[Auth] Trial auto-activated (via auto-login)");
                }
              } catch (trialErr) {
                console.warn("[Auth] Trial activation error:", trialErr);
              }
            }
            setTimeout(() => {
              navigate('/dashboard', { replace: true });
            }, 300);
          }
        });
      }
    } catch (err: any) {
      alert(err?.message);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  return (
    <PublicLayout showFooter={false}>
      <div className="min-h-[calc(100vh-100px)] flex items-center justify-center p-4">
        {/* Decorative Background for Auth */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-primary/10 rounded-full blur-[120px] pointer-events-none" />

        <div className="relative w-full max-w-md z-10 p-1 rounded-3xl bg-gradient-to-b from-white/10 to-white/5 animate-pulse-slow">
          <div className="glass-card rounded-[22px] p-8 md:p-10 border border-white/10 backdrop-blur-xl shadow-2xl">
            {/* Logo */}
            <div className="flex flex-col items-center justify-center mb-8">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-primary to-secondary flex items-center justify-center mb-4 shadow-lg shadow-primary/20">
                <Sparkles className="h-6 w-6 text-white" />
              </div>
              <h1 className="text-2xl font-bold text-white tracking-tight">
                {isLogin ? "Welcome Back" : "Join WriteVerse Hub"}
              </h1>
              <p className="text-sm text-muted-foreground mt-2">
                {isLogin ? "Enter your credentials to access your workspace" : "Start your journey with AI-powered publishing"}
              </p>
            </div>

            {/* Toggle Tabs */}
            <div className="flex bg-black/20 p-1 rounded-xl mb-8 relative">
              <button
                onClick={() => setIsLogin(true)}
                className={`flex-1 py-2.5 text-sm font-medium rounded-lg transition-all duration-300 ${
                  isLogin ? "bg-primary/20 text-primary shadow-sm" : "text-muted-foreground hover:text-white"
                }`}
              >
                Sign In
              </button>
              <button
                onClick={() => setIsLogin(false)}
                className={`flex-1 py-2.5 text-sm font-medium rounded-lg transition-all duration-300 ${
                  !isLogin ? "bg-primary/20 text-primary shadow-sm" : "text-muted-foreground hover:text-white"
                }`}
              >
                Sign Up
              </button>
            </div>

            <form onSubmit={isLogin ? handleLogin : handleSignup} className="space-y-5">
              {!isLogin && (
                <div className="space-y-2">
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider ml-1">Full Name</label>
                  <input
                    name="name"
                    type="text"
                    placeholder="John Doe"
                    value={formData.name}
                    onChange={handleInputChange}
                    className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/20 focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/50 transition-all font-light"
                    required
                  />
                </div>
              )}

              <div className="space-y-2">
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider ml-1">Email</label>
                <input
                  name="email"
                  type="email"
                  placeholder="name@company.com"
                  value={formData.email}
                  onChange={handleInputChange}
                  className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/20 focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/50 transition-all font-light"
                  required
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider ml-1">Password</label>
                <input
                  name="password"
                  type="password"
                  placeholder="••••••••"
                  value={formData.password}
                  onChange={handleInputChange}
                  className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/20 focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/50 transition-all font-light"
                  required
                />
                {!isLogin && <p className="text-[10px] text-muted-foreground/60 ml-1">Min 8 chars, 1 uppercase, 1 number</p>}
                {isLogin && (
                  <div className="text-right">
                    <Link to="/forgot-password" className="text-xs text-primary/80 hover:text-primary transition-colors">
                      Forgot your password?
                    </Link>
                  </div>
                )}
              </div>

              <button
                type="submit"
                className="w-full btn-premium py-4 rounded-xl text-white font-bold tracking-wide mt-4 shadow-lg shadow-primary/20 hover:shadow-primary/40"
              >
                {isLogin ? "Sign In" : "Create Account"}
              </button>
            </form>

            {/* SSO Login Option */}
            {isLogin && (
              <div className="mt-6">
                <div className="relative flex items-center">
                  <div className="flex-grow border-t border-white/10"></div>
                  <span className="flex-shrink mx-4 text-xs text-muted-foreground uppercase">Or</span>
                  <div className="flex-grow border-t border-white/10"></div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    const domain = prompt('Enter your company domain (e.g., yourcompany.com):');
                    if (domain) {
                      window.location.href = `/api/auth/sso?domain=${encodeURIComponent(domain)}&redirect=${encodeURIComponent(returnTo)}`;
                    }
                  }}
                  className="w-full mt-4 py-3 px-4 rounded-xl border border-white/20 bg-white/5 text-white font-medium hover:bg-white/10 transition-all flex items-center justify-center gap-2"
                >
                  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M12 2L2 7L12 12L22 7L12 2Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    <path d="M2 17L12 22L22 17" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    <path d="M2 12L12 17L22 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  Sign in with SSO
                </button>
              </div>
            )}

            <div className="mt-8 text-center space-y-4">
              <p className="text-xs text-muted-foreground">
                By continuing, you agree to our{" "}
                <Link to="/terms" className="text-primary hover:text-white transition-colors">Terms</Link>
                {" "}and{" "}
                <Link to="/privacy" className="text-primary hover:text-white transition-colors">Privacy Policy</Link>
              </p>
            </div>
          </div>
        </div>
      </div>
    </PublicLayout>
  );
};

export default Auth;

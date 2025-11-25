import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { SiteNav } from "@/components/SiteNav";
import { Button } from "@/components/ui/button-brutal";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sparkles, ArrowLeft, Eye, EyeOff } from "lucide-react";

/**
 * Authentication Page - Login & Signup (UI ONLY)
 * 
 * This page provides the interface for user authentication.
 * The actual authentication logic will be implemented by the backend developer.
 * 
 * TODO for backend developer:
 * 1. Integrate with your authentication service (Firebase, Supabase, Auth0, etc.)
 * 2. Implement handleLogin function:
 *    - Validate credentials
 *    - Call authentication API
 *    - Store auth token/session
 *    - Redirect to dashboard on success
 * 3. Implement handleSignup function:
 *    - Validate form data
 *    - Create new user account
 *    - Send verification email (if needed)
 *    - Auto-login or redirect to verification page
 * 4. Add error handling and validation:
 *    - Email format validation
 *    - Password strength requirements
 *    - Display error messages
 * 5. Implement "Forgot Password" flow
 * 6. Add social login options (Google, GitHub, etc.) if needed
 * 7. Implement rate limiting for security
 * 8. Add CAPTCHA for bot protection
 * 
 * Form validation rules to implement:
 * - Email: Valid email format, required
 * - Password: Min 8 characters, at least 1 uppercase, 1 number, required
 * - Name: Min 2 characters (for signup)
 */

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
  const returnTo = searchParams.get("returnTo") || "/dashboard";

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        if (!supabase) return;
        const { data } = await supabase.auth.getUser();
        if (mounted && data.user?.id) {
          console.debug("[Auth] Already logged in, redirecting", { userId: data.user.id });
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
    console.groupCollapsed("[Auth] Login");
    console.debug("payload.email", formData.email);
    try {
      if (!supabase) {
        console.error("[Auth] Supabase not configured (missing env)");
        alert("Auth not configured. Please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.");
        return;
      }
      const { data, error } = await supabase.auth.signInWithPassword({
        email: formData.email,
        password: formData.password,
      });
      if (error) {
        console.error("[Auth] Login error", error);
        alert(error.message || "Login failed");
        return;
      }
      console.debug("[Auth] Login success", { userId: data.user?.id });
      alert("Logged in successfully");
      navigate(returnTo, { replace: true });
    } catch (err: any) {
      console.error("[Auth] Unexpected login error", err);
      alert(err?.message || "Unexpected error during login");
    } finally {
      console.groupEnd();
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    console.groupCollapsed("[Auth] Signup");
    console.debug("payload.email", formData.email);
    try {
      if (!supabase) {
        console.error("[Auth] Supabase not configured (missing env)");
        alert("Auth not configured. Please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.");
        return;
      }
      let created = false;
      let createdStatus = 0;
      try {
        const r = await fetch('/api/auth/create-confirmed', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: formData.email, password: formData.password, name: formData.name }),
        });
        const txt = await r.text();
        let js: any = null; try { js = JSON.parse(txt); } catch {}
        console.debug('[Auth] create-confirmed status', r.status, js ?? txt.slice(0, 300));
        created = r.ok;
        createdStatus = r.status;
      } catch (e) {
        console.error('[Auth] create-confirmed error', e);
      }

      if (!created) {
        // Fallback: create via client signUp (works when email confirmation is disabled)
        const { data: suData, error: suError } = await supabase.auth.signUp({
          email: formData.email,
          password: formData.password,
          options: { data: { name: formData.name } },
        });
        if (suError && !/already registered/i.test(String(suError.message))) {
          console.error('[Auth] signUp fallback error', suError);
          alert(suError.message || 'Signup failed');
          return;
        }
        if (suData?.session) {
          navigate(returnTo, { replace: true });
          return;
        }
        // If user already exists or no session returned, continue to login below
      }

      const { data: loginData, error: loginError } = await supabase.auth.signInWithPassword({
        email: formData.email,
        password: formData.password,
      });
      if (loginError) {
        console.error("[Auth] Login after signup failed", loginError);
        if (/invalid login credentials/i.test(String(loginError.message))) {
          setIsLogin(true);
          return;
        }
        alert(loginError.message || "Login failed after signup");
        return;
      }
      console.debug("[Auth] Auto-login success", { userId: loginData.user?.id });
      navigate(returnTo, { replace: true });
    } catch (err: any) {
      console.error("[Auth] Unexpected signup error", err);
      alert(err?.message || "Unexpected error during signup");
    } finally {
      console.groupEnd();
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  return (
    <div className="min-h-screen bg-background">
      <SiteNav />
      <div className="flex items-center justify-center p-4">
      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 left-10 w-32 h-32 border-4 border-black bg-brutalist-yellow rotate-12"></div>
        <div className="absolute bottom-20 right-10 w-40 h-40 border-4 border-black bg-brutalist-pink -rotate-6"></div>
        <div className="absolute top-1/2 left-1/4 w-24 h-24 border-4 border-black bg-brutalist-green rotate-45"></div>
      </div>

      <div className="relative w-full max-w-md">
        {/* Back to home link */}
        <Link 
          to="/" 
          className="inline-flex items-center gap-2 mb-6 font-bold hover:text-primary transition-colors"
        >
          <ArrowLeft className="h-5 w-5" />
          Back to home
        </Link>

        {/* Auth card */}
        <div className="border-4 border-black bg-card shadow-brutal-lg p-8">
          {/* Logo */}
          <div className="flex items-center justify-center gap-2 mb-8">
            <Sparkles className="h-8 w-8" />
            <span className="text-2xl font-bold uppercase">WriterAI</span>
          </div>

          {/* Toggle tabs */}
          <div className="flex gap-2 mb-8 border-4 border-black p-1 bg-muted">
            <button
              onClick={() => setIsLogin(true)}
              className={`flex-1 py-2 font-bold uppercase text-sm transition-all ${
                isLogin 
                  ? "bg-background border-4 border-black shadow-brutal-sm" 
                  : "border-4 border-transparent"
              }`}
            >
              Login
            </button>
            <button
              onClick={() => setIsLogin(false)}
              className={`flex-1 py-2 font-bold uppercase text-sm transition-all ${
                !isLogin 
                  ? "bg-background border-4 border-black shadow-brutal-sm" 
                  : "border-4 border-transparent"
              }`}
            >
              Sign Up
            </button>
          </div>

          {/* Form */}
          <form onSubmit={isLogin ? handleLogin : handleSignup} className="space-y-6">
            {/* Name field (signup only) */}
            {!isLogin && (
              <div className="space-y-2">
                <Label htmlFor="name" className="font-bold uppercase text-sm">
                  Full Name
                </Label>
                <div>
                  <Input
                    id="name"
                    name="name"
                    type="text"
                    placeholder="John Doe"
                    value={formData.name}
                    onChange={handleInputChange}
                    className="input-brutal h-12"
                    required={!isLogin}
                  />
                </div>
              </div>
            )}

            {/* Email field */}
            <div className="space-y-2">
              <Label htmlFor="email" className="font-bold uppercase text-sm">
                Email Address
              </Label>
              <div>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  placeholder="you@example.com"
                  value={formData.email}
                  onChange={handleInputChange}
                  className="input-brutal h-12"
                  required
                />
              </div>
            </div>

            {/* Password field */}
            <div className="space-y-2">
              <Label htmlFor="password" className="font-bold uppercase text-sm">
                Password
              </Label>
              <div className="relative">
                <Input
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  value={formData.password}
                  onChange={handleInputChange}
                  className="input-brutal h-12 pr-10"
                  required
                />
                <button
                  type="button"
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-md border-2 border-black bg-background hover:bg-muted transition-colors"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {!isLogin && (
                <p className="text-xs font-medium text-muted-foreground">
                  Min 8 characters, 1 uppercase, 1 number
                </p>
              )}
            </div>

            {/* Forgot password (login only) */}
            {isLogin && (
              <div className="text-right">
                <button
                  type="button"
                  className="text-sm font-bold hover:text-primary transition-colors"
                  onClick={() => alert("Forgot password flow not implemented yet")}
                >
                  Forgot password?
                </button>
              </div>
            )}

            {/* Submit button */}
            <Button 
              type="submit" 
              className="w-full" 
              size="lg"
            >
              {isLogin ? "Login" : "Create Account"}
            </Button>

            {/* Social login buttons - TODO: Implement social auth */}
            
          </form>

          {/* Terms notice */}
          <p className="mt-6 text-xs text-center font-medium text-muted-foreground">
            By continuing, you agree to our{" "}
            <Link to="/terms" className="underline hover:text-primary">
              Terms of Service
            </Link>{" "}
            and{" "}
            <Link to="/privacy" className="underline hover:text-primary">
              Privacy Policy
            </Link>
          </p>
        </div>

        {/* Additional info */}
        <div className="mt-6 text-center">
          <div className="inline-block border-4 border-black bg-brutalist-yellow px-6 py-3 shadow-brutal-sm rotate-1">
            <p className="font-bold text-sm">
              🎉 Start with 5,000 free tokens!
            </p>
          </div>
        </div>
      </div>
    </div>
  </div>
  );
};

export default Auth;

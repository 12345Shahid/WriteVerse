import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Link, useNavigate } from "react-router-dom";
import { SiteNav } from "@/components/SiteNav";
import { Button } from "@/components/ui/button-brutal";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sparkles, Mail, Lock, User, ArrowLeft } from "lucide-react";

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
  const navigate = useNavigate();

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        if (!supabase) return;
        const { data } = await supabase.auth.getUser();
        if (mounted && data.user?.id) {
          console.debug("[Auth] Already logged in, redirecting", { userId: data.user.id });
          navigate("/tools/email-subject", { replace: true });
        }
      } catch (e) {
        console.error("[Auth] Session check failed", e);
      }
    })();
    return () => { mounted = false; };
  }, [navigate]);

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
      navigate("/tools/email-subject", { replace: true });
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
      const { data, error } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password,
        options: {
          data: { name: formData.name },
        },
      });
      if (error) {
        console.error("[Auth] Signup error", error);
        alert(error.message || "Signup failed");
        return;
      }
      console.debug("[Auth] Signup success", { userId: data.user?.id });
      alert("Account created. Please check your email to verify (if required).");
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
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                  <Input
                    id="name"
                    name="name"
                    type="text"
                    placeholder="John Doe"
                    value={formData.name}
                    onChange={handleInputChange}
                    className="input-brutal pl-10"
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
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                <Input
                  id="email"
                  name="email"
                  type="email"
                  placeholder="you@example.com"
                  value={formData.email}
                  onChange={handleInputChange}
                  className="input-brutal pl-10"
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
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                <Input
                  id="password"
                  name="password"
                  type="password"
                  placeholder="••••••••"
                  value={formData.password}
                  onChange={handleInputChange}
                  className="input-brutal pl-10"
                  required
                />
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
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t-2 border-black"></div>
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-card px-2 font-bold">Or continue with</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => alert("Google auth not implemented yet")}
              >
                <svg className="h-5 w-5 mr-2" viewBox="0 0 24 24">
                  <path
                    fill="currentColor"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="currentColor"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="currentColor"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  />
                  <path
                    fill="currentColor"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  />
                </svg>
                Google
              </Button>

              <Button
                type="button"
                variant="outline"
                onClick={() => alert("GitHub auth not implemented yet")}
              >
                <svg className="h-5 w-5 mr-2" fill="currentColor" viewBox="0 0 24 24">
                  <path
                    fillRule="evenodd"
                    d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"
                    clipRule="evenodd"
                  />
                </svg>
                GitHub
              </Button>
            </div>
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

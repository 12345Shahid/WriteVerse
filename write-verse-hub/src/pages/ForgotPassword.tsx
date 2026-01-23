import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { Link } from "react-router-dom";
import { Sparkles, ArrowLeft, Mail, CheckCircle } from "lucide-react";
import PublicLayout from "@/layouts/PublicLayout";
import { Button } from "@/components/ui/button-brutal";
import { Input } from "@/components/ui/input";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      if (!supabase) {
        setError("Auth not configured.");
        return;
      }

      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: 'https://writehubai.halal-solutions.com/reset-password',
      });

      if (resetError) {
        setError(resetError.message);
        return;
      }

      setSent(true);
    } catch (err: any) {
      setError(err?.message || "Unexpected error occurred");
    } finally {
      setLoading(false);
    }
  };

  return (
    <PublicLayout>
      <div className="min-h-[80vh] flex items-center justify-center px-4">
        <div className="w-full max-w-md">
          <div className="bg-white border-4 border-black shadow-brutal p-8 rounded-xl">
            <div className="flex flex-col items-center mb-6">
              <Sparkles className="w-10 h-10 text-primary mb-2" />
              <h1 className="text-2xl font-black uppercase tracking-tight">Reset Password</h1>
            </div>

            {sent ? (
              <div className="text-center space-y-4">
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
                  <CheckCircle className="w-8 h-8 text-green-600" />
                </div>
                <h2 className="text-xl font-bold">Check Your Email</h2>
                <p className="text-gray-600">
                  We've sent a password reset link to <strong>{email}</strong>.
                  Click the link in the email to reset your password.
                </p>
                <p className="text-sm text-gray-500">
                  Didn't receive the email? Check your spam folder or try again.
                </p>
                <Link to="/auth">
                  <Button variant="outline" className="mt-4">
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    Back to Sign In
                  </Button>
                </Link>
              </div>
            ) : (
              <>
                <p className="text-center text-gray-600 mb-6">
                  Enter your email address and we'll send you a link to reset your password.
                </p>

                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <label className="block text-sm font-bold mb-1">Email Address</label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <Input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="you@example.com"
                        required
                        className="pl-10 border-2 border-black"
                      />
                    </div>
                  </div>

                  {error && (
                    <div className="bg-red-50 border-2 border-red-200 text-red-700 p-3 rounded-lg text-sm">
                      {error}
                    </div>
                  )}

                  <Button
                    type="submit"
                    disabled={loading || !email}
                    className="w-full"
                  >
                    {loading ? "Sending..." : "Send Reset Link"}
                  </Button>
                </form>

                <div className="mt-6 text-center">
                  <Link to="/auth" className="text-sm text-gray-600 hover:text-black flex items-center justify-center gap-1">
                    <ArrowLeft className="w-4 h-4" />
                    Back to Sign In
                  </Link>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </PublicLayout>
  );
}

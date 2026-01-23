import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { useNavigate } from "react-router-dom";
import { Sparkles, Lock, Eye, EyeOff, CheckCircle } from "lucide-react";
import PublicLayout from "@/layouts/PublicLayout";
import { Button } from "@/components/ui/button-brutal";
import { Input } from "@/components/ui/input";

export default function ResetPassword() {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");
  const navigate = useNavigate();

  // Check if user has a valid session (came from email link)
  useEffect(() => {
    const checkSession = async () => {
      if (!supabase) return;
      const { data } = await supabase.auth.getSession();
      if (!data.session) {
        // No session means they didn't come from a valid reset link
        setError("Invalid or expired reset link. Please request a new one.");
      }
    };
    checkSession();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (password.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    setLoading(true);

    try {
      if (!supabase) {
        setError("Auth not configured.");
        return;
      }

      const { error: updateError } = await supabase.auth.updateUser({
        password: password,
      });

      if (updateError) {
        setError(updateError.message);
        return;
      }

      setSuccess(true);
      
      // Redirect to login after 3 seconds
      setTimeout(() => {
        navigate("/auth", { replace: true });
      }, 3000);
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
              <h1 className="text-2xl font-black uppercase tracking-tight">Set New Password</h1>
            </div>

            {success ? (
              <div className="text-center space-y-4">
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
                  <CheckCircle className="w-8 h-8 text-green-600" />
                </div>
                <h2 className="text-xl font-bold">Password Updated!</h2>
                <p className="text-gray-600">
                  Your password has been successfully updated.
                  Redirecting you to the login page...
                </p>
              </div>
            ) : (
              <>
                <p className="text-center text-gray-600 mb-6">
                  Enter your new password below.
                </p>

                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <label className="block text-sm font-bold mb-1">New Password</label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <Input
                        type={showPassword ? "text" : "password"}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Enter new password"
                        required
                        minLength={6}
                        className="pl-10 pr-10 border-2 border-black"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-bold mb-1">Confirm Password</label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <Input
                        type={showPassword ? "text" : "password"}
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="Confirm new password"
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
                    disabled={loading || !password || !confirmPassword}
                    className="w-full"
                  >
                    {loading ? "Updating..." : "Update Password"}
                  </Button>
                </form>
              </>
            )}
          </div>
        </div>
      </div>
    </PublicLayout>
  );
}

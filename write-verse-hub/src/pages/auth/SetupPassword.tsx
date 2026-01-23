import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button-brutal';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Loader2, Lock, Mail, Check, AlertCircle, Shield } from 'lucide-react';
import { toast } from 'sonner';

export default function SetupPassword() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token');

  const [isLoading, setIsLoading] = useState(true);
  const [inviteData, setInviteData] = useState<any>(null);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!token) {
      setError('Invalid invitation link');
      setIsLoading(false);
      return;
    }

    // Validate invitation token
    validateInvite();
  }, [token]);

  const validateInvite = async () => {
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL || ''}/api/teams/invite/${token}`);
      const data = await res.json();

      if (!res.ok) {
        setError(data.message || 'Invalid or expired invitation');
        setIsLoading(false);
        return;
      }

      setInviteData(data.invite);
      setIsLoading(false);
    } catch (err: any) {
      setError('Failed to validate invitation');
      setIsLoading(false);
    }
  };

  const handleSetupPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Validation
    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setIsSubmitting(true);

    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL || ''}/api/auth/setup-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        if (data.requiresLogin) {
          // User already exists, redirect to login
          toast.info(data.message);
          navigate(`/login?email=${encodeURIComponent(inviteData.email)}`);
          return;
        }
        throw new Error(data.message || 'Failed to create account');
      }

      // Success! Now sign in with the new credentials
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: inviteData.email,
        password: password,
      });

      if (signInError) {
        toast.error('Account created, but auto-login failed. Please login manually.');
        navigate(`/login?email=${encodeURIComponent(inviteData.email)}`);
        return;
      }

      // Success!
      toast.success(`Welcome to ${data.organizationName}!`);
      navigate('/dashboard');

    } catch (err: any) {
      setError(err.message || 'An error occurred');
      toast.error(err.message || 'Failed to create account');
    } finally {
      setIsSubmitting(false);
    }
  };

  const getPasswordStrength = () => {
    if (password.length === 0) return { label: '', color: '' };
    if (password.length < 8) return { label: 'Too short', color: 'text-red-600' };
    if (password.length < 12) return { label: 'Good', color: 'text-yellow-600' };
    return { label: 'Strong', color: 'text-green-600' };
  };

  const strength = getPasswordStrength();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-brutalist-bg flex items-center justify-center p-4">
        <Card className="w-full max-w-md border-4 border-black shadow-brutal">
          <CardContent className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin" />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error && !inviteData) {
    return (
      <div className="min-h-screen bg-brutalist-bg flex items-center justify-center p-4">
        <Card className="w-full max-w-md border-4 border-black shadow-brutal">
          <CardHeader className="bg-red-100 border-b-4 border-black">
            <CardTitle className="flex items-center gap-2 text-red-800">
              <AlertCircle className="w-6 h-6" />
              Invalid Invitation
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <p className="text-lg mb-4">{error}</p>
            <Button onClick={() => navigate('/login')} className="w-full">
              Go to Login
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-brutalist-bg flex items-center justify-center p-4">
      <Card className="w-full max-w-md border-4 border-black shadow-brutal">
        <CardHeader className="bg-brutalist-yellow border-b-4 border-black">
          <div className="flex items-center justify-center mb-4">
            <div className="bg-black text-white p-3 rounded-full">
              <Shield className="w-8 h-8" />
            </div>
          </div>
          <CardTitle className="text-center text-2xl font-black uppercase">
            Welcome to {inviteData?.teamName}!
          </CardTitle>
          <CardDescription className="text-center text-base">
            Set up your password to join the workspace
          </CardDescription>
        </CardHeader>

        <CardContent className="p-8">
          {/* Email Display */}
          <div className="mb-6 p-4 bg-gray-100 border-2 border-black rounded">
            <div className="flex items-center gap-2 text-sm">
              <Mail className="w-4 h-4" />
              <span className="font-mono font-bold">{inviteData?.email}</span>
            </div>
          </div>

          <form onSubmit={handleSetupPassword} className="space-y-6">
            {/* Password Input */}
            <div className="space-y-2">
              <Label htmlFor="password" className="flex items-center gap-2">
                <Lock className="w-4 h-4" />
                Password
              </Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter a strong password"
                className="input-brutal"
                required
              />
              {password && (
                <p className={`text-xs font-bold ${strength.color}`}>
                  {strength.label}
                </p>
              )}
            </div>

            {/* Confirm Password */}
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm Password</Label>
              <Input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm your password"
                className="input-brutal"
                required
              />
              {confirmPassword && password === confirmPassword && (
                <p className="text-xs text-green-600 font-bold flex items-center gap-1">
                  <Check className="w-3 h-3" /> Passwords match
                </p>
              )}
            </div>

            {/* Error Display */}
            {error && (
              <div className="bg-red-100 border-2 border-red-600 p-3 rounded">
                <p className="text-red-800 text-sm font-bold">{error}</p>
              </div>
            )}

            {/* Submit Button */}
            <Button
              type="submit"
              disabled={isSubmitting || !password || !confirmPassword || password !== confirmPassword}
              className="w-full h-12 bg-black text-white font-bold uppercase"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating Account...
                </>
              ) : (
                'Create Account & Join'
              )}
            </Button>
          </form>

          {/* Info Box */}
          <div className="mt-6 p-4 bg-blue-50 border-2 border-black rounded">
            <p className="text-xs text-gray-700">
              <strong>Note:</strong> You'll have access to all workspace features and shared credits. 
              No subscription required!
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

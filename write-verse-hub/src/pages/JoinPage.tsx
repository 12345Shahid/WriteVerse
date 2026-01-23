import { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button-brutal";
import { Loader2, CheckCircle, XCircle, Users, ArrowRight } from "lucide-react";
import { ToolLayout } from "@/components/tool/ToolLayout";

const JoinPage = () => {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");
  const navigate = useNavigate();
  
  const [status, setStatus] = useState<'loading' | 'preview' | 'processing' | 'success' | 'error'>('loading');
  const [invite, setInvite] = useState<{ email: string, role: string, teamName: string } | null>(null);
  const [message, setMessage] = useState("Verifying invitation...");

  useEffect(() => {
    if (!token) {
      setStatus('error');
      setMessage("Invalid invitation link (missing token).");
      return;
    }
    
    // Peek invite details
    fetch(`/api/teams/invite/${token}`)
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || data.error);
        return data;
      })
      .then((data) => {
        setInvite(data.invite);
        setStatus('preview');
      })
      .catch((err) => {
        console.error(err);
        setStatus('error');
        setMessage(err.message || "Failed to load invitation.");
      });
  }, [token]);

  const handleJoin = async () => {
    if (!token) return;
    setStatus('processing');
    setMessage("Joining team...");
    
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        // Redirect to auth with return URL
        const returnUrl = encodeURIComponent(`/join?token=${token}`);
        navigate(`/auth?returnTo=${returnUrl}`);
        return;
      }

      const res = await fetch('/api/teams/join', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': session.user.id
        },
        body: JSON.stringify({ token })
      });
      
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || data.error);

      setStatus('success');
      setMessage(`You have successfully joined ${invite?.teamName || 'the team'}!`);
      
    } catch (e: any) {
      console.error(e);
      setStatus('error');
      setMessage(e.message || "Failed to accept invitation.");
    }
  };

  return (
    <ToolLayout title="Join Team" description="Accept your invitation">
      <div className="max-w-md mx-auto border-4 border-black bg-white p-8 shadow-brutal text-center">
        
        {/* Loading State */}
        {(status === 'loading' || status === 'processing') && (
          <div className="flex flex-col items-center gap-4">
            <Loader2 className="h-12 w-12 animate-spin" />
            <p className="font-bold">{message}</p>
          </div>
        )}

        {/* Preview State (Ready to Join) */}
        {status === 'preview' && invite && (
          <div className="flex flex-col items-center gap-6">
            <div className="bg-brutalist-yellow p-4 border-4 border-black rounded-full">
              <Users className="h-12 w-12" />
            </div>
            
            <div className="space-y-2">
              <h2 className="text-xl font-bold">You've been invited to join</h2>
              <div className="text-3xl font-black uppercase bg-black text-white p-2 inline-block transform -rotate-1">
                {invite.teamName}
              </div>
            </div>

            <div className="text-sm text-muted-foreground bg-muted p-4 border-2 border-black w-full">
              <p><strong>Email:</strong> {invite.email}</p>
              <p><strong>Role:</strong> {invite.role.toUpperCase()}</p>
            </div>

            <Button onClick={handleJoin} size="lg" className="w-full text-lg h-14 gap-2">
              Accept & Join Team <ArrowRight className="h-5 w-5" />
            </Button>
          </div>
        )}

        {/* Success State */}
        {status === 'success' && (
          <div className="flex flex-col items-center gap-4">
            <CheckCircle className="h-16 w-16 text-green-500" />
            <h2 className="text-2xl font-black uppercase">Welcome Aboard!</h2>
            <p>{message}</p>
            <Button onClick={() => navigate('/settings/team')} className="w-full mt-4">
              Go to Team Settings
            </Button>
          </div>
        )}

        {/* Error State */}
        {status === 'error' && (
          <div className="flex flex-col items-center gap-4">
            <XCircle className="h-16 w-16 text-red-500" />
            <h2 className="text-2xl font-black uppercase">Error</h2>
            <p className="text-red-600 font-bold">{message}</p>
            <Button onClick={() => navigate('/')} variant="ghost">
              Go Home
            </Button>
          </div>
        )}
      </div>
    </ToolLayout>
  );
};

export default JoinPage;

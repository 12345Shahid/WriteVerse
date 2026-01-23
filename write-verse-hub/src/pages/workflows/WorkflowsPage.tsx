import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Workflow, Loader2, AlertCircle, ExternalLink, Zap, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button-brutal';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { SiteNav } from '@/components/SiteNav';
import { useTeam } from '@/context/TeamContext';
import { supabase } from '@/lib/supabase';

// Latenode SDK version
const LATENODE_SDK_URL = 'https://embedded.latenode.com/static/sdk/0.1.4.js';

// Brand colors for white-label
const WRITEVERSE_THEME = {
  primaryColor: '#007AFF',
  button: {
    primary: {
      default: { backgroundColor: '#007AFF', textColor: 'white', borderColor: '#007AFF' },
      hover: { backgroundColor: '#0051D5', textColor: 'white', borderColor: '#0051D5' },
      borderRadius: '8px'
    },
    success: {
      default: { backgroundColor: '#34C759', textColor: 'white', borderColor: '#34C759' },
      borderRadius: '8px'
    }
  },
  input: { borderRadius: '8px' },
  scenario: { backgroundColor: '#F9F9F9' }
};

export default function WorkflowsPage() {
  const navigate = useNavigate();
  const { currentTeam } = useTeam();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sdkReady, setSdkReady] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const sdkRef = useRef<any>(null);

  // Check user authentication
  useEffect(() => {
    const checkAuth = async () => {
      const { data } = await supabase.auth.getUser();
      if (!data.user) {
        navigate('/auth?redirect=/workflows');
        return;
      }
      setUser(data.user);
    };
    checkAuth();
  }, [navigate]);

  // Load Latenode SDK
  useEffect(() => {
    if (!user || !currentTeam?.id) return;

    const loadSdk = async () => {
      try {
        setLoading(true);
        setError(null);

        // Check if SDK is already loaded
        if (!(window as any).LatenodeEmbeddedSDK) {
          // Load SDK script
          await new Promise<void>((resolve, reject) => {
            const script = document.createElement('script');
            script.src = LATENODE_SDK_URL;
            script.async = true;
            script.onload = () => resolve();
            script.onerror = () => reject(new Error('Failed to load Latenode SDK'));
            document.head.appendChild(script);
          });
        }

        // Generate JWT token from backend
        const tokenResponse = await fetch('/api/workflows/get-token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: user.id,
            email: user.email,
            organizationId: currentTeam.id
          })
        });

        if (!tokenResponse.ok) {
          const errData = await tokenResponse.json();
          throw new Error(errData.error || 'Failed to generate token');
        }

        const { token } = await tokenResponse.json();

        // Initialize SDK
        const LatenodeSDK = (window as any).LatenodeEmbeddedSDK;
        sdkRef.current = new LatenodeSDK();

        await sdkRef.current.configure({
          token: token,
          container: 'latenode-workflow-container',
          ui: {
            scenarios: {
              hideEmptyScenariosGreetings: false,
              logo: {
                src: '/logo.png', // Your logo
                style: { width: 120, height: 40 }
              }
            },
            main: {
              hideSideMenu: false
            },
            scenario: {
              showGrid: true
            },
            theme: WRITEVERSE_THEME,
            navigation: {
              handler: ({ route }: { route: string }) => {
                console.log('[Latenode] Navigation:', route);
              }
            }
          }
        });

        setSdkReady(true);
        setLoading(false);
      } catch (err: any) {
        console.error('[Workflows] Error:', err);
        setError(err.message || 'Failed to initialize workflow builder');
        setLoading(false);
      }
    };

    loadSdk();

    // Cleanup on unmount
    return () => {
      if (sdkRef.current?.cleanup) {
        sdkRef.current.cleanup();
      }
    };
  }, [user, currentTeam?.id]);

  // Show loading state
  if (!user || loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <SiteNav />
        <div className="container mx-auto px-4 py-12">
          <div className="flex flex-col items-center justify-center gap-4">
            <Loader2 className="w-8 h-8 animate-spin text-purple-500" />
            <p className="text-gray-600">Loading workflow builder...</p>
          </div>
        </div>
      </div>
    );
  }

  // Show error state with setup instructions
  if (error) {
    return (
      <div className="min-h-screen bg-gray-50">
        <SiteNav />
        <div className="container mx-auto px-4 py-12 max-w-3xl">
          <Card className="border-4 border-black">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Workflow className="w-6 h-6" />
                Workflow Automation
              </CardTitle>
              <CardDescription>
                Build powerful automations without code
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <Alert variant="destructive">
                <AlertCircle className="w-4 h-4" />
                <AlertDescription>
                  {error}
                </AlertDescription>
              </Alert>

              <div className="bg-gray-50 rounded-lg p-6 space-y-4">
                <h3 className="font-bold text-lg">Setup Required</h3>
                <p className="text-gray-600">
                  To enable workflows, you need to configure Latenode integration:
                </p>
                <ol className="list-decimal list-inside space-y-2 text-sm">
                  <li>Sign up at <a href="https://latenode.com" target="_blank" rel="noopener" className="text-blue-600 underline">latenode.com</a></li>
                  <li>Get your API credentials (White-Label tier)</li>
                  <li>Add <code className="bg-gray-200 px-1 rounded">LATENODE_SECRET_KEY</code> to environment variables</li>
                  <li>Redeploy the application</li>
                </ol>
                <Button 
                  variant="outline" 
                  onClick={() => window.location.reload()}
                  className="mt-4"
                >
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Try Again
                </Button>
              </div>

              {/* Feature Preview */}
              <div className="mt-8">
                <h3 className="font-bold text-lg mb-4">What You'll Get</h3>
                <div className="grid md:grid-cols-2 gap-4">
                  <FeatureCard 
                    icon={<Zap className="w-5 h-5 text-amber-500" />}
                    title="Visual Workflow Builder"
                    description="Drag-and-drop interface to create complex automations"
                  />
                  <FeatureCard 
                    icon={<ExternalLink className="w-5 h-5 text-blue-500" />}
                    title="300+ Integrations"
                    description="Connect to Gmail, Slack, HubSpot, Notion, and more"
                  />
                  <FeatureCard 
                    icon={<Workflow className="w-5 h-5 text-purple-500" />}
                    title="AI-Powered Automation"
                    description="AI agents that coordinate across multiple systems"
                  />
                  <FeatureCard 
                    icon={<RefreshCw className="w-5 h-5 text-green-500" />}
                    title="Pre-Built Templates"
                    description="Blog creation, lead qualification, content repurposing"
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // Show workflow builder
  return (
    <div className="min-h-screen bg-gray-50">
      <SiteNav />
      
      <div className="container mx-auto px-4 py-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Workflow className="w-6 h-6" />
              Workflow Automation
            </h1>
            <p className="text-gray-600">Build powerful automations without code</p>
          </div>
          <div className="flex items-center gap-2">
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => window.open('https://docs.latenode.com', '_blank')}
            >
              <ExternalLink className="w-4 h-4 mr-1" />
              Docs
            </Button>
          </div>
        </div>

        {/* SDK Container */}
        <div 
          id="latenode-workflow-container"
          ref={containerRef}
          className="w-full border-4 border-black rounded-lg bg-white overflow-hidden"
          style={{ 
            height: 'calc(100vh - 200px)',
            minHeight: '600px'
          }}
        >
          {!sdkReady && (
            <div className="flex items-center justify-center h-full">
              <Loader2 className="w-8 h-8 animate-spin text-purple-500" />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Feature card component
function FeatureCard({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) {
  return (
    <div className="flex items-start gap-3 p-4 bg-white rounded-lg border">
      <div className="flex-shrink-0 mt-0.5">{icon}</div>
      <div>
        <h4 className="font-medium">{title}</h4>
        <p className="text-sm text-gray-600">{description}</p>
      </div>
    </div>
  );
}

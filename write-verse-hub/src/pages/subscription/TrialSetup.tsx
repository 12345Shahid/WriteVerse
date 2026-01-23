import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, Sparkles, Zap, Crown, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button-brutal';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useSubscription, PLANS } from '@/hooks/useSubscription';
import { toast } from 'sonner';
import { SiteNav } from '@/components/SiteNav';

const PLAN_ICONS = {
  starter: Sparkles,
  professional: Zap,
  business: Crown
};

const PLAN_COLORS = {
  starter: 'border-blue-500',
  professional: 'border-purple-500 ring-2 ring-purple-200',
  business: 'border-amber-500'
};

export default function TrialSetup() {
  const navigate = useNavigate();
  const { startTrial, hasSubscription } = useSubscription();
  const [loading, setLoading] = useState<string | null>(null);

  // If already has subscription, redirect
  if (hasSubscription) {
    navigate('/dashboard');
    return null;
  }

  const handleStartTrial = async (plan: 'starter' | 'professional' | 'business') => {
    setLoading(plan);
    try {
      await startTrial(plan);
      toast.success('🎉 Trial started! You have 7 days and 7,000 credits to explore.');
      navigate('/dashboard');
    } catch (err: any) {
      toast.error(err.message || 'Failed to start trial');
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      <SiteNav />
      
      <div className="container mx-auto px-4 py-12">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold mb-4">Start Your 7-Day Free Trial</h1>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            Choose a plan to get started. You'll get <strong>7,000 credits</strong> and access to <strong>all features</strong> during your trial.
            No credit card required.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
          {(Object.entries(PLANS) as [keyof typeof PLANS, typeof PLANS[keyof typeof PLANS]][]).map(([key, plan]) => {
            const Icon = PLAN_ICONS[key];
            const isPopular = key === 'professional';
            
            return (
              <Card 
                key={key} 
                className={`relative border-4 ${PLAN_COLORS[key]} transition-all hover:shadow-xl ${isPopular ? 'scale-105' : ''}`}
              >
                {isPopular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-purple-500 text-white px-4 py-1 rounded-full text-sm font-bold">
                    Most Popular
                  </div>
                )}
                
                <CardHeader className="text-center pb-2">
                  <div className="w-12 h-12 mx-auto mb-4 bg-gray-100 rounded-full flex items-center justify-center">
                    <Icon className="w-6 h-6" />
                  </div>
                  <CardTitle className="text-2xl">{plan.name}</CardTitle>
                  <CardDescription>
                    <span className="text-4xl font-bold text-black">${plan.price}</span>
                    <span className="text-gray-500">/month</span>
                  </CardDescription>
                </CardHeader>
                
                <CardContent className="space-y-6">
                  <ul className="space-y-3">
                    {plan.features.map((feature, i) => (
                      <li key={i} className="flex items-center gap-2">
                        <Check className="w-5 h-5 text-green-500 flex-shrink-0" />
                        <span className="text-sm">{feature}</span>
                      </li>
                    ))}
                  </ul>
                  
                  <Button 
                    className="w-full"
                    variant={isPopular ? 'default' : 'outline'}
                    onClick={() => handleStartTrial(key)}
                    disabled={loading !== null}
                  >
                    {loading === key ? (
                      <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Starting...</>
                    ) : (
                      'Start Free Trial'
                    )}
                  </Button>
                  
                  <p className="text-xs text-center text-gray-500">
                    7-day trial • 7,000 credits • All features
                  </p>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <div className="text-center mt-12 text-gray-500">
          <p>After your trial ends, you'll be charged ${'{plan price}'}/month.</p>
          <p className="text-sm mt-2">Cancel anytime. No questions asked.</p>
        </div>
      </div>
    </div>
  );
}

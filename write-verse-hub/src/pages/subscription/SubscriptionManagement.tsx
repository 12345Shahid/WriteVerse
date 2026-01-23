import { useNavigate } from 'react-router-dom';
import { CreditCard, Clock, Zap, ArrowUpRight, AlertCircle, Building2 } from 'lucide-react';
import { Button } from '@/components/ui/button-brutal';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { useSubscription, PLANS } from '@/hooks/useSubscription';
import { SiteNav } from '@/components/SiteNav';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useTeam } from '@/context/TeamContext';
import { createSubscriptionSession } from '@/lib/api';
import { toast } from 'sonner';

const STATUS_COLORS = {
  trialing: 'bg-blue-100 text-blue-800',
  active: 'bg-green-100 text-green-800',
  past_due: 'bg-red-100 text-red-800',
  canceled: 'bg-gray-100 text-gray-800',
  expired: 'bg-orange-100 text-orange-800'
};

const STATUS_LABELS = {
  trialing: 'Trial',
  active: 'Active',
  past_due: 'Past Due',
  canceled: 'Canceled',
  expired: 'Expired'
};

export default function SubscriptionManagement() {
  const navigate = useNavigate();
  const { currentTeam } = useTeam();
  const { subscription, loading, isTrialing, daysLeft, hasSubscription } = useSubscription();
  const [creditsBalance, setCreditsBalance] = useState<number | null>(null);

  // Fetch actual credits balance from organization_credits
  useEffect(() => {
    if (!currentTeam?.id) return;
    
    const fetchCredits = async () => {
      const { data } = await supabase
        .from('organization_credits')
        .select('balance')
        .eq('organization_id', currentTeam.id)
        .single();
      
      if (data) {
        setCreditsBalance(data.balance);
      }
    };
    
    fetchCredits();
    fetchCredits();
  }, [currentTeam?.id]);

  const handleUpgrade = async (plan: 'starter' | 'professional' | 'business') => {
    try {
      const { url } = await createSubscriptionSession(plan, 'monthly');
      if (url) {
        window.location.href = url;
      }
    } catch (err) {
      console.error('Failed to start upgrade session:', err);
      toast.error('Failed to start upgrade. Please try again.');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <SiteNav />
        <div className="container mx-auto px-4 py-12 text-center">
          <div className="animate-pulse">Loading subscription...</div>
        </div>
      </div>
    );
  }

  if (!hasSubscription) {
    navigate('/subscription/setup');
    return null;
  }

  const planInfo = subscription?.plan && PLANS[subscription.plan as keyof typeof PLANS];
  const monthlyCredits = planInfo?.credits || subscription?.monthly_credits || 0;
  // Use actual balance from organization_credits, fallback to monthly total for trial
  const creditsRemaining = creditsBalance ?? monthlyCredits;
  const creditsPercentage = monthlyCredits > 0 ? Math.min(100, ((monthlyCredits - creditsRemaining) / monthlyCredits) * 100) : 0;

  return (
    <div className="min-h-screen bg-gray-50">
      <SiteNav />
      
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-3xl font-bold mb-8">Subscription Management</h1>

          {/* Current Plan Card */}
          <Card className="border-4 border-black mb-6">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-2xl flex items-center gap-3">
                  {planInfo?.name || 'Trial'} Plan
                  <Badge className={STATUS_COLORS[subscription?.status || 'trialing']}>
                    {STATUS_LABELS[subscription?.status || 'trialing']}
                  </Badge>
                </CardTitle>
                <CardDescription>
                  {isTrialing 
                    ? `Your trial ends in ${daysLeft} days`
                    : `Renews on ${subscription?.current_period_end ? new Date(subscription.current_period_end).toLocaleDateString() : 'N/A'}`
                  }
                </CardDescription>
              </div>
              <div className="text-right">
                <div className="text-3xl font-bold">${planInfo?.price || 0}</div>
                <div className="text-gray-500">/month</div>
              </div>
            </CardHeader>
            <CardContent>
              {isTrialing && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6 flex items-start gap-3">
                  <Clock className="w-5 h-5 text-blue-500 mt-0.5" />
                  <div>
                    <p className="font-medium text-blue-900">Trial Period Active</p>
                    <p className="text-sm text-blue-700">
                      You have {daysLeft} days left to explore all features. 
                      After the trial, you'll be charged ${planInfo?.price}/month.
                    </p>
                  </div>
                </div>
              )}

              {subscription?.status === 'past_due' && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6 flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-red-500 mt-0.5" />
                  <div>
                    <p className="font-medium text-red-900">Payment Failed</p>
                    <p className="text-sm text-red-700">
                      Please update your payment method to continue using all features.
                    </p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>



          {/* Upgrade Options */}
          {subscription?.plan !== 'business' && (
            <Card className="border-4 border-black mb-6">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ArrowUpRight className="w-5 h-5" />
                  Upgrade Your Plan
                </CardTitle>
                <CardDescription>
                  Get more credits and unlock additional features
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid md:grid-cols-2 gap-4">
                  {subscription?.plan === 'starter' && (
                    <div className="border rounded-lg p-4 hover:border-purple-500 transition-colors">
                      <h3 className="font-bold">Professional</h3>
                      <p className="text-2xl font-bold mt-1">${PLANS.professional.price}<span className="text-sm font-normal text-gray-500">/mo</span></p>
                      <p className="text-sm text-gray-600 mt-2">{PLANS.professional.credits.toLocaleString()} credits, {PLANS.professional.seats} seats</p>
                      <Button variant="outline" className="w-full mt-4" onClick={() => handleUpgrade('professional')}>
                        Upgrade
                      </Button>
                    </div>
                  )}
                  {(subscription?.plan === 'starter' || subscription?.plan === 'professional') && (
                    <div className="border rounded-lg p-4 hover:border-amber-500 transition-colors">
                      <h3 className="font-bold">Business</h3>
                      <p className="text-2xl font-bold mt-1">${PLANS.business.price}<span className="text-sm font-normal text-gray-500">/mo</span></p>
                      <p className="text-sm text-gray-600 mt-2">{PLANS.business.credits.toLocaleString()} credits, {PLANS.business.seats} seats, API access</p>
                      <Button variant="outline" className="w-full mt-4" onClick={() => handleUpgrade('business')}>
                        Upgrade
                      </Button>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Enterprise Option */}
          <Card className="border-4 border-black mb-6 bg-gradient-to-r from-purple-50 to-blue-50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="w-5 h-5" />
                Need More?
              </CardTitle>
              <CardDescription>
                Custom solutions for larger teams and enterprises
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Enterprise Plan</p>
                  <p className="text-sm text-gray-600">Unlimited seats, custom credits, SSO, dedicated support</p>
                </div>
                <Button variant="default" onClick={() => navigate('/enterprise')}>
                  Contact Sales
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Billing Actions */}
          <Card className="border-4 border-black">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="w-5 h-5" />
                Billing
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Payment Method</p>
                  <p className="text-sm text-gray-500">
                    {subscription?.stripe_customer_id ? 'Card on file' : 'No payment method'}
                  </p>
                </div>
                <Button variant="outline" size="sm" disabled>
                  Update
                </Button>
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Billing History</p>
                  <p className="text-sm text-gray-500">View past invoices</p>
                </div>
                <Button variant="outline" size="sm" disabled>
                  View
                </Button>
              </div>
              <hr />
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-red-600">Cancel Subscription</p>
                  <p className="text-sm text-gray-500">Your access will continue until the end of the billing period</p>
                </div>
                <Button variant="outline" size="sm" className="text-red-600 border-red-300 hover:bg-red-50" disabled>
                  Cancel
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

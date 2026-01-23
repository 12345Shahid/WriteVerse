import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, X, Sparkles, Zap, Crown, Building2, Loader2, CreditCard } from 'lucide-react';
import { Button } from '@/components/ui/button-brutal';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { useSubscription, PLANS } from '@/hooks/useSubscription';
import { toast } from 'sonner';
import { SiteNav } from '@/components/SiteNav';
import { supabase } from '@/lib/supabase';
import { useTeam } from '@/context/TeamContext';

const PLAN_ICONS = {
  starter: Sparkles,
  professional: Zap,
  business: Crown,
  enterprise: Building2
};

const PLAN_COLORS = {
  starter: 'border-gray-300 hover:border-blue-400',
  professional: 'border-purple-400 ring-2 ring-purple-100',
  business: 'border-amber-400',
  enterprise: 'border-gray-400'
};

export default function PricingPage() {
  const navigate = useNavigate();
  const { currentTeam, isLoading: teamLoading, refreshTeams } = useTeam();
  const { startTrialWithCard, hasSubscription, loading: subLoading } = useSubscription();
  const [loading, setLoading] = useState<string | null>(null);
  const [isAnnual, setIsAnnual] = useState(false);
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    const checkUser = async () => {
      const { data } = await supabase.auth.getUser();
      setUser(data.user);
    };
    checkUser();
  }, []);

  // If already has subscription, redirect to dashboard
  useEffect(() => {
    if (hasSubscription && !subLoading) {
      navigate('/dashboard');
    }
  }, [hasSubscription, subLoading, navigate]);

  const handleStartTrial = async (plan: 'starter' | 'professional' | 'business') => {
    if (!user) {
      // Redirect to auth with return URL
      navigate('/auth?redirect=/subscription/pricing');
      return;
    }

    setLoading(plan);
    try {
      // If no team available, try refreshing teams first (handles race condition)
      if (!currentTeam?.id) {
        console.log('[PricingPage] No team found, refreshing...');
        await refreshTeams(true);
        // Give a moment for state to update
        await new Promise(resolve => setTimeout(resolve, 300));
      }
      
      // Use Stripe Checkout with credit card required
      await startTrialWithCard(plan, isAnnual ? 'yearly' : 'monthly');
      // User will be redirected to Stripe Checkout
    } catch (err: any) {
      // If still no organization, show a more helpful message
      if (err.message === 'No organization') {
        toast.error('Setting up your workspace... Please try again in a moment.');
        // Trigger another refresh in the background
        refreshTeams(true);
      } else {
        toast.error(err.message || 'Failed to start checkout');
      }
      setLoading(null);
    }
  };

  const getPrice = (plan: keyof typeof PLANS) => {
    if (isAnnual) {
      return Math.round(PLANS[plan].yearlyPrice / 12);
    }
    return PLANS[plan].price;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-100">
      <SiteNav />
      
      <div className="container mx-auto px-4 py-12">
        {/* Header */}
        <div className="text-center mb-12">
          <Badge className="mb-4 bg-purple-100 text-purple-800 border-purple-200">
            7-Day Free Trial • Credit Card Required
          </Badge>
          <h1 className="text-4xl md:text-5xl font-bold mb-4">
            Simple, Transparent Pricing
          </h1>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            Start with a free trial. Get <strong>7,000 credits</strong> and full access to all features for 7 days.
          </p>
          
          {/* Annual/Monthly Toggle */}
          <div className="flex items-center justify-center gap-4 mt-8">
            <span className={`text-sm font-medium ${!isAnnual ? 'text-black' : 'text-gray-500'}`}>Monthly</span>
            <Switch checked={isAnnual} onCheckedChange={setIsAnnual} />
            <span className={`text-sm font-medium ${isAnnual ? 'text-black' : 'text-gray-500'}`}>
              Annual <Badge variant="secondary" className="ml-1 bg-green-100 text-green-800">Save 30%</Badge>
            </span>
          </div>
        </div>

        {/* Pricing Cards */}
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-7xl mx-auto">
          {/* Starter Plan */}
          <Card className={`relative border-4 ${PLAN_COLORS.starter} transition-all hover:shadow-lg`}>
            <CardHeader className="text-center pb-4">
              <div className="w-12 h-12 mx-auto mb-4 bg-blue-50 rounded-full flex items-center justify-center">
                <Sparkles className="w-6 h-6 text-blue-500" />
              </div>
              <CardTitle className="text-xl">Starter</CardTitle>
              <CardDescription>For solo creators</CardDescription>
              <div className="mt-4">
                <span className="text-4xl font-bold">${getPrice('starter')}</span>
                <span className="text-gray-500">/{isAnnual ? 'mo' : 'month'}</span>
                {isAnnual && <p className="text-xs text-green-600 mt-1">Billed ${PLANS.starter.yearlyPrice}/year</p>}
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <ul className="space-y-2">
                {PLANS.starter.features.map((feature, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm">
                    <Check className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                    <span>{feature}</span>
                  </li>
                ))}
                {PLANS.starter.notIncluded.map((feature, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-gray-400">
                    <X className="w-4 h-4 text-gray-300 mt-0.5 flex-shrink-0" />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>
              <Button 
                className="w-full" 
                variant="outline"
                onClick={() => handleStartTrial('starter')}
                disabled={loading !== null}
              >
                {loading === 'starter' ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Start Free Trial'}
              </Button>
            </CardContent>
          </Card>

          {/* Professional Plan - Most Popular */}
          <Card className={`relative border-4 ${PLAN_COLORS.professional} transition-all hover:shadow-xl scale-[1.02]`}>
            <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-purple-500 text-white px-4 py-1 rounded-full text-sm font-bold">
              Most Popular
            </div>
            <CardHeader className="text-center pb-4">
              <div className="w-12 h-12 mx-auto mb-4 bg-purple-50 rounded-full flex items-center justify-center">
                <Zap className="w-6 h-6 text-purple-500" />
              </div>
              <CardTitle className="text-xl">Professional</CardTitle>
              <CardDescription>For growing teams</CardDescription>
              <div className="mt-4">
                <span className="text-4xl font-bold">${getPrice('professional')}</span>
                <span className="text-gray-500">/{isAnnual ? 'mo' : 'month'}</span>
                {isAnnual && <p className="text-xs text-green-600 mt-1">Billed ${PLANS.professional.yearlyPrice}/year</p>}
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <ul className="space-y-2">
                {PLANS.professional.features.map((feature, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm">
                    <Check className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                    <span>{feature}</span>
                  </li>
                ))}
                {PLANS.professional.notIncluded.map((feature, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-gray-400">
                    <X className="w-4 h-4 text-gray-300 mt-0.5 flex-shrink-0" />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>
              <Button 
                className="w-full bg-purple-600 hover:bg-purple-700"
                onClick={() => handleStartTrial('professional')}
                disabled={loading !== null}
              >
                {loading === 'professional' ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Start Free Trial'}
              </Button>
            </CardContent>
          </Card>

          {/* Business Plan */}
          <Card className={`relative border-4 ${PLAN_COLORS.business} transition-all hover:shadow-lg`}>
            <CardHeader className="text-center pb-4">
              <div className="w-12 h-12 mx-auto mb-4 bg-amber-50 rounded-full flex items-center justify-center">
                <Crown className="w-6 h-6 text-amber-500" />
              </div>
              <CardTitle className="text-xl">Business</CardTitle>
              <CardDescription>For agencies & SaaS</CardDescription>
              <div className="mt-4">
                <span className="text-4xl font-bold">${getPrice('business')}</span>
                <span className="text-gray-500">/{isAnnual ? 'mo' : 'month'}</span>
                {isAnnual && <p className="text-xs text-green-600 mt-1">Billed ${PLANS.business.yearlyPrice}/year</p>}
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <ul className="space-y-2">
                {PLANS.business.features.slice(0, 8).map((feature, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm">
                    <Check className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                    <span>{feature}</span>
                  </li>
                ))}
                {PLANS.business.notIncluded.map((feature, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-gray-400">
                    <X className="w-4 h-4 text-gray-300 mt-0.5 flex-shrink-0" />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>
              <Button 
                className="w-full bg-amber-500 hover:bg-amber-600 text-white"
                onClick={() => handleStartTrial('business')}
                disabled={loading !== null}
              >
                {loading === 'business' ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Start Free Trial'}
              </Button>
            </CardContent>
          </Card>

          {/* Enterprise Plan */}
          <Card className={`relative border-4 ${PLAN_COLORS.enterprise} transition-all hover:shadow-lg bg-gray-50`}>
            <CardHeader className="text-center pb-4">
              <div className="w-12 h-12 mx-auto mb-4 bg-gray-200 rounded-full flex items-center justify-center">
                <Building2 className="w-6 h-6 text-gray-600" />
              </div>
              <CardTitle className="text-xl">Enterprise</CardTitle>
              <CardDescription>For large organizations</CardDescription>
              <div className="mt-4">
                <span className="text-2xl font-bold">Custom</span>
                <p className="text-xs text-gray-500 mt-1">Starting at $1,000/mo</p>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <ul className="space-y-2 text-sm">
                <li className="flex items-start gap-2">
                  <Check className="w-4 h-4 text-green-500 mt-0.5" />
                  <span>Everything in Business</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="w-4 h-4 text-green-500 mt-0.5" />
                  <span>Unlimited credits</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="w-4 h-4 text-green-500 mt-0.5" />
                  <span>White-label branding</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="w-4 h-4 text-green-500 mt-0.5" />
                  <span>SSO & advanced security</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="w-4 h-4 text-green-500 mt-0.5" />
                  <span>Dedicated account manager</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="w-4 h-4 text-green-500 mt-0.5" />
                  <span>99.9% SLA guarantee</span>
                </li>
              </ul>
              <Button 
                className="w-full" 
                variant="outline"
                onClick={() => window.location.href = 'mailto:sales@writerai.com?subject=Enterprise Inquiry'}
              >
                Contact Sales
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Trial Info */}
        <div className="text-center mt-12 p-6 bg-blue-50 rounded-2xl max-w-3xl mx-auto">
          <CreditCard className="w-8 h-8 mx-auto mb-3 text-blue-500" />
          <h3 className="text-lg font-bold mb-2">7-Day Free Trial</h3>
          <p className="text-gray-600">
            Try any plan free for 7 days with 7,000 credits. Credit card required to start.
            You won't be charged until the trial ends. Cancel anytime.
          </p>
        </div>

        {/* FAQ or Features Comparison could go here */}
      </div>
    </div>
  );
}

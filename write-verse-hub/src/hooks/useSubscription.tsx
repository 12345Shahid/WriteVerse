import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useTeam } from '@/context/TeamContext';

export interface Subscription {
  id: string;
  organization_id: string;
  plan: 'trial' | 'starter' | 'professional' | 'business';
  status: 'trialing' | 'active' | 'past_due' | 'canceled' | 'expired';
  stripe_customer_id?: string;
  stripe_subscription_id?: string;
  trial_ends_at?: string;
  current_period_end?: string;
  monthly_credits: number;
  created_at: string;
}

export const PLANS = {
  starter: {
    name: 'Starter',
    price: 29,
    credits: 100000,
    seats: 1,
    yearlyPrice: 244,
    features: [
      'All 25+ writing tools',
      '100,000 credits/month (~75K words)',
      '1-2 custom agents',
      'Basic knowledge base (100MB)',
      'Basic workflows (3-5 steps)',
      '1 brand voice profile',
      'Basic analytics (30 days)'
    ],
    notIncluded: ['Embed chatbot', 'Composio integrations', 'API access']
  },
  professional: {
    name: 'Professional',
    price: 79,
    credits: 500000,
    seats: 5,
    yearlyPrice: 665,
    features: [
      'Everything in Starter',
      '500,000 credits/month (~375K words)',
      '5 custom agents',
      'Full knowledge base (1GB)',
      'Advanced workflows (unlimited)',
      '5 team seats',
      'Embed chatbot (3 instances)',
      'Composio integrations (500+ apps)',
      'Detailed analytics (all time)',
      'Unlimited brand voices'
    ],
    notIncluded: ['API access', 'SSO/Advanced security']
  },
  business: {
    name: 'Business',
    price: 199,
    credits: 2000000,
    seats: 15,
    yearlyPrice: 1681,
    features: [
      'Everything in Professional',
      '2,000,000 credits/month (~1.5M words)',
      'Unlimited custom agents',
      'Full knowledge base (10GB)',
      '15 team seats',
      'Unlimited embed chatbots',
      'API access (100K req/month)',
      'Priority support (24h response)',
      'Advanced analytics & reporting',
      'Custom integrations consultation'
    ],
    notIncluded: ['White-label', 'Dedicated account manager']
  }
} as const;

export function useSubscription() {
  const { currentTeam } = useTeam();
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!currentTeam?.id) {
      setLoading(false);
      return;
    }

    const fetchSubscription = async () => {
      try {
        setLoading(true);
        const { data, error: fetchError } = await supabase
          .from('organization_subscriptions')
          .select('*')
          .eq('organization_id', currentTeam.id)
          .single();

        if (fetchError && fetchError.code !== 'PGRST116') {
          throw fetchError;
        }

        setSubscription(data || null);
      } catch (err: any) {
        console.error('[useSubscription] Error:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchSubscription();
  }, [currentTeam?.id]);

  const isTrialing = subscription?.status === 'trialing';
  const isActive = subscription?.status === 'active';
  const hasSubscription = !!subscription;
  
  const daysLeft = subscription?.trial_ends_at
    ? Math.max(0, Math.ceil((new Date(subscription.trial_ends_at).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
    : 0;

  const startTrial = async (selectedPlan: 'starter' | 'professional' | 'business') => {
    if (!currentTeam?.id) throw new Error('No organization');

    const { data: { session } } = await supabase.auth.getSession();
    const res = await fetch(`${import.meta.env.VITE_API_URL || ''}/api/subscriptions/start-trial`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': session?.user?.id || '',
      },
      body: JSON.stringify({
        organizationId: currentTeam.id,
        plan: selectedPlan
      })
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to start trial');
    }

    const result = await res.json();
    setSubscription(result.subscription);
    return result;
  };

  // Start trial with credit card via Stripe Checkout
  const startTrialWithCard = async (
    selectedPlan: 'starter' | 'professional' | 'business',
    billing: 'monthly' | 'yearly' = 'monthly'
  ) => {
    if (!currentTeam?.id) throw new Error('No organization');

    const { data: { session } } = await supabase.auth.getSession();
    const res = await fetch(`${import.meta.env.VITE_API_URL || ''}/api/subscriptions/checkout-trial`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': session?.user?.id || '',
      },
      body: JSON.stringify({
        organizationId: currentTeam.id,
        plan: selectedPlan,
        billing: billing,
        successUrl: `${window.location.origin}/dashboard?sub_session_id={CHECKOUT_SESSION_ID}`,
        cancelUrl: `${window.location.origin}/subscription/pricing?canceled=true`
      })
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to create checkout session');
    }

    const result = await res.json();
    
    // Redirect to Stripe Checkout
    if (result.url) {
      window.location.href = result.url;
    }
    
    return result;
  };

  return {
    subscription,
    loading,
    error,
    isTrialing,
    isActive,
    hasSubscription,
    daysLeft,
    startTrial,
    startTrialWithCard,
    planDetails: subscription?.plan ? PLANS[subscription.plan as keyof typeof PLANS] : null
  };
}

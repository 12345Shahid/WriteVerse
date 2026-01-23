import React from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, CreditCard, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button-brutal';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useSubscription } from '@/hooks/useSubscription';
import { useTeam } from '@/context/TeamContext';
import { supabase } from '@/lib/supabase';
import { useState, useEffect } from 'react';

interface RequireCreditsProps {
  children: React.ReactNode;
  minCredits?: number;
  showWarningAt?: number; // Show warning when credits drop below this
}

/**
 * RequireCredits - Wrapper component that gates features behind credit availability
 * 
 * Usage:
 * <RequireCredits minCredits={100}>
 *   <BlogGenerator />
 * </RequireCredits>
 */
export function RequireCredits({ 
  children, 
  minCredits = 1,
  showWarningAt = 500 
}: RequireCreditsProps) {
  const navigate = useNavigate();
  const { currentTeam } = useTeam();
  const { hasSubscription } = useSubscription();
  const [credits, setCredits] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [showNoCreditsModal, setShowNoCreditsModal] = useState(false);
  const [showLowCreditsWarning, setShowLowCreditsWarning] = useState(false);

  useEffect(() => {
    if (!currentTeam?.id) {
      setLoading(false);
      return;
    }

    const fetchCredits = async () => {
      try {
        const { data, error } = await supabase
          .from('organization_credits')
          .select('balance_credits')
          .eq('organization_id', currentTeam.id)
          .single();

        if (!error && data) {
          setCredits(data.balance_credits);
          
          // Check if we should show warning or block
          if (data.balance_credits <= 0) {
            setShowNoCreditsModal(true);
          } else if (data.balance_credits < showWarningAt) {
            setShowLowCreditsWarning(true);
          }
        }
      } catch (err) {
        console.error('[RequireCredits] Error fetching credits:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchCredits();
  }, [currentTeam?.id, showWarningAt]);

  // If no subscription, redirect to pricing
  if (!hasSubscription && !loading) {
    navigate('/subscription/pricing');
    return null;
  }

  // Block if no credits
  if (credits !== null && credits <= 0) {
    return (
      <>
        <Dialog open={showNoCreditsModal} onOpenChange={setShowNoCreditsModal}>
          <DialogContent className="sm:max-w-md border-4 border-black">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-red-600">
                <AlertTriangle className="w-5 h-5" />
                Out of Credits
              </DialogTitle>
              <DialogDescription>
                You've run out of credits. Purchase more or upgrade your plan to continue using this feature.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3 mt-4">
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-center">
                <p className="text-2xl font-bold text-red-600">{credits} credits</p>
                <p className="text-sm text-red-500">remaining</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Button 
                  variant="outline" 
                  onClick={() => navigate('/subscription?action=buy-credits')}
                  className="flex items-center gap-2"
                >
                  <CreditCard className="w-4 h-4" />
                  Buy Credits
                </Button>
                <Button 
                  onClick={() => navigate('/subscription/pricing')}
                  className="flex items-center gap-2"
                >
                  <Zap className="w-4 h-4" />
                  Upgrade Plan
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
        {/* Show disabled state */}
        <div className="opacity-50 pointer-events-none">
          {children}
        </div>
      </>
    );
  }

  return (
    <>
      {/* Low credits warning banner */}
      {showLowCreditsWarning && credits !== null && credits > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-500" />
            <span className="text-sm text-amber-700">
              Low credits: <strong>{credits.toLocaleString()}</strong> remaining
            </span>
          </div>
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => navigate('/subscription?action=buy-credits')}
          >
            Buy More
          </Button>
        </div>
      )}
      {children}
    </>
  );
}

/**
 * useCredits hook - Get current credit balance
 */
export function useCredits() {
  const { currentTeam } = useTeam();
  const [credits, setCredits] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = async () => {
    if (!currentTeam?.id) return;
    
    try {
      const { data, error } = await supabase
        .from('organization_credits')
        .select('balance_credits')
        .eq('organization_id', currentTeam.id)
        .single();

      if (!error && data) {
        setCredits(data.balance_credits);
      }
    } catch (err) {
      console.error('[useCredits] Error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
  }, [currentTeam?.id]);

  return {
    credits,
    loading,
    hasCredits: credits !== null && credits > 0,
    isLow: credits !== null && credits < 500,
    refresh
  };
}

import Stripe from 'stripe';
import { getSupabaseAdmin } from '../supabaseAdmin.js';
import { buffer } from 'micro';
import { sendEmail, generateInvoiceHtml } from '../../server/resend.js';

const stripe = process.env.STRIPE_SECRET_KEY ? new Stripe(process.env.STRIPE_SECRET_KEY) : null;

export const config = {
  api: {
    bodyParser: false, // Required for Stripe signature verification
  },
};

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  console.log('[Webhook][Stripe] Incoming webhook event');

  if (!stripe) {
    console.error('[Webhook][Stripe] STRIPE_SECRET_KEY not configured');
    return res.status(500).json({ error: 'STRIPE_NOT_CONFIGURED' });
  }

  const supabaseAdmin = getSupabaseAdmin();
  if (!supabaseAdmin) {
    console.error('[Webhook][Stripe] Supabase admin not configured');
    return res.status(500).json({ error: 'SUPABASE_NOT_CONFIGURED' });
  }

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  let event: Stripe.Event;

  try {
    // Use micro's buffer for Vercel serverless functions
    const rawBody = await buffer(req);
    
    // Verify webhook signature if secret is configured
    if (webhookSecret) {
      const sig = req.headers['stripe-signature'];
      try {
        event = stripe.webhooks.constructEvent(rawBody, sig, webhookSecret);
      } catch (err: any) {
        console.error('[Webhook][Stripe] Signature verification failed:', err.message);
        return res.status(400).json({ error: 'INVALID_SIGNATURE', message: err.message });
      }
    } else {
      // For development without webhook secret (NOT recommended for production)
      console.warn('[Webhook][Stripe] No STRIPE_WEBHOOK_SECRET configured');
      event = JSON.parse(rawBody.toString());
    }
  } catch (err: any) {
    console.error('[Webhook][Stripe] Failed to parse body:', err.message);
    return res.status(400).json({ error: 'INVALID_PAYLOAD' });
  }

  console.log('[Webhook][Stripe] Event type:', event.type, 'ID:', event.id);

  try {
    switch (event.type) {
      // One-time credit purchase completed
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        console.log('[Webhook][Stripe] checkout.session.completed', session.id);

        // Handle one-time payments
        if (session.mode === 'payment') {
          const { data, error } = await supabaseAdmin.rpc('fulfill_checkout', {
            session_id: session.id,
          });

          if (error) {
            console.error('[Webhook][Stripe] fulfill_checkout error:', error);
          } else {
            console.log('[Webhook][Stripe] Credits fulfilled:', data);
          }

          // Send Invoice Email for One-Time Purchase
          if (session.customer_details?.email) {
            const amountTotal = session.amount_total || 0;
            const currency = session.currency || 'usd';
            
            const invoiceDetails = {
              customerName: session.customer_details.name || 'Valued Customer',
              amount: amountTotal,
              currency: currency,
              date: new Date().toLocaleDateString(),
              items: [{ description: 'Credits Purchase', amount: amountTotal }],
              invoiceId: session.payment_intent as string || session.id,
            };

            const html = generateInvoiceHtml(invoiceDetails);
            await sendEmail({
              to: session.customer_details.email,
              subject: `Receipt for your purchase`,
              html,
            });
          }
        }
        
        // Handle subscription checkout (backup to frontend confirm flow)
        if (session.mode === 'subscription' && session.subscription) {
          console.log('[Webhook][Stripe] Subscription checkout completed, creating backup record');
          
          const subscriptionId = typeof session.subscription === 'string' 
            ? session.subscription 
            : (session.subscription as any).id;
          
          // Get subscription details from Stripe
          const subscription = await stripe.subscriptions.retrieve(String(subscriptionId));
          
          // Get org ID from metadata
          const orgId = session.metadata?.organization_id || subscription.metadata?.organization_id;
          const plan = session.metadata?.plan || subscription.metadata?.plan;
          const trialCredits = parseInt(subscription.metadata?.trial_credits || '7000', 10);
          
          if (orgId) {
            // Check if subscription record already exists (created by frontend confirm)
            const { data: existing } = await supabaseAdmin
              .from('organization_subscriptions')
              .select('id, trial_credits_granted')
              .eq('organization_id', orgId)
              .maybeSingle();
            
            const customerId = typeof subscription.customer === 'string' 
              ? subscription.customer 
              : subscription.customer?.id;
            
            const subPayload = {
              plan: plan || 'starter',
              status: subscription.status,
              stripe_customer_id: customerId,
              stripe_subscription_id: subscription.id,
              trial_ends_at: subscription.trial_end ? new Date(subscription.trial_end * 1000).toISOString() : null,
              current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
              monthly_credits: trialCredits,
              updated_at: new Date().toISOString(),
            };
            
            if (existing) {
              // Update existing record
              await supabaseAdmin
                .from('organization_subscriptions')
                .update(subPayload)
                .eq('organization_id', orgId);
              console.log('[Webhook][Stripe] Updated existing subscription for org:', orgId);
            } else {
              // Create new record
              await supabaseAdmin
                .from('organization_subscriptions')
                .insert({
                  organization_id: orgId,
                  ...subPayload,
                });
              console.log('[Webhook][Stripe] Created new subscription for org:', orgId);
              
              // Grant trial credits for new subscriptions
              if (subscription.status === 'trialing') {
                await supabaseAdmin
                  .from('organization_credits')
                  .upsert({
                    organization_id: orgId,
                    balance_credits: trialCredits,
                  }, { onConflict: 'organization_id' });
                
                await supabaseAdmin
                  .from('organization_subscriptions')
                  .update({ trial_credits_granted: true })
                  .eq('organization_id', orgId);
                  
                console.log('[Webhook][Stripe] Granted', trialCredits, 'trial credits to org:', orgId);
              }
            }
          } else {
            console.warn('[Webhook][Stripe] No organization_id in subscription metadata');
          }
        }
        break;
      }

      // Subscription invoice paid (monthly/yearly renewal)
      case 'invoice.paid': {
        const invoice = event.data.object as Stripe.Invoice;
        console.log('[Webhook][Stripe] invoice.paid', invoice.id, 'subscription:', invoice.subscription);

        // Send Invoice Email for Subscription Renewal
        if (invoice.customer_email) {
          const amountPaid = invoice.amount_paid;
          const currency = invoice.currency;

          const invoiceDetails = {
            customerName: invoice.customer_name || 'Subscriber',
            amount: amountPaid,
            currency: currency,
            date: new Date(invoice.created * 1000).toLocaleDateString(),
            items: invoice.lines.data.map(line => ({
              description: line.description || 'Subscription',
              amount: line.amount,
            })),
            invoiceId: invoice.number || invoice.id,
            invoicePdfUrl: invoice.hosted_invoice_url || undefined,
          };

          const html = generateInvoiceHtml(invoiceDetails);
          await sendEmail({
            to: invoice.customer_email,
            subject: `Invoice ${invoice.number || ''}`,
            html,
          });
        }

        // Skip if no subscription (already handled above or logic below handles credits)
        if (!invoice.subscription) break;

        // Get the subscription to find the org
        const { data: orgSub } = await supabaseAdmin
          .from('organization_subscriptions')
          .select('organization_id, plan_code, trial_credits_granted')
          .eq('stripe_subscription_id', invoice.subscription)
          .maybeSingle();

        if (!orgSub) {
          console.warn('[Webhook][Stripe] No org subscription found for:', invoice.subscription);
          break;
        }

        // Get plan details for monthly credits
        const { data: plan } = await supabaseAdmin
          .from('subscription_plans')
          .select('included_credits_per_month')
          .eq('code', orgSub.plan_code)
          .maybeSingle();

        if (!plan) {
          console.warn('[Webhook][Stripe] No plan found for code:', orgSub.plan_code);
          break;
        }

        const creditsToAdd = plan.included_credits_per_month || 0;

        // Add monthly credits using RPC
        await supabaseAdmin.rpc('add_monthly_credits', {
          p_organization_id: orgSub.organization_id,
          p_credits: creditsToAdd,
        });

        console.log('[Webhook][Stripe] Added', creditsToAdd, 'credits to org', orgSub.organization_id);

        // Update subscription period
        await supabaseAdmin
          .from('organization_subscriptions')
          .update({
            status: 'active',
            current_period_start: new Date((invoice.period_start || 0) * 1000).toISOString(),
            current_period_end: new Date((invoice.period_end || 0) * 1000).toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq('stripe_subscription_id', invoice.subscription);

        break;
      }

      // Subscription status changed
      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription;
        console.log('[Webhook][Stripe] customer.subscription.updated', subscription.id, 'status:', subscription.status);

        await supabaseAdmin
          .from('organization_subscriptions')
          .update({
            status: subscription.status,
            cancel_at_period_end: subscription.cancel_at_period_end,
            current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
            current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq('stripe_subscription_id', subscription.id);

        break;
      }

      // Subscription deleted/cancelled
      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        console.log('[Webhook][Stripe] customer.subscription.deleted', subscription.id);

        await supabaseAdmin
          .from('organization_subscriptions')
          .update({
            status: 'canceled',
            updated_at: new Date().toISOString(),
          })
          .eq('stripe_subscription_id', subscription.id);
        break;
      }

      default:
        console.log('[Webhook][Stripe] Unhandled event type:', event.type);
    }

    // Always return 200 to acknowledge receipt
    return res.json({ received: true });
  } catch (err: any) {
    console.error('[Webhook][Stripe] Processing error:', err);
    // Still return 200 to prevent Stripe from retrying
    return res.json({ received: true, error: err.message });
  }
}

import { getUserId } from './supabase';

export async function getCommonHeaders() {
  const userId = await getUserId();
  const teamId = typeof window !== 'undefined' ? window.localStorage.getItem('writerai_active_team') : null;
  return {
    'Content-Type': 'application/json',
    ...(userId ? { 'X-User-Id': userId } : {}),
    ...(teamId ? { 'x-organization-id': teamId } : {}),
  };
}

export async function generate(params: {
  tool: 'email_subject' | 'resume' | 'cold_email' | 'product_description' | 'job_description' | 'linkedin'
    | 'social_ad' | 'summarizer' | 'cover_letter' | 'twitter_thread' | 'faq' | 'script' | 'blog_helper'
    | 'copy_helper' | 'social_helper' | 'email_writer' | 'rewrite_helper'
    | 'blog_post' | 'article_from_outline' | 'seo_blog_optimizer'
    | 'case_study_writer' | 'landing_page_writer' | 'report_writer';
  inputs: Record<string, any>;
  outputCount?: number;
  tone?: string;
  brandVoiceId?: string;
  modelId?: string;
}) {
  const started = performance.now();
  const userId = await getUserId();
  const body = {
    tool: params.tool,
    inputs: params.inputs,
    outputCount: params.outputCount ?? 3,
    tone: params.tone,
    brandVoiceId: params.brandVoiceId,
    modelId: params.modelId,
  };

  console.groupCollapsed('[API] POST /api/generate');
  console.debug('headers.x-user-id', userId || '(none)');
  console.debug('request.body', body);
  try {
    const res = await fetch('/api/generate', {
      method: 'POST',
      headers: await getCommonHeaders(),
      body: JSON.stringify(body),
    });

    const text = await res.text();
    let json: any = null;
    try { json = JSON.parse(text); } catch {}
    console.debug('response.status', res.status);
    console.debug('response.body', json ?? text.slice(0, 500));

    if (!res.ok) {
      throw new Error(json?.message || `HTTP ${res.status}`);
    }

    const elapsed = Math.round(performance.now() - started);
    console.debug('durationMs', elapsed);
    console.groupEnd();
    return json as { results: any; debug?: any };
  } catch (err: any) {
    console.error('[API] /api/generate error', err);
    console.groupEnd();
    throw err;
  }
}

export async function saveResults(payload: { tool_name: string; input_data: any; results: any }) {
  const userId = await getUserId();
  console.groupCollapsed('[API] POST /api/results/save');
  console.debug('headers.x-user-id', userId || '(none)');
  console.debug('request.body', payload);
  try {
    const res = await fetch('/api/results/save', {
      method: 'POST',
      headers: await getCommonHeaders(),
      body: JSON.stringify(payload),
    });
    const text = await res.text();
    let json: any = null;
    try { json = JSON.parse(text); } catch {}
    console.debug('response.status', res.status);
    console.debug('response.body', json ?? text.slice(0, 500));
    if (!res.ok) throw new Error(json?.message || `HTTP ${res.status}`);
    return (json as any) as { saved: any };
  } catch (err: any) {
    console.error('[API] /api/results/save error', err);
    throw err;
  } finally {
    console.groupEnd();
  }
}

export async function confirmCheckout(sessionId: string) {
  const userId = await getUserId();
  console.groupCollapsed('[API] POST /api/checkout/confirm');
  console.debug('headers.x-user-id', userId || '(none)');
  console.debug('sessionId', sessionId);
  try {
    const res = await fetch('/api/checkout/confirm', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(userId ? { 'X-User-Id': userId } : {}),
      },
      body: JSON.stringify({ sessionId }),
    });
    const text = await res.text();
    let json: any = null;
    try { json = JSON.parse(text); } catch {}
    console.debug('response.status', res.status);
    console.debug('response.body', json ?? text.slice(0, 500));
    if (!res.ok) throw new Error(json?.message || `HTTP ${res.status}`);
    return json as {
      ok: boolean;
      alreadyConfirmed?: boolean;
      credits_added?: number;
      new_balance?: number;
      new_lifetime?: number;
    };
  } catch (err) {
    console.error('[API] /api/checkout/confirm error', err);
    throw err;
  } finally {
    console.groupEnd();
  }
}

export async function shareSavedResult(id: string) {
  const userId = await getUserId();
  console.groupCollapsed('[API] POST /api/results-share');
  console.debug('headers.x-user-id', userId || '(none)');
  console.debug('id', id);
  try {
    const res = await fetch(`/api/results-share`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(userId ? { 'X-User-Id': userId } : {}),
      },
      body: JSON.stringify({ id }),
    });
    const text = await res.text();
    let json: any = null;
    try { json = JSON.parse(text); } catch {}
    console.debug('response.status', res.status);
    console.debug('response.body', json ?? text.slice(0, 500));
    if (!res.ok) throw new Error(json?.message || `HTTP ${res.status}`);
    return json as { public_slug: string };
  } catch (err) {
    console.error('[API] /api/results-share error', err);
    throw err;
  } finally {
    console.groupEnd();
  }
}

export async function unshareSavedResult(id: string) {
  const userId = await getUserId();
  console.groupCollapsed('[API] POST /api/results-unshare');
  console.debug('headers.x-user-id', userId || '(none)');
  console.debug('id', id);
  try {
    const res = await fetch(`/api/results-unshare`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(userId ? { 'X-User-Id': userId } : {}),
      },
      body: JSON.stringify({ id }),
    });
    const text = await res.text();
    let json: any = null;
    try { json = JSON.parse(text); } catch {}
    console.debug('response.status', res.status);
    console.debug('response.body', json ?? text.slice(0, 500));
    if (!res.ok) throw new Error(json?.message || `HTTP ${res.status}`);
    return json as { ok: boolean };
  } catch (err) {
    console.error('[API] /api/results-unshare error', err);
    throw err;
  } finally {
    console.groupEnd();
  }
}

export async function listAbTests() {
  const userId = await getUserId();
  console.groupCollapsed('[API] GET /api/ab-tests');
  console.debug('headers.x-user-id', userId || '(none)');
  try {
    const res = await fetch('/api/ab-tests', {
      headers: {
        ...(userId ? { 'X-User-Id': userId } : {}),
      },
    });
    const text = await res.text();
    let json: any = null;
    try { json = JSON.parse(text); } catch {}
    console.debug('response.status', res.status);
    console.debug('response.body', json ?? text.slice(0, 500));
    if (!res.ok) throw new Error(json?.message || `HTTP ${res.status}`);
    return json as { tests: any[] };
  } catch (err) {
    console.error('[API] /api/ab-tests error', err);
    throw err;
  } finally {
    console.groupEnd();
  }
}

export async function createAbTest(payload: { tool_name: string; variant_a: string; variant_b: string; input_summary?: string }) {
  const userId = await getUserId();
  console.groupCollapsed('[API] POST /api/ab-tests');
  console.debug('headers.x-user-id', userId || '(none)');
  console.debug('request.body', payload);
  try {
    const res = await fetch('/api/ab-tests', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(userId ? { 'X-User-Id': userId } : {}),
      },
      body: JSON.stringify(payload),
    });
    const text = await res.text();
    let json: any = null;
    try { json = JSON.parse(text); } catch {}
    console.debug('response.status', res.status);
    console.debug('response.body', json ?? text.slice(0, 500));
    if (!res.ok) throw new Error(json?.message || `HTTP ${res.status}`);
    return json as { test: any };
  } catch (err) {
    console.error('[API] /api/ab-tests error', err);
    throw err;
  } finally {
    console.groupEnd();
  }
}

export async function setAbTestWinner(id: string, winner: 'A' | 'B') {
  const userId = await getUserId();
  console.groupCollapsed('[API] POST /api/ab-tests/:id/winner');
  console.debug('headers.x-user-id', userId || '(none)');
  console.debug('id', id, 'winner', winner);
  try {
    const res = await fetch(`/api/ab-tests-winner`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(userId ? { 'X-User-Id': userId } : {}),
      },
      body: JSON.stringify({ id, winner }),
    });
    const text = await res.text();
    let json: any = null;
    try { json = JSON.parse(text); } catch {}
    console.debug('response.status', res.status);
    console.debug('response.body', json ?? text.slice(0, 500));
    if (!res.ok) throw new Error(json?.message || `HTTP ${res.status}`);
    return json as { test: any };
  } catch (err) {
    console.error('[API] /api/ab-tests/:id/winner error', err);
    throw err;
  } finally {
    console.groupEnd();
  }
}

export async function createCheckoutSession(amountUsd: number) {
  const userId = await getUserId();
  console.groupCollapsed('[API] POST /api/checkout/session');
  console.debug('headers.x-user-id', userId || '(none)');
  console.debug('amountUsd', amountUsd);
  try {
    const res = await fetch('/api/checkout/session', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(userId ? { 'X-User-Id': userId } : {}),
      },
      body: JSON.stringify({ amountUsd }),
    });
    const text = await res.text();
    let json: any = null;
    try { json = JSON.parse(text); } catch {}
    console.debug('response.status', res.status);
    console.debug('response.body', json ?? text.slice(0, 500));
    if (!res.ok) throw new Error(json?.message || `HTTP ${res.status}`);
    return json as { url: string };
  } catch (err) {
    console.error('[API] /api/checkout/session error', err);
    throw err;
  } finally {
    console.groupEnd();
  }
}

export async function createSubscriptionSession(planCode: string, billingInterval: 'monthly' | 'yearly') {
  const userId = await getUserId();
  // Get org ID manually since it is required in the body
  const organizationId = typeof window !== 'undefined' ? window.localStorage.getItem('writerai_active_team') : null;

  console.groupCollapsed('[API] POST /api/subscriptions/checkout-trial');
  console.debug('headers.x-user-id', userId || '(none)');
  console.debug('plan', planCode, 'billing', billingInterval, 'org', organizationId);
  try {
    const res = await fetch('/api/subscriptions/checkout-trial', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(userId ? { 'X-User-Id': userId } : {}),
      },
      body: JSON.stringify({ 
        organizationId, 
        plan: planCode, // Map planCode -> plan
        billing: billingInterval 
      }),
    });
    const text = await res.text();
    let json: any = null;
    try { json = JSON.parse(text); } catch {}
    console.debug('response.status', res.status);
    console.debug('response.body', json ?? text.slice(0, 500));
    if (!res.ok) throw new Error(json?.message || json?.error || `HTTP ${res.status}`);
    return json as { url: string };
  } catch (err: any) {
    console.error('[API] /api/subscriptions/checkout-trial error', err);
    throw err;
  } finally {
    console.groupEnd();
  }
}

export async function confirmSubscription(sessionId: string) {
  const userId = await getUserId();
  console.groupCollapsed('[API] POST /api/billing/subscription/confirm');
  console.debug('headers.x-user-id', userId || '(none)');
  console.debug('sessionId', sessionId);
  try {
    const res = await fetch('/api/billing/subscription/confirm', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(userId ? { 'X-User-Id': userId } : {}),
      },
      body: JSON.stringify({ sessionId }),
    });
    const text = await res.text();
    let json: any = null;
    try { json = JSON.parse(text); } catch {}
    console.debug('response.status', res.status);
    console.debug('response.body', json ?? text.slice(0, 500));
    if (!res.ok) throw new Error(json?.message || `HTTP ${res.status}`);
    return json as {
      ok: boolean;
      status?: string;
      plan_code?: string | null;
      trial_credits_added?: number;
      trial_end?: string | null;
    };
  } catch (err) {
    console.error('[API] /api/billing/subscription/confirm error', err);
    throw err;
  } finally {
    console.groupEnd();
  }
}

export async function getSavedResults() {
  const userId = await getUserId();
  console.groupCollapsed('[API] GET /api/results');
  console.debug('headers.x-user-id', userId || '(none)');
  try {
    const res = await fetch('/api/results', {
      headers: {
        ...(userId ? { 'X-User-Id': userId } : {}),
      },
    });
    const text = await res.text();
    let json: any = null;
    try { json = JSON.parse(text); } catch {}
    console.debug('response.status', res.status);
    console.debug('response.body', json ?? text.slice(0, 500));
    if (!res.ok) throw new Error(json?.message || `HTTP ${res.status}`);
    return (json as any) as { results: any[] };
  } catch (err: any) {
    console.error('[API] /api/results error', err);
    throw err;
  } finally {
    console.groupEnd();
  }
}

export async function deleteSavedResult(id: string) {
  const userId = await getUserId();
  console.groupCollapsed('[API] DELETE /api/results/:id');
  console.debug('headers.x-user-id', userId || '(none)');
  console.debug('id', id);
  try {
    const res = await fetch(`/api/results-delete`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(userId ? { 'X-User-Id': userId } : {}),
      },
      body: JSON.stringify({ id }),
    });
    const text = await res.text();
    let json: any = null;
    try { json = JSON.parse(text); } catch {}
    console.debug('response.status', res.status);
    console.debug('response.body', json ?? text.slice(0, 500));
    if (!res.ok) throw new Error(json?.message || `HTTP ${res.status}`);
    return (json as any) as { ok: boolean };
  } catch (err: any) {
    console.error('[API] /api/results/:id error', err);
    throw err;
  } finally {
    console.groupEnd();
  }
}

export async function getProfile() {
  const userId = await getUserId();
  console.groupCollapsed('[API] GET /api/profile');
  console.debug('headers.x-user-id', userId || '(none)');
  try {
    const res = await fetch('/api/profile', {
      headers: {
        ...(userId ? { 'X-User-Id': userId } : {}),
      },
    });
    const text = await res.text();
    let json: any = null;
    try { json = JSON.parse(text); } catch {}
    console.debug('response.status', res.status);
    console.debug('response.body', json ?? text.slice(0, 500));
    if (!res.ok) throw new Error(json?.message || `HTTP ${res.status}`);
    return json as {
      monthly_token_limit: number;
      tokens_used_this_month: number;
      credits_balance: number | null;
      credits_lifetime: number | null;
      email: string | null;
      subscription_tier: string | null;
    };
  } catch (err: any) {
    console.error('[API] /api/profile error', err);
    throw err;
  } finally {
    console.groupEnd();
  }
}

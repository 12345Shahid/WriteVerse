-- Zapier Subscriptions (Webhooks)
CREATE TABLE IF NOT EXISTS public.zapier_subscriptions (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
    event text NOT NULL, -- 'workflow_completed', 'lead_captured'
    target_url text NOT NULL,
    created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.zapier_subscriptions ENABLE ROW LEVEL SECURITY;

-- Users can manage their own subscriptions
CREATE POLICY "Users manage own hooks" ON public.zapier_subscriptions
    FOR ALL USING (auth.uid() = user_id);

-- OAuth Codes (Temporary storage for auth flow)
CREATE TABLE IF NOT EXISTS public.oauth_codes (
    code text PRIMARY KEY,
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
    client_id text NOT NULL,
    expires_at timestamptz NOT NULL,
    created_at timestamptz DEFAULT now()
);

-- OAuth Access Tokens
CREATE TABLE IF NOT EXISTS public.oauth_access_tokens (
    access_token text PRIMARY KEY,
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
    client_id text NOT NULL,
    expires_at timestamptz NOT NULL,
    created_at timestamptz DEFAULT now()
);

-- Fix missing organization_id in credits_transactions if table exists from partial run
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'credits_transactions'
        AND column_name = 'organization_id'
    ) THEN
        ALTER TABLE credits_transactions ADD COLUMN organization_id UUID;
    END IF;
END $$;

-- Ensure indexes exist
CREATE INDEX IF NOT EXISTS idx_credits_transactions_org_id ON credits_transactions(organization_id);

-- Re-run the table creations to ensure they exist (idempotent)
CREATE TABLE IF NOT EXISTS credit_deductions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID,
  amount_credits INTEGER,
  reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Re-define the function to ensure it matches table schema
CREATE OR REPLACE FUNCTION fulfill_checkout(session_id TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  tx_record RECORD;
  org_id UUID;
  new_balance BIGINT;
BEGIN
  -- 1. Find the transaction
  SELECT * INTO tx_record
  FROM credits_transactions
  WHERE stripe_session_id = session_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Transaction not found');
  END IF;

  IF tx_record.status = 'completed' THEN
    RETURN jsonb_build_object('status', 'already_completed');
  END IF;

  -- 2. Determine Organization (default to user's primary org if not specified)
  IF tx_record.organization_id IS NULL THEN
     SELECT organization_id INTO org_id
     FROM organization_members
     WHERE user_id = tx_record.user_id
     ORDER BY created_at ASC
     LIMIT 1;
  ELSE
     org_id := tx_record.organization_id;
  END IF;

  IF org_id IS NULL THEN
    RETURN jsonb_build_object('error', 'No organization found for user');
  END IF;

  -- 3. Update Transaction Status
  UPDATE credits_transactions
  SET 
    status = 'completed',
    organization_id = org_id,
    updated_at = now()
  WHERE id = tx_record.id;

  -- 4. Add Credits to Organization Balance
  INSERT INTO organization_credits (organization_id, balance_credits)
  VALUES (org_id, tx_record.credits_added)
  ON CONFLICT (organization_id)
  DO UPDATE SET
    balance_credits = organization_credits.balance_credits + EXCLUDED.balance_credits,
    updated_at = now()
  RETURNING balance_credits INTO new_balance;

  RETURN jsonb_build_object(
    'status', 'success',
    'credits_added', tx_record.credits_added,
    'new_balance', new_balance,
    'organization_id', org_id
  );
END;
$$;

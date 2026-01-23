-- SQL57: Fix fulfill_checkout to auto-create organization if user doesn't have one
-- Run this in Supabase SQL Editor

-- Drop and recreate the function with auto-org creation
CREATE OR REPLACE FUNCTION fulfill_checkout(session_id TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  tx_record RECORD;
  org_id UUID;
  new_balance BIGINT;
  user_email TEXT;
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
  IF tx_record.organization_id IS NOT NULL THEN
    org_id := tx_record.organization_id;
  ELSE
    -- Try to find existing organization membership
    SELECT om.organization_id INTO org_id
    FROM organization_members om
    WHERE om.user_id = tx_record.user_id
    ORDER BY om.created_at ASC
    LIMIT 1;
    
    -- If no organization found, auto-create one for the user
    IF org_id IS NULL THEN
      -- Get user email for naming the workspace
      SELECT email INTO user_email FROM auth.users WHERE id = tx_record.user_id;
      IF user_email IS NULL THEN
        user_email := 'User';
      END IF;
      
      -- Create a personal workspace
      INSERT INTO organizations (name, seat_limit)
      VALUES (split_part(user_email, '@', 1) || '''s Workspace', 1)
      RETURNING id INTO org_id;
      
      -- Add user as owner of this organization
      INSERT INTO organization_members (organization_id, user_id, role)
      VALUES (org_id, tx_record.user_id, 'owner');
      
      -- Initialize organization credits
      INSERT INTO organization_credits (organization_id, balance_credits)
      VALUES (org_id, 0)
      ON CONFLICT (organization_id) DO NOTHING;
    END IF;
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

-- Ensure RLS doesn't block the function
GRANT EXECUTE ON FUNCTION fulfill_checkout(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION fulfill_checkout(TEXT) TO service_role;

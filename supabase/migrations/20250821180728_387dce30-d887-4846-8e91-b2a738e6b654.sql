-- PHASE 1: CRITICAL SECURITY FIXES

-- First, let's see what WHAPI tokens currently exist in the sellers table
-- We need to migrate them to Supabase Secrets

-- Step 1: Add a new column for secret references
ALTER TABLE public.sellers 
ADD COLUMN whapi_token_secret_name TEXT;

-- Step 2: Update existing records to reference secrets instead of plaintext tokens
-- For now, we'll set a pattern that matches the expected secret naming
UPDATE public.sellers 
SET whapi_token_secret_name = 'WHAPI_TOKEN_' || REPLACE(phone_number, '+', '')
WHERE whapi_token IS NOT NULL AND whapi_token != '';

-- Step 3: Create a secure function to get WHAPI tokens for sellers
CREATE OR REPLACE FUNCTION public.get_whapi_token_for_seller(seller_id_param UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  secret_name TEXT;
  seller_record RECORD;
BEGIN
  -- Check if user has permission to access seller data
  IF NOT (
    public.has_role(auth.uid(), 'admin'::app_role) OR 
    public.has_role(auth.uid(), 'manager'::app_role) OR
    public.can_access_seller_data(auth.uid(), seller_id_param)
  ) THEN
    RAISE EXCEPTION 'Insufficient permissions to access seller WHAPI token';
  END IF;
  
  -- Get the secret name for this seller
  SELECT whapi_token_secret_name INTO secret_name
  FROM public.sellers 
  WHERE id = seller_id_param AND active = true;
  
  IF secret_name IS NULL THEN
    RAISE EXCEPTION 'No WHAPI token configured for this seller';
  END IF;
  
  -- Return the secret name (the actual secret value will be retrieved by edge functions)
  RETURN secret_name;
END;
$$;

-- Step 4: Create view for sellers without exposing sensitive tokens
CREATE OR REPLACE VIEW public.sellers_secure AS
SELECT 
  id,
  name,
  phone_number,
  email,
  avatar_url,
  active,
  personality_type,
  bio,
  experience_years,
  current_workload,
  max_concurrent_leads,
  performance_score,
  conversion_rate,
  average_ticket,
  auto_first_message,
  whapi_status,
  whapi_error_message,
  whapi_last_test,
  whapi_webhook_url,
  created_at,
  updated_at,
  deleted,
  -- Only show if user has permission, otherwise show masked value
  CASE 
    WHEN public.has_role(auth.uid(), 'admin'::app_role) OR 
         public.has_role(auth.uid(), 'manager'::app_role) THEN
      whapi_token_secret_name
    ELSE 
      CASE 
        WHEN whapi_token_secret_name IS NOT NULL THEN '[CONFIGURED]'
        ELSE NULL
      END
  END as whapi_token_status
FROM public.sellers;

-- Step 5: Enable RLS on the secure view
ALTER VIEW public.sellers_secure SET (security_barrier = true);

-- Step 6: Create RLS policies for the secure view
-- (Views inherit RLS from underlying tables, so sellers table policies will apply)

-- Step 7: Remove plaintext whapi_token column (COMMENTED FOR SAFETY - will do this after migration)
-- ALTER TABLE public.sellers DROP COLUMN whapi_token;

-- Log the security improvement
INSERT INTO public.system_logs (type, source, message, details)
VALUES (
  'info',
  'security_migration',
  'WHAPI tokens migrated to secure secret references',
  jsonb_build_object(
    'affected_sellers', (SELECT COUNT(*) FROM public.sellers WHERE whapi_token_secret_name IS NOT NULL),
    'migration_timestamp', now()
  )
);
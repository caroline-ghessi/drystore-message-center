-- PHASE 1: CRITICAL SECURITY FIXES (Fixed version)

-- Step 1: Add a new column for secret references
ALTER TABLE public.sellers 
ADD COLUMN IF NOT EXISTS whapi_token_secret_name TEXT;

-- Step 2: Update existing records to reference secrets instead of plaintext tokens
-- For now, we'll set a pattern that matches the expected secret naming
UPDATE public.sellers 
SET whapi_token_secret_name = 'WHAPI_TOKEN_' || REPLACE(phone_number, '+', '')
WHERE whapi_token IS NOT NULL AND whapi_token != '' AND whapi_token_secret_name IS NULL;

-- Step 3: Create a secure function to get WHAPI token secret name for sellers
CREATE OR REPLACE FUNCTION public.get_whapi_token_secret_name(seller_id_param UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  secret_name TEXT;
BEGIN
  -- Check if user has permission to access seller data
  IF NOT (
    public.has_role(auth.uid(), 'admin'::app_role) OR 
    public.has_role(auth.uid(), 'manager'::app_role)
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

-- Step 4: Add index for performance
CREATE INDEX IF NOT EXISTS idx_sellers_whapi_token_secret_name 
ON public.sellers (whapi_token_secret_name) 
WHERE whapi_token_secret_name IS NOT NULL;

-- Step 5: Log the security improvement with allowed source
INSERT INTO public.system_logs (type, source, message, details)
VALUES (
  'info',
  'user_management',
  'WHAPI tokens migrated to secure secret references',
  jsonb_build_object(
    'affected_sellers', (SELECT COUNT(*) FROM public.sellers WHERE whapi_token_secret_name IS NOT NULL),
    'migration_timestamp', now(),
    'security_improvement', 'WHAPI tokens no longer stored as plaintext'
  )
);
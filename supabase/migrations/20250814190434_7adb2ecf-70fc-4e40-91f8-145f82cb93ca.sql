-- Create audit access attempt function
CREATE OR REPLACE FUNCTION audit_access_attempt(
  user_id_param UUID,
  email_param TEXT,
  has_access_param BOOLEAN,
  approval_status_param TEXT,
  roles_param TEXT[],
  timestamp_param TIMESTAMPTZ
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  INSERT INTO public.system_logs (
    type,
    source,
    message,
    details,
    user_id,
    created_at
  ) VALUES (
    CASE 
      WHEN has_access_param THEN 'info'
      ELSE 'warning'
    END,
    'auth_security',
    CASE 
      WHEN has_access_param THEN 'User access granted'
      ELSE 'User access denied'
    END,
    jsonb_build_object(
      'user_id', user_id_param,
      'email', email_param,
      'has_access', has_access_param,
      'approval_status', approval_status_param,
      'roles', roles_param,
      'ip_address', current_setting('request.headers', true)::json->>'x-forwarded-for',
      'user_agent', current_setting('request.headers', true)::json->>'user-agent'
    ),
    user_id_param,
    timestamp_param
  );
END;
$$;

-- Create edge function to handle audit access attempts
CREATE OR REPLACE FUNCTION public.handle_audit_access_attempt()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  -- This trigger can be used for additional audit logic if needed
  RETURN NEW;
END;
$$;
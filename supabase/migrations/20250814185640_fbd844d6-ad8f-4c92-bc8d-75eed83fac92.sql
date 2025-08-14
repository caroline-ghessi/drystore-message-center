-- Phase 2: Fix remaining security definer issues and add final security enhancements

-- Fix function search paths that don't have SET search_path
ALTER FUNCTION public.get_user_role_safe(uuid) SET search_path = 'public';
ALTER FUNCTION public.can_access_customer_data(uuid) SET search_path = 'public';
ALTER FUNCTION public.mask_phone_number(text, app_role) SET search_path = 'public';

-- Create enhanced authentication settings
-- Note: These settings need to be applied through Supabase dashboard:
-- 1. Set OTP expiry to 300 seconds (5 minutes) in Auth > Settings
-- 2. Enable leaked password protection in Auth > Settings

-- Create admin user creation approval system
CREATE TABLE IF NOT EXISTS public.user_registrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  requested_role app_role DEFAULT 'operator',
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  requested_at timestamp with time zone DEFAULT now(),
  approved_by uuid REFERENCES auth.users(id),
  approved_at timestamp with time zone,
  metadata jsonb DEFAULT '{}'::jsonb
);

-- Enable RLS on user registrations
ALTER TABLE public.user_registrations ENABLE ROW LEVEL SECURITY;

-- Only admins can manage user registrations
CREATE POLICY "admins_can_manage_user_registrations" 
ON public.user_registrations 
FOR ALL 
USING (has_role(auth.uid(), 'admin'::app_role));

-- Create function to handle new user approval workflow
CREATE OR REPLACE FUNCTION public.request_user_access(
  user_email text,
  requested_role_param app_role DEFAULT 'operator'
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
DECLARE
  registration_id uuid;
BEGIN
  -- Insert registration request
  INSERT INTO public.user_registrations (email, requested_role)
  VALUES (user_email, requested_role_param)
  RETURNING id INTO registration_id;
  
  -- Log the request
  INSERT INTO public.system_logs (type, source, message, details)
  VALUES (
    'info',
    'user_management',
    'New user access requested',
    jsonb_build_object(
      'email', user_email,
      'requested_role', requested_role_param,
      'registration_id', registration_id
    )
  );
  
  RETURN registration_id;
END;
$function$;

-- Create function to approve user access
CREATE OR REPLACE FUNCTION public.approve_user_access(
  registration_id_param uuid,
  approve boolean DEFAULT true
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
DECLARE
  registration_record record;
BEGIN
  -- Check if caller is admin
  IF NOT has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Only admins can approve user access';
  END IF;
  
  -- Get registration record
  SELECT * INTO registration_record
  FROM public.user_registrations
  WHERE id = registration_id_param AND status = 'pending';
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Registration not found or already processed';
  END IF;
  
  -- Update registration status
  UPDATE public.user_registrations
  SET 
    status = CASE WHEN approve THEN 'approved' ELSE 'rejected' END,
    approved_by = auth.uid(),
    approved_at = now()
  WHERE id = registration_id_param;
  
  -- If approved, create user role
  IF approve THEN
    INSERT INTO public.user_roles (user_id, role)
    SELECT 
      u.id,
      registration_record.requested_role
    FROM auth.users u
    WHERE u.email = registration_record.email
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;
  
  -- Log the approval/rejection
  INSERT INTO public.system_logs (type, source, message, details)
  VALUES (
    'info',
    'user_management',
    'User access ' || CASE WHEN approve THEN 'approved' ELSE 'rejected' END,
    jsonb_build_object(
      'email', registration_record.email,
      'requested_role', registration_record.requested_role,
      'approved_by', auth.uid(),
      'registration_id', registration_id_param
    )
  );
  
  RETURN true;
END;
$function$;

-- Create data retention policy function
CREATE OR REPLACE FUNCTION public.cleanup_old_data()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
DECLARE
  deleted_count integer := 0;
BEGIN
  -- Delete old system logs (older than 6 months)
  DELETE FROM public.system_logs 
  WHERE created_at < now() - interval '6 months';
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  
  -- Delete old webhook logs (older than 3 months)
  DELETE FROM public.webhook_logs 
  WHERE created_at < now() - interval '3 months';
  
  -- Delete old whapi logs (older than 6 months)
  DELETE FROM public.whapi_logs 
  WHERE created_at < now() - interval '6 months';
  
  -- Delete old audit logs (older than 2 years)
  DELETE FROM public.audit_logs 
  WHERE created_at < now() - interval '2 years';
  
  -- Log cleanup activity
  INSERT INTO public.system_logs (type, source, message, details)
  VALUES (
    'info',
    'data_retention',
    'Data cleanup completed',
    jsonb_build_object('deleted_logs_count', deleted_count)
  );
  
  RETURN deleted_count;
END;
$function$;
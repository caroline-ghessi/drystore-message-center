CREATE OR REPLACE FUNCTION public.log_admin_action()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  -- Log when admins make sensitive changes
  IF has_role(auth.uid(), 'admin'::app_role) THEN
    INSERT INTO public.system_logs (
      type,
      source,
      message,
      details,
      user_id
    ) VALUES (
      'info',
      'auth_security',
      'Admin action: ' || TG_OP || ' on ' || TG_TABLE_NAME,
      jsonb_build_object(
        'table_name', TG_TABLE_NAME,
        'operation', TG_OP,
        'record_id', COALESCE(NEW.id, OLD.id),
        'admin_user_id', auth.uid(),
        'timestamp', now()
      ),
      auth.uid()
    );
  END IF;
  
  RETURN COALESCE(NEW, OLD);
END;
$function$
-- Fix remaining security issues from linter

-- 1. Fix remaining functions that don't have search_path set
CREATE OR REPLACE FUNCTION public.audit_trigger_function()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF TG_OP = 'DELETE' THEN
    INSERT INTO public.audit_logs (user_id, action, table_name, record_id, old_values)
    VALUES (auth.uid(), TG_OP, TG_TABLE_NAME, OLD.id, to_jsonb(OLD));
    RETURN OLD;
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO public.audit_logs (user_id, action, table_name, record_id, old_values, new_values)
    VALUES (auth.uid(), TG_OP, TG_TABLE_NAME, NEW.id, to_jsonb(OLD), to_jsonb(NEW));
    RETURN NEW;
  ELSIF TG_OP = 'INSERT' THEN
    INSERT INTO public.audit_logs (user_id, action, table_name, record_id, new_values)
    VALUES (auth.uid(), TG_OP, TG_TABLE_NAME, NEW.id, to_jsonb(NEW));
    RETURN NEW;
  END IF;
  RETURN NULL;
END;
$function$;

CREATE OR REPLACE FUNCTION public.set_message_direction()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Se o token é do Rodrigo Bot
  IF NEW.token_secret_name = 'WHAPI_TOKEN_5551981155622' THEN
    NEW.direction = 'bot_to_seller';
  -- Se o phone_from é do Rodrigo Bot (número completo ou sem 9)
  ELSIF NEW.phone_from IN ('5551981155622', '555181155622') THEN
    NEW.direction = 'bot_to_seller';
  -- Se o número de destino não tem @s.whatsapp.net (formato cliente)
  ELSIF NEW.phone_to NOT LIKE '%@s.whatsapp.net' THEN
    NEW.direction = 'seller_to_customer';
  -- Se o número de origem não tem @s.whatsapp.net (formato cliente)
  ELSIF NEW.phone_from NOT LIKE '%@s.whatsapp.net' THEN
    NEW.direction = 'customer_to_seller';
  ELSE
    NEW.direction = 'unknown';
  END IF;
  
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.request_user_access(user_email text, requested_role_param app_role DEFAULT 'operator'::app_role)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
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

CREATE OR REPLACE FUNCTION public.approve_user_access(registration_id_param uuid, approve boolean DEFAULT true)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
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

CREATE OR REPLACE FUNCTION public.cleanup_old_data()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
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

CREATE OR REPLACE FUNCTION public.get_dashboard_stats()
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  stats JSON;
BEGIN
  SELECT json_build_object(
    'total_conversations', COUNT(DISTINCT c.id),
    'active_conversations', COUNT(DISTINCT CASE WHEN c.status != 'finished' THEN c.id END),
    'total_leads', COUNT(DISTINCT l.id),
    'active_leads', COUNT(DISTINCT CASE WHEN l.status = 'attending' THEN l.id END),
    'total_sales', COUNT(DISTINCT CASE WHEN l.generated_sale = true THEN l.id END),
    'total_revenue', COALESCE(SUM(CASE WHEN l.generated_sale = true THEN l.sale_value END), 0),
    'active_sellers', COUNT(DISTINCT CASE WHEN s.active = true THEN s.id END)
  ) INTO stats
  FROM public.conversations c
  LEFT JOIN public.leads l ON c.id = l.conversation_id
  LEFT JOIN public.sellers s ON s.active = true;
  
  RETURN stats;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_seller_conversations(seller_uuid uuid)
 RETURNS TABLE(conversation_id uuid, customer_name text, phone_number text, last_message text, last_message_at timestamp with time zone, status text, total_messages bigint)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
  SELECT 
    c.id,
    c.customer_name,
    c.phone_number,
    cv.last_message,
    cv.last_message_at,
    l.status,
    cv.total_messages
  FROM public.conversations c
  JOIN public.leads l ON c.id = l.conversation_id
  JOIN public.conversations_with_last_message cv ON c.id = cv.id
  WHERE l.seller_id = seller_uuid
  ORDER BY cv.last_message_at DESC;
END;
$function$;

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.process_message_queue()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  queue_record RECORD;
  processed_count INTEGER := 0;
BEGIN
  FOR queue_record IN 
    SELECT * FROM public.message_queue 
    WHERE status = 'waiting' AND scheduled_for <= NOW()
    ORDER BY scheduled_for
  LOOP
    -- Aqui seria implementada a lógica de envio para o bot
    -- Por enquanto, apenas marcar como processado
    UPDATE public.message_queue 
    SET status = 'sent', processed_at = NOW()
    WHERE id = queue_record.id;
    
    processed_count := processed_count + 1;
  END LOOP;
  
  RETURN processed_count;
END;
$function$;

CREATE OR REPLACE FUNCTION public.update_whapi_configurations_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$function$;
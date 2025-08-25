-- Corrigir função para usar source válido na constraint
CREATE OR REPLACE FUNCTION public.get_integration_config_secure(integration_type_param text)
RETURNS TABLE(config jsonb, active boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Log do acesso para monitoramento usando source válido
  INSERT INTO public.system_logs (type, source, message, details)
  VALUES (
    'info',
    'dify', -- usando source válido da constraint
    'Edge function accessing integration config',
    jsonb_build_object(
      'integration_type', integration_type_param,
      'timestamp', now(),
      'function_call', 'get_integration_config_secure'
    )
  );

  -- Retornar configuração da integração
  RETURN QUERY
  SELECT i.config, i.active
  FROM public.integrations i
  WHERE i.type = integration_type_param AND i.active = true
  LIMIT 1;
END;
$function$;

-- Atualizar função de logging de RLS para usar source válido
CREATE OR REPLACE FUNCTION public.log_rls_access_failure(
  table_name_param text,
  operation_param text,
  details_param jsonb DEFAULT '{}'::jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.system_logs (type, source, message, details)
  VALUES (
    'warning',
    'security', -- usando source válido da constraint
    'RLS access failure detected',
    jsonb_build_object(
      'table_name', table_name_param,
      'operation', operation_param,
      'timestamp', now(),
      'details', details_param
    )
  );
END;
$function$;
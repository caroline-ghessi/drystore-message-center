-- Criar função segura para edge functions acessarem configurações de integração
CREATE OR REPLACE FUNCTION public.get_integration_config_secure(integration_type_param text)
RETURNS TABLE(config jsonb, active boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Log do acesso para monitoramento
  INSERT INTO public.system_logs (type, source, message, details)
  VALUES (
    'info',
    'integration_access',
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

-- Atualizar política RLS da tabela integrations para permitir acesso via função segura
DROP POLICY IF EXISTS "admins_can_manage_integrations" ON public.integrations;

-- Nova política que permite acesso direto apenas para admins
CREATE POLICY "admins_can_manage_integrations" 
ON public.integrations 
FOR ALL 
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- Política adicional para permitir SELECT via função segura (para edge functions)
CREATE POLICY "secure_function_access_integrations"
ON public.integrations
FOR SELECT
TO service_role
USING (true);

-- Criar função para monitorar falhas de RLS em edge functions
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
    'rls_security',
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
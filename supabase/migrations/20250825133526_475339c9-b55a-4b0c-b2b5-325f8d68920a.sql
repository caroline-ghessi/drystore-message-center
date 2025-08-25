-- Política para permitir edge functions (service role) inserir mensagens
CREATE POLICY "edge_functions_can_insert_messages" 
ON public.messages 
FOR INSERT 
WITH CHECK (
  -- Permitir se for service role (edge functions)
  current_setting('role', true) = 'service_role' OR
  -- Permitir para admins e managers
  (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role))
);

-- Política para permitir edge functions atualizar message_queue
CREATE POLICY "edge_functions_can_update_message_queue" 
ON public.message_queue 
FOR UPDATE 
USING (
  -- Permitir se for service role (edge functions)
  current_setting('role', true) = 'service_role' OR
  -- Permitir para usuários autenticados
  auth.uid() IS NOT NULL
);

-- Log da correção
INSERT INTO public.system_logs (type, source, message, details)
VALUES (
  'info',
  'security',
  'Políticas RLS corrigidas para edge functions',
  jsonb_build_object(
    'action', 'rls_fix_edge_functions',
    'timestamp', now()
  )
);
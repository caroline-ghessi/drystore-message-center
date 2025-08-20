-- Criar cron job para processar fila de mensagens do Dify automaticamente
-- Este cron job executa a cada 30 segundos para garantir processamento rápido

-- Primeiro, configurar o cron para executar o processador da fila de mensagens
select cron.schedule(
  'process-dify-message-queue',
  '*/30 * * * * *', -- A cada 30 segundos
  $$
  select
    net.http_post(
        url:='https://groqsnnytvjabgeaekkw.supabase.co/functions/v1/process-message-queue',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imdyb3Fzbm55dHZqYWJnZWFla2t3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI1OTU3ODcsImV4cCI6MjA2ODE3MTc4N30.HWBJVbSSShx1P8bqa4dvO9jCsCDybt2rhgPPBy8zEVs"}'::jsonb,
        body:='{"automated": true}'::jsonb
    ) as request_id;
  $$
);

-- Adicionar configurações para o sistema de agrupamento de mensagens
INSERT INTO public.settings (key, value, description) VALUES 
  ('dify_message_grouping_time', '"60"', 'Tempo em segundos para agrupar mensagens do cliente antes de enviar para o Dify')
ON CONFLICT (key) DO UPDATE SET 
  value = EXCLUDED.value,
  updated_at = now();

INSERT INTO public.settings (key, value, description) VALUES 
  ('dify_queue_processing_interval', '"30"', 'Intervalo em segundos para processar a fila de mensagens')
ON CONFLICT (key) DO UPDATE SET 
  value = EXCLUDED.value,
  updated_at = now();

-- Criar função para limpar registros antigos da fila de mensagens (limpeza automática)
CREATE OR REPLACE FUNCTION public.cleanup_message_queue()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Remove mensagens processadas com mais de 24 horas
  DELETE FROM public.message_queue 
  WHERE status IN ('sent', 'error', 'skipped') 
    AND processed_at < now() - interval '24 hours';
  
  -- Remove mensagens abandonadas (mais de 2 horas esperando)
  DELETE FROM public.message_queue 
  WHERE status = 'waiting' 
    AND created_at < now() - interval '2 hours';
    
  -- Log da limpeza
  INSERT INTO public.system_logs (type, source, message, details)
  VALUES (
    'info',
    'queue_cleanup',
    'Limpeza automática da fila de mensagens executada',
    jsonb_build_object('timestamp', now())
  );
END;
$function$;

-- Cron job para limpeza da fila (executa a cada hora)
select cron.schedule(
  'cleanup-message-queue',
  '0 * * * *', -- A cada hora
  $$
  SELECT public.cleanup_message_queue();
  $$
);
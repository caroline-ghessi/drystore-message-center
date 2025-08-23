-- Criar funções auxiliares para o sistema de correção

-- Função para remover cron jobs de message queue
CREATE OR REPLACE FUNCTION public.remove_message_queue_crons()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Remove todos os cron jobs relacionados ao processamento de mensagens
  PERFORM cron.unschedule(jobid) 
  FROM cron.job 
  WHERE command LIKE '%process-message-queue%';
  
  -- Log da remoção
  INSERT INTO public.system_logs (type, source, message, details)
  VALUES (
    'info',
    'cron_management',
    'Cron jobs de message queue removidos',
    jsonb_build_object('timestamp', now())
  );
END;
$$;

-- Função para criar cron job corretamente
CREATE OR REPLACE FUNCTION public.create_message_queue_cron()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Criar novo cron job com configuração otimizada
  PERFORM cron.schedule(
    'process-message-queue-fixed',
    '*/30 * * * * *', -- A cada 30 segundos
    $$
    SELECT net.http_post(
      url := 'https://groqsnnytvjabgeaekkw.supabase.co/functions/v1/process-message-queue',
      headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imdyb3Fzbm55dHZqYWJnZWFla2t3Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MjU5NTc4NywiZXhwIjoyMDY4MTcxNzg3fQ.tqnUGUxO9cFBBu7dOYYAGy8b5n4MlLgdNJJvI7ht3HI"}'::jsonb,
      body := '{"auto_run": true, "timestamp": "' || now() || '"}'::jsonb
    ) AS request_id;
    $$
  );
  
  -- Log da criação
  INSERT INTO public.system_logs (type, source, message, details)
  VALUES (
    'info',
    'cron_management',
    'Novo cron job para message queue criado',
    jsonb_build_object(
      'schedule', '*/30 * * * * *',
      'timestamp', now()
    )
  );
END;
$$;
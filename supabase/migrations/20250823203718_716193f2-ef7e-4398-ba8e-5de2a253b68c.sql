-- Atualizar a função create_message_queue_cron para usar o service role key correto
CREATE OR REPLACE FUNCTION public.create_message_queue_cron()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  job_command text;
  service_key text;
BEGIN
  -- Usar a chave de serviço do ambiente
  service_key := current_setting('app.settings.supabase_service_role_key', true);
  
  -- Se não estiver definida, usar a chave padrão (menos seguro, mas funcional)
  IF service_key IS NULL OR service_key = '' THEN
    service_key := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imdyb3Fzbm55dHZqYWJnZWFla2t3Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MjU5NTc4NywiZXhwIjoyMDY4MTcxNzg3fQ.tqnUGUxO9cFBBu7dOYYAGy8b5n4MlLgdNJJvI7ht3HI';
  END IF;

  -- Montar comando do cron job com a chave correta
  job_command := 'SELECT net.http_post(' ||
    'url := ''https://groqsnnytvjabgeaekkw.supabase.co/functions/v1/process-message-queue'', ' ||
    'headers := ''{"Content-Type": "application/json", "Authorization": "Bearer ' || service_key || '"}'', ' ||  
    'body := ''{"auto_run": true}'') AS request_id;';

  -- Criar novo cron job
  PERFORM cron.schedule(
    'process-message-queue-fixed',
    '*/30 * * * * *',
    job_command
  );
  
  -- Log da criação
  INSERT INTO public.system_logs (type, source, message, details)
  VALUES (
    'info',
    'cron_management',
    'Novo cron job para message queue criado com service role key',
    jsonb_build_object(
      'schedule', '*/30 * * * * *',
      'timestamp', now()
    )
  );
END;
$function$;
-- Ajustar cron jobs para evitar processamento duplicado

-- Remover cron job antigo de processamento frequente de mensagens pendentes
SELECT cron.unschedule(jobname) 
FROM cron.job 
WHERE jobname = 'process-pending-messages';

-- Recriar com frequência menor (apenas para backup de mensagens que falharam)
SELECT cron.schedule(
    'process-pending-messages-backup',
    '*/5 * * * *', -- A cada 5 minutos (menos frequente)
    $$
    SELECT net.http_post(
        url:='https://groqsnnytvjabgeaekkw.supabase.co/functions/v1/process-pending-messages',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imdyb3Fzbm55dHZqYWJnZWFla2t3Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MjU5NTc4NywiZXhwIjoyMDY4MTcxNzg3fQ.tqnUGUxO9cFBBu7dOYYAGy8b5n4MlLgdNJJvI7ht3HI"}'::jsonb,
        body:='{"auto_run": true}'::jsonb
    ) as request_id;
    $$
);

-- Log da correção
INSERT INTO public.system_logs (type, source, message, details)
VALUES (
  'info',
  'whapi',
  'Sistema de mensagens duplicadas corrigido',
  jsonb_build_object(
    'buffer_time_reduced', '30 segundos',
    'deduplication_enabled', true,
    'pending_messages_frequency', '5 minutos',
    'primary_processing', 'dify-process-messages com buffer',
    'timestamp', now()
  )
);
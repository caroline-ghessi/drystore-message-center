-- Passo 1: Remoção segura de todos os cron jobs (ignorando erros)
DO $$
DECLARE
    job_record RECORD;
BEGIN
    -- Remove todos os jobs relacionados ao processamento de mensagens
    FOR job_record IN 
        SELECT jobname FROM cron.job 
        WHERE command LIKE '%process%message%'
    LOOP
        BEGIN
            PERFORM cron.unschedule(job_record.jobname);
        EXCEPTION WHEN OTHERS THEN
            -- Ignora erros de jobs que já foram removidos
            NULL;
        END;
    END LOOP;
END $$;

-- Passo 2: Criar APENAS um cron job unificado (a cada 3 minutos)
SELECT cron.schedule(
  'process-messages-unified-v2',
  '*/3 * * * *', -- A cada 3 minutos
  $$
  SELECT net.http_post(
    url := 'https://groqsnnytvjabgeaekkw.supabase.co/functions/v1/process-pending-messages',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imdyb3Fzbm55dHZqYWJnZWFla2t3Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MjU5NTc4NywiZXhwIjoyMDY4MTcxNzg3fQ.tqnUGUxO9cFBBu7dOYYAGy8b5n4MlLgdNJJvI7ht3HI"}'::jsonb,
    body := '{"auto_run": true}'::jsonb
  ) as request_id;
  $$
);

-- Passo 3: Log da reorganização usando source válido
INSERT INTO public.system_logs (type, source, message, details)
VALUES (
  'info',
  'dify', -- usando source válido
  'Sistema de cron jobs reorganizado - eliminação de duplicações',
  jsonb_build_object(
    'action', 'unified_cron_job_creation',
    'new_job', 'process-messages-unified-v2',
    'interval', '3 minutes',
    'old_jobs_removed', true,
    'timestamp', now()
  )
);
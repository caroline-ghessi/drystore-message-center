-- LIMPEZA SEGURA DE TODOS OS CRON JOBS RELACIONADOS A MENSAGENS
DO $$
DECLARE
    job_record RECORD;
BEGIN
    -- Remove TODOS os jobs relacionados ao processamento de mensagens de forma segura
    FOR job_record IN 
        SELECT jobname FROM cron.job 
        WHERE command LIKE '%process%message%' OR jobname LIKE '%process%message%'
    LOOP
        BEGIN
            PERFORM cron.unschedule(job_record.jobname);
            RAISE NOTICE 'Removido job: %', job_record.jobname;
        EXCEPTION WHEN OTHERS THEN
            RAISE NOTICE 'Job % já removido ou erro: %', job_record.jobname, SQLERRM;
        END;
    END LOOP;
END $$;

-- Criar APENAS o novo job unificado (se não existir)
DO $$
BEGIN
    -- Verifica se o job unificado já existe
    IF NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'process-messages-unified-final') THEN
        PERFORM cron.schedule(
          'process-messages-unified-final',
          '*/3 * * * *', -- A cada 3 minutos
          $$
          SELECT net.http_post(
            url := 'https://groqsnnytvjabgeaekkw.supabase.co/functions/v1/process-pending-messages',
            headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imdyb3Fzbm55dHZqYWJnZWFla2t3Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MjU5NTc4NywiZXhwIjoyMDY4MTcxNzg3fQ.tqnUGUxO9cFBBu7dOYYAGy8b5n4MlLgdNJJvI7ht3HI"}'::jsonb,
            body := '{"auto_run": true}'::jsonb
          ) as request_id;
          $$
        );
        RAISE NOTICE 'Criado job unificado: process-messages-unified-final';
    END IF;
END $$;

-- Log da limpeza final
INSERT INTO public.system_logs (type, source, message, details)
VALUES (
  'info',
  'dify',
  'Limpeza completa de cron jobs - sistema unificado estabelecido',
  jsonb_build_object(
    'action', 'complete_cleanup_and_unification',
    'active_job_only', 'process-messages-unified-final',
    'interval', '3_minutes',
    'timestamp', now(),
    'status', 'single_job_active'
  )
);
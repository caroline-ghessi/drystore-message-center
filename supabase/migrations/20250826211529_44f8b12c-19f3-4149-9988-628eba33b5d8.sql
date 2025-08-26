-- LIMPEZA DIRETA E EFICAZ DOS CRON JOBS
DO $$
DECLARE
    job_record RECORD;
    job_command TEXT;
BEGIN
    -- Remove TODOS os jobs relacionados ao processamento de mensagens
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
    
    -- Criar comando para o novo cron job
    job_command := 'SELECT net.http_post(' ||
                   'url := ''https://groqsnnytvjabgeaekkw.supabase.co/functions/v1/process-pending-messages'', ' ||
                   'headers := ''{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imdyb3Fzbm55dHZqYWJnZWFla2t3Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MjU5NTc4NywiZXhwIjoyMDY4MTcxNzg3fQ.tqnUGUxO9cFBBu7dOYYAGy8b5n4MlLgdNJJvI7ht3HI"}'', ' ||
                   'body := ''{"auto_run": true}'') as request_id;';

    -- Criar APENAS o novo job unificado
    PERFORM cron.schedule(
        'process-messages-unified-final',
        '*/3 * * * *',
        job_command
    );
    
    RAISE NOTICE 'Criado job unificado: process-messages-unified-final';
END $$;

-- Log da limpeza
INSERT INTO public.system_logs (type, source, message, details)
VALUES (
  'info',
  'dify',
  'Sistema de cron jobs completamente reorganizado',
  jsonb_build_object(
    'action', 'final_cron_cleanup',
    'single_active_job', 'process-messages-unified-final',
    'interval', '3 minutes',
    'duplications_eliminated', true,
    'timestamp', now()
  )
);
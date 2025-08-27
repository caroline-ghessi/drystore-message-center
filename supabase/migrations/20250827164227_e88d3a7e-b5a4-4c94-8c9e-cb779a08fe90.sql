-- LIMPEZA DEFINITIVA DOS CRON JOBS CONFLITANTES
-- Remove TODOS os jobs de processamento de mensagens conflitantes

DO $$
DECLARE
    job_record RECORD;
    jobs_removed INTEGER := 0;
BEGIN
    -- Listar e remover jobs conflitantes específicos
    FOR job_record IN 
        SELECT jobname FROM cron.job 
        WHERE jobname IN (
            'dify-process-messages-auto',
            'process-message-queue-active', 
            'process-messages-unified-final',
            'process-pending-messages-manual',
            'test-manual-process',
            'process-automatic-transfers',
            'process-message-queue-fixed',
            'process-pending-messages',
            'unified-message-processor'
        )
    LOOP
        PERFORM cron.unschedule(job_record.jobname);
        jobs_removed := jobs_removed + 1;
        
        INSERT INTO system_logs (type, source, message, details)
        VALUES (
            'info',
            'dify',
            'Cron job conflitante removido: ' || job_record.jobname,
            jsonb_build_object('job_name', job_record.jobname, 'timestamp', now())
        );
    END LOOP;
    
    -- Garantir que bot-dify-processor existe e é único
    PERFORM cron.unschedule('bot-dify-processor');
    
    -- Recriar bot-dify-processor como ÚNICO processador
    PERFORM cron.schedule(
        'bot-dify-processor',
        '*/2 * * * *',
        'SELECT net.http_post(
            url := ''https://groqsnnytvjabgeaekkw.supabase.co/functions/v1/dify-process-messages'',
            headers := ''{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imdyb3Fzbm55dHZqYWJnZWFla2t3Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MjU5NTc4NywiZXhwIjoyMDY4MTcxNzg3fQ.tqnUGUxO9cFBBu7dOYYAGy8b5n4MlLgdNJJvI7ht3HI"}'',
            body := ''{"source": "cron_bot_dify_processor", "auto_run": true}''
        ) AS request_id;'
    );
    
    -- Log final da limpeza definitiva
    INSERT INTO system_logs (type, source, message, details)
    VALUES (
        'success',
        'dify',
        '🎯 LIMPEZA DEFINITIVA CONCLUÍDA - Sistema unificado!',
        jsonb_build_object(
            'jobs_conflitantes_removidos', jobs_removed,
            'unico_processador_ativo', 'bot-dify-processor (a cada 2 minutos)',
            'funcao_processadora', 'dify-process-messages',
            'outros_jobs_mantidos', jsonb_build_array(
                'cleanup-message-queue (limpeza diária)',
                'monitor-whapi-pending-messages (apenas monitor)',
                'bot-dify-processor (ÚNICO processador)'
            ),
            'status_sistema', 'LIMPO E FUNCIONAL',
            'proxima_execucao', 'Em 2 minutos máximo',
            'timestamp', now()
        )
    );
    
    -- Verificar jobs ativos restantes
    INSERT INTO system_logs (type, source, message, details)
    VALUES (
        'info',
        'dify',
        'Jobs ativos após limpeza definitiva',
        (
            SELECT jsonb_agg(
                jsonb_build_object(
                    'job_name', jobname,
                    'schedule', schedule,
                    'command', LEFT(command, 100) || '...'
                )
            )
            FROM cron.job
            WHERE active = true
        )
    );
    
END $$;
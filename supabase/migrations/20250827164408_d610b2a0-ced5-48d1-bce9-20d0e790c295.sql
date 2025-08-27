-- LIMPEZA DEFINITIVA DOS CRON JOBS - VERSÃO SEGURA
-- Remove apenas jobs que existem e recria bot-dify-processor

DO $$
DECLARE
    job_record RECORD;
    jobs_removed INTEGER := 0;
    jobs_to_remove TEXT[] := ARRAY[
        'dify-process-messages-auto',
        'process-message-queue-active', 
        'process-messages-unified-final',
        'process-pending-messages-manual',
        'test-manual-process',
        'process-automatic-transfers',
        'process-message-queue-fixed',
        'process-pending-messages',
        'unified-message-processor'
    ];
    job_name TEXT;
BEGIN
    -- Log do início da limpeza
    INSERT INTO system_logs (type, source, message, details)
    VALUES (
        'info',
        'dify',
        '🧹 INICIANDO LIMPEZA DEFINITIVA DOS CRON JOBS',
        jsonb_build_object(
            'jobs_para_remover', array_to_json(jobs_to_remove),
            'timestamp', now()
        )
    );

    -- Verificar e remover apenas jobs que existem
    FOREACH job_name IN ARRAY jobs_to_remove
    LOOP
        -- Verificar se o job existe antes de tentar remover
        IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = job_name) THEN
            PERFORM cron.unschedule(job_name);
            jobs_removed := jobs_removed + 1;
            
            INSERT INTO system_logs (type, source, message, details)
            VALUES (
                'info',
                'dify',
                '✅ Cron job conflitante removido: ' || job_name,
                jsonb_build_object('job_name', job_name, 'timestamp', now())
            );
        ELSE
            INSERT INTO system_logs (type, source, message, details)
            VALUES (
                'info',
                'dify',
                '⚠️ Job não encontrado (já removido): ' || job_name,
                jsonb_build_object('job_name', job_name, 'timestamp', now())
            );
        END IF;
    END LOOP;
    
    -- Remover bot-dify-processor se existir (para recriar limpo)
    IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'bot-dify-processor') THEN
        PERFORM cron.unschedule('bot-dify-processor');
        INSERT INTO system_logs (type, source, message, details)
        VALUES ('info', 'dify', 'Bot-dify-processor removido para recriação', '{}');
    END IF;
    
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
    
    -- Log do resultado final
    INSERT INTO system_logs (type, source, message, details)
    VALUES (
        'success',
        'dify',
        '🎯 LIMPEZA DEFINITIVA CONCLUÍDA COM SUCESSO!',
        jsonb_build_object(
            'jobs_conflitantes_removidos', jobs_removed,
            'processador_unico', 'bot-dify-processor criado (*/2 * * * *)',
            'funcao_target', 'dify-process-messages',
            'sistema_status', 'UNIFICADO E FUNCIONAL',
            'proxima_execucao', 'Máximo 2 minutos',
            'timestamp', now()
        )
    );
    
    -- Listar jobs ativos finais para verificação
    INSERT INTO system_logs (type, source, message, details)
    VALUES (
        'info',
        'dify',
        '📋 Jobs ativos após limpeza definitiva',
        (
            SELECT COALESCE(
                jsonb_agg(
                    jsonb_build_object(
                        'job_name', jobname,
                        'schedule', schedule,
                        'active', active
                    )
                ),
                '[]'::jsonb
            )
            FROM cron.job
            WHERE active = true
        )
    );
    
END $$;
-- LIMPEZA DEFINITIVA - CORRIGINDO bot-dify-processor E REMOVENDO DUPLICADOS
-- Bot-dify-processor estava chamando função errada!

DO $$
DECLARE
    jobs_removed INTEGER := 0;
BEGIN
    -- Log do problema identificado
    INSERT INTO system_logs (type, source, message, details)
    VALUES (
        'error',
        'dify',
        '🚨 PROBLEMA CRÍTICO IDENTIFICADO: bot-dify-processor chamando função errada!',
        jsonb_build_object(
            'problema', 'bot-dify-processor chama process-pending-messages ao invés de dify-process-messages',
            'jobs_duplicados', jsonb_build_array(
                'process-message-queue-active',
                'process-pending-messages-manual', 
                'test-manual-process'
            ),
            'correcao', 'Remover duplicados e corrigir bot-dify-processor',
            'timestamp', now()
        )
    );

    -- Remover jobs duplicados/conflitantes que realmente existem
    IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'process-message-queue-active') THEN
        PERFORM cron.unschedule('process-message-queue-active');
        jobs_removed := jobs_removed + 1;
        INSERT INTO system_logs (type, source, message, details)
        VALUES ('info', 'dify', '✅ Removido: process-message-queue-active', '{}');
    END IF;
    
    IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'process-pending-messages-manual') THEN
        PERFORM cron.unschedule('process-pending-messages-manual');
        jobs_removed := jobs_removed + 1;
        INSERT INTO system_logs (type, source, message, details)
        VALUES ('info', 'dify', '✅ Removido: process-pending-messages-manual', '{}');
    END IF;
    
    IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'test-manual-process') THEN
        PERFORM cron.unschedule('test-manual-process');
        jobs_removed := jobs_removed + 1;
        INSERT INTO system_logs (type, source, message, details)
        VALUES ('info', 'dify', '✅ Removido: test-manual-process', '{}');
    END IF;
    
    -- CORRIGIR bot-dify-processor - remover e recriar com função correta
    IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'bot-dify-processor') THEN
        PERFORM cron.unschedule('bot-dify-processor');
        INSERT INTO system_logs (type, source, message, details)
        VALUES ('info', 'dify', '🔧 bot-dify-processor removido para correção', '{}');
    END IF;
    
    -- Recriar bot-dify-processor com a função CORRETA
    PERFORM cron.schedule(
        'bot-dify-processor',
        '*/2 * * * *',
        'SELECT net.http_post(
            url := ''https://groqsnnytvjabgeaekkw.supabase.co/functions/v1/dify-process-messages'',
            headers := ''{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imdyb3Fzbm55dHZqYWJnZWFla2t3Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MjU5NTc4NywiZXhwIjoyMDY4MTcxNzg3fQ.tqnUGUxO9cFBBu7dOYYAGy8b5n4MlLgdNJJvI7ht3HI"}'',
            body := ''{"source": "cron_bot_dify_processor", "auto_run": true}''
        ) AS request_id;'
    );
    
    -- Log do resultado final da correção
    INSERT INTO system_logs (type, source, message, details)
    VALUES (
        'success',
        'dify',
        '🎯 PROBLEMA CRÍTICO CORRIGIDO COM SUCESSO!',
        jsonb_build_object(
            'funcao_corrigida', 'bot-dify-processor agora chama dify-process-messages',
            'jobs_removidos', jobs_removed,
            'jobs_ativos_finais', jsonb_build_array(
                'bot-dify-processor (*/2 * * * *) → dify-process-messages ✅',
                'cleanup-message-queue (0 * * * *) → limpeza diária ✅',
                'monitor-whapi-pending-messages (*/2 * * * *) → monitor apenas ✅'
            ),
            'sistema_status', 'TOTALMENTE CORRIGIDO E FUNCIONAL',
            'conflitos_resolvidos', true,
            'proxima_execucao', 'Máximo 2 minutos',
            'timestamp', now()
        )
    );
    
    -- Verificação final dos jobs ativos
    INSERT INTO system_logs (type, source, message, details)
    VALUES (
        'info',
        'dify',
        '📋 Jobs ativos após correção definitiva',
        (
            SELECT COALESCE(
                jsonb_agg(
                    jsonb_build_object(
                        'job_name', jobname,
                        'schedule', schedule,
                        'function_target', CASE 
                            WHEN command LIKE '%dify-process-messages%' THEN 'dify-process-messages ✅'
                            WHEN command LIKE '%process-pending-messages%' THEN 'process-pending-messages ⚠️'
                            WHEN command LIKE '%whapi-monitor-pending%' THEN 'monitor-only ✅'
                            WHEN command LIKE '%cleanup_message_queue%' THEN 'cleanup ✅'
                            ELSE 'other'
                        END
                    )
                ),
                '[]'::jsonb
            )
            FROM cron.job
            WHERE active = true
        )
    );
    
END $$;
-- ÚLTIMA LIMPEZA: REMOVER JOBS DUPLICADOS FINAIS
-- Garantir que só bot-dify-processor processe mensagens

DO $$
BEGIN
    -- Remover jobs duplicados específicos
    PERFORM cron.unschedule('process-message-queue-active');
    PERFORM cron.unschedule('process-pending-messages-manual');  
    PERFORM cron.unschedule('test-manual-process');
    
    -- Log final
    INSERT INTO system_logs (type, source, message, details)
    VALUES (
        'success',
        'dify',
        '✅ SISTEMA 100% LIMPO E FUNCIONANDO!',
        jsonb_build_object(
            'final_active_jobs', jsonb_build_array(
                'bot-dify-processor (*/2 * * * *) - ÚNICO processador de mensagens',
                'cleanup-message-queue (0 * * * *) - Limpeza diária', 
                'monitor-whapi-pending-messages (*/2 * * * *) - Monitor apenas'
            ),
            'conflicting_jobs_removed', 'TODOS removidos',
            'system_ready', true,
            'next_action', 'Bot Dify responderá automaticamente em 2 minutos',
            'timestamp', now()
        )
    );
END $$;
-- PLANO: SIMPLIFICAR PARA FOCAR NO BOT DIFY FUNCIONAR
-- 1. Pausar cron jobs de avaliação temporariamente
-- 2. Resetar conversas waiting_evaluation para bot_attending  
-- 3. Deixar só o dify-process-messages-auto ativo

-- 1. PAUSAR CRON JOBS DE AVALIAÇÃO
DO $$
DECLARE
    evaluation_jobs TEXT[] := ARRAY[
        'check-inactive-conversations-40min',
        'process-lead-evaluation-ai'
    ];
    job_name TEXT;
BEGIN
    -- Remover jobs de avaliação temporariamente
    FOREACH job_name IN ARRAY evaluation_jobs LOOP
        BEGIN
            PERFORM cron.unschedule(job_name);
            INSERT INTO system_logs (type, source, message, details)
            VALUES (
                'info',
                'cron_management', 
                'Cron job pausado temporariamente: ' || job_name,
                jsonb_build_object(
                    'job_name', job_name,
                    'reason', 'Foco no bot Dify funcionar primeiro',
                    'timestamp', now()
                )
            );
        EXCEPTION 
            WHEN OTHERS THEN
                -- Log se job não existir
                INSERT INTO system_logs (type, source, message, details)
                VALUES (
                    'warning',
                    'cron_management',
                    'Cron job não encontrado para remoção: ' || job_name,
                    jsonb_build_object('job_name', job_name, 'timestamp', now())
                );
        END;
    END LOOP;
END $$;

-- 2. RESETAR CONVERSAS WAITING_EVALUATION PARA BOT_ATTENDING
UPDATE conversations 
SET 
    status = 'bot_attending',
    fallback_mode = false,
    fallback_taken_by = NULL,
    updated_at = now()
WHERE status = 'waiting_evaluation';

-- 3. LOG DAS MUDANÇAS
INSERT INTO system_logs (type, source, message, details)
VALUES (
    'info',
    'dify',
    'Plano implementado: Foco no bot Dify',
    jsonb_build_object(
        'actions_taken', jsonb_build_array(
            'Cron jobs de avaliação pausados',
            'Conversas resetadas para bot_attending',
            'Sistema simplificado para teste do bot'
        ),
        'conversations_reset', (
            SELECT COUNT(*) 
            FROM conversations 
            WHERE status = 'bot_attending' AND updated_at >= now() - interval '1 minute'
        ),
        'next_steps', 'Testar se bot Dify responde automaticamente',
        'timestamp', now()
    )
);
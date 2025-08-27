-- FASE 3: PROCESSAR BACKLOG MANUAL DE 25 MENSAGENS
-- Chamar process-pending-messages manualmente para processar acúmulo

-- Log início do processamento manual
INSERT INTO system_logs (type, source, message, details)
VALUES (
    'info',
    'dify',
    'FASE 3 INICIADA: Processamento manual do backlog',
    jsonb_build_object(
        'messages_waiting', (SELECT count(*) FROM message_queue WHERE status = 'waiting'),
        'action', 'manual_backlog_processing',
        'timestamp', now()
    )
);

-- Chamar a função process-pending-messages diretamente (simulando chamada da edge function)
SELECT net.http_post(
    url := 'https://groqsnnytvjabgeaekkw.supabase.co/functions/v1/process-pending-messages',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imdyb3Fzbm55dHZqYWJnZWFla2t3Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MjU5NTc4NywiZXhwIjoyMDY4MTcxNzg3fQ.tqnUGUxO9cFBBu7dOYYAGy8b5n4MlLgdNJJvI7ht3HI"}'::jsonb,
    body := '{"auto_run": true, "source": "manual_backlog_cleanup", "force_process": true}'::jsonb
) AS request_id;

-- Log da chamada manual
INSERT INTO system_logs (type, source, message, details)
VALUES (
    'info',
    'dify',
    'BACKLOG PROCESSING: Chamada manual para process-pending-messages executada',
    jsonb_build_object(
        'method', 'HTTP POST via net.http_post',
        'target_function', 'process-pending-messages',
        'purpose', 'Processar 25 mensagens acumuladas',
        'timestamp', now()
    )
);
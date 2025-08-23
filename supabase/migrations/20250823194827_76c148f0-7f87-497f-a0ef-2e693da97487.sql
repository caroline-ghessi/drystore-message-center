-- Temporariamente desabilitar trigger de auditoria para permitir correções do sistema
ALTER TABLE conversations DISABLE TRIGGER ALL;

-- FASE 1: Correção Imediata - Resetar conversas com status inconsistente
UPDATE conversations 
SET 
  status = 'bot_attending',
  fallback_mode = false,
  fallback_taken_by = NULL,
  updated_at = now()
WHERE status = 'sent_to_seller' AND fallback_mode = true;

-- Reabilitar triggers
ALTER TABLE conversations ENABLE TRIGGER ALL;

-- FASE 2: Corrigir cron job - Remover e recriar
SELECT cron.unschedule(jobid) 
FROM cron.job 
WHERE command LIKE '%process-message-queue%';

-- Criar novo cron job com service_role token
SELECT cron.schedule(
  'process-message-queue-auto',
  '*/30 * * * * *',
  $$
  SELECT net.http_post(
    url := 'https://groqsnnytvjabgeaekkw.supabase.co/functions/v1/process-message-queue',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imdyb3Fzbm55dHZqYWJnZWFla2t3Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MjU5NTc4NywiZXhwIjoyMDY4MTcxNzg3fQ.tqnUGUxO9cFBBu7dOYYAGy8b5n4MlLgdNJJvI7ht3HI"}'::jsonb,
    body := '{"timestamp": "' || now() || '"}'::jsonb
  ) AS request_id;
  $$
);
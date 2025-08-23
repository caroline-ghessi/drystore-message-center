-- FASE 1: Correção Imediata - Resetar conversas com status inconsistente
-- Resetar todas as conversas que estão com status sent_to_seller mas deveriam estar disponíveis para o bot
UPDATE conversations 
SET 
  status = 'bot_attending',
  fallback_mode = false,
  fallback_taken_by = NULL,
  updated_at = now()
WHERE status = 'sent_to_seller' AND fallback_mode = true;

-- FASE 2: Corrigir cron job - Remover e recriar cron job para processamento automático
-- Primeiro remover todos os jobs existentes de process-message-queue
SELECT cron.unschedule(jobid) 
FROM cron.job 
WHERE command LIKE '%process-message-queue%';

-- Criar novo cron job com configuração correta
SELECT cron.schedule(
  'process-message-queue-auto',
  '*/30 * * * * *', -- A cada 30 segundos
  $$
  SELECT net.http_post(
    url := 'https://groqsnnytvjabgeaekkw.supabase.co/functions/v1/process-message-queue',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imdyb3Fzbm55dHZqYWJnZWFla2t3Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MjU5NTc4NywiZXhwIjoyMDY4MTcxNzg3fQ.tqnUGUxO9cFBBu7dOYYAGy8b5n4MlLgdNJJvI7ht3HI"}'::jsonb,
    body := '{"timestamp": "' || now() || '"}'::jsonb
  ) AS request_id;
  $$
);

-- Log da correção
INSERT INTO system_logs (type, source, message, details)
VALUES (
  'info',
  'queue_fix',
  'Correção completa aplicada - conversas resetadas e cron job recriado',
  jsonb_build_object(
    'conversations_reset', (SELECT COUNT(*) FROM conversations WHERE status = 'bot_attending'),
    'pending_messages', (SELECT COUNT(*) FROM message_queue WHERE status = 'waiting'),
    'timestamp', now()
  )
);
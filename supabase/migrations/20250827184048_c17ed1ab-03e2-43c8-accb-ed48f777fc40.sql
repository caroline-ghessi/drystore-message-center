-- Criar cron job para o processador de fila do bot Dify (a cada 2 minutos)
SELECT cron.schedule(
  'bot-dify-processor',
  '*/2 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://groqsnnytvjabgeaekkw.supabase.co/functions/v1/bot-dify-processor',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imdyb3Fzbm55dHZqYWJnZWFla2t3Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MjU5NTc4NywiZXhwIjoyMDY4MTcxNzg3fQ.tqnUGUxO9cFBBu7dOYYAGy8b5n4MlLgdNJJvI7ht3HI"}',
    body := '{"auto_run": true}'
  ) AS request_id;
  $$
);

-- Log da criação do cron job
INSERT INTO public.system_logs (type, source, message, details)
VALUES (
  'info',
  'dify',
  'Cron job bot-dify-processor criado com sucesso',
  jsonb_build_object(
    'schedule', '*/2 * * * *',
    'function', 'bot-dify-processor',
    'timestamp', now()
  )
);
-- Remover cron jobs existentes de message queue diretamente
SELECT cron.unschedule(jobname) 
FROM cron.job 
WHERE command LIKE '%process-message-queue%';

-- Criar novo cron job com autenticação correta
SELECT cron.schedule(
  'process-message-queue-fixed-auth',
  '*/30 * * * * *',
  $$
  SELECT net.http_post(
    url := 'https://groqsnnytvjabgeaekkw.supabase.co/functions/v1/process-message-queue',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imdyb3Fzbm55dHZqYWJnZWFla2t3Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MjU5NTc4NywiZXhwIjoyMDY4MTcxNzg3fQ.tqnUGUxO9cFBBu7dOYYAGy8b5n4MlLgdNJJvI7ht3HI"}',
    body := '{"auto_run": true}'
  ) AS request_id;
  $$
);
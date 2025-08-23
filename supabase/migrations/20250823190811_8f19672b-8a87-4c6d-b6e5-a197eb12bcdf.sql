-- Verificar o cron job atual
SELECT 
  cron.schedule(
    'process-dify-message-queue-fixed',
    '*/30 * * * * *',
    $$
    select
      net.http_post(
          url:='https://groqsnnytvjabgeaekkw.supabase.co/functions/v1/process-message-queue',
          headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imdyb3Fzbm55dHZqYWJnZWFla2t3Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MjU5NTc4NywiZXhwIjoyMDY4MTcxNzg3fQ.FKlR_zBWDtJK6gcAMqOF46u8BYa6f0FO8qGzx1tYqmg"}'::jsonb,
          body:='{"scheduled": true}'::jsonb
      ) as request_id;
    $$
  ) as job_id;
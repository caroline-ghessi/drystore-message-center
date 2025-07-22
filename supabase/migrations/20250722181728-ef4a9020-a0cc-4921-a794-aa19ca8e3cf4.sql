
-- Habilitar extensões necessárias para cron jobs (caso ainda não estejam habilitadas)
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Configurar cron job para monitorar mensagens pendentes (a cada 2 minutos)
SELECT cron.schedule(
  'monitor-whapi-pending-messages',
  '*/2 * * * *',
  $$
  SELECT
    net.http_post(
        url:='https://groqsnnytvjabgeaekkw.supabase.co/functions/v1/whapi-monitor-pending',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imdyb3Fzbm55dHZqYWJnZWFla2t3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI1OTU3ODcsImV4cCI6MjA2ODE3MTc4N30.HWBJVbSSShx1P8bqa4dvO9jCsCDybt2rhgPPBy8zEVs"}'::jsonb,
        body:='{"automated": true}'::jsonb
    ) as request_id;
  $$
);

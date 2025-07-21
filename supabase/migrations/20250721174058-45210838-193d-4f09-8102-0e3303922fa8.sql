
-- Habilitar extensões necessárias para cron jobs
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Configurar cron job para verificar conversas inativas (a cada 5 minutos)
SELECT cron.schedule(
  'check-inactive-conversations',
  '*/5 * * * *',
  $$
  SELECT
    net.http_post(
        url:='https://groqsnnytvjabgeaekkw.supabase.co/functions/v1/check-inactive-conversations',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imdyb3Fzbm55dHZqYWJnZWFla2t3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI1OTU3ODcsImV4cCI6MjA2ODE3MTc4N30.HWBJVbSSShx1P8bqa4dvO9jCsCDybt2rhgPPBy8zEVs"}'::jsonb,
        body:='{"scheduled": true}'::jsonb
    ) as request_id;
  $$
);

-- Configurar cron job para processar avaliações de leads (a cada 2 minutos)
SELECT cron.schedule(
  'process-lead-evaluation',
  '*/2 * * * *',
  $$
  SELECT
    net.http_post(
        url:='https://groqsnnytvjabgeaekkw.supabase.co/functions/v1/process-lead-evaluation',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imdyb3Fzbm55dHZqYWJnZWFla2t3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI1OTU3ODcsImV4cCI6MjA2ODE3MTc4N30.HWBJVbSSShx1P8bqa4dvO9jCsCDybt2rhgPPBy8zEVs"}'::jsonb,
        body:='{"scheduled": true}'::jsonb
    ) as request_id;
  $$
);

-- Configurar cron job para processar transferências inteligentes (a cada 1 minuto)
SELECT cron.schedule(
  'intelligent-transfer-orchestrator',
  '*/1 * * * *',
  $$
  SELECT
    net.http_post(
        url:='https://groqsnnytvjabgeaekkw.supabase.co/functions/v1/intelligent-transfer-orchestrator',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imdyb3Fzbm55dHZqYWJnZWFla2t3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI1OTU3ODcsImV4cCI6MjA2ODE3MTc4N30.HWBJVbSSShx1P8bqa4dvO9jCsCDybt2rhgPPBy8zEVs"}'::jsonb,
        body:='{"scheduled": true}'::jsonb
    ) as request_id;
  $$
);

-- Remover o cron job duplicado (jobid:5) que usa token anon
SELECT cron.unschedule(5);

-- Verificar se existem outros cron jobs duplicados
SELECT cron.unschedule(job_id) 
FROM cron.job 
WHERE command LIKE '%process-message-queue%' 
AND job_id != 7;
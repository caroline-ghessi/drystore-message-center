-- Remover o cron job duplicado (jobid:5) que usa token anon
SELECT cron.unschedule(5);

-- Verificar se existem outros cron jobs duplicados (além do jobid:7)
SELECT cron.unschedule(jobid) 
FROM cron.job 
WHERE command LIKE '%process-message-queue%' 
AND jobid != 7;
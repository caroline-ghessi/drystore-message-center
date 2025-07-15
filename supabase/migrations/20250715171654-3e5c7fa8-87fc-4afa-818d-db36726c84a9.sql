-- Check the check constraint for integrations type
SELECT conname, consrc 
FROM pg_constraint 
WHERE conrelid = 'public.integrations'::regclass 
AND contype = 'c';

-- Also check existing data
SELECT DISTINCT type FROM public.integrations;
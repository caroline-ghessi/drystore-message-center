
-- Fase 1: Correção completa dos números dos vendedores
-- Remover espaços em branco no início dos números
UPDATE sellers 
SET phone_number = TRIM(phone_number) 
WHERE phone_number LIKE ' %';

-- Adicionar código do país 55 para números que não começam com 55
UPDATE sellers 
SET phone_number = '55' || phone_number 
WHERE phone_number NOT LIKE '55%' 
AND active = true 
AND deleted = false;

-- Correções específicas baseadas na imagem:
-- Marcia: garantir que o número esteja correto
UPDATE sellers 
SET phone_number = '5551981181894' 
WHERE name ILIKE '%marcia%' OR phone_number IN ('51981181894', '1981181894');

-- Cristiano: remover espaço e garantir formato correto
UPDATE sellers 
SET phone_number = '5551995265283' 
WHERE name ILIKE '%cristiano%' OR phone_number IN (' 51995265283', '51995265283');

-- Gabriel: garantir formato correto
UPDATE sellers 
SET phone_number = '5551981690036' 
WHERE name ILIKE '%gabriel%' AND phone_number != '5551981690036';

-- Ronaldo: garantir formato correto
UPDATE sellers 
SET phone_number = '5551999858989' 
WHERE name ILIKE '%ronaldo%' AND phone_number != '5551999858989';

-- Validação: verificar se todos os números ativos têm o formato correto
-- (números devem ter entre 12-13 dígitos e começar com 55)
UPDATE sellers 
SET phone_number = '55' || REGEXP_REPLACE(phone_number, '^0+', '') 
WHERE LENGTH(REGEXP_REPLACE(phone_number, '[^0-9]', '')) BETWEEN 10 AND 11
AND phone_number NOT LIKE '55%'
AND active = true 
AND deleted = false;

-- Log da correção
INSERT INTO system_logs (type, source, message, details)
VALUES (
  'info',
  'phone_correction_phase2',
  'Correção completa dos números de telefone dos vendedores executada',
  '{"action": "fix_all_phone_numbers", "format": "55 + DDD + number", "vendors_affected": "all_active"}'
);

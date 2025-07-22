
-- Fase 1: Correção dos números dos vendedores
-- Corrigir números que não começam com 55
UPDATE sellers 
SET phone_number = '55' || phone_number 
WHERE phone_number NOT LIKE '55%' 
AND active = true 
AND deleted = false;

-- Corrigir espaço em branco no início dos números
UPDATE sellers 
SET phone_number = TRIM(phone_number) 
WHERE phone_number LIKE ' %';

-- Validar e corrigir números específicos dos vendedores conforme as imagens
-- Gabriel Alves
UPDATE sellers 
SET phone_number = '5551981690036' 
WHERE name = 'Gabriel Alves' AND phone_number != '5551981690036';

-- Cristiano Ghessi (remover espaço e garantir formato correto)
UPDATE sellers 
SET phone_number = '5551996294471' 
WHERE name = 'Cristiano Ghessi';

-- Ronaldo (garantir formato correto)
UPDATE sellers 
SET phone_number = '5551999858989' 
WHERE name = 'Ronaldo' AND phone_number != '5551999858989';

-- Log das correções
INSERT INTO system_logs (type, source, message, details)
VALUES (
  'info',
  'phone_number_correction',
  'Correção em massa dos números de telefone dos vendedores',
  '{"action": "standardize_phone_numbers", "format": "55 + DDD + number"}'
);

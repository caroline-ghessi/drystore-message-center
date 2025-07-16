-- Adicionar campo deleted na tabela sellers para distinguir de active
ALTER TABLE sellers 
ADD COLUMN IF NOT EXISTS deleted BOOLEAN DEFAULT false;

-- Atualizar vendedores existentes que foram "excluídos" (active = false) 
-- para serem marcados como deleted = true se não têm leads recentes
UPDATE sellers 
SET deleted = true 
WHERE active = false 
AND id NOT IN (
  SELECT DISTINCT seller_id 
  FROM leads 
  WHERE seller_id IS NOT NULL 
  AND created_at > NOW() - INTERVAL '30 days'
);

-- Reativar vendedores que foram inativados mas não devem estar excluídos
UPDATE sellers 
SET active = true 
WHERE deleted = false AND active = false;

-- Adicionar índice para performance
CREATE INDEX IF NOT EXISTS idx_sellers_deleted_active ON sellers(deleted, active);
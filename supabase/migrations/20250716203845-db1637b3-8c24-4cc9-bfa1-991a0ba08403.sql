-- Limpeza completa dos dados de vendedores
-- Remove todas as especialidades dos vendedores
DELETE FROM seller_specialties;

-- Remove todas as habilidades dos vendedores  
DELETE FROM seller_skills;

-- Remove todas as métricas de performance dos vendedores
DELETE FROM seller_performance_metrics;

-- Remove todas as análises de qualidade dos vendedores
DELETE FROM quality_analyses;

-- Remove todas as configurações WHAPI dos vendedores
DELETE FROM whapi_configurations WHERE seller_id IS NOT NULL;

-- Remove todos os logs WHAPI dos vendedores
DELETE FROM whapi_logs WHERE seller_id IS NOT NULL;

-- Remove todos os leads dos vendedores
DELETE FROM leads;

-- Finalmente, remove todos os vendedores
DELETE FROM sellers;
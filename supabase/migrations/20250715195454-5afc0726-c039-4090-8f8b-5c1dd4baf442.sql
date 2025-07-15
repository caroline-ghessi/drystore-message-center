-- Update product categories with the new correct list
-- First, handle existing specialties for categories that will be removed or renamed

-- Update existing categories that are being renamed
UPDATE product_categories 
SET name = 'Drywall e Divisórias', updated_at = now()
WHERE name = 'Drywall e Gesso';

UPDATE product_categories 
SET name = 'Isolamento Termoacústico', updated_at = now()
WHERE name = 'Isolamento Térmico';

UPDATE product_categories 
SET name = 'Telhas Shingle', updated_at = now()
WHERE name = 'Telhas e Coberturas';

-- Remove categories that are no longer needed
-- First remove seller specialties for these categories to maintain referential integrity
DELETE FROM seller_specialties 
WHERE product_category_id IN (
  SELECT id FROM product_categories 
  WHERE name IN ('Equipamentos', 'Hidráulica', 'Madeiras', 'Materiais Elétricos', 'Metais e Soldas', 'Tintas e Vernizes')
);

-- Then remove the categories
DELETE FROM product_categories 
WHERE name IN ('Equipamentos', 'Hidráulica', 'Madeiras', 'Materiais Elétricos', 'Metais e Soldas', 'Tintas e Vernizes');

-- Insert new categories that don't exist yet
INSERT INTO product_categories (name, description, active, created_at, updated_at)
VALUES 
  ('Energia Solar', 'Equipamentos e materiais para energia solar', true, now(), now()),
  ('Pisos e carpetes', 'Pisos, carpetes e revestimentos', true, now(), now()),
  ('Impermeabilização', 'Materiais e serviços de impermeabilização', true, now(), now()),
  ('Verga Fibra', 'Vergas de fibra para construção', true, now(), now()),
  ('Argamassa SilentFloor', 'Argamassa específica SilentFloor', true, now(), now()),
  ('Construções em Light Steel Frame', 'Estruturas em Light Steel Frame', true, now(), now())
ON CONFLICT (name) DO NOTHING;

-- Ensure Ferramentas category exists (should already exist)
INSERT INTO product_categories (name, description, active, created_at, updated_at)
VALUES ('Ferramentas', 'Ferramentas para construção', true, now(), now())
ON CONFLICT (name) DO NOTHING;
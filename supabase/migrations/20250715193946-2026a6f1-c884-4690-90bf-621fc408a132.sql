-- Populate product_categories with sample data
INSERT INTO product_categories (name, description) VALUES 
  ('Telha Shingle', 'Telhas shingle asfálticas de alta qualidade'),
  ('Drywall', 'Sistemas de drywall e divisórias'),
  ('Ferramentas', 'Ferramentas para construção e reforma'),
  ('Isolamento Térmico', 'Materiais para isolamento térmico e acústico'),
  ('Impermeabilização', 'Produtos para impermeabilização'),
  ('Estruturas Metálicas', 'Perfis e estruturas metálicas'),
  ('Tintas e Acabamentos', 'Tintas e produtos de acabamento'),
  ('Pisos e Revestimentos', 'Pisos laminados, vinílicos e revestimentos');

-- Populate client_types with sample data  
INSERT INTO client_types (name, description, avg_ticket_range, complexity_level) VALUES 
  ('Pessoa Física - Residencial', 'Clientes residenciais para reformas e melhorias', 'R$ 1.000 - R$ 10.000', 'low'),
  ('Construtora Pequena', 'Construtoras de pequeno porte', 'R$ 10.000 - R$ 50.000', 'medium'),
  ('Construtora Grande', 'Construtoras de grande porte', 'R$ 50.000 - R$ 500.000', 'high'),
  ('Loja de Materiais', 'Revendedores e lojas de materiais', 'R$ 5.000 - R$ 100.000', 'medium'),
  ('Arquiteto/Engenheiro', 'Profissionais da construção', 'R$ 2.000 - R$ 50.000', 'medium'),
  ('Pessoa Física - Comercial', 'Pequenos comércios e estabelecimentos', 'R$ 5.000 - R$ 25.000', 'medium');
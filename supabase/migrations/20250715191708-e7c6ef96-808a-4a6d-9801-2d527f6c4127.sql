-- Estender tabela sellers com campos adicionais para perfil detalhado
ALTER TABLE public.sellers ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE public.sellers ADD COLUMN IF NOT EXISTS avatar_url TEXT;
ALTER TABLE public.sellers ADD COLUMN IF NOT EXISTS experience_years INTEGER DEFAULT 0;
ALTER TABLE public.sellers ADD COLUMN IF NOT EXISTS current_workload INTEGER DEFAULT 0;
ALTER TABLE public.sellers ADD COLUMN IF NOT EXISTS max_concurrent_leads INTEGER DEFAULT 10;
ALTER TABLE public.sellers ADD COLUMN IF NOT EXISTS personality_type TEXT DEFAULT 'consultivo';
ALTER TABLE public.sellers ADD COLUMN IF NOT EXISTS bio TEXT;
ALTER TABLE public.sellers ADD COLUMN IF NOT EXISTS performance_score DECIMAL(3,2) DEFAULT 0;
ALTER TABLE public.sellers ADD COLUMN IF NOT EXISTS conversion_rate DECIMAL(5,2) DEFAULT 0;
ALTER TABLE public.sellers ADD COLUMN IF NOT EXISTS average_ticket DECIMAL(10,2) DEFAULT 0;

-- Criar tabela de categorias de produtos
CREATE TABLE IF NOT EXISTS public.product_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  parent_id UUID REFERENCES public.product_categories(id),
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Criar tabela de tipos de cliente
CREATE TABLE IF NOT EXISTS public.client_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  complexity_level TEXT DEFAULT 'medium' CHECK (complexity_level IN ('low', 'medium', 'high')),
  avg_ticket_range TEXT DEFAULT 'medium' CHECK (avg_ticket_range IN ('low', 'medium', 'high')),
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Criar tabela de especialidades dos vendedores
CREATE TABLE IF NOT EXISTS public.seller_specialties (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id UUID NOT NULL REFERENCES public.sellers(id) ON DELETE CASCADE,
  product_category_id UUID NOT NULL REFERENCES public.product_categories(id) ON DELETE CASCADE,
  expertise_level TEXT DEFAULT 'intermediate' CHECK (expertise_level IN ('beginner', 'intermediate', 'advanced', 'expert')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(seller_id, product_category_id)
);

-- Criar tabela de habilidades dos vendedores
CREATE TABLE IF NOT EXISTS public.seller_skills (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id UUID NOT NULL REFERENCES public.sellers(id) ON DELETE CASCADE,
  skill_name TEXT NOT NULL,
  skill_type TEXT DEFAULT 'soft' CHECK (skill_type IN ('soft', 'hard', 'technical')),
  proficiency_level INTEGER DEFAULT 3 CHECK (proficiency_level >= 1 AND proficiency_level <= 5),
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(seller_id, skill_name)
);

-- Criar tabela de métricas de performance dos vendedores
CREATE TABLE IF NOT EXISTS public.seller_performance_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id UUID NOT NULL REFERENCES public.sellers(id) ON DELETE CASCADE,
  metric_type TEXT NOT NULL, -- 'monthly_sales', 'customer_satisfaction', 'response_time', etc.
  metric_value DECIMAL(10,2) NOT NULL,
  metric_unit TEXT DEFAULT 'number', -- 'number', 'percentage', 'minutes', 'currency'
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Inserir categorias de produtos padrão da Drystore
INSERT INTO public.product_categories (name, description) VALUES
  ('Telhas e Coberturas', 'Telhas shingle, metálicas, cerâmicas e acessórios para telhados'),
  ('Drywall e Gesso', 'Placas de drywall, perfis, parafusos e acessórios para gesso'),
  ('Ferramentas', 'Ferramentas manuais e elétricas para construção'),
  ('Materiais Elétricos', 'Fios, cabos, disjuntores e materiais elétricos'),
  ('Hidráulica', 'Tubos, conexões, registros e materiais hidráulicos'),
  ('Tintas e Vernizes', 'Tintas, primers, vernizes e produtos químicos'),
  ('Madeiras', 'Madeiras para construção, compensados e derivados'),
  ('Metais e Soldas', 'Perfis metálicos, soldas e materiais siderúrgicos'),
  ('Isolamento Térmico', 'Materiais para isolamento térmico e acústico'),
  ('Equipamentos', 'Equipamentos e máquinas para construção');

-- Inserir tipos de cliente padrão
INSERT INTO public.client_types (name, description, complexity_level, avg_ticket_range) VALUES
  ('Construtor Residencial', 'Construtores de casas residenciais', 'medium', 'medium'),
  ('Construtor Comercial', 'Construtores de prédios comerciais', 'high', 'high'),
  ('Arquiteto', 'Profissionais de arquitetura especificando produtos', 'high', 'medium'),
  ('Pessoa Física', 'Clientes finais para reforma residencial', 'low', 'low'),
  ('Lojista Revendedor', 'Lojas que revendem nossos produtos', 'medium', 'high'),
  ('Empreiteiro', 'Profissionais de pequenas obras e reformas', 'medium', 'medium'),
  ('Indústria', 'Clientes industriais com grandes volumes', 'high', 'high');

-- Habilitar RLS nas novas tabelas
ALTER TABLE public.product_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.seller_specialties ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.seller_skills ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.seller_performance_metrics ENABLE ROW LEVEL SECURITY;

-- Criar políticas RLS para authenticated users
CREATE POLICY "Enable all for authenticated users on product_categories" 
ON public.product_categories FOR ALL 
TO authenticated 
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Enable all for authenticated users on client_types" 
ON public.client_types FOR ALL 
TO authenticated 
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Enable all for authenticated users on seller_specialties" 
ON public.seller_specialties FOR ALL 
TO authenticated 
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Enable all for authenticated users on seller_skills" 
ON public.seller_skills FOR ALL 
TO authenticated 
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Enable all for authenticated users on seller_performance_metrics" 
ON public.seller_performance_metrics FOR ALL 
TO authenticated 
USING (auth.uid() IS NOT NULL);

-- Criar triggers para updated_at
CREATE TRIGGER update_product_categories_updated_at
  BEFORE UPDATE ON public.product_categories
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_client_types_updated_at
  BEFORE UPDATE ON public.client_types
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_seller_skills_updated_at
  BEFORE UPDATE ON public.seller_skills
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_seller_performance_metrics_updated_at
  BEFORE UPDATE ON public.seller_performance_metrics
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Atualizar trigger para sellers
CREATE TRIGGER update_sellers_updated_at
  BEFORE UPDATE ON public.sellers
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
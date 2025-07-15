-- =====================================================
-- SCRIPT COMPLETO DA PLATAFORMA DE ATENDIMENTO WHATSAPP
-- Versão Melhorada com Correções e Funcionalidades Extras
-- =====================================================

-- 1. CRIAR TABELA DE PERFIS DE USUÁRIOS
-- =====================================================
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT,
  email TEXT,
  role TEXT CHECK (role IN ('admin', 'manager', 'operator')) DEFAULT 'operator',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. CRIAR TABELAS PRINCIPAIS
-- =====================================================

-- Tabela de Vendedores
CREATE TABLE IF NOT EXISTS sellers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  phone_number TEXT UNIQUE NOT NULL,
  whapi_token TEXT,
  whapi_webhook TEXT,
  active BOOLEAN DEFAULT true,
  auto_first_message BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabela de Conversas (melhorada com fallback)
CREATE TABLE IF NOT EXISTS conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone_number TEXT NOT NULL,
  customer_name TEXT,
  status TEXT CHECK (status IN ('bot_attending', 'waiting_evaluation', 'sent_to_seller', 'finished')) DEFAULT 'bot_attending',
  assigned_seller_id UUID REFERENCES sellers(id) ON DELETE SET NULL,
  fallback_mode BOOLEAN DEFAULT FALSE,
  fallback_taken_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabela de Mensagens (melhorada)
CREATE TABLE IF NOT EXISTS messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE NOT NULL,
  whatsapp_message_id TEXT UNIQUE,
  reply_to_message_id UUID REFERENCES messages(id),
  sender_type TEXT CHECK (sender_type IN ('customer', 'bot', 'seller', 'system', 'rodrigo_bot')) NOT NULL,
  sender_name TEXT,
  content TEXT,
  message_type TEXT CHECK (message_type IN ('text', 'audio', 'image', 'video', 'document', 'location')) DEFAULT 'text',
  media_url TEXT,
  is_read BOOLEAN DEFAULT FALSE,
  delivery_status TEXT CHECK (delivery_status IN ('sent', 'delivered', 'read', 'failed')) DEFAULT 'sent',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabela de Fila de Mensagens (para agrupamento)
CREATE TABLE IF NOT EXISTS message_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE NOT NULL,
  messages_content TEXT[] DEFAULT '{}',
  status TEXT CHECK (status IN ('waiting', 'processing', 'sent', 'failed')) DEFAULT 'waiting',
  scheduled_for TIMESTAMPTZ DEFAULT NOW() + INTERVAL '1 minute',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  processed_at TIMESTAMPTZ
);

-- Tabela de Leads
CREATE TABLE IF NOT EXISTS leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,
  seller_id UUID REFERENCES sellers(id) ON DELETE SET NULL,
  customer_name TEXT NOT NULL,
  phone_number TEXT NOT NULL,
  product_interest TEXT,
  summary TEXT,
  ai_evaluation TEXT,
  sent_at TIMESTAMPTZ DEFAULT NOW(),
  status TEXT CHECK (status IN ('attending', 'finished', 'sold', 'lost')) DEFAULT 'attending',
  generated_sale BOOLEAN DEFAULT false,
  sale_value DECIMAL(10, 2),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabela de Integrações (para armazenar tokens com segurança)
CREATE TABLE IF NOT EXISTS integrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT UNIQUE NOT NULL,
  type TEXT CHECK (type IN ('whapi', 'dify', 'meta', 'grok', 'claude')) NOT NULL,
  config JSONB NOT NULL DEFAULT '{}',
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabela de Logs de Webhooks (para debugging)
CREATE TABLE IF NOT EXISTS webhook_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source TEXT NOT NULL,
  method TEXT CHECK (method IN ('GET', 'POST', 'PUT', 'DELETE')) NOT NULL,
  url TEXT NOT NULL,
  headers JSONB DEFAULT '{}',
  body JSONB DEFAULT '{}',
  response_status INTEGER,
  response_body JSONB DEFAULT '{}',
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabela de Logs do Sistema
CREATE TABLE IF NOT EXISTS system_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT CHECK (type IN ('error', 'info', 'warning', 'success')) NOT NULL,
  source TEXT CHECK (source IN ('whatsapp_api', 'dify', 'whapi', 'grok', 'claude', 'system')) NOT NULL,
  message TEXT NOT NULL,
  details JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabela de Configurações
CREATE TABLE IF NOT EXISTS settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT UNIQUE NOT NULL,
  value JSONB NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabela de Análises de Qualidade
CREATE TABLE IF NOT EXISTS quality_analyses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,
  seller_id UUID REFERENCES sellers(id) ON DELETE CASCADE,
  analysis_type TEXT CHECK (analysis_type IN ('attendance_quality', 'response_time', 'conversion_rate')),
  score DECIMAL(3, 2) CHECK (score >= 0 AND score <= 10),
  feedback TEXT,
  suggestions JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. CRIAR ÍNDICES PARA PERFORMANCE
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_conversations_phone ON conversations(phone_number);
CREATE INDEX IF NOT EXISTS idx_conversations_status ON conversations(status);
CREATE INDEX IF NOT EXISTS idx_conversations_created ON conversations(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_messages_whatsapp_id ON messages(whatsapp_message_id);
CREATE INDEX IF NOT EXISTS idx_messages_created ON messages(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_message_queue_scheduled ON message_queue(scheduled_for);
CREATE INDEX IF NOT EXISTS idx_message_queue_status ON message_queue(status);
CREATE INDEX IF NOT EXISTS idx_leads_seller ON leads(seller_id);
CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(status);
CREATE INDEX IF NOT EXISTS idx_system_logs_type ON system_logs(type);
CREATE INDEX IF NOT EXISTS idx_system_logs_source ON system_logs(source);
CREATE INDEX IF NOT EXISTS idx_system_logs_created ON system_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_webhook_logs_source ON webhook_logs(source);
CREATE INDEX IF NOT EXISTS idx_webhook_logs_created ON webhook_logs(created_at DESC);

-- 4. CRIAR FUNÇÕES E TRIGGERS
-- =====================================================

-- Função para atualizar updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers para atualizar updated_at
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_sellers_updated_at BEFORE UPDATE ON sellers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_conversations_updated_at BEFORE UPDATE ON conversations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_leads_updated_at BEFORE UPDATE ON leads
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_integrations_updated_at BEFORE UPDATE ON integrations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_settings_updated_at BEFORE UPDATE ON settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 5. CRIAR VIEWS ÚTEIS
-- =====================================================

-- View de conversas com última mensagem
CREATE OR REPLACE VIEW conversations_with_last_message AS
SELECT 
  c.*,
  s.name as seller_name,
  last_msg.content as last_message,
  last_msg.created_at as last_message_at,
  last_msg.sender_type as last_sender_type,
  msg_count.total_messages
FROM conversations c
LEFT JOIN sellers s ON c.assigned_seller_id = s.id
LEFT JOIN LATERAL (
  SELECT content, created_at, sender_type
  FROM messages
  WHERE conversation_id = c.id
  ORDER BY created_at DESC
  LIMIT 1
) last_msg ON true
LEFT JOIN LATERAL (
  SELECT COUNT(*) as total_messages
  FROM messages
  WHERE conversation_id = c.id
) msg_count ON true;

-- View de dashboard de vendedores
CREATE OR REPLACE VIEW seller_dashboard AS
SELECT 
  s.id,
  s.name,
  s.active,
  COUNT(DISTINCT l.id) as total_leads,
  COUNT(DISTINCT CASE WHEN l.status = 'attending' THEN l.id END) as active_leads,
  COUNT(DISTINCT CASE WHEN l.generated_sale = true THEN l.id END) as total_sales,
  SUM(CASE WHEN l.generated_sale = true THEN l.sale_value ELSE 0 END) as total_revenue,
  AVG(qa.score) as avg_quality_score
FROM sellers s
LEFT JOIN leads l ON s.id = l.seller_id
LEFT JOIN quality_analyses qa ON s.id = qa.seller_id
GROUP BY s.id, s.name, s.active;

-- 6. CONFIGURAR ROW LEVEL SECURITY (RLS)
-- =====================================================

-- Habilitar RLS em todas as tabelas
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE sellers ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE message_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE integrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhook_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE quality_analyses ENABLE ROW LEVEL SECURITY;

-- Políticas RLS corrigidas para usuários autenticados
CREATE POLICY "Enable all for authenticated users on profiles" ON profiles
  FOR ALL USING (auth.uid() IS NOT NULL);

CREATE POLICY "Enable all for authenticated users on sellers" ON sellers
  FOR ALL USING (auth.uid() IS NOT NULL);

CREATE POLICY "Enable all for authenticated users on conversations" ON conversations
  FOR ALL USING (auth.uid() IS NOT NULL);

CREATE POLICY "Enable all for authenticated users on messages" ON messages
  FOR ALL USING (auth.uid() IS NOT NULL);

CREATE POLICY "Enable all for authenticated users on message_queue" ON message_queue
  FOR ALL USING (auth.uid() IS NOT NULL);

CREATE POLICY "Enable all for authenticated users on leads" ON leads
  FOR ALL USING (auth.uid() IS NOT NULL);

CREATE POLICY "Enable all for authenticated users on integrations" ON integrations
  FOR ALL USING (auth.uid() IS NOT NULL);

CREATE POLICY "Enable all for authenticated users on webhook_logs" ON webhook_logs
  FOR ALL USING (auth.uid() IS NOT NULL);

CREATE POLICY "Enable all for authenticated users on system_logs" ON system_logs
  FOR ALL USING (auth.uid() IS NOT NULL);

CREATE POLICY "Enable all for authenticated users on settings" ON settings
  FOR ALL USING (auth.uid() IS NOT NULL);

CREATE POLICY "Enable all for authenticated users on quality_analyses" ON quality_analyses
  FOR ALL USING (auth.uid() IS NOT NULL);

-- 7. CONFIGURAR REAL-TIME
-- =====================================================

-- Configurar real-time para tabelas principais
ALTER TABLE messages REPLICA IDENTITY FULL;
ALTER TABLE conversations REPLICA IDENTITY FULL;
ALTER TABLE leads REPLICA IDENTITY FULL;

-- Adicionar tabelas à publicação do real-time
ALTER PUBLICATION supabase_realtime ADD TABLE messages;
ALTER PUBLICATION supabase_realtime ADD TABLE conversations;
ALTER PUBLICATION supabase_realtime ADD TABLE leads;

-- 8. INSERIR CONFIGURAÇÕES INICIAIS
-- =====================================================

INSERT INTO settings (key, value, description) VALUES
  ('message_grouping_time', '{"seconds": 60}', 'Tempo em segundos para agrupar mensagens do cliente'),
  ('whatsapp_business_number', '{"number": ""}', 'Número do WhatsApp Business oficial'),
  ('rodrigo_bot_number', '{"number": ""}', 'Número do Rodrigo Bot para envio de avisos'),
  ('dify_api_endpoint', '{"url": ""}', 'Endpoint da API do Dify'),
  ('auto_evaluation_time', '{"minutes": 15}', 'Tempo para avaliação automática de finalização'),
  ('fallback_enabled', '{"enabled": true}', 'Permitir assumir conversas manualmente')
ON CONFLICT (key) DO NOTHING;

-- 9. CRIAR FUNÇÕES AUXILIARES
-- =====================================================

-- Função para obter estatísticas gerais
CREATE OR REPLACE FUNCTION get_dashboard_stats()
RETURNS JSON AS $$
DECLARE
  stats JSON;
BEGIN
  SELECT json_build_object(
    'total_conversations', COUNT(DISTINCT c.id),
    'active_conversations', COUNT(DISTINCT CASE WHEN c.status != 'finished' THEN c.id END),
    'total_leads', COUNT(DISTINCT l.id),
    'active_leads', COUNT(DISTINCT CASE WHEN l.status = 'attending' THEN l.id END),
    'total_sales', COUNT(DISTINCT CASE WHEN l.generated_sale = true THEN l.id END),
    'total_revenue', COALESCE(SUM(CASE WHEN l.generated_sale = true THEN l.sale_value END), 0),
    'active_sellers', COUNT(DISTINCT CASE WHEN s.active = true THEN s.id END)
  ) INTO stats
  FROM conversations c
  LEFT JOIN leads l ON c.id = l.conversation_id
  LEFT JOIN sellers s ON s.active = true;
  
  RETURN stats;
END;
$$ LANGUAGE plpgsql;

-- Função para buscar conversas de um vendedor
CREATE OR REPLACE FUNCTION get_seller_conversations(seller_uuid UUID)
RETURNS TABLE (
  conversation_id UUID,
  customer_name TEXT,
  phone_number TEXT,
  last_message TEXT,
  last_message_at TIMESTAMPTZ,
  status TEXT,
  total_messages BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    c.id,
    c.customer_name,
    c.phone_number,
    cv.last_message,
    cv.last_message_at,
    l.status,
    cv.total_messages
  FROM conversations c
  JOIN leads l ON c.id = l.conversation_id
  JOIN conversations_with_last_message cv ON c.id = cv.id
  WHERE l.seller_id = seller_uuid
  ORDER BY cv.last_message_at DESC;
END;
$$ LANGUAGE plpgsql;

-- Função para processar fila de mensagens
CREATE OR REPLACE FUNCTION process_message_queue()
RETURNS INTEGER AS $$
DECLARE
  queue_record RECORD;
  processed_count INTEGER := 0;
BEGIN
  FOR queue_record IN 
    SELECT * FROM message_queue 
    WHERE status = 'waiting' AND scheduled_for <= NOW()
    ORDER BY scheduled_for
  LOOP
    -- Aqui seria implementada a lógica de envio para o bot
    -- Por enquanto, apenas marcar como processado
    UPDATE message_queue 
    SET status = 'sent', processed_at = NOW()
    WHERE id = queue_record.id;
    
    processed_count := processed_count + 1;
  END LOOP;
  
  RETURN processed_count;
END;
$$ LANGUAGE plpgsql;

-- 10. GRANT PERMISSÕES
-- =====================================================

GRANT EXECUTE ON FUNCTION get_dashboard_stats() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION get_seller_conversations(UUID) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION process_message_queue() TO anon, authenticated;

-- 11. INSERIR DADOS DE EXEMPLO
-- =====================================================

INSERT INTO sellers (name, phone_number, active) VALUES
  ('João Silva', '5551999999999', true),
  ('Maria Santos', '5551888888888', true),
  ('Pedro Oliveira', '5551777777777', true)
ON CONFLICT (phone_number) DO NOTHING;
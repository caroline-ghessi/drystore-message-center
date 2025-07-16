-- Adicionar campos WHAPI na tabela sellers
ALTER TABLE sellers 
ADD COLUMN IF NOT EXISTS whapi_token TEXT,
ADD COLUMN IF NOT EXISTS whapi_webhook_url TEXT,
ADD COLUMN IF NOT EXISTS whapi_status TEXT DEFAULT 'disconnected' CHECK (whapi_status IN ('connected', 'disconnected', 'error')),
ADD COLUMN IF NOT EXISTS whapi_last_test TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS whapi_error_message TEXT;

-- Criar tabela de logs WHAPI
CREATE TABLE IF NOT EXISTS whapi_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  direction TEXT NOT NULL CHECK (direction IN ('sent', 'received')),
  phone_from TEXT NOT NULL,
  phone_to TEXT NOT NULL,
  content TEXT,
  message_type TEXT DEFAULT 'text',
  media_url TEXT,
  whapi_message_id TEXT,
  token_used TEXT,
  conversation_id UUID REFERENCES conversations(id),
  seller_id UUID REFERENCES sellers(id),
  status TEXT DEFAULT 'sent' CHECK (status IN ('sent', 'delivered', 'read', 'failed')),
  error_message TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Criar tabela de configurações WHAPI
CREATE TABLE IF NOT EXISTS whapi_configurations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  phone_number TEXT UNIQUE NOT NULL,
  token_secret_name TEXT NOT NULL,
  webhook_url TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('rodrigo_bot', 'seller')),
  active BOOLEAN DEFAULT true,
  seller_id UUID REFERENCES sellers(id),
  last_health_check TIMESTAMP WITH TIME ZONE,
  health_status TEXT DEFAULT 'unknown' CHECK (health_status IN ('healthy', 'unhealthy', 'unknown')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Adicionar campo source na tabela messages para distinguir Meta de WHAPI
ALTER TABLE messages 
ADD COLUMN IF NOT EXISTS message_source TEXT DEFAULT 'meta' CHECK (message_source IN ('meta', 'whapi', 'system'));

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_whapi_logs_created ON whapi_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_whapi_logs_phone_from ON whapi_logs(phone_from);
CREATE INDEX IF NOT EXISTS idx_whapi_logs_phone_to ON whapi_logs(phone_to);
CREATE INDEX IF NOT EXISTS idx_whapi_logs_conversation ON whapi_logs(conversation_id);
CREATE INDEX IF NOT EXISTS idx_whapi_logs_seller ON whapi_logs(seller_id);
CREATE INDEX IF NOT EXISTS idx_whapi_configurations_phone ON whapi_configurations(phone_number);
CREATE INDEX IF NOT EXISTS idx_whapi_configurations_type ON whapi_configurations(type);
CREATE INDEX IF NOT EXISTS idx_messages_source ON messages(message_source);

-- Políticas RLS
ALTER TABLE whapi_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Enable all for authenticated users on whapi_logs" 
ON whapi_logs FOR ALL 
USING (auth.uid() IS NOT NULL);

ALTER TABLE whapi_configurations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Enable all for authenticated users on whapi_configurations" 
ON whapi_configurations FOR ALL 
USING (auth.uid() IS NOT NULL);

-- Trigger para updated_at
CREATE OR REPLACE FUNCTION update_whapi_configurations_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_whapi_configurations_updated_at
  BEFORE UPDATE ON whapi_configurations
  FOR EACH ROW
  EXECUTE FUNCTION update_whapi_configurations_updated_at();
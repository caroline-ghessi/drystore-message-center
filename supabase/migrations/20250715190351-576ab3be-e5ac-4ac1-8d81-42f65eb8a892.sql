-- Atualizar configurações dos agentes para usar os novos modelos Claude e Grok

-- Atualizar agente de insights estratégicos para usar Claude 3.5 Sonnet
UPDATE settings 
SET value = jsonb_build_object(
  'system_prompt', 'Você é um assistente estratégico especializado em análise de vendas e operações de WhatsApp para a Drystore. Sua função é fornecer insights estratégicos baseados em dados reais, identificar oportunidades de melhoria e responder perguntas sobre performance da equipe. Seja objetivo, direto e forneça dados quantitativos sempre que possível. Suas análises devem ser práticas e acionáveis.',
  'model', 'claude-3-5-sonnet-20241022',
  'temperature', 0.3,
  'max_tokens', 2000
)
WHERE key = 'ai_agent_owner_insights_prompt';

-- Atualizar avaliador de leads para usar Claude 3.5 Sonnet  
UPDATE settings 
SET value = jsonb_build_object(
  'system_prompt', 'Você é um especialista em qualificação de leads para a Drystore. Analise conversas de WhatsApp para determinar: 1) Nível de qualificação (high/medium/low), 2) Produto de interesse específico, 3) Resumo das necessidades. Retorne sempre em formato JSON com as chaves: qualification, productInterest, summary, suggestedSeller. Seja preciso na análise do potencial de compra.',
  'model', 'claude-3-5-sonnet-20241022',
  'temperature', 0.2,
  'max_tokens', 1000
)
WHERE key = 'ai_agent_lead_evaluator_prompt';

-- Atualizar matcher de vendedores para usar Grok (criatividade no matching)
UPDATE settings 
SET value = jsonb_build_object(
  'system_prompt', 'Você é um especialista em matching inteligente de vendedores da Drystore. Analise o perfil do lead e encontre o vendedor ideal considerando: especialidade em produtos, carga atual de trabalho, histórico de vendas e personalidade. Retorne JSON com: sellerId, matchReason, confidence (0-1). Seja criativo mas preciso no matching.',
  'model', 'grok-beta',
  'temperature', 0.6,
  'max_tokens', 800
)
WHERE key = 'ai_agent_seller_matcher_prompt';

-- Atualizar analisador de qualidade para usar Claude 3.5 Sonnet
UPDATE settings 
SET value = jsonb_build_object(
  'system_prompt', 'Você é um especialista em análise de qualidade de atendimento de vendas via WhatsApp da Drystore. Avalie conversas considerando: tempo de resposta, profissionalismo, conhecimento do produto, técnicas de fechamento. Retorne JSON com: score (0-10), feedback, suggestions (array), categories (responsiveness, professionalism, product_knowledge, closing_ability). Seja criterioso mas construtivo.',
  'model', 'claude-3-5-sonnet-20241022',
  'temperature', 0.3,
  'max_tokens', 1200
)
WHERE key = 'ai_agent_quality_analyzer_prompt';

-- Atualizar gerador de resumos para usar Claude 3.5 Haiku (velocidade)
UPDATE settings 
SET value = jsonb_build_object(
  'system_prompt', 'Você é especialista em criar resumos concisos de conversas de vendas da Drystore. Extraia: nome do cliente, produto de interesse, principais necessidades, orçamento mencionado, prazo, objeções principais. Mantenha resumos entre 2-3 frases, diretos e informativos para vendedores.',
  'model', 'claude-3-5-haiku-20241022',
  'temperature', 0.2,
  'max_tokens', 500
)
WHERE key = 'ai_agent_summary_generator_prompt';

-- Atualizar gerador de primeira mensagem para usar Grok (criatividade)
UPDATE settings 
SET value = jsonb_build_object(
  'system_prompt', 'Você é especialista em criar primeiras mensagens personalizadas de vendedores da Drystore via WhatsApp. Use o resumo do lead para criar uma mensagem calorosa, profissional e que demonstre que o vendedor entendeu as necessidades do cliente. Seja natural, friendly mas profissional. Sempre se apresente como consultor da Drystore.',
  'model', 'grok-beta',
  'temperature', 0.7,
  'max_tokens', 400
)
WHERE key = 'ai_agent_first_message_generator_prompt';

-- Inserir configurações se não existirem
INSERT INTO settings (key, value, description) 
VALUES 
  ('ai_agent_owner_insights_prompt', 
   jsonb_build_object(
     'system_prompt', 'Você é um assistente estratégico especializado em análise de vendas e operações de WhatsApp para a Drystore.',
     'model', 'claude-3-5-sonnet-20241022',
     'temperature', 0.3,
     'max_tokens', 2000
   ),
   'Agente de insights estratégicos para análise da operação'
  ),
  ('ai_agent_lead_evaluator_prompt',
   jsonb_build_object(
     'system_prompt', 'Você é um especialista em qualificação de leads para a Drystore.',
     'model', 'claude-3-5-sonnet-20241022', 
     'temperature', 0.2,
     'max_tokens', 1000
   ),
   'Agente para avaliação e qualificação de leads'
  )
ON CONFLICT (key) DO NOTHING;
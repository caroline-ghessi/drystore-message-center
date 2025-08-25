import { supabase } from '@/integrations/supabase/client';

interface WhapiMessage {
  to: string;
  content: string;
  type: 'text' | 'media';
  media?: {
    url?: string;
    base64?: string;
    filename?: string;
    caption?: string;
  };
  buttons?: Array<{
    id: string;
    text: string;
  }>;
  quoted?: string;
}

interface WhapiSendResponse {
  success: boolean;
  message_id?: string;
  to?: string;
  error?: string;
}

interface WhapiConfiguration {
  id: string;
  name: string;
  phone_number: string;
  webhook_url: string;
  type: 'rodrigo_bot' | 'seller';
  active: boolean;
  seller_id?: string;
  health_status: 'healthy' | 'unhealthy' | 'unknown';
  last_health_check?: string;
}

export class WhapiService {
  private projectId: string;
  private baseUrl: string;

  constructor() {
    this.projectId = 'groqsnnytvjabgeaekkw';
    this.baseUrl = `https://${this.projectId}.supabase.co/functions/v1`;
  }

  /**
   * Envia mensagem via WHAPI usando token específico
   */
  async sendMessage(
    token: string,
    to: string,
    content: string,
    options?: {
      media?: any;
      buttons?: any[];
      quoted?: string;
    }
  ): Promise<WhapiSendResponse> {
    try {
      const payload: any = {
        token,
        to: this.formatPhoneNumber(to),
        content,
        type: options?.media ? 'media' : 'text'
      };

      if (options?.media) {
        payload.media = options.media;
      }

      if (options?.buttons) {
        payload.buttons = options.buttons;
      }

      if (options?.quoted) {
        payload.quoted = options.quoted;
      }

      const { data, error } = await supabase.functions.invoke('whapi-send', {
        body: payload
      });

      if (error) {
        console.error('Erro WHAPI Service:', error);
        throw error;
      }

      return data;
    } catch (error) {
      console.error('Erro ao enviar mensagem WHAPI:', error);
      throw error;
    }
  }

  /**
   * Configura webhook para um número WHAPI
   */
  async configureWebhook(
    token: string,
    phoneNumber: string,
    type: 'rodrigo_bot' | 'seller',
    sellerId?: string
  ): Promise<WhapiConfiguration> {
    try {
      // Para vendedores, incluir seller_id na URL do webhook
      const webhookUrl = type === 'seller' && sellerId 
        ? `${this.baseUrl}/whapi-webhook/${sellerId}`
        : `${this.baseUrl}/whapi-webhook`;

      const { data, error } = await supabase.functions.invoke('whapi-configure', {
        body: {
          token,
          webhookUrl,
          phoneNumber: this.formatPhoneNumber(phoneNumber),
          type,
          sellerId
        }
      });

      if (error) {
        console.error('Erro ao configurar webhook WHAPI:', error);
        throw error;
      }

      return data.configuration;
    } catch (error) {
      console.error('Erro na configuração WHAPI:', error);
      throw error;
    }
  }

  /**
   * Testa conectividade com token WHAPI
   */
  async testConnection(token: string): Promise<boolean> {
    try {
      const response = await fetch(`https://gate.whapi.cloud/health?token=${token}`);
      return response.ok;
    } catch (error) {
      console.error('Erro ao testar conexão WHAPI:', error);
      return false;
    }
  }

  /**
   * Envia lead para vendedor via Rodrigo Bot (uso interno)
   */
  async sendLeadToSeller(
    sellerId: string,
    leadSummary: string,
    customerPhone: string,
    customerName: string,
    conversationId: string
  ): Promise<void> {
    try {
      console.log('Enviando lead para vendedor via Rodrigo Bot:', { sellerId, customerName });

      // Buscar dados do vendedor
      const { data: seller, error: sellerError } = await supabase
        .from('sellers')
        .select('*')
        .eq('id', sellerId)
        .single();

      if (sellerError || !seller) {
        throw new Error(`Vendedor não encontrado: ${sellerId}`);
      }

      // Buscar configuração do Rodrigo Bot
      const { data: rodrigoConfig, error: configError } = await supabase
        .from('whapi_configurations')
        .select('*')
        .eq('type', 'rodrigo_bot')
        .eq('active', true)
        .single();

      if (configError || !rodrigoConfig) {
        throw new Error('Rodrigo Bot WHAPI não configurado');
      }

      // Buscar token do Rodrigo Bot de forma segura
      const rodrigoToken = await this.getRodrigoBotTokenSecurely();
      
      if (!rodrigoToken) {
        throw new Error('Token do Rodrigo Bot não encontrado nos secrets');
      }

      // Formatar mensagem para uso interno (lead para vendedor)
      const message = `🎯 *Novo Lead Recebido*

*Cliente:* ${customerName}
*Telefone:* ${customerPhone}

*Resumo do Atendimento:*
${leadSummary}

---
_Lead distribuído pelo Rodrigo Bot_
_Responda diretamente para o cliente_`;

      // Enviar mensagem via Rodrigo Bot
      const response = await this.sendMessage(rodrigoToken, seller.phone_number, message);

      if (!response.success) {
        throw new Error(`Falha ao enviar lead: ${response.error}`);
      }

      // Atualizar status do lead
      await supabase
        .from('leads')
        .update({ 
          sent_at: new Date().toISOString(),
          status: 'sent_to_seller',
          seller_id: sellerId
        })
        .eq('conversation_id', conversationId);

      // Log do envio
      await supabase.from('system_logs').insert({
        type: 'info',
        source: 'rodrigo-bot',
        message: 'Lead enviado para vendedor',
        details: {
          sellerId,
          sellerName: seller.name,
          customerName,
          customerPhone,
          conversationId,
          messageId: response.message_id
        }
      });

      console.log('Lead enviado com sucesso via Rodrigo Bot:', sellerId);

      // Se primeira mensagem automática estiver ativa, usar WHAPI do vendedor
      if (seller.auto_first_message && seller.whapi_status === 'connected') {
        await this.sendAutoFirstMessage(seller, customerPhone, leadSummary);
      }

    } catch (error) {
      console.error('Erro ao enviar lead via Rodrigo Bot:', error);
      
      await supabase.from('system_logs').insert({
        type: 'error',
        source: 'rodrigo-bot',
        message: 'Erro ao enviar lead para vendedor',
        details: { error: error.message, sellerId, conversationId }
      });

      throw error;
    }
  }

  /**
   * Envia primeira mensagem automática do vendedor para o cliente
   */
  private async sendAutoFirstMessage(
    seller: any,
    customerPhone: string,
    leadSummary: string
  ): Promise<void> {
    try {
      // Buscar token do vendedor de forma segura
      const sellerToken = await this.getSellerTokenSecurely(seller.phone_number);
      
      if (!sellerToken) {
        console.warn(`Token WHAPI não encontrado para vendedor ${seller.name}`);
        return;
      }

      // Gerar mensagem com IA (pode ser implementado depois)
      const firstMessage = await this.generateFirstMessage(leadSummary, seller.name);

      // Enviar usando o token do vendedor
      await this.sendMessage(sellerToken, customerPhone, firstMessage);

      // Log da mensagem automática
      await supabase.from('system_logs').insert({
        type: 'success',
        source: 'whapi-service',
        message: `Primeira mensagem automática enviada por ${seller.name}`,
        details: { 
          seller_id: seller.id,
          customer_phone: customerPhone,
          auto_generated: true 
        }
      });

    } catch (error) {
      console.error('Erro ao enviar primeira mensagem automática:', error);
    }
  }

  /**
   * Envia alertas para gestores via Rodrigo Bot (uso interno)
   */
  async sendAlertToManagers(
    alertType: 'poor_service' | 'delayed_response' | 'lost_opportunity',
    details: {
      sellerName: string;
      customerName: string;
      issue: string;
      conversationId: string;
    }
  ): Promise<void> {
    try {
      console.log('Enviando alerta para gestores via Rodrigo Bot:', { alertType, details });

      // Buscar números dos gestores na configuração
      const { data: managersConfig, error: configError } = await supabase
        .from('settings')
        .select('value')
        .eq('key', 'manager_phones')
        .single();

      if (configError || !managersConfig) {
        console.log('Números de gestores não configurados');
        return;
      }

      const managerPhones = managersConfig.value as string[];
      if (!managerPhones || managerPhones.length === 0) {
        console.log('Lista de gestores vazia');
        return;
      }

      // Buscar configuração do Rodrigo Bot
      const { data: rodrigoConfig, error: rodrigoError } = await supabase
        .from('whapi_configurations')
        .select('*')
        .eq('type', 'rodrigo_bot')
        .eq('active', true)
        .single();

      if (rodrigoError || !rodrigoConfig) {
        throw new Error('Rodrigo Bot WHAPI não configurado');
      }

      // Buscar token do Rodrigo Bot de forma segura
      const rodrigoToken = await this.getRodrigoBotTokenSecurely();
      
      if (!rodrigoToken) {
        throw new Error('Token do Rodrigo Bot não encontrado');
      }

      // Preparar mensagem de alerta
      const alertConfig = {
        poor_service: {
          emoji: '⚠️',
          title: 'Alerta de Qualidade de Atendimento'
        },
        delayed_response: {
          emoji: '⏰',
          title: 'Alerta de Atraso na Resposta'
        },
        lost_opportunity: {
          emoji: '❌',
          title: 'Alerta de Oportunidade Perdida'
        }
      };

      const config = alertConfig[alertType];
      const message = `${config.emoji} *${config.title}*

*Vendedor:* ${details.sellerName}
*Cliente:* ${details.customerName}
*Problema:* ${details.issue}

*ID da Conversa:* ${details.conversationId}

---
_Alerta automático do sistema de monitoramento_`;

      // Enviar para todos os gestores
      let successCount = 0;
      for (const managerPhone of managerPhones) {
        try {
          await this.sendMessage(rodrigoToken, managerPhone, message);
          successCount++;
          console.log('Alerta enviado para gestor:', managerPhone);
        } catch (error) {
          console.error('Erro ao enviar alerta para gestor:', managerPhone, error);
        }
      }

      // Log da ação
      await supabase.from('system_logs').insert({
        type: 'info',
        source: 'rodrigo-bot',
        message: 'Alerta enviado para gestores',
        details: {
          alertType,
          managersTotal: managerPhones.length,
          managersNotified: successCount,
          ...details
        }
      });

      console.log(`Alerta enviado para ${successCount}/${managerPhones.length} gestores`);

    } catch (error) {
      console.error('Erro ao enviar alerta para gestores:', error);
      
      // Log do erro
      await supabase.from('system_logs').insert({
        type: 'error',
        source: 'rodrigo-bot',
        message: 'Erro ao enviar alerta para gestores',
        details: { alertType, error: error.message, ...details }
      });

      throw error;
    }
  }

  /**
   * Buscar configurações WHAPI
   */
  async getConfigurations(): Promise<WhapiConfiguration[]> {
    const { data, error } = await supabase
      .from('whapi_configurations')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Erro ao buscar configurações WHAPI:', error);
      return [];
    }

    return (data || []).map(config => ({
      id: config.id,
      name: config.name,
      phone_number: config.phone_number,
      webhook_url: config.webhook_url,
      type: config.type as 'rodrigo_bot' | 'seller',
      active: config.active,
      seller_id: config.seller_id,
      health_status: config.health_status as 'healthy' | 'unhealthy' | 'unknown',
      last_health_check: config.last_health_check
    }));
  }

  /**
   * Buscar logs WHAPI
   */
  async getLogs(limit: number = 100) {
    const { data, error } = await supabase
      .from('whapi_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('Erro ao buscar logs WHAPI:', error);
      return [];
    }

    return data || [];
  }

  /**
   * Helpers privados
   */
  private formatPhoneNumber(phone: string): string {
    // Remove caracteres não numéricos
    const cleaned = phone.replace(/\D/g, '');
    
    // Validação de número brasileiro
    if (cleaned.length < 10 || cleaned.length > 13) {
      throw new Error(`Número de telefone inválido: ${phone}`);
    }
    
    // Se já começa com 55, retorna como está
    if (cleaned.startsWith('55')) {
      return cleaned;
    }
    
    // Se começa com 0, remove o 0 e adiciona 55
    if (cleaned.startsWith('0')) {
      return `55${cleaned.substring(1)}`;
    }
    
    // Se tem 10 ou 11 dígitos (formato brasileiro sem código do país), adiciona 55
    if (cleaned.length >= 10 && cleaned.length <= 11) {
      return `55${cleaned}`;
    }
    
    // Para outros casos, assume que precisa do código do país
    return `55${cleaned}`;
  }

  private formatLeadMessage(summary: string, customerName: string, phone: string): string {
    return `🔔 *Novo Lead Recebido*\n\n` +
           `👤 *Cliente:* ${customerName}\n` +
           `📱 *WhatsApp:* ${phone}\n\n` +
           `📋 *Resumo do Atendimento:*\n${summary}\n\n` +
           `⏰ _Por favor, inicie o atendimento o quanto antes._`;
  }

  private formatAlertMessage(type: string, details: any): string {
    const titles = {
      'poor_service': '⚠️ Alerta de Qualidade no Atendimento',
      'delayed_response': '⏱️ Alerta de Demora na Resposta',
      'lost_opportunity': '❌ Alerta de Oportunidade Perdida'
    };

    return `${titles[type]}\n\n` +
           `👥 *Vendedor:* ${details.sellerName}\n` +
           `👤 *Cliente:* ${details.customerName}\n\n` +
           `📝 *Situação:*\n${details.issue}\n\n` +
           `🔗 *ID da Conversa:* ${details.conversationId}\n\n` +
           `_Ação imediata pode ser necessária._`;
  }

  private async generateFirstMessage(summary: string, sellerName: string): Promise<string> {
    // Implementar integração com Claude AI depois
    return `Olá! Eu sou ${sellerName} da Drystore. Vi que você tem interesse em nossos produtos. Como posso ajudá-lo hoje?`;
  }

  // Helper seguro para obter token de vendedor
  private async getSellerTokenSecurely(sellerId: string): Promise<string | null> {
    try {
      const { data: tokenData } = await supabase.functions.invoke('get-whapi-token', {
        body: { 
          tokenSecretName: `WHAPI_TOKEN_${sellerId.replace(/\D/g, '')}`,
          sellerId,
          requesterType: 'system'
        }
      })
      
      return tokenData?.success ? tokenData.token : null
    } catch (error) {
      console.error('Erro ao obter token do vendedor:', error)
      return null
    }
  }

  // Helper seguro para obter token do Rodrigo Bot
  private async getRodrigoBotTokenSecurely(): Promise<string | null> {
    try {
      const { data: tokenData } = await supabase.functions.invoke('get-whapi-token', {
        body: { 
          tokenSecretName: 'WHAPI_TOKEN_5551981155622',
          requesterType: 'system'
        }
      })
      
      return tokenData?.success ? tokenData.token : null
    } catch (error) {
      console.error('Erro ao obter token do Rodrigo Bot:', error)
      return null
    }
  }
}

export const whapiService = new WhapiService();
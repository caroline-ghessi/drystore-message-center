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
      const webhookUrl = `${this.baseUrl}/whapi-webhook`;

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
   * Envia lead do Rodrigo Bot para vendedor
   */
  async sendLeadToSeller(
    sellerId: string,
    leadSummary: string,
    customerPhone: string,
    customerName: string,
    conversationId: string
  ): Promise<void> {
    try {
      // Buscar dados do vendedor
      const { data: seller, error: sellerError } = await supabase
        .from('sellers')
        .select('*')
        .eq('id', sellerId)
        .single();

      if (sellerError || !seller) {
        throw new Error('Vendedor não encontrado');
      }

      // Buscar configuração do Rodrigo Bot
      const { data: rodrigoConfig, error: configError } = await supabase
        .from('whapi_configurations')
        .select('*')
        .eq('type', 'rodrigo_bot')
        .eq('active', true)
        .single();

      if (configError || !rodrigoConfig) {
        throw new Error('Configuração do Rodrigo Bot não encontrada');
      }

      // Buscar token do Rodrigo Bot (secret)
      const rodrigoToken = await this.getSecretValue(rodrigoConfig.token_secret_name);
      
      if (!rodrigoToken) {
        throw new Error('Token do Rodrigo Bot não configurado');
      }

      // Formatar mensagem do lead
      const message = this.formatLeadMessage(leadSummary, customerName, customerPhone);

      // Enviar para o vendedor
      await this.sendMessage(rodrigoToken, seller.phone_number, message);

      // Atualizar status do lead
      await supabase
        .from('leads')
        .update({ 
          sent_at: new Date().toISOString(),
          status: 'attending' 
        })
        .eq('conversation_id', conversationId);

      // Log do envio
      await supabase.from('system_logs').insert({
        type: 'success',
        source: 'whapi-service',
        message: `Lead enviado ao vendedor ${seller.name}`,
        details: {
          seller_id: sellerId,
          customer_name: customerName,
          customer_phone: customerPhone,
          conversation_id: conversationId
        }
      });

      // Se primeira mensagem automática estiver ativa
      if (seller.auto_first_message && seller.whapi_status === 'connected') {
        await this.sendAutoFirstMessage(seller, customerPhone, leadSummary);
      }

    } catch (error) {
      console.error('Erro ao enviar lead para vendedor:', error);
      
      await supabase.from('system_logs').insert({
        type: 'error',
        source: 'whapi-service',
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
      // Buscar token do vendedor
      const sellerToken = await this.getSecretValue(`WHAPI_TOKEN_${seller.phone_number.replace(/\D/g, '')}`);
      
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
   * Envia alerta para gestores
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
      // Buscar configuração do Rodrigo Bot
      const { data: rodrigoConfig } = await supabase
        .from('whapi_configurations')
        .select('*')
        .eq('type', 'rodrigo_bot')
        .eq('active', true)
        .single();

      if (!rodrigoConfig) {
        console.warn('Rodrigo Bot não configurado para envio de alertas');
        return;
      }

      const rodrigoToken = await this.getSecretValue(rodrigoConfig.token_secret_name);
      
      if (!rodrigoToken) {
        console.warn('Token do Rodrigo Bot não encontrado');
        return;
      }

      // Buscar gestores (pode ser implementado com tabela de gestores)
      // Por enquanto, usar um número fixo ou configuração
      const managerPhone = '5551999999999'; // Implementar busca real

      // Formatar mensagem de alerta
      const alertMessage = this.formatAlertMessage(alertType, details);

      // Enviar alerta
      await this.sendMessage(rodrigoToken, managerPhone, alertMessage);

      // Log do alerta
      await supabase.from('system_logs').insert({
        type: 'warning',
        source: 'whapi-service',
        message: `Alerta ${alertType} enviado aos gestores`,
        details: details
      });

    } catch (error) {
      console.error('Erro ao enviar alerta aos gestores:', error);
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
    const cleaned = phone.replace(/\D/g, '');
    if (!cleaned.startsWith('55')) {
      return `55${cleaned}`;
    }
    return cleaned;
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

  private async getSecretValue(secretName: string): Promise<string | null> {
    // Em um ambiente real, isso buscaria o secret do Supabase
    // Por enquanto, simular a busca
    console.log(`Buscando secret: ${secretName}`);
    return process.env[secretName] || null;
  }
}

export const whapiService = new WhapiService();
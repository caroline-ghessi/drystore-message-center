import { supabase } from '@/integrations/supabase/client';

interface DifyMessage {
  inputs: Record<string, any>;
  query: string;
  response_mode: 'blocking' | 'streaming';
  conversation_id?: string;
  user: string;
  files?: Array<{
    type: string;
    transfer_method: string;
    url?: string;
    upload_file_id?: string;
  }>;
}

interface DifyResponse {
  message_id: string;
  conversation_id: string;
  mode: string;
  answer: string;
  metadata: {
    usage: {
      prompt_tokens: number;
      completion_tokens: number;
      total_tokens: number;
    };
    retriever_resources?: Array<any>;
  };
  created_at: number;
}

class DifyService {
  private async getConfig() {
    const { data: integration } = await supabase
      .from('integrations')
      .select('config, active')
      .eq('type', 'dify')
      .eq('active', true)
      .single();

    if (!integration?.config) {
      throw new Error('Integração Dify não configurada');
    }

    return integration.config as { api_url: string; api_key: string };
  }

  /**
   * Envia mensagem para o chatflow do Dify
   */
  async sendMessage(
    message: string,
    conversationId?: string,
    userId?: string,
    files?: any[]
  ): Promise<DifyResponse> {
    try {
      const config = await this.getConfig();
      
      const payload: DifyMessage = {
        inputs: {},
        query: message,
        response_mode: 'blocking',
        user: userId || 'default-user',
      };

      if (conversationId) {
        payload.conversation_id = conversationId;
      }

      if (files && files.length > 0) {
        payload.files = files.map(file => ({
          type: 'image',
          transfer_method: 'remote_url',
          url: file.url
        }));
      }

      const response = await fetch(`${config.api_url}/chat-messages`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${config.api_key}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Dify API error: ${response.statusText} - ${errorText}`);
      }

      const data: DifyResponse = await response.json();
      
      // Log de sucesso
      await supabase.from('system_logs').insert({
        type: 'info',
        source: 'dify',
        message: 'Mensagem enviada com sucesso',
        details: {
          message_id: data.message_id,
          conversation_id: data.conversation_id,
          tokens_used: data.metadata.usage.total_tokens
        }
      });
      
      return data;
    } catch (error) {
      console.error('Erro ao enviar mensagem para Dify:', error);
      
      // Log de erro
      await supabase.from('system_logs').insert({
        type: 'error',
        source: 'dify',
        message: 'Erro ao enviar mensagem',
        details: { error: error.message }
      });
      
      throw error;
    }
  }

  /**
   * Implementação de streaming para respostas em tempo real
   */
  async sendMessageStreaming(
    message: string,
    conversationId?: string,
    userId?: string,
    onChunk?: (chunk: string) => void
  ): Promise<string> {
    try {
      const config = await this.getConfig();
      
      const payload: DifyMessage = {
        inputs: {},
        query: message,
        response_mode: 'streaming',
        user: userId || 'default-user',
      };

      if (conversationId) {
        payload.conversation_id = conversationId;
      }

      const response = await fetch(`${config.api_url}/chat-messages`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${config.api_key}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Dify API error: ${response.statusText} - ${errorText}`);
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let fullAnswer = '';

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value);
          const lines = chunk.split('\n');

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const data = line.slice(6);
              if (data === '[DONE]') continue;

              try {
                const parsed = JSON.parse(data);
                if (parsed.answer) {
                  fullAnswer += parsed.answer;
                  onChunk?.(parsed.answer);
                }
              } catch (e) {
                console.error('Erro ao parsear chunk:', e);
              }
            }
          }
        }
      }

      return fullAnswer;
    } catch (error) {
      console.error('Erro no streaming Dify:', error);
      throw error;
    }
  }

  /**
   * Testa conexão com Dify
   */
  async testConnection(): Promise<boolean> {
    try {
      const response = await this.sendMessage(
        'Teste de conexão',
        undefined,
        'test-user'
      );
      return !!response.answer;
    } catch (error) {
      console.error('Erro ao testar conexão Dify:', error);
      return false;
    }
  }

  /**
   * Busca histórico de conversa
   */
  async getConversationHistory(conversationId: string) {
    try {
      const config = await this.getConfig();
      
      const response = await fetch(
        `${config.api_url}/messages?conversation_id=${conversationId}`,
        {
          headers: {
            'Authorization': `Bearer ${config.api_key}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error(`Dify API error: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Erro ao buscar histórico:', error);
      throw error;
    }
  }
}

export const difyService = new DifyService();
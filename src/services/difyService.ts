import { supabase } from '@/integrations/supabase/client';

interface DifyFile {
  type: 'document' | 'image' | 'audio' | 'video' | 'other';
  transfer_method: 'remote_url' | 'local_file';
  url?: string;
  upload_file_id?: string;
}

interface DifyMessage {
  inputs: {
    arquivo?: DifyFile[];
    [key: string]: any;
  };
  query: string;
  response_mode: 'blocking' | 'streaming';
  conversation_id?: string;
  user: string;
  files?: DifyFile[];
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

    const config = integration.config as { api_url: string };
    
    // A API Key vem dos secrets do Supabase via edge function
    return { 
      api_url: config.api_url,
      api_key: 'MANAGED_BY_EDGE_FUNCTION' // Será usado via edge function
    };
  }

  /**
   * Detecta o tipo de arquivo baseado no MIME type ou URL
   */
  private getFileType(mimeTypeOrUrl: string): DifyFile['type'] {
    const mimeType = mimeTypeOrUrl.toLowerCase();
    
    if (mimeType.includes('image/') || mimeType.includes('.jpg') || mimeType.includes('.png') || mimeType.includes('.gif') || mimeType.includes('.webp')) {
      return 'image';
    }
    if (mimeType.includes('audio/') || mimeType.includes('.mp3') || mimeType.includes('.m4a') || mimeType.includes('.wav') || mimeType.includes('.amr')) {
      return 'audio';
    }
    if (mimeType.includes('video/') || mimeType.includes('.mp4') || mimeType.includes('.mov') || mimeType.includes('.mpeg') || mimeType.includes('.webm')) {
      return 'video';
    }
    if (mimeType.includes('pdf') || mimeType.includes('document') || mimeType.includes('msword') || 
        mimeType.includes('sheet') || mimeType.includes('presentation') || mimeType.includes('.doc') || 
        mimeType.includes('.xls') || mimeType.includes('.ppt')) {
      return 'document';
    }
    return 'other';
  }

  /**
   * Envia mensagem para o chatflow do Dify via edge function
   */
  async sendMessage(
    message: string,
    conversationId?: string,
    userId?: string,
    files?: any[]
  ): Promise<DifyResponse> {
    try {
      // Usa edge function para manter API key segura
      const { data, error } = await supabase.functions.invoke('dify-chat', {
        body: {
          message,
          conversationId,
          userId: userId || 'default-user',
          files
        }
      });

      if (error) {
        throw new Error(error.message);
      }

      return data as DifyResponse;
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
   * Envia mensagem com arquivos para o Dify
   */
  async sendMessageWithFiles(
    message: string,
    fileUrls: string[],
    conversationId?: string,
    userId?: string
  ): Promise<DifyResponse> {
    try {
      const difyFiles: DifyFile[] = fileUrls.map(url => ({
        type: this.getFileType(url),
        transfer_method: 'remote_url',
        url: url
      }));

      const { data, error } = await supabase.functions.invoke('dify-chat', {
        body: {
          message,
          conversationId,
          userId: userId || 'default-user',
          files: difyFiles,
          hasFiles: true
        }
      });

      if (error) {
        throw new Error(error.message);
      }

      return data as DifyResponse;
    } catch (error) {
      console.error('Erro ao enviar mensagem com arquivos para Dify:', error);
      
      // Log de erro
      await supabase.from('system_logs').insert({
        type: 'error',
        source: 'dify',
        message: 'Erro ao enviar mensagem com arquivos',
        details: { error: error.message, fileCount: fileUrls.length }
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
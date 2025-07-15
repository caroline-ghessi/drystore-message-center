import { useState, useCallback } from 'react';
import { difyService } from '@/services/difyService';
import { toast } from 'sonner';

interface UseDifyChatOptions {
  conversationId?: string;
  userId?: string;
  onStreamChunk?: (chunk: string) => void;
}

interface ChatMessage {
  type: 'user' | 'bot';
  content: string;
  streaming?: boolean;
  timestamp: Date;
}

export const useDifyChat = (options: UseDifyChatOptions = {}) => {
  const [loading, setLoading] = useState(false);
  const [conversationId, setConversationId] = useState(options.conversationId);
  const [messages, setMessages] = useState<ChatMessage[]>([]);

  const sendMessage = useCallback(async (message: string, files?: any[]) => {
    setLoading(true);
    try {
      const response = await difyService.sendMessage(
        message,
        conversationId,
        options.userId,
        files
      );

      // Atualiza o ID da conversa se for uma nova conversa
      if (!conversationId && response.conversation_id) {
        setConversationId(response.conversation_id);
      }

      // Adiciona mensagens ao estado local
      setMessages(prev => [
        ...prev,
        { type: 'user', content: message, timestamp: new Date() },
        { type: 'bot', content: response.answer, timestamp: new Date() }
      ]);

      return response;
    } catch (error) {
      toast.error('Erro ao enviar mensagem para o bot');
      throw error;
    } finally {
      setLoading(false);
    }
  }, [conversationId, options.userId]);

  const sendMessageStreaming = useCallback(async (message: string) => {
    setLoading(true);
    let fullResponse = '';
    
    try {
      // Adiciona mensagem do usuário
      setMessages(prev => [...prev, { type: 'user', content: message, timestamp: new Date() }]);
      
      // Adiciona placeholder para resposta do bot
      setMessages(prev => [...prev, { type: 'bot', content: '', streaming: true, timestamp: new Date() }]);

      fullResponse = await difyService.sendMessageStreaming(
        message,
        conversationId,
        options.userId,
        (chunk) => {
          // Atualiza a última mensagem (bot) com o chunk
          setMessages(prev => {
            const newMessages = [...prev];
            const lastMessage = newMessages[newMessages.length - 1];
            if (lastMessage && lastMessage.type === 'bot') {
              lastMessage.content += chunk;
            }
            return newMessages;
          });
          
          options.onStreamChunk?.(chunk);
        }
      );

      // Marca como finalizado
      setMessages(prev => {
        const newMessages = [...prev];
        const lastMessage = newMessages[newMessages.length - 1];
        if (lastMessage && lastMessage.type === 'bot') {
          lastMessage.streaming = false;
        }
        return newMessages;
      });

      return fullResponse;
    } catch (error) {
      toast.error('Erro ao enviar mensagem para o bot');
      throw error;
    } finally {
      setLoading(false);
    }
  }, [conversationId, options.userId, options.onStreamChunk]);

  const clearConversation = useCallback(() => {
    setConversationId(undefined);
    setMessages([]);
  }, []);

  const testConnection = useCallback(async () => {
    setLoading(true);
    try {
      const isConnected = await difyService.testConnection();
      if (isConnected) {
        toast.success('Conexão com Dify funcionando!');
      } else {
        toast.error('Falha na conexão com Dify');
      }
      return isConnected;
    } catch (error) {
      toast.error('Erro ao testar conexão');
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    loading,
    conversationId,
    messages,
    sendMessage,
    sendMessageStreaming,
    clearConversation,
    testConnection
  };
};

import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface ManualTransferData {
  conversationId: string;
  sellerId: string;
  summary: string;
  notes?: string;
}

export function useManualTransfer() {
  const [isLoading, setIsLoading] = useState(false);
  const [isGeneratingSummary, setIsGeneratingSummary] = useState(false);

  const generateSummary = async (conversationId: string): Promise<string> => {
    setIsGeneratingSummary(true);
    try {
      // Buscar mensagens da conversa
      const { data: messages, error: messagesError } = await supabase
        .from('messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true });

      if (messagesError) throw messagesError;

      // Buscar dados da conversa
      const { data: conversation, error: conversationError } = await supabase
        .from('conversations')
        .select('*')
        .eq('id', conversationId)
        .single();

      if (conversationError) throw conversationError;

      // Formatar mensagens para o contexto
      const formattedMessages = messages.map(msg => 
        `${msg.sender_type === 'customer' ? 'Cliente' : 'Bot'}: ${msg.content}`
      ).join('\n');

      // Chamar edge function anthropic-agent com formato correto
      const { data, error } = await supabase.functions.invoke('anthropic-agent', {
        body: {
          agentKey: 'ai_agent_summary_generator_prompt',
          messages: [
            {
              role: 'user',
              content: `Gere um resumo profissional da seguinte conversa de WhatsApp para transferir ao vendedor:\n\nCliente: ${conversation.customer_name || 'Cliente'}\nTelefone: ${conversation.phone_number}\n\nConversa:\n${formattedMessages}\n\nO resumo deve incluir: necessidades do cliente, produtos de interesse, urgência, e informações relevantes para o vendedor dar continuidade ao atendimento.`
            }
          ],
          context: {
            conversation_id: conversationId,
            customer_name: conversation.customer_name,
            phone_number: conversation.phone_number,
            total_messages: messages.length
          }
        }
      });

      if (error) {
        console.error('Erro na edge function anthropic-agent:', error);
        throw error;
      }

      // A resposta da edge function tem o formato { result, usage, agentKey }
      const summary = data?.result || 'Resumo não pôde ser gerado. Verifique a configuração do agente de IA.';
      
      console.log('Resumo gerado com sucesso:', summary);
      return summary;

    } catch (error) {
      console.error('Erro ao gerar resumo:', error);
      toast.error('Erro ao gerar resumo da conversa. Verifique as configurações da IA.');
      throw error;
    } finally {
      setIsGeneratingSummary(false);
    }
  };

  const transferToSeller = async ({
    conversationId,
    sellerId,
    summary,
    notes
  }: ManualTransferData) => {
    setIsLoading(true);
    try {
      // 1. Buscar dados da conversa e vendedor
      const [conversationResult, sellerResult] = await Promise.all([
        supabase
          .from('conversations')
          .select('*')
          .eq('id', conversationId)
          .single(),
        supabase
          .from('sellers')
          .select('*')
          .eq('id', sellerId)
          .single()
      ]);

      if (conversationResult.error) throw conversationResult.error;
      if (sellerResult.error) throw sellerResult.error;

      const conversation = conversationResult.data;
      const seller = sellerResult.data;

      // 2. Criar lead
      const { data: lead, error: leadError } = await supabase
        .from('leads')
        .insert({
          customer_name: conversation.customer_name || 'Cliente',
          phone_number: conversation.phone_number,
          conversation_id: conversationId,
          seller_id: sellerId,
          summary: summary,
          ai_evaluation: notes || '',
          status: 'attending'
        })
        .select()
        .single();

      if (leadError) throw leadError;

      // 3. Atualizar conversa
      const { error: updateError } = await supabase
        .from('conversations')
        .update({
          status: 'sent_to_seller',
          assigned_seller_id: sellerId,
          updated_at: new Date().toISOString()
        })
        .eq('id', conversationId);

      if (updateError) throw updateError;

      // 4. Buscar configuração do Rodrigo Bot
      const { data: rodrigoConfig, error: rodrigoConfigError } = await supabase
        .from('whapi_configurations')
        .select('*')
        .eq('type', 'rodrigo_bot')
        .eq('active', true)
        .single();

      if (rodrigoConfigError || !rodrigoConfig) {
        throw new Error('Rodrigo Bot não está configurado. Configure-o na seção WHAPI.');
      }

      // 5. Buscar token do Rodrigo Bot dos secrets
      const { data: tokenData, error: tokenError } = await supabase.functions.invoke('get-secret', {
        body: { secretName: rodrigoConfig.token_secret_name }
      });

      if (tokenError || !tokenData?.value) {
        throw new Error(`Token do Rodrigo Bot não encontrado. Secret: ${rodrigoConfig.token_secret_name}`);
      }

      // 6. Formatar mensagem para o vendedor
      const messageContent = `🎯 *NOVO LEAD RECEBIDO*

*Cliente:* ${conversation.customer_name || 'Cliente'}
*Telefone:* ${conversation.phone_number}
*ID da Conversa:* ${conversationId}

*📋 Resumo do Atendimento:*
${summary}

${notes ? `*📝 Observações Adicionais:*\n${notes}\n\n` : ''}---
_Lead distribuído automaticamente pelo sistema_
_Responda o cliente o quanto antes_`;

      // 7. Enviar via Rodrigo Bot com dados corretos
      const { data: sendResult, error: sendError } = await supabase.functions.invoke('whapi-send', {
        body: {
          token: tokenData.value,
          to: seller.phone_number,
          content: messageContent,
          type: 'text'
        }
      });

      if (sendError) {
        console.error('Erro ao enviar via Rodrigo Bot:', sendError);
        throw new Error(`Falha no envio via WhatsApp: ${sendError.message}`);
      }

      if (!sendResult?.success) {
        throw new Error(`Falha no envio: ${sendResult?.error || 'Erro desconhecido'}`);
      }

      // 8. Atualizar lead com dados do envio
      await supabase
        .from('leads')
        .update({
          sent_at: new Date().toISOString(),
          status: 'sent_to_seller'
        })
        .eq('id', lead.id);

      // 9. Log de sucesso
      await supabase.from('system_logs').insert({
        type: 'success',
        source: 'manual-transfer',
        message: `Lead transferido manualmente para ${seller.name}`,
        details: {
          lead_id: lead.id,
          seller_id: sellerId,
          seller_name: seller.name,
          customer_name: conversation.customer_name,
          customer_phone: conversation.phone_number,
          conversation_id: conversationId,
          whapi_message_id: sendResult.message_id
        }
      });

      toast.success(`Lead enviado com sucesso para ${seller.name} via Rodrigo Bot!`);
      return lead;

    } catch (error) {
      console.error('Erro na transferência manual:', error);
      
      // Log do erro
      await supabase.from('system_logs').insert({
        type: 'error',
        source: 'manual-transfer',
        message: 'Erro na transferência manual de lead',
        details: { 
          error: error.message, 
          conversation_id: conversationId,
          seller_id: sellerId
        }
      });

      toast.error(`Erro na transferência: ${error.message}`);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  return {
    generateSummary,
    transferToSeller,
    isLoading,
    isGeneratingSummary
  };
}


import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface SendLeadRequest {
  leadId: string;
  sellerId: string;
  summary: string;
  customerName: string;
  customerPhone: string;
  productInterest?: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { leadId, sellerId, summary, customerName, customerPhone, productInterest }: SendLeadRequest = await req.json()
    console.log('📨 Enviando lead para vendedor (FLUXO CORRIGIDO):', { leadId, sellerId, customerName })

    const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2')
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    // Buscar dados do vendedor
    const { data: seller, error: sellerError } = await supabase
      .from('sellers')
      .select('name, phone_number, auto_first_message')
      .eq('id', sellerId)
      .single()

    if (sellerError || !seller) {
      throw new Error(`Vendedor não encontrado: ${sellerError?.message}`)
    }

    // CRÍTICO: SEMPRE usar o token do Rodrigo Bot (5551981155622) para comunicações internas
    const rodrigoBotToken = Deno.env.get('WHAPI_TOKEN_5551981155622')
    if (!rodrigoBotToken) {
      throw new Error('Token do Rodrigo Bot não encontrado')
    }

    console.log('🤖 Usando Rodrigo Bot (5551981155622) para enviar lead ao vendedor:', seller.name)

    // Preparar mensagem de resumo do lead
    const leadMessage = `🆕 **NOVO LEAD ATRIBUÍDO**

📋 **Resumo do Atendimento:**
${summary}

👤 **Cliente:** ${customerName}
📱 **Telefone:** ${customerPhone}
${productInterest ? `🛍️ **Interesse:** ${productInterest}` : ''}

⏰ **Data:** ${new Date().toLocaleString('pt-BR')}

---
💡 *Este lead foi atribuído automaticamente pelo sistema baseado no seu perfil e especialidades.*

🔄 **FLUXO CORRIGIDO:** Rodrigo Bot (5551981155622) → ${seller.name}`

    // Enviar mensagem via Rodrigo Bot (FLUXO CORRIGIDO)
    const sendPayload = {
      token: rodrigoBotToken, // TOKEN DO RODRIGO BOT
      to: seller.phone_number, // NÚMERO DO VENDEDOR (DESTINO)
      content: leadMessage
    }

    console.log('📤 Enviando mensagem do Rodrigo Bot para vendedor (FLUXO CORRIGIDO):', {
      de: 'Rodrigo Bot (5551981155622)',
      para: `${seller.name} (${seller.phone_number})`,
      leadId,
      fluxo_esperado: `5551981155622 → ${seller.phone_number}`
    })

    const { data: sendResult, error: sendError } = await supabase.functions.invoke('whapi-send', {
      body: sendPayload
    })

    if (sendError) {
      throw new Error(`Erro ao enviar mensagem: ${sendError.message}`)
    }

    console.log('✅ Lead enviado com sucesso via Rodrigo Bot (FLUXO CORRIGIDO)')

    // Atualizar status do lead
    await supabase
      .from('leads')
      .update({
        status: 'sent_to_seller',
        sent_at: new Date().toISOString()
      })
      .eq('id', leadId)

    // Se o vendedor tem primeira mensagem automática habilitada, gerar e enviar
    if (seller.auto_first_message) {
      console.log('🤖 Gerando primeira mensagem automática para o cliente...')
      
      try {
        // Gerar primeira mensagem usando IA
        const { data: aiResponse } = await supabase.functions.invoke('anthropic-agent', {
          body: {
            prompt: `Crie uma mensagem de apresentação profissional de um vendedor para um novo cliente.

Contexto:
- Vendedor: ${seller.name}
- Cliente: ${customerName}
- Interesse: ${productInterest || 'produtos em geral'}
- Resumo do atendimento: ${summary}

A mensagem deve:
1. Ser calorosa e profissional
2. Referenciar o interesse específico do cliente
3. Demonstrar que você leu o histórico do atendimento
4. Oferecer próximos passos concretos
5. Ter no máximo 3 parágrafos

Retorne apenas a mensagem, sem aspas ou formatação extra.`,
            context: `Vendedor especializado criando primeira mensagem para lead qualificado`
          }
        })

        if (aiResponse?.response) {
          console.log('💬 Primeira mensagem gerada, enviando para cliente...')
          
          // IMPORTANTE: Para primeira mensagem ao cliente, deveria usar token do vendedor
          // Mas por enquanto mantemos Rodrigo Bot até garantir que está funcionando
          const firstMessagePayload = {
            token: rodrigoBotToken, // TODO: Usar token do vendedor quando sistema estiver estável
            to: customerPhone,
            content: aiResponse.response
          }

          const { data: firstMsgResult } = await supabase.functions.invoke('whapi-send', {
            body: firstMessagePayload
          })

          if (firstMsgResult?.success) {
            console.log('✅ Primeira mensagem automática enviada')
          }
        }
      } catch (error) {
        console.error('⚠️ Erro ao enviar primeira mensagem automática:', error)
        // Não falhar a operação principal por causa disso
      }
    }

    // Log do sistema
    await supabase
      .from('system_logs')
      .insert({
        type: 'info',
        source: 'lead_transfer',
        message: `Lead ${leadId} enviado para vendedor ${seller.name} via Rodrigo Bot (FLUXO CORRIGIDO)`,
        details: {
          lead_id: leadId,
          seller_id: sellerId,
          seller_name: seller.name,
          seller_phone: seller.phone_number,
          customer_name: customerName,
          customer_phone: customerPhone,
          product_interest: productInterest,
          rodrigo_bot_used: true,
          rodrigo_bot_phone: '5551981155622',
          auto_first_message: seller.auto_first_message,
          send_result: sendResult,
          fluxo_corrigido: `5551981155622 → ${seller.phone_number}`,
          expected_whatsapp_behavior: {
            rodrigo_bot_whatsapp: `Mensagem aparece como ENVIADA para ${seller.name}`,
            seller_whatsapp: `Mensagem aparece como RECEBIDA do Rodrigo Bot`
          }
        }
      })

    return new Response(
      JSON.stringify({
        success: true,
        message: `Lead enviado para ${seller.name} via Rodrigo Bot (FLUXO CORRIGIDO)`,
        details: {
          lead_id: leadId,
          seller: {
            id: sellerId,
            name: seller.name,
            phone: seller.phone_number
          },
          communication_flow: "Rodrigo Bot → Vendedor (CORRIGIDO)",
          sender: "Rodrigo Bot (5551981155622)",
          recipient: `${seller.name} (${seller.phone_number})`,
          auto_first_message_sent: seller.auto_first_message,
          send_result: sendResult,
          fluxo_corrigido: `5551981155622 → ${seller.phone_number}`,
          expected_whatsapp_behavior: {
            rodrigo_bot_whatsapp: `Mensagem aparece como ENVIADA para ${seller.name}`,
            seller_whatsapp: `Mensagem aparece como RECEBIDA do Rodrigo Bot`
          }
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('❌ Erro ao enviar lead:', error)

    return new Response(
      JSON.stringify({
        success: false,
        error: error.message
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      }
    )
  }
})


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

// Função para normalizar números brasileiros para WHAPI
function normalizePhoneForWhapi(phone: string): string {
  let cleaned = phone.replace(/\D/g, '');
  cleaned = cleaned.replace(/^0+/, '');
  
  if (!cleaned.startsWith('55')) {
    if (cleaned.length >= 10 && cleaned.length <= 11) {
      cleaned = '55' + cleaned;
    }
  }
  
  if (!cleaned.startsWith('55') || cleaned.length < 12 || cleaned.length > 13) {
    throw new Error(`Número brasileiro inválido: ${phone}`);
  }
  
  const countryCode = cleaned.substring(0, 2);
  const areaCode = cleaned.substring(2, 4);
  const number = cleaned.substring(4);
  
  // Se é celular com 9º dígito (novo formato), remove o 9
  if (number.length === 9 && number.startsWith('9')) {
    const normalizedNumber = number.substring(1);
    const result = countryCode + areaCode + normalizedNumber;
    
    console.log('📱 NORMALIZAÇÃO: Removendo 9º dígito para WHAPI:', {
      original: `${countryCode}${areaCode}${number}`,
      normalized: result,
      explanation: 'WHAPI usa formato antigo (sem 9º dígito)'
    });
    
    return result;
  }
  
  return cleaned;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { leadId, sellerId, summary, customerName, customerPhone, productInterest }: SendLeadRequest = await req.json()
    console.log('📨 Enviando lead para vendedor (COM NORMALIZAÇÃO):', { leadId, sellerId, customerName })

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

    // APLICAR NORMALIZAÇÃO NO NÚMERO DO VENDEDOR
    let normalizedSellerPhone: string
    try {
      normalizedSellerPhone = normalizePhoneForWhapi(seller.phone_number)
      console.log('📱 Número do vendedor normalizado para WHAPI:', {
        original: seller.phone_number,
        normalized: normalizedSellerPhone,
        aplicou_normalizacao: seller.phone_number !== normalizedSellerPhone
      })
    } catch (error) {
      throw new Error(`Erro ao normalizar número do vendedor: ${error.message}`)
    }

    // APLICAR NORMALIZAÇÃO NO NÚMERO DO CLIENTE
    let normalizedCustomerPhone: string
    try {
      normalizedCustomerPhone = normalizePhoneForWhapi(customerPhone)
      console.log('📱 Número do cliente normalizado para WHAPI:', {
        original: customerPhone,
        normalized: normalizedCustomerPhone,
        aplicou_normalizacao: customerPhone !== normalizedCustomerPhone
      })
    } catch (error) {
      console.warn('⚠️ Erro ao normalizar número do cliente (continuando com original):', error)
      normalizedCustomerPhone = customerPhone
    }

    // Usar token do Rodrigo Bot
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

🔄 **FLUXO COM NORMALIZAÇÃO:** Rodrigo Bot (5551981155622) → ${seller.name}
📱 **Número normalizado:** ${seller.phone_number} → ${normalizedSellerPhone}`

    // Enviar mensagem via Rodrigo Bot (COM NORMALIZAÇÃO)
    const sendPayload = {
      token: rodrigoBotToken,
      to: normalizedSellerPhone, // USAR NÚMERO NORMALIZADO
      content: leadMessage
    }

    console.log('📤 Enviando mensagem do Rodrigo Bot para vendedor (COM NORMALIZAÇÃO):', {
      de: 'Rodrigo Bot (5551981155622)',
      para: `${seller.name}`,
      numero_original: seller.phone_number,
      numero_normalizado: normalizedSellerPhone,
      normalizacao_aplicada: seller.phone_number !== normalizedSellerPhone,
      leadId,
      fluxo_esperado: `5551981155622 → ${normalizedSellerPhone}`
    })

    const { data: sendResult, error: sendError } = await supabase.functions.invoke('whapi-send', {
      body: sendPayload
    })

    if (sendError) {
      throw new Error(`Erro ao enviar mensagem: ${sendError.message}`)
    }

    console.log('✅ Lead enviado com sucesso via Rodrigo Bot (COM NORMALIZAÇÃO)')

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
          
          // Para primeira mensagem ao cliente, usar token do Rodrigo Bot (por enquanto)
          const firstMessagePayload = {
            token: rodrigoBotToken,
            to: normalizedCustomerPhone, // USAR NÚMERO NORMALIZADO DO CLIENTE
            content: aiResponse.response
          }

          const { data: firstMsgResult } = await supabase.functions.invoke('whapi-send', {
            body: firstMessagePayload
          })

          if (firstMsgResult?.success) {
            console.log('✅ Primeira mensagem automática enviada COM NORMALIZAÇÃO')
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
        message: `Lead ${leadId} enviado para vendedor ${seller.name} via Rodrigo Bot (COM NORMALIZAÇÃO)`,
        details: {
          lead_id: leadId,
          seller_id: sellerId,
          seller_name: seller.name,
          seller_phone_original: seller.phone_number,
          seller_phone_normalized: normalizedSellerPhone,
          customer_name: customerName,
          customer_phone_original: customerPhone,
          customer_phone_normalized: normalizedCustomerPhone,
          product_interest: productInterest,
          rodrigo_bot_used: true,
          rodrigo_bot_phone: '5551981155622',
          auto_first_message: seller.auto_first_message,
          send_result: sendResult,
          normalizacao_aplicada: {
            vendedor: seller.phone_number !== normalizedSellerPhone,
            cliente: customerPhone !== normalizedCustomerPhone
          },
          fluxo_corrigido: `5551981155622 → ${normalizedSellerPhone}`,
          explicacao_normalizacao: 'Removido 9º dígito para compatibilidade com WHAPI'
        }
      })

    return new Response(
      JSON.stringify({
        success: true,
        message: `Lead enviado para ${seller.name} via Rodrigo Bot (COM NORMALIZAÇÃO)`,
        details: {
          lead_id: leadId,
          seller: {
            id: sellerId,
            name: seller.name,
            phone_original: seller.phone_number,
            phone_normalized: normalizedSellerPhone
          },
          customer: {
            name: customerName,
            phone_original: customerPhone,
            phone_normalized: normalizedCustomerPhone
          },
          communication_flow: "Rodrigo Bot → Vendedor (COM NORMALIZAÇÃO)",
          sender: "Rodrigo Bot (5551981155622)",
          recipient: `${seller.name} (${normalizedSellerPhone})`,
          auto_first_message_sent: seller.auto_first_message,
          send_result: sendResult,
          normalizacao_aplicada: {
            vendedor: seller.phone_number !== normalizedSellerPhone,
            cliente: customerPhone !== normalizedCustomerPhone,
            explicacao: 'Removido 9º dígito para compatibilidade WHAPI'
          },
          fluxo_corrigido: `5551981155622 → ${normalizedSellerPhone}`,
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

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface AlertRequest {
  type: 'quality_issue' | 'potential_loss' | 'delayed_response' | 'opportunity_alert';
  sellerId?: string;
  customerId?: string;
  message: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  details?: any;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { type, sellerId, customerId, message, priority, details }: AlertRequest = await req.json()
    console.log('🚨 Enviando alerta para gestores:', { type, priority, sellerId })

    const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2')
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    // CRÍTICO: SEMPRE usar o token do Rodrigo Bot para comunicações internas
    const rodrigoBotToken = Deno.env.get('WHAPI_TOKEN_5551981155622')
    if (!rodrigoBotToken) {
      throw new Error('Token do Rodrigo Bot não encontrado')
    }

    console.log('🤖 Usando Rodrigo Bot para enviar alertas aos gestores')

    // Buscar gestores (usuários com role 'manager' ou 'admin')
    const { data: managers } = await supabase
      .from('profiles')
      .select('*')
      .in('role', ['manager', 'admin'])

    if (!managers || managers.length === 0) {
      console.log('⚠️ Nenhum gestor encontrado, usando números padrão')
    }

    // Números padrão de gestores (configuráveis via settings)
    const { data: managerSettings } = await supabase
      .from('settings')
      .select('value')
      .eq('key', 'manager_phones')
      .single()

    const managerPhones = managerSettings?.value?.phones || [
      '5551999888777', // Número padrão do gestor principal
    ]

    // Buscar detalhes do vendedor se fornecido
    let sellerInfo = null
    if (sellerId) {
      const { data: seller } = await supabase
        .from('sellers')
        .select('name, phone_number, performance_score')
        .eq('id', sellerId)
        .single()
      
      sellerInfo = seller
    }

    // Definir emoji e prioridade baseado no tipo
    const alertConfig = {
      quality_issue: { emoji: '⚠️', color: '🟡' },
      potential_loss: { emoji: '🚨', color: '🔴' },
      delayed_response: { emoji: '⏰', color: '🟠' },
      opportunity_alert: { emoji: '💰', color: '🟢' }
    }

    const config = alertConfig[type] || { emoji: '📢', color: '🔵' }
    const priorityEmoji = {
      low: '🔵',
      medium: '🟡', 
      high: '🟠',
      critical: '🔴'
    }

    // Preparar mensagem do alerta
    const alertMessage = `${config.emoji} **ALERTA DO SISTEMA** ${config.color}

📋 **Tipo:** ${type.replace('_', ' ').toUpperCase()}
${priorityEmoji[priority]} **Prioridade:** ${priority.toUpperCase()}

📝 **Descrição:**
${message}

${sellerInfo ? `👤 **Vendedor:** ${sellerInfo.name} (${sellerInfo.phone_number})` : ''}
${customerId ? `📞 **Cliente:** ${customerId}` : ''}

⏰ **Data:** ${new Date().toLocaleString('pt-BR')}

${details ? `📊 **Detalhes Adicionais:**
${JSON.stringify(details, null, 2)}` : ''}

---
🤖 *Alerta gerado automaticamente pelo sistema de monitoramento*`

    // Enviar para todos os gestores
    const sendResults = []
    
    for (const managerPhone of managerPhones) {
      try {
        console.log('📤 Enviando alerta do Rodrigo Bot para gestor:', managerPhone)

        const sendPayload = {
          token: rodrigoBotToken,
          to: managerPhone,
          content: alertMessage
        }

        const { data: sendResult, error: sendError } = await supabase.functions.invoke('whapi-send', {
          body: sendPayload
        })

        if (sendError) {
          console.error(`❌ Erro ao enviar para ${managerPhone}:`, sendError)
          sendResults.push({
            phone: managerPhone,
            success: false,
            error: sendError.message
          })
        } else {
          console.log(`✅ Alerta enviado para ${managerPhone}`)
          sendResults.push({
            phone: managerPhone,
            success: true,
            result: sendResult
          })
        }
      } catch (error) {
        console.error(`❌ Erro ao enviar para ${managerPhone}:`, error)
        sendResults.push({
          phone: managerPhone,
          success: false,
          error: error.message
        })
      }
    }

    const successCount = sendResults.filter(r => r.success).length
    console.log(`📊 Alertas enviados: ${successCount}/${sendResults.length}`)

    // Log do sistema
    await supabase
      .from('system_logs')
      .insert({
        type: priority === 'critical' ? 'error' : 'warning',
        source: 'manager_alerts',
        message: `Alerta ${type} enviado para ${successCount} gestores via Rodrigo Bot`,
        details: {
          alert_type: type,
          priority,
          seller_id: sellerId,
          seller_info: sellerInfo,
          customer_id: customerId,
          message: message,
          managers_notified: successCount,
          send_results: sendResults,
          rodrigo_bot_used: true,
          rodrigo_bot_phone: '5551981155622',
          alert_details: details
        }
      })

    return new Response(
      JSON.stringify({
        success: successCount > 0,
        message: `Alerta enviado para ${successCount}/${sendResults.length} gestores via Rodrigo Bot`,
        details: {
          alert_type: type,
          priority,
          managers_notified: successCount,
          total_managers: sendResults.length,
          communication_flow: "Rodrigo Bot → Gestores",
          sender: "Rodrigo Bot (5551981155622)",
          send_results: sendResults,
          seller_info: sellerInfo
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('❌ Erro ao enviar alerta:', error)

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
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Play, CheckCircle, XCircle, Clock } from "lucide-react";

interface TestStep {
  name: string;
  status: 'pending' | 'running' | 'success' | 'error';
  message: string;
  duration?: number;
}

export function BotFlowTester() {
  const [isRunning, setIsRunning] = useState(false);
  const [testPhone, setTestPhone] = useState('5551999999999');
  const [testMessage, setTestMessage] = useState('Olá, preciso de um orçamento de telhas shingle para minha casa');
  const [steps, setSteps] = useState<TestStep[]>([]);

  const updateStep = (index: number, updates: Partial<TestStep>) => {
    setSteps(prev => prev.map((step, i) => 
      i === index ? { ...step, ...updates } : step
    ));
  };

  const runCompleteTest = async () => {
    setIsRunning(true);
    
    const testSteps: TestStep[] = [
      { name: 'Criação da conversa', status: 'pending', message: 'Preparando teste...' },
      { name: 'Adição à fila de mensagens', status: 'pending', message: 'Esperando...' },
      { name: 'Processamento pelo bot (60s)', status: 'pending', message: 'Aguardando agrupamento...' },
      { name: 'Resposta do Dify', status: 'pending', message: 'Esperando processamento...' },
      { name: 'Envio via WhatsApp', status: 'pending', message: 'Preparando envio...' },
      { name: 'Verificação final', status: 'pending', message: 'Validando resultado...' }
    ];

    setSteps(testSteps);

    try {
      // Passo 1: Criar conversa de teste
      updateStep(0, { status: 'running', message: 'Criando conversa de teste...' });
      const startTime = Date.now();

      const { data: conversation, error: convError } = await supabase
        .from('conversations')
        .insert({
          phone_number: testPhone,
          customer_name: 'Cliente Teste Bot',
          status: 'bot_attending',
          fallback_mode: false
        })
        .select()
        .single();

      if (convError || !conversation) {
        throw new Error(`Erro ao criar conversa: ${convError?.message}`);
      }

      updateStep(0, { 
        status: 'success', 
        message: `Conversa criada: ${conversation.id}`,
        duration: Date.now() - startTime
      });

      // Passo 2: Simular mensagem do cliente
      updateStep(1, { status: 'running', message: 'Inserindo mensagem do cliente...' });
      const step2Start = Date.now();

      const { error: messageError } = await supabase
        .from('messages')
        .insert({
          conversation_id: conversation.id,
          sender_type: 'customer',
          sender_name: 'Cliente Teste Bot',
          content: testMessage,
          message_type: 'text'
        });

      if (messageError) {
        throw new Error(`Erro ao inserir mensagem: ${messageError.message}`);
      }

      // Adicionar à fila manualmente (simulando webhook)
      const { error: queueError } = await supabase
        .from('message_queue')
        .insert({
          conversation_id: conversation.id,
          messages_content: [testMessage],
          status: 'waiting',
          scheduled_for: new Date(Date.now() + 60000).toISOString() // 60 segundos
        });

      if (queueError) {
        throw new Error(`Erro ao adicionar à fila: ${queueError.message}`);
      }

      updateStep(1, { 
        status: 'success', 
        message: 'Mensagem adicionada à fila (60s de espera)',
        duration: Date.now() - step2Start
      });

      // Passo 3: Aguardar processamento (60 segundos)
      updateStep(2, { status: 'running', message: 'Aguardando 60 segundos para agrupamento...' });
      const step3Start = Date.now();

      // Simular espera com countdown
      for (let i = 60; i > 0; i--) {
        updateStep(2, { 
          status: 'running', 
          message: `Aguardando agrupamento... ${i}s restantes` 
        });
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      updateStep(2, { 
        status: 'success', 
        message: 'Período de agrupamento completado',
        duration: Date.now() - step3Start
      });

      // Passo 4: Forçar processamento da fila
      updateStep(3, { status: 'running', message: 'Processando fila de mensagens...' });
      const step4Start = Date.now();

      const { data: processResult, error: processError } = await supabase.functions
        .invoke('process-message-queue');

      if (processError) {
        throw new Error(`Erro no processamento: ${processError.message}`);
      }

      updateStep(3, { 
        status: 'success', 
        message: `Fila processada: ${JSON.stringify(processResult)}`,
        duration: Date.now() - step4Start
      });

      // Passo 5: Verificar resposta do bot
      updateStep(4, { status: 'running', message: 'Verificando resposta do bot...' });
      const step5Start = Date.now();

      // Aguardar um pouco para o processamento
      await new Promise(resolve => setTimeout(resolve, 3000));

      const { data: botMessages, error: botError } = await supabase
        .from('messages')
        .select('*')
        .eq('conversation_id', conversation.id)
        .eq('sender_type', 'bot')
        .order('created_at', { ascending: false })
        .limit(1);

      if (botError) {
        throw new Error(`Erro ao verificar mensagens do bot: ${botError.message}`);
      }

      if (!botMessages || botMessages.length === 0) {
        throw new Error('Bot não respondeu à mensagem');
      }

      updateStep(4, { 
        status: 'success', 
        message: `Bot respondeu: "${botMessages[0].content.substring(0, 100)}..."`,
        duration: Date.now() - step5Start
      });

      // Passo 6: Verificação final
      updateStep(5, { status: 'running', message: 'Executando verificações finais...' });
      const step6Start = Date.now();

      // Verificar se não há mensagens duplicadas
      const { data: allMessages, error: allMsgError } = await supabase
        .from('messages')
        .select('*')
        .eq('conversation_id', conversation.id)
        .eq('sender_type', 'bot');

      if (allMsgError) {
        throw new Error(`Erro ao verificar duplicatas: ${allMsgError.message}`);
      }

      if (allMessages && allMessages.length > 1) {
        updateStep(5, { 
          status: 'error', 
          message: `ATENÇÃO: Encontradas ${allMessages.length} mensagens do bot (possível duplicata)`,
          duration: Date.now() - step6Start
        });
      } else {
        updateStep(5, { 
          status: 'success', 
          message: '✅ Nenhuma duplicata encontrada. Teste concluído com sucesso!',
          duration: Date.now() - step6Start
        });
      }

      toast.success('Teste do fluxo do bot concluído com sucesso!');

    } catch (error) {
      console.error('Erro no teste:', error);
      
      // Marcar step atual como erro
      const currentStepIndex = steps.findIndex(step => step.status === 'running');
      if (currentStepIndex !== -1) {
        updateStep(currentStepIndex, { 
          status: 'error', 
          message: error.message 
        });
      }
      
      toast.error(`Erro no teste: ${error.message}`);
    } finally {
      setIsRunning(false);
    }
  };

  const resetTest = () => {
    setSteps([]);
  };

  const getStepIcon = (status: TestStep['status']) => {
    switch (status) {
      case 'running':
        return <Loader2 className="h-4 w-4 animate-spin text-blue-500" />;
      case 'success':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'error':
        return <XCircle className="h-4 w-4 text-red-500" />;
      default:
        return <Clock className="h-4 w-4 text-gray-400" />;
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Play className="h-5 w-5" />
          Teste Completo do Fluxo do Bot
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="testPhone">Telefone de Teste</Label>
            <Input
              id="testPhone"
              value={testPhone}
              onChange={(e) => setTestPhone(e.target.value)}
              placeholder="5551999999999"
              disabled={isRunning}
            />
          </div>
        </div>

        <div>
          <Label htmlFor="testMessage">Mensagem de Teste</Label>
          <Textarea
            id="testMessage"
            value={testMessage}
            onChange={(e) => setTestMessage(e.target.value)}
            placeholder="Digite a mensagem que o cliente enviaria..."
            disabled={isRunning}
            rows={3}
          />
        </div>

        <div className="flex gap-2">
          <Button 
            onClick={runCompleteTest} 
            disabled={isRunning}
            className="flex items-center gap-2"
          >
            {isRunning ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Play className="h-4 w-4" />
            )}
            {isRunning ? 'Executando Teste...' : 'Executar Teste Completo'}
          </Button>

          <Button 
            variant="outline" 
            onClick={resetTest}
            disabled={isRunning}
          >
            Limpar Resultados
          </Button>
        </div>

        {/* Resultados do teste */}
        {steps.length > 0 && (
          <div className="border rounded-lg p-4 space-y-3">
            <h3 className="font-semibold">Progresso do Teste:</h3>
            {steps.map((step, index) => (
              <div key={index} className="flex items-center gap-3 p-2 border rounded">
                {getStepIcon(step.status)}
                <div className="flex-1">
                  <div className="font-medium">{step.name}</div>
                  <div className="text-sm text-muted-foreground">{step.message}</div>
                  {step.duration && (
                    <div className="text-xs text-muted-foreground">
                      Tempo: {step.duration}ms
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
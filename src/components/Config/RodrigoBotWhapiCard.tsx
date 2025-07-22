import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Bot, Wifi, WifiOff, TestTube, Settings, Check, X, Loader2, Search, AlertTriangle } from 'lucide-react';
import { useWhapiIntegration } from '@/hooks/useWhapiIntegration';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

export function RodrigoBotWhapiCard() {
  const [token, setToken] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [showConfig, setShowConfig] = useState(false);
  const [isDiagnosing, setIsDiagnosing] = useState(false);
  const { toast } = useToast();

  const {
    configurations,
    getWebhookUrl,
    isRodrigoBotConnected,
    getConfiguration,
    configureWebhook,
    testConnection,
    sendTestMessage,
    isConfiguringWebhook,
    isTestingConnection,
    isSendingTest
  } = useWhapiIntegration();

  const rodrigoConfig = getConfiguration('rodrigo_bot');
  const isConnected = isRodrigoBotConnected();

  const handleConfigure = () => {
    if (!token || !phoneNumber) {
      toast({
        title: "Dados incompletos",
        description: "Por favor, preencha o token e o número do telefone",
        variant: "destructive",
      });
      return;
    }

    configureWebhook({
      token,
      phoneNumber,
      type: 'rodrigo_bot'
    });
  };

  const handleTestConnection = () => {
    if (!token) {
      toast({
        title: "Token necessário",
        description: "Por favor, insira o token WHAPI",
        variant: "destructive",
      });
      return;
    }

    testConnection(token);
  };

  const handleSendTest = () => {
    if (!token || !phoneNumber) {
      toast({
        title: "Dados incompletos",
        description: "Por favor, configure o Rodrigo Bot primeiro",
        variant: "destructive",
      });
      return;
    }

    sendTestMessage({
      token,
      phoneNumber,
      message: '🤖 Teste do Rodrigo Bot WHAPI - Sistema funcionando!'
    });
  };

  const handleDiagnoseRodrigoBot = async () => {
    setIsDiagnosing(true);
    
    try {
      const { data, error } = await supabase.functions.invoke('diagnose-rodrigo-bot', {
        body: {}
      });

      if (error) {
        throw error;
      }

      if (data?.success) {
        const diagnosis = data.diagnosis;
        const solution = data.solution;

        toast({
          title: diagnosis.problema_identificado ? "🚨 Problema Identificado e Corrigido!" : "✅ Diagnóstico Completo",
          description: diagnosis.problema_identificado 
            ? `Número corrigido de ${diagnosis.numero_no_banco} para ${diagnosis.numero_real_whapi}`
            : "Configuração do Rodrigo Bot está correta",
        });

        console.log('🔍 Diagnóstico completo:', data);
        
        // Mostrar detalhes do diagnóstico
        if (diagnosis.problema_identificado) {
          toast({
            title: "🔧 Correções Aplicadas",
            description: `
              ✅ Configuração atualizada
              ✅ Função de direção corrigida  
              ✅ Logs históricos corrigidos
              
              Próximo: Teste o envio para confirmar o fluxo
            `,
          });
        }
        
      } else {
        throw new Error(data?.error || 'Erro no diagnóstico');
      }
    } catch (error) {
      console.error('Erro no diagnóstico:', error);
      toast({
        title: "Erro no Diagnóstico",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsDiagnosing(false);
    }
  };

  const getStatusBadge = () => {
    if (!rodrigoConfig) {
      return <Badge variant="secondary">Não configurado</Badge>;
    }

    if (rodrigoConfig.health_status === 'healthy') {
      return <Badge variant="default" className="bg-green-500"><Check className="w-3 h-3 mr-1" />Conectado</Badge>;
    }

    if (rodrigoConfig.health_status === 'unhealthy') {
      return <Badge variant="destructive"><X className="w-3 h-3 mr-1" />Erro</Badge>;
    }

    return <Badge variant="secondary">Status desconhecido</Badge>;
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="p-2 bg-orange-100 rounded-lg">
            <Bot className="w-6 h-6 text-orange-600" />
          </div>
          <div>
            <CardTitle className="flex items-center gap-2">
              Rodrigo Bot (WHAPI)
              {getStatusBadge()}
            </CardTitle>
            <CardDescription>
              <strong>Uso Interno:</strong> Bot responsável por envio de leads e alertas aos vendedores e gestores
            </CardDescription>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Informações do Status */}
        {rodrigoConfig && (
          <div className="p-4 bg-muted rounded-lg space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Número:</span>
              <span className="text-sm">{rodrigoConfig.phone_number}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Webhook URL:</span>
              <span className="text-xs text-muted-foreground break-all">
                {rodrigoConfig.webhook_url}
              </span>
            </div>
            {rodrigoConfig.last_health_check && (
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Último teste:</span>
                <span className="text-sm">
                  {new Date(rodrigoConfig.last_health_check).toLocaleString()}
                </span>
              </div>
            )}
          </div>
        )}

        {/* Alerta de Diagnóstico */}
        <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="w-4 h-4 text-yellow-600" />
            <span className="text-sm font-medium text-yellow-800">Diagnóstico Avançado</span>
          </div>
          <p className="text-xs text-yellow-700 mb-3">
            Se mensagens estão chegando no lugar errado, execute o diagnóstico para identificar e corrigir automaticamente.
          </p>
          <Button
            size="sm"
            variant="outline"
            onClick={handleDiagnoseRodrigoBot}
            disabled={isDiagnosing}
            className="w-full border-yellow-300 text-yellow-700 hover:bg-yellow-100"
          >
            {isDiagnosing ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Search className="w-4 h-4 mr-2" />
            )}
            {isDiagnosing ? 'Diagnosticando...' : 'Diagnosticar Fluxo'}
          </Button>
        </div>

        {/* Configuração */}
        {(!isConnected || showConfig) && (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="rodrigo-token">Token WHAPI</Label>
              <Input
                id="rodrigo-token"
                type="password"
                placeholder="Insira o token WHAPI do Rodrigo Bot"
                value={token}
                onChange={(e) => setToken(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="rodrigo-phone">Número do WhatsApp</Label>
              <Input
                id="rodrigo-phone"
                placeholder="5551999999999"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value.replace(/\D/g, ''))}
              />
            </div>

            <div className="space-y-2">
              <Label>URL do Webhook</Label>
              <div className="p-2 bg-muted rounded text-sm break-all">
                {getWebhookUrl()}
              </div>
              <p className="text-xs text-muted-foreground">
                Configure esta URL no painel WHAPI para receber webhooks
              </p>
            </div>
          </div>
        )}

        {/* Ações */}
        <div className="flex gap-2 flex-wrap">
          {!isConnected ? (
            <Button 
              onClick={handleConfigure}
              disabled={isConfiguringWebhook || !token || !phoneNumber}
              className="flex-1"
            >
              {isConfiguringWebhook && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              <Settings className="w-4 h-4 mr-2" />
              Configurar
            </Button>
          ) : (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowConfig(!showConfig)}
              >
                <Settings className="w-4 h-4 mr-2" />
                {showConfig ? 'Ocultar' : 'Reconfigurar'}
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={handleTestConnection}
                disabled={isTestingConnection || !token}
              >
                {isTestingConnection ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : isConnected ? (
                  <Wifi className="w-4 h-4 mr-2" />
                ) : (
                  <WifiOff className="w-4 h-4 mr-2" />
                )}
                Testar Conexão
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={handleSendTest}
                disabled={isSendingTest || !token || !phoneNumber}
              >
                {isSendingTest && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                <TestTube className="w-4 h-4 mr-2" />
                Enviar Teste
              </Button>
            </>
          )}
        </div>

        {/* Instruções */}
        <div className="text-xs text-muted-foreground space-y-1">
          <p><strong>1.</strong> Configure um número no WHAPI para o Rodrigo Bot</p>
          <p><strong>2.</strong> Insira o token gerado pelo WHAPI</p>
          <p><strong>3.</strong> Configure o webhook no painel WHAPI</p>
          <p><strong>4.</strong> Teste a conexão para confirmar funcionamento</p>
        </div>
      </CardContent>
    </Card>
  );
}

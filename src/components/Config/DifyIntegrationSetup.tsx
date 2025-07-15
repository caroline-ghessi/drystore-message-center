import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Bot, TestTube, CheckCircle, XCircle, AlertCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export function DifyIntegrationSetup() {
  const [config, setConfig] = useState({
    api_url: 'https://api.dify.ai/v1',
    active: false
  });
  const [loading, setLoading] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<'success' | 'error' | null>(null);

  // Carregar configuração existente
  const loadConfig = async () => {
    try {
      const { data, error } = await supabase
        .from('integrations')
        .select('config, active')
        .eq('type', 'dify')
        .single();

      if (data) {
        const config = data.config as any;
        setConfig({
          api_url: config?.api_url || 'https://api.dify.ai/v1',
          active: data.active || false
        });
      }
    } catch (error) {
      console.error('Erro ao carregar configuração:', error);
    }
  };

  // Salvar configuração
  const saveConfig = async () => {
    setLoading(true);
    try {
      const { error } = await supabase
        .from('integrations')
        .update({
          config: {
            api_url: config.api_url,
            api_key: 'STORED_IN_SECRETS' // Indicador de que está nos secrets
          },
          active: config.active
        })
        .eq('type', 'dify');

      if (error) throw error;

      toast.success('Configuração Dify salva com sucesso!');
      
      // Log da configuração
      await supabase.from('system_logs').insert({
        type: 'info',
        source: 'dify',
        message: 'Configuração atualizada',
        details: { 
          api_url: config.api_url,
          active: config.active
        }
      });

    } catch (error) {
      console.error('Erro ao salvar:', error);
      toast.error('Erro ao salvar configuração');
    } finally {
      setLoading(false);
    }
  };

  // Testar conexão
  const testConnection = async () => {
    setTesting(true);
    setTestResult(null);
    
    try {
      // Salvar configuração temporariamente para teste
      await supabase
        .from('integrations')
        .update({
          config: {
            api_url: config.api_url,
            api_key: 'STORED_IN_SECRETS'
          },
          active: true
        })
        .eq('type', 'dify');

      // Testar via hook
      const { error } = await supabase.functions.invoke('dify-process-messages', {
        body: {
          conversationId: 'test',
          phoneNumber: 'test-user',
          messageContent: 'Teste de conexão'
        }
      });

      if (error) {
        throw new Error(error.message);
      }

      setTestResult('success');
      toast.success('Conexão com Dify funcionando!');
      
    } catch (error) {
      console.error('Erro no teste:', error);
      setTestResult('error');
      toast.error('Falha na conexão com Dify');
    } finally {
      setTesting(false);
    }
  };

  // Carregar configuração ao montar
  useEffect(() => {
    loadConfig();
  }, []);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bot className="h-5 w-5" />
          Configuração Dify Chatflow
          {config.active && (
            <Badge variant="default" className="bg-green-100 text-green-800">
              Ativo
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      
      <CardContent className="space-y-6">
        {/* API URL */}
        <div className="space-y-2">
          <Label htmlFor="dify-url">Base URL da API Dify</Label>
          <Input
            id="dify-url"
            value={config.api_url}
            onChange={(e) => setConfig(prev => ({ ...prev, api_url: e.target.value }))}
            placeholder="https://api.dify.ai/v1"
            disabled={loading}
          />
          <p className="text-xs text-muted-foreground">
            URL base do seu chatflow Dify (ex: https://api.dify.ai/v1 ou https://cloud.dify.ai/v1)
          </p>
        </div>

        {/* API Key Status */}
        <div className="space-y-2">
          <Label>Status da API Key</Label>
          <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
            <CheckCircle className="h-4 w-4 text-green-600" />
            <span className="text-sm">API Key configurada nos secrets do Supabase</span>
          </div>
        </div>

        {/* Ativar/Desativar */}
        <div className="flex items-center justify-between p-4 border rounded-lg">
          <div>
            <Label htmlFor="dify-active" className="text-base font-medium">
              Ativar Integração Dify
            </Label>
            <p className="text-sm text-muted-foreground">
              Quando ativo, mensagens do WhatsApp serão processadas pelo chatflow
            </p>
          </div>
          <Switch
            id="dify-active"
            checked={config.active}
            onCheckedChange={(checked) => setConfig(prev => ({ ...prev, active: checked }))}
            disabled={loading}
          />
        </div>

        {/* Resultado do teste */}
        {testResult && (
          <div className={`flex items-center gap-2 p-3 rounded-lg ${
            testResult === 'success' 
              ? 'bg-green-50 text-green-800 border border-green-200' 
              : 'bg-red-50 text-red-800 border border-red-200'
          }`}>
            {testResult === 'success' ? (
              <CheckCircle className="h-4 w-4" />
            ) : (
              <XCircle className="h-4 w-4" />
            )}
            <span className="text-sm">
              {testResult === 'success' 
                ? 'Conexão testada com sucesso!' 
                : 'Falha na conexão. Verifique a configuração.'}
            </span>
          </div>
        )}

        {/* Ações */}
        <div className="flex gap-3">
          <Button 
            onClick={saveConfig} 
            disabled={loading || !config.api_url}
            className="flex-1"
          >
            {loading ? 'Salvando...' : 'Salvar Configuração'}
          </Button>
          
          <Button 
            variant="outline" 
            onClick={testConnection}
            disabled={testing || !config.api_url}
          >
            <TestTube className="h-4 w-4 mr-2" />
            {testing ? 'Testando...' : 'Testar'}
          </Button>
        </div>

        {/* Informações importantes */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-start gap-2">
            <AlertCircle className="h-4 w-4 text-blue-600 mt-0.5" />
            <div className="text-sm text-blue-800">
              <p className="font-medium mb-1">Como configurar:</p>
              <ul className="list-disc list-inside space-y-1 text-xs">
                <li>Copie a Base URL do seu chatflow Dify</li>
                <li>A API Key já foi configurada nos secrets</li>
                <li>Ative a integração para começar o processamento</li>
                <li>Mensagens do WhatsApp serão agrupadas em 60 segundos</li>
                <li>Respostas do Dify serão enviadas automaticamente</li>
              </ul>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
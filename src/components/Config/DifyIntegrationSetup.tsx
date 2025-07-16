import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Bot, CheckCircle, XCircle, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export function DifyIntegrationSetup() {
  const [apiUrl, setApiUrl] = useState("https://api.dify.ai/v1");
  const [isActive, setIsActive] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [testResult, setTestResult] = useState<'success' | 'error' | null>(null);
  const [hasApiKey, setHasApiKey] = useState(false);

  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    try {
      const { data } = await supabase
        .from('integrations')
        .select('config, active')
        .eq('type', 'dify')
        .single();

      if (data) {
        const config = data.config as { api_url?: string } | null;
        setApiUrl(config?.api_url || "https://api.dify.ai/v1");
        setIsActive(data.active || false);
      }
    } catch (error) {
      console.error('Error loading Dify config:', error);
    }
  };

  const saveConfig = async () => {
    setIsLoading(true);
    try {
      const { error } = await supabase
        .from('integrations')
        .upsert({
          type: 'dify',
          name: 'Dify Chatflow',
          config: { api_url: apiUrl },
          active: isActive
        });

      if (error) throw error;

      // Log da configuração
      await supabase.from('system_logs').insert({
        type: 'info',
        source: 'dify_config',
        message: 'Configuração do Dify atualizada',
        details: {
          api_url: apiUrl,
          active: isActive
        }
      });

      toast.success("Configuração salva com sucesso!");
    } catch (error) {
      toast.error("Erro ao salvar configuração");
      console.error('Error saving config:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const testConnection = async () => {
    setIsLoading(true);
    setTestResult(null);
    
    try {
      const { data, error } = await supabase.functions.invoke('dify-chat', {
        body: {
          message: "Teste de conexão",
          userId: "test_user"
        }
      });

      if (error) throw error;

      setTestResult('success');
      toast.success("Conexão testada com sucesso!");
    } catch (error) {
      setTestResult('error');
      toast.error("Erro ao testar conexão");
      console.error('Error testing connection:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <Bot className="h-5 w-5 text-drystore-orange" />
          <span>Integração Dify (Bot de Atendimento)</span>
          <Badge variant={isActive ? "default" : "secondary"}>
            {isActive ? "Ativo" : "Inativo"}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="dify-url">URL da API do Dify</Label>
            <Input
              id="dify-url"
              value={apiUrl}
              onChange={(e) => setApiUrl(e.target.value)}
              placeholder="https://api.dify.ai/v1"
            />
          </div>
          
          <div className="space-y-2">
            <Label>Status da Integração</Label>
            <div className="flex items-center space-x-2">
              <Switch
                checked={isActive}
                onCheckedChange={setIsActive}
              />
              <span className="text-sm">
                {isActive ? "Ativada" : "Desativada"}
              </span>
            </div>
          </div>
        </div>

        <div className="bg-muted p-4 rounded-lg">
          <h4 className="font-medium text-sm mb-2 flex items-center space-x-2">
            <AlertTriangle className="h-4 w-4 text-amber-500" />
            <span>Status da API Key</span>
          </h4>
          <div className="flex items-center space-x-2">
            {hasApiKey ? (
              <>
                <CheckCircle className="h-4 w-4 text-green-500" />
                <span className="text-sm text-green-700">API Key configurada</span>
              </>
            ) : (
              <>
                <XCircle className="h-4 w-4 text-red-500" />
                <span className="text-sm text-red-700">API Key não configurada</span>
              </>
            )}
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            A API Key deve ser configurada nos secrets do Supabase como DIFY_API_KEY
          </p>
        </div>

        <div className="flex space-x-2">
          <Button 
            onClick={saveConfig} 
            disabled={isLoading}
            className="flex-1"
          >
            Salvar Configuração
          </Button>
          <Button 
            onClick={testConnection} 
            disabled={isLoading || !isActive}
            variant="outline"
            className="flex items-center space-x-2"
          >
            {testResult === 'success' && <CheckCircle className="h-4 w-4 text-green-500" />}
            {testResult === 'error' && <XCircle className="h-4 w-4 text-red-500" />}
            <span>Testar Conexão</span>
          </Button>
        </div>

        <div className="bg-blue-50 p-4 rounded-lg">
          <h4 className="font-medium text-sm mb-2">Informações Importantes:</h4>
          <ul className="text-sm text-blue-700 space-y-1">
            <li>• O Dify é responsável pelo primeiro atendimento dos clientes</li>
            <li>• As mensagens são agrupadas por 1 minuto antes do envio</li>
            <li>• A integração deve estar ativa para funcionar</li>
            <li>• Verifique se a API Key está configurada nos secrets</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}
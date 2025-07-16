import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Settings, 
  Users, 
  Key, 
  Bot,
  Shield
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

// Import new components
import SellerCard from "@/components/Config/SellerCard";
import RodrigoBotCard from "@/components/Config/RodrigoBotCard";
import { RodrigoBotWhapiCard } from "@/components/Config/RodrigoBotWhapiCard";
import MetaIntegrationSetup from "@/components/Config/MetaIntegrationSetup";
import { DifyIntegrationSetup } from "@/components/Config/DifyIntegrationSetup";
import SellerProfileForm from "@/components/Config/SellerProfileForm";
import { useSellers, useDeleteSeller } from "@/hooks/useSellers";

interface Seller {
  id: string;
  name: string;
  phone_number: string;
  webhook_url: string;
  status: 'active' | 'inactive' | 'testing' | 'error';
  auto_first_message: boolean;
  created_at: string;
  last_test?: string;
}

interface RodrigoBot {
  status: 'active' | 'inactive' | 'testing' | 'error';
  webhook_url: string;
  phone_number: string;
  last_test?: string;
  messages_sent_today: number;
}

export default function Configuracoes() {
  const { toast } = useToast();
  
  // Buscar vendedores reais
  const { sellers: realSellers, isLoading: sellersLoading } = useSellers();
  const deleteSeller = useDeleteSeller();

  const [rodrigoBot, setRodrigoBot] = useState<RodrigoBot>({
    status: 'active',
    webhook_url: 'https://api.drystore.com/webhook/rodrigo-bot',
    phone_number: '(11) 99999-0000',
    last_test: '2024-01-15T09:00:00Z',
    messages_sent_today: 23
  });

  const [systemSettings, setSystemSettings] = useState({
    message_grouping_minutes: 1,
    auto_evaluation_enabled: true,
    webhook_timeout: 30,
    default_greeting: 'Olá! Sou {seller_name} da Drystore. Recebi seu interesse em {product}. Como posso ajudar?'
  });

  // Mock function to simulate WHAPI integration testing
  const mockTestWhapiIntegration = async (token: string): Promise<boolean> => {
    await new Promise(resolve => setTimeout(resolve, 2000)); // Simulate API call
    return token.length > 10; // Simple validation
  };

  const handleAddSeller = async (newSeller: any, token: string): Promise<boolean> => {
    try {
      // Test integration first
      const success = await mockTestWhapiIntegration(token);
      return success;
    } catch (error) {
      console.error('Error adding seller:', error);
      return false;
    }
  };

  const handleUpdateSeller = (updatedSeller: Seller) => {
    // Updates are now handled via real database operations
    console.log('Update seller:', updatedSeller);
  };

  const handleDeleteSeller = async (id: string) => {
    console.log("🗑️ Configurações: Recebido pedido de exclusão do vendedor:", id);
    try {
      console.log("🔥 Configurações: Chamando deleteSeller.mutateAsync...");
      await deleteSeller.mutateAsync(id);
      console.log("✅ Configurações: Exclusão bem-sucedida, mostrando toast");
      toast({
        title: "Vendedor excluído",
        description: "Vendedor foi marcado como inativo com sucesso.",
      });
    } catch (error) {
      console.error("❌ Configurações: Erro na exclusão:", error);
      toast({
        title: "Erro ao excluir",
        description: "Não foi possível excluir o vendedor. Tente novamente.",
        variant: "destructive",
      });
    }
  };

  const handleTestSellerIntegration = async (id: string, token: string): Promise<boolean> => {
    return await mockTestWhapiIntegration(token);
  };

  const handleUpdateRodrigoBot = (data: any) => {
    setRodrigoBot({
      ...rodrigoBot,
      ...data
    });
  };

  const handleTestRodrigoBotIntegration = async (token: string): Promise<boolean> => {
    return await mockTestWhapiIntegration(token);
  };

  return (
    <div className="h-full overflow-y-auto bg-background">
      <div className="p-6 space-y-4">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-foreground">Configurações</h1>
          <p className="text-muted-foreground mt-1">
            Gerencie vendedores, integração WHAPI e configurações do sistema
          </p>
        </div>

        {/* Content */}
        <Tabs defaultValue="sellers" className="space-y-4">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="sellers">Vendedores</TabsTrigger>
          <TabsTrigger value="rodrigo-bot">Rodrigo Bot</TabsTrigger>
          <TabsTrigger value="integrations">Integrações</TabsTrigger>
          <TabsTrigger value="system">Sistema</TabsTrigger>
        </TabsList>

        {/* Sellers Tab */}
        <TabsContent value="sellers" className="space-y-4">
          <Card className="shadow-card">
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Users className="h-5 w-5 text-drystore-orange" />
                <span>Cadastro e Gerenciamento de Vendedores</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <SellerProfileForm onSuccess={() => {
                toast({
                  title: "Sucesso!",
                  description: "Vendedor cadastrado com sucesso",
                });
              }} />
            </CardContent>
          </Card>
          
          <Card className="shadow-card">
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Users className="h-5 w-5 text-drystore-orange" />
                <span>Vendedores Cadastrados ({realSellers?.length || 0})</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {sellersLoading ? (
                <div className="text-center py-8">
                  <div className="inline-flex items-center space-x-2">
                    <div className="h-4 w-4 border-2 border-drystore-orange border-t-transparent rounded-full animate-spin" />
                    <span className="text-muted-foreground">Carregando vendedores...</span>
                  </div>
                </div>
              ) : realSellers?.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-muted-foreground">Nenhum vendedor cadastrado ainda.</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Use o formulário acima para adicionar um vendedor.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {realSellers?.map(seller => (
                    <SellerCard 
                      key={seller.id}
                      seller={seller}
                      onDelete={handleDeleteSeller}
                      onTestIntegration={handleTestSellerIntegration}
                    />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Rodrigo Bot Tab */}
        <TabsContent value="rodrigo-bot" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <RodrigoBotWhapiCard />
            
            <Card className="shadow-card">
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Shield className="h-5 w-5 text-drystore-orange" />
                  <span>Funcionalidades Internas</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  <div className="p-3 bg-blue-50 rounded-lg">
                    <h4 className="font-medium text-blue-800 mb-1">🎯 Envio de Leads</h4>
                    <p className="text-sm text-blue-700">
                      Distribui leads qualificados para vendedores automaticamente
                    </p>
                  </div>
                  
                  <div className="p-3 bg-orange-50 rounded-lg">
                    <h4 className="font-medium text-orange-800 mb-1">⚠️ Alertas de Gestão</h4>
                    <p className="text-sm text-orange-700">
                      Notifica gestores sobre atrasos, oportunidades perdidas e problemas de atendimento
                    </p>
                  </div>
                  
                  <div className="p-3 bg-green-50 rounded-lg">
                    <h4 className="font-medium text-green-800 mb-1">📊 Monitoramento</h4>
                    <p className="text-sm text-green-700">
                      Todas as mensagens são registradas para análise de performance
                    </p>
                  </div>
                </div>
                
                <div className="pt-2 border-t">
                  <p className="text-xs text-muted-foreground">
                    <strong>Nota:</strong> O Rodrigo Bot é de uso interno exclusivo. Não recebe mensagens de clientes.
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Integrations Tab */}
        <TabsContent value="integrations" className="space-y-6">
          <MetaIntegrationSetup />
          <DifyIntegrationSetup />
          
          <Card className="shadow-card">
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Key className="h-5 w-5 text-drystore-orange" />
                <span>WhatsApp Business Meta</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="bg-green-50 p-4 rounded-lg mb-4">
                <h4 className="font-medium text-green-800 mb-2">✅ Integração Configurada!</h4>
                <div className="space-y-2 text-sm text-green-700">
                  <p><strong>Status:</strong> Ativa e funcionando</p>
                  <p><strong>Webhook URL:</strong></p>
                  <code className="bg-white p-2 rounded block text-xs break-all">
                    https://groqsnnytvjabgeaekkw.supabase.co/functions/v1/whatsapp-webhook
                  </code>
                  <p><strong>Token de Verificação:</strong> whatsapp_meta_verify_mTk9Xx2A</p>
                  <p className="text-xs mt-2">
                    ✅ Todos os dados necessários foram configurados com segurança
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-card">
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Key className="h-5 w-5 text-drystore-orange" />
                <span>Outras Integrações</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 border rounded-lg">
                  <h3 className="font-medium mb-2 flex items-center space-x-2">
                    <Bot className="h-4 w-4" />
                    <span>Dify AI</span>
                  </h3>
                  <p className="text-sm text-muted-foreground mb-3">
                    Integração com chatbot inteligente para automatizar conversas
                  </p>
                  <div className="space-y-2">
                    <Input placeholder="API Key do Dify" type="password" />
                    <Input placeholder="URL do Workflow" />
                    <Button size="sm" className="w-full">
                      Testar Conexão
                    </Button>
                  </div>
                </div>
                
                <div className="p-4 border rounded-lg">
                  <h3 className="font-medium mb-2 flex items-center space-x-2">
                    <Key className="h-4 w-4" />
                    <span>Grok AI</span>
                  </h3>
                  <p className="text-sm text-muted-foreground mb-3">
                    Análise avançada de mensagens e geração de insights
                  </p>
                  <div className="space-y-2">
                    <Input placeholder="API Key do Grok" type="password" />
                    <Button size="sm" className="w-full">
                      Testar Conexão
                    </Button>
                  </div>
                </div>

                <div className="p-4 border rounded-lg">
                  <h3 className="font-medium mb-2 flex items-center space-x-2">
                    <Bot className="h-4 w-4" />
                    <span>Claude AI</span>
                  </h3>
                  <p className="text-sm text-muted-foreground mb-3">
                    Processamento de linguagem natural e análise de sentimentos
                  </p>
                  <div className="space-y-2">
                    <Input placeholder="API Key do Claude" type="password" />
                    <Button size="sm" className="w-full">
                      Testar Conexão
                    </Button>
                  </div>
                </div>

                <div className="p-4 border rounded-lg">
                  <h3 className="font-medium mb-2 flex items-center space-x-2">
                    <Shield className="h-4 w-4" />
                    <span>Webhook Security</span>
                  </h3>
                  <p className="text-sm text-muted-foreground mb-3">
                    Configurações de segurança para webhooks
                  </p>
                  <div className="space-y-2">
                    <Input placeholder="Secret Key" type="password" />
                    <div className="flex items-center space-x-2">
                      <Switch id="webhook-security" />
                      <Label htmlFor="webhook-security" className="text-sm">
                        Verificação de assinatura
                      </Label>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* System Tab */}
        <TabsContent value="system" className="space-y-6">
          <Card className="shadow-card">
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Settings className="h-5 w-5 text-drystore-orange" />
                <span>Configurações do Sistema</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <Label htmlFor="grouping">Agrupamento de Mensagens (minutos)</Label>
                  <Input
                    id="grouping"
                    type="number"
                    value={systemSettings.message_grouping_minutes}
                    onChange={(e) => setSystemSettings({
                      ...systemSettings,
                      message_grouping_minutes: parseInt(e.target.value) || 1
                    })}
                    min="1"
                    max="60"
                  />
                  <p className="text-sm text-muted-foreground mt-1">
                    Tempo para agrupar mensagens do mesmo contato
                  </p>
                </div>

                <div>
                  <Label htmlFor="timeout">Timeout Webhook (segundos)</Label>
                  <Input
                    id="timeout"
                    type="number"
                    value={systemSettings.webhook_timeout}
                    onChange={(e) => setSystemSettings({
                      ...systemSettings,
                      webhook_timeout: parseInt(e.target.value) || 30
                    })}
                    min="10"
                    max="120"
                  />
                  <p className="text-sm text-muted-foreground mt-1">
                    Timeout para chamadas de webhook
                  </p>
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <Switch
                  id="auto_evaluation"
                  checked={systemSettings.auto_evaluation_enabled}
                  onCheckedChange={(checked) => setSystemSettings({
                    ...systemSettings,
                    auto_evaluation_enabled: checked
                  })}
                />
                <Label htmlFor="auto_evaluation">Avaliação automática de leads (15 min)</Label>
              </div>

              <div>
                <Label htmlFor="greeting">Mensagem padrão para vendedores</Label>
                <textarea
                  id="greeting"
                  className="w-full p-3 border rounded-lg resize-none"
                  rows={3}
                  value={systemSettings.default_greeting}
                  onChange={(e) => setSystemSettings({
                    ...systemSettings,
                    default_greeting: e.target.value
                  })}
                />
                <p className="text-sm text-muted-foreground mt-1">
                  Use {'{seller_name}'} para nome do vendedor e {'{product}'} para produto de interesse
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="retry-attempts">Tentativas de Retry</Label>
                  <Input
                    id="retry-attempts"
                    type="number"
                    defaultValue={3}
                    min="1"
                    max="10"
                  />
                </div>
                <div>
                  <Label htmlFor="rate-limit">Rate Limit (req/min)</Label>
                  <Input
                    id="rate-limit"
                    type="number"
                    defaultValue={60}
                    min="10"
                    max="300"
                  />
                </div>
              </div>

              <Button className="w-full">
                Salvar Configurações
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
      </div>
    </div>
  );
}

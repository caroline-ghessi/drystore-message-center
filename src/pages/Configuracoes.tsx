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
import AddSellerWizard from "@/components/Config/AddSellerWizard";
import SellerCard from "@/components/Config/SellerCard";
import RodrigoBotCard from "@/components/Config/RodrigoBotCard";

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
  
  const [sellers, setSellers] = useState<Seller[]>([
    {
      id: '1',
      name: 'Carlos Silva',
      phone_number: '(11) 99999-9999',
      webhook_url: 'https://api.drystore.com/webhook/seller/carlos-silva',
      status: 'active',
      auto_first_message: true,
      created_at: '2024-01-10T00:00:00Z',
      last_test: '2024-01-15T10:30:00Z'
    },
    {
      id: '2',
      name: 'Ana Santos',
      phone_number: '(11) 88888-8888',
      webhook_url: 'https://api.drystore.com/webhook/seller/ana-santos',
      status: 'inactive',
      auto_first_message: false,
      created_at: '2024-01-10T00:00:00Z',
      last_test: '2024-01-12T14:20:00Z'
    }
  ]);

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
      
      if (success) {
        // Store token securely (would use Supabase Secrets in real implementation)
        // For now, just add the seller
        const seller: Seller = {
          id: Date.now().toString(),
          name: newSeller.name,
          phone_number: newSeller.phone_number,
          webhook_url: newSeller.webhook_url,
          status: 'active',
          auto_first_message: newSeller.auto_first_message,
          created_at: new Date().toISOString(),
          last_test: new Date().toISOString()
        };
        
        setSellers([...sellers, seller]);
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('Error adding seller:', error);
      return false;
    }
  };

  const handleUpdateSeller = (updatedSeller: Seller) => {
    setSellers(sellers.map(seller => 
      seller.id === updatedSeller.id ? updatedSeller : seller
    ));
  };

  const handleDeleteSeller = (id: string) => {
    setSellers(sellers.filter(seller => seller.id !== id));
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
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-foreground">Configurações</h1>
        <p className="text-muted-foreground mt-1">
          Gerencie vendedores, integração WHAPI e configurações do sistema
        </p>
      </div>

      {/* Content */}
      <Tabs defaultValue="sellers" className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="sellers">Vendedores</TabsTrigger>
          <TabsTrigger value="rodrigo-bot">Rodrigo Bot</TabsTrigger>
          <TabsTrigger value="integrations">Integrações</TabsTrigger>
          <TabsTrigger value="system">Sistema</TabsTrigger>
        </TabsList>

        {/* Sellers Tab */}
        <TabsContent value="sellers" className="space-y-6">
          <AddSellerWizard onAdd={handleAddSeller} />
          
          <Card className="shadow-card">
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Users className="h-5 w-5 text-drystore-orange" />
                <span>Vendedores Cadastrados ({sellers.length})</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {sellers.map((seller) => (
                  <SellerCard
                    key={seller.id}
                    seller={seller}
                    onUpdate={handleUpdateSeller}
                    onDelete={handleDeleteSeller}
                    onTestIntegration={handleTestSellerIntegration}
                  />
                ))}
              </div>
              {sellers.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  Nenhum vendedor cadastrado. Use o formulário acima para adicionar vendedores.
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Rodrigo Bot Tab */}
        <TabsContent value="rodrigo-bot" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <RodrigoBotCard
              status={rodrigoBot.status}
              webhook_url={rodrigoBot.webhook_url}
              phone_number={rodrigoBot.phone_number}
              last_test={rodrigoBot.last_test}
              messages_sent_today={rodrigoBot.messages_sent_today}
              onUpdate={handleUpdateRodrigoBot}
              onTestIntegration={handleTestRodrigoBotIntegration}
            />
            
            <Card className="shadow-card">
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Shield className="h-5 w-5 text-drystore-orange" />
                  <span>Configurações do Rodrigo Bot</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="bot-greeting">Mensagem de Boas-vindas</Label>
                  <textarea
                    id="bot-greeting"
                    className="w-full p-3 border rounded-lg resize-none"
                    rows={3}
                    defaultValue="Olá! Sou o Rodrigo Bot da Drystore. Estou aqui para ajudar com informações sobre nossos produtos e serviços. Como posso ajudar?"
                  />
                </div>
                
                <div>
                  <Label htmlFor="bot-timeout">Timeout de Resposta (segundos)</Label>
                  <Input
                    id="bot-timeout"
                    type="number"
                    defaultValue={10}
                    min="5"
                    max="60"
                  />
                </div>
                
                <div className="flex items-center space-x-2">
                  <Switch id="bot-auto-response" defaultChecked />
                  <Label htmlFor="bot-auto-response">Respostas automáticas ativas</Label>
                </div>
                
                <Button className="w-full">
                  Salvar Configurações
                </Button>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Integrations Tab */}
        <TabsContent value="integrations" className="space-y-6">
          <Card className="shadow-card">
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Key className="h-5 w-5 text-drystore-orange" />
                <span>WhatsApp Business Meta</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="bg-blue-50 p-4 rounded-lg mb-4">
                <h4 className="font-medium text-blue-800 mb-2">📱 Webhook Configurado!</h4>
                <div className="space-y-2 text-sm text-blue-700">
                  <p><strong>URL do Webhook:</strong></p>
                  <code className="bg-white p-2 rounded block text-xs break-all">
                    https://groqsnnytvjabgeaekkw.supabase.co/functions/v1/whatsapp-webhook
                  </code>
                  <p><strong>Token de Verificação:</strong></p>
                  <code className="bg-white p-2 rounded block text-xs">
                    whatsapp_meta_verify_mTk9Xx2A
                  </code>
                  <p className="text-xs mt-2">
                    ✅ Use essas informações para configurar o webhook no Meta Developer Console
                  </p>
                </div>
              </div>
              
              <div className="grid grid-cols-1 gap-4">
                <div>
                  <Label htmlFor="meta-access-token">Meta Access Token</Label>
                  <Input 
                    id="meta-access-token" 
                    placeholder="EAAxxxxxx..." 
                    type="password" 
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Token permanente do WhatsApp Business API
                  </p>
                </div>
                
                <div>
                  <Label htmlFor="phone-number-id">Phone Number ID</Label>
                  <Input 
                    id="phone-number-id" 
                    placeholder="1234567890123456" 
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    ID do número de telefone configurado no Meta
                  </p>
                </div>
                
                <div>
                  <Label htmlFor="business-account-id">Business Account ID (WABA)</Label>
                  <Input 
                    id="business-account-id" 
                    placeholder="1234567890123456" 
                  />
                </div>
                
                <div>
                  <Label htmlFor="app-id">App ID</Label>
                  <Input 
                    id="app-id" 
                    placeholder="1234567890123456" 
                  />
                </div>
                
                <Button className="w-full">
                  Salvar Configuração Meta
                </Button>
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
  );
}
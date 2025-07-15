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
  MessageCircle, 
  Plus,
  Edit,
  Trash2,
  Check,
  X
} from "lucide-react";
import { 
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface Seller {
  id: string;
  name: string;
  phone_number: string;
  whapi_token: string;
  whapi_webhook: string;
  active: boolean;
  auto_first_message: boolean;
  created_at: string;
}

export default function Configuracoes() {
  const [sellers, setSellers] = useState<Seller[]>([
    {
      id: '1',
      name: 'Carlos Silva',
      phone_number: '(11) 99999-9999',
      whapi_token: 'token_carlos_***',
      whapi_webhook: 'https://api.drystore.com/webhook/carlos',
      active: true,
      auto_first_message: true,
      created_at: '2024-01-10T00:00:00Z'
    },
    {
      id: '2',
      name: 'Ana Santos',
      phone_number: '(11) 88888-8888',
      whapi_token: 'token_ana_***',
      whapi_webhook: 'https://api.drystore.com/webhook/ana',
      active: true,
      auto_first_message: false,
      created_at: '2024-01-10T00:00:00Z'
    }
  ]);

  const [editingSeller, setEditingSeller] = useState<string | null>(null);
  const [newSeller, setNewSeller] = useState<Partial<Seller>>({
    name: '',
    phone_number: '',
    whapi_token: '',
    whapi_webhook: '',
    active: true,
    auto_first_message: false
  });

  const [systemSettings, setSystemSettings] = useState({
    message_grouping_minutes: 1,
    auto_evaluation_enabled: true,
    webhook_timeout: 30,
    default_greeting: 'Olá! Sou {seller_name} da Drystore. Recebi seu interesse em {product}. Como posso ajudar?'
  });

  const handleSaveNewSeller = () => {
    if (newSeller.name && newSeller.phone_number) {
      const seller: Seller = {
        id: Date.now().toString(),
        name: newSeller.name,
        phone_number: newSeller.phone_number,
        whapi_token: newSeller.whapi_token || '',
        whapi_webhook: newSeller.whapi_webhook || '',
        active: newSeller.active || true,
        auto_first_message: newSeller.auto_first_message || false,
        created_at: new Date().toISOString()
      };
      setSellers([...sellers, seller]);
      setNewSeller({
        name: '',
        phone_number: '',
        whapi_token: '',
        whapi_webhook: '',
        active: true,
        auto_first_message: false
      });
    }
  };

  const handleDeleteSeller = (id: string) => {
    setSellers(sellers.filter(s => s.id !== id));
  };

  const handleToggleSellerActive = (id: string) => {
    setSellers(sellers.map(s => 
      s.id === id ? { ...s, active: !s.active } : s
    ));
  };

  const handleToggleAutoMessage = (id: string) => {
    setSellers(sellers.map(s => 
      s.id === id ? { ...s, auto_first_message: !s.auto_first_message } : s
    ));
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-foreground">Configurações</h1>
        <p className="text-muted-foreground mt-1">
          Gerencie vendedores e configurações do sistema
        </p>
      </div>

      {/* Content */}
      <Tabs defaultValue="sellers" className="space-y-6">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="sellers">Vendedores</TabsTrigger>
          <TabsTrigger value="integrations">Integrações</TabsTrigger>
          <TabsTrigger value="system">Sistema</TabsTrigger>
        </TabsList>

        {/* Sellers Tab */}
        <TabsContent value="sellers" className="space-y-6">
          {/* Add New Seller */}
          <Card className="shadow-card">
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Plus className="h-5 w-5 text-drystore-orange" />
                <span>Adicionar Vendedor</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="name">Nome</Label>
                  <Input
                    id="name"
                    value={newSeller.name}
                    onChange={(e) => setNewSeller({...newSeller, name: e.target.value})}
                    placeholder="Nome do vendedor"
                  />
                </div>
                <div>
                  <Label htmlFor="phone">Telefone</Label>
                  <Input
                    id="phone"
                    value={newSeller.phone_number}
                    onChange={(e) => setNewSeller({...newSeller, phone_number: e.target.value})}
                    placeholder="(11) 99999-9999"
                  />
                </div>
                <div>
                  <Label htmlFor="token">Token WHAPI</Label>
                  <Input
                    id="token"
                    value={newSeller.whapi_token}
                    onChange={(e) => setNewSeller({...newSeller, whapi_token: e.target.value})}
                    placeholder="Token da API (configurar depois)"
                    disabled
                  />
                </div>
                <div>
                  <Label htmlFor="webhook">Webhook URL</Label>
                  <Input
                    id="webhook"
                    value={newSeller.whapi_webhook}
                    onChange={(e) => setNewSeller({...newSeller, whapi_webhook: e.target.value})}
                    placeholder="URL do webhook (configurar depois)"
                    disabled
                  />
                </div>
              </div>
              <div className="flex items-center space-x-4 mt-4">
                <div className="flex items-center space-x-2">
                  <Switch
                    id="active"
                    checked={newSeller.active}
                    onCheckedChange={(checked) => setNewSeller({...newSeller, active: checked})}
                  />
                  <Label htmlFor="active">Ativo</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Switch
                    id="auto_message"
                    checked={newSeller.auto_first_message}
                    onCheckedChange={(checked) => setNewSeller({...newSeller, auto_first_message: checked})}
                  />
                  <Label htmlFor="auto_message">Primeira mensagem automática</Label>
                </div>
              </div>
              <Button 
                onClick={handleSaveNewSeller}
                className="mt-4"
                disabled={!newSeller.name || !newSeller.phone_number}
              >
                Adicionar Vendedor
              </Button>
            </CardContent>
          </Card>

          {/* Sellers List */}
          <Card className="shadow-card">
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Users className="h-5 w-5 text-drystore-orange" />
                <span>Vendedores Cadastrados</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Telefone</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Msg. Automática</TableHead>
                    <TableHead>Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sellers.map((seller) => (
                    <TableRow key={seller.id}>
                      <TableCell className="font-medium">{seller.name}</TableCell>
                      <TableCell>{seller.phone_number}</TableCell>
                      <TableCell>
                        <div className="flex items-center space-x-2">
                          <Switch
                            checked={seller.active}
                            onCheckedChange={() => handleToggleSellerActive(seller.id)}
                          />
                          <span className={seller.active ? 'text-drystore-success' : 'text-drystore-error'}>
                            {seller.active ? 'Ativo' : 'Inativo'}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Switch
                          checked={seller.auto_first_message}
                          onCheckedChange={() => handleToggleAutoMessage(seller.id)}
                        />
                      </TableCell>
                      <TableCell>
                        <div className="flex space-x-2">
                          <Button size="sm" variant="outline">
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button 
                            size="sm" 
                            variant="outline"
                            onClick={() => handleDeleteSeller(seller.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Integrations Tab */}
        <TabsContent value="integrations" className="space-y-6">
          <Card className="shadow-card">
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Key className="h-5 w-5 text-drystore-orange" />
                <span>Integrações Futuras</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 border rounded-lg opacity-50">
                  <h3 className="font-medium mb-2">Dify AI</h3>
                  <p className="text-sm text-muted-foreground mb-3">
                    Integração com chatbot inteligente
                  </p>
                  <Input placeholder="API Key do Dify" disabled />
                  <Button size="sm" className="mt-2" disabled>
                    Configurar
                  </Button>
                </div>
                
                <div className="p-4 border rounded-lg opacity-50">
                  <h3 className="font-medium mb-2">WHAPI</h3>
                  <p className="text-sm text-muted-foreground mb-3">
                    API para WhatsApp Business
                  </p>
                  <Input placeholder="Token WHAPI" disabled />
                  <Button size="sm" className="mt-2" disabled>
                    Configurar
                  </Button>
                </div>

                <div className="p-4 border rounded-lg opacity-50">
                  <h3 className="font-medium mb-2">Grok AI</h3>
                  <p className="text-sm text-muted-foreground mb-3">
                    Análise avançada de mensagens
                  </p>
                  <Input placeholder="API Key do Grok" disabled />
                  <Button size="sm" className="mt-2" disabled>
                    Configurar
                  </Button>
                </div>

                <div className="p-4 border rounded-lg opacity-50">
                  <h3 className="font-medium mb-2">Claude AI</h3>
                  <p className="text-sm text-muted-foreground mb-3">
                    Processamento de linguagem natural
                  </p>
                  <Input placeholder="API Key do Claude" disabled />
                  <Button size="sm" className="mt-2" disabled>
                    Configurar
                  </Button>
                </div>
              </div>
              
              <div className="text-center p-8 bg-muted rounded-lg">
                <p className="text-muted-foreground">
                  As integrações externas serão configuradas em versões futuras da plataforma.
                </p>
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
                <Label htmlFor="auto_evaluation">Avaliação automática de leads</Label>
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

              <Button>
                Salvar Configurações
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
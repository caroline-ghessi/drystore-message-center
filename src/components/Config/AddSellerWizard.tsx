import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { 
  Plus, 
  User, 
  Link, 
  Key, 
  TestTube, 
  CheckCircle, 
  Copy,
  Eye,
  EyeOff,
  Loader2
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface NewSeller {
  name: string;
  phone_number: string;
  webhook_url: string;
  auto_first_message: boolean;
}

interface AddSellerWizardProps {
  onAdd: (seller: NewSeller, token: string) => Promise<boolean>;
}

export default function AddSellerWizard({ onAdd }: AddSellerWizardProps) {
  const [currentStep, setCurrentStep] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [showToken, setShowToken] = useState(false);
  const [token, setToken] = useState("");
  const { toast } = useToast();

  const [newSeller, setNewSeller] = useState<NewSeller>({
    name: '',
    phone_number: '',
    webhook_url: '',
    auto_first_message: false
  });

  const generateWebhookUrl = () => {
    const sellerId = newSeller.name.toLowerCase().replace(/\s+/g, '-');
    const webhookUrl = `https://api.drystore.com/webhook/seller/${sellerId}`;
    setNewSeller({
      ...newSeller,
      webhook_url: webhookUrl
    });
    setCurrentStep(3);
  };

  const copyWebhookUrl = () => {
    navigator.clipboard.writeText(newSeller.webhook_url);
    toast({
      title: "URL copiada!",
      description: "URL do webhook copiada para área de transferência.",
    });
  };

  const handleTestAndSave = async () => {
    if (!token.trim()) {
      toast({
        title: "Token necessário",
        description: "Por favor, insira o token da WHAPI para testar a integração.",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    try {
      const success = await onAdd(newSeller, token);
      
      if (success) {
        toast({
          title: "Vendedor adicionado com sucesso!",
          description: "A integração foi testada e está funcionando corretamente.",
        });
        
        // Reset form
        setNewSeller({
          name: '',
          phone_number: '',
          webhook_url: '',
          auto_first_message: false
        });
        setToken("");
        setCurrentStep(1);
      } else {
        toast({
          title: "Falha na integração",
          description: "Não foi possível conectar com a WHAPI. Verifique o token.",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Erro",
        description: "Ocorreu um erro ao adicionar o vendedor.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const steps = [
    { number: 1, title: "Informações Básicas", icon: User },
    { number: 2, title: "Webhook URL", icon: Link },
    { number: 3, title: "Token WHAPI", icon: Key },
    { number: 4, title: "Testar Integração", icon: TestTube },
  ];

  return (
    <Card className="shadow-card">
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <Plus className="h-5 w-5 text-drystore-orange" />
          <span>Adicionar Vendedor</span>
        </CardTitle>
        
        {/* Steps Progress */}
        <div className="flex items-center space-x-2 mt-4">
          {steps.map((step) => (
            <div key={step.number} className="flex items-center">
              <div className={`flex items-center justify-center w-8 h-8 rounded-full border-2 ${
                currentStep >= step.number 
                  ? 'bg-drystore-orange text-white border-drystore-orange' 
                  : 'border-gray-300 text-gray-400'
              }`}>
                {currentStep > step.number ? (
                  <CheckCircle className="h-4 w-4" />
                ) : (
                  <step.icon className="h-4 w-4" />
                )}
              </div>
              {step.number < steps.length && (
                <div className={`w-8 h-0.5 mx-2 ${
                  currentStep > step.number ? 'bg-drystore-orange' : 'bg-gray-300'
                }`} />
              )}
            </div>
          ))}
        </div>
      </CardHeader>
      
      <CardContent className="space-y-6">
        {/* Step 1: Basic Information */}
        {currentStep === 1 && (
          <div className="space-y-4">
            <div>
              <Label htmlFor="seller-name">Nome do Vendedor</Label>
              <Input
                id="seller-name"
                value={newSeller.name}
                onChange={(e) => setNewSeller({...newSeller, name: e.target.value})}
                placeholder="Digite o nome do vendedor"
              />
            </div>
            
            <div>
              <Label htmlFor="seller-phone">Telefone</Label>
              <Input
                id="seller-phone"
                value={newSeller.phone_number}
                onChange={(e) => setNewSeller({...newSeller, phone_number: e.target.value})}
                placeholder="(11) 99999-9999"
              />
            </div>

            <div className="flex items-center space-x-2">
              <Switch
                id="auto-message"
                checked={newSeller.auto_first_message}
                onCheckedChange={(checked) => setNewSeller({...newSeller, auto_first_message: checked})}
              />
              <Label htmlFor="auto-message">Enviar primeira mensagem automática</Label>
            </div>

            <Button 
              onClick={() => setCurrentStep(2)}
              disabled={!newSeller.name || !newSeller.phone_number}
              className="w-full"
            >
              Próximo
            </Button>
          </div>
        )}

        {/* Step 2: Webhook URL Generation */}
        {currentStep === 2 && (
          <div className="space-y-4">
            <div className="text-center">
              <h3 className="text-lg font-medium mb-2">Gerar URL do Webhook</h3>
              <p className="text-sm text-muted-foreground">
                Será gerada uma URL única para o vendedor <strong>{newSeller.name}</strong>
              </p>
            </div>

            <div className="flex space-x-2">
              <Button 
                onClick={() => setCurrentStep(1)}
                variant="outline"
                className="flex-1"
              >
                Voltar
              </Button>
              <Button 
                onClick={generateWebhookUrl}
                className="flex-1"
              >
                Gerar URL do Webhook
              </Button>
            </div>
          </div>
        )}

        {/* Step 3: Token Input */}
        {currentStep === 3 && (
          <div className="space-y-4">
            <div>
              <Label htmlFor="webhook-url">URL do Webhook</Label>
              <div className="flex items-center space-x-2 mt-1">
                <Input
                  id="webhook-url"
                  value={newSeller.webhook_url}
                  readOnly
                  className="flex-1"
                />
                <Button 
                  size="sm" 
                  variant="outline" 
                  onClick={copyWebhookUrl}
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Use esta URL no painel da WHAPI
              </p>
            </div>

            <div>
              <Label htmlFor="whapi-token">Token da WHAPI</Label>
              <div className="flex items-center space-x-2 mt-1">
                <Input
                  id="whapi-token"
                  type={showToken ? "text" : "password"}
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  placeholder="Insira o token da WHAPI"
                  className="flex-1"
                />
                <Button 
                  size="sm" 
                  variant="outline" 
                  onClick={() => setShowToken(!showToken)}
                >
                  {showToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Token será armazenado de forma segura nos Secrets do Supabase
              </p>
            </div>

            <div className="flex space-x-2">
              <Button 
                onClick={() => setCurrentStep(2)}
                variant="outline"
                className="flex-1"
              >
                Voltar
              </Button>
              <Button 
                onClick={() => setCurrentStep(4)}
                disabled={!token.trim()}
                className="flex-1"
              >
                Próximo
              </Button>
            </div>
          </div>
        )}

        {/* Step 4: Test and Save */}
        {currentStep === 4 && (
          <div className="space-y-4">
            <div className="text-center">
              <h3 className="text-lg font-medium mb-2">Testar e Salvar</h3>
              <p className="text-sm text-muted-foreground">
                Vamos testar a integração antes de salvar o vendedor
              </p>
            </div>

            <div className="bg-muted/50 p-4 rounded-lg space-y-2">
              <div className="flex justify-between">
                <span className="text-sm">Vendedor:</span>
                <span className="text-sm font-medium">{newSeller.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm">Telefone:</span>
                <span className="text-sm font-medium">{newSeller.phone_number}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm">Msg. Automática:</span>
                <Badge variant={newSeller.auto_first_message ? "default" : "secondary"}>
                  {newSeller.auto_first_message ? "Sim" : "Não"}
                </Badge>
              </div>
            </div>

            <div className="flex space-x-2">
              <Button 
                onClick={() => setCurrentStep(3)}
                variant="outline"
                className="flex-1"
                disabled={isLoading}
              >
                Voltar
              </Button>
              <Button 
                onClick={handleTestAndSave}
                disabled={isLoading}
                className="flex-1"
              >
                {isLoading ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <TestTube className="h-4 w-4 mr-2" />
                )}
                Testar e Salvar
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
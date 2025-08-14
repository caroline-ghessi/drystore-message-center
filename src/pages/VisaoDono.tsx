import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useOwnerInsights } from "@/hooks/useOwnerInsights";
import { toast } from "sonner";
import { 
  Brain, 
  BarChart3, 
  Users, 
  TrendingUp, 
  AlertTriangle,
  Clock,
  Target,
  MessageSquare
} from "lucide-react";

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

export default function VisaoDono() {
  const { data: insightsData, isLoading: dataLoading, askQuestion } = useOwnerInsights();
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: '1',
      role: 'assistant',
      content: 'Olá! Sou seu assistente de análise estratégica com dados reais do sistema. Como posso ajudar você hoje? Posso fornecer insights sobre performance de vendedores, qualidade dos leads, tendências de atendimento e muito mais.',
      timestamp: new Date().toISOString()
    }
  ]);
  
  const [newMessage, setNewMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const quickQuestions = [
    "Quais as principais negociações em andamento hoje?",
    "Qual vendedor teve a melhor performance esta semana?",
    "Quais são as principais objeções dos clientes?",
    "Quanto de vendas foram geradas pelo WhatsApp?",
    "Qual o tempo médio de resposta dos vendedores?",
    "Quais leads têm maior potencial de conversão?"
  ];

  const handleSendMessage = async (content: string) => {
    if (!content.trim()) return;
    
    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content,
      timestamp: new Date().toISOString()
    };
    
    setMessages(prev => [...prev, userMessage]);
    setNewMessage('');
    setIsLoading(true);
    
    try {
      // Usar agente IA real com dados do sistema
      const response = await askQuestion(content);
      
      const assistantMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: response,
        timestamp: new Date().toISOString()
      };
      
      setMessages(prev => [...prev, assistantMessage]);
    } catch (error) {
      console.error('Erro ao processar pergunta:', error);
      toast.error('Erro ao processar pergunta. Tente novamente.');
      
      const errorMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: 'Desculpe, houve um erro ao processar sua pergunta. Tente novamente em alguns momentos.',
        timestamp: new Date().toISOString()
      };
      
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };


  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage(newMessage);
    }
  };

  return (
    <div className="p-6 h-screen flex flex-col">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-foreground flex items-center space-x-2">
          <Brain className="h-8 w-8 text-drystore-orange" />
          <span>Visão do Dono</span>
        </h1>
        <p className="text-muted-foreground mt-1">
          Análise estratégica inteligente dos seus atendimentos
        </p>
      </div>

      {/* Content */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Quick Stats */}
        <Card className="shadow-card">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center space-x-2">
              <BarChart3 className="h-5 w-5 text-drystore-orange" />
              <span>Resumo Hoje</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <MessageSquare className="h-4 w-4 text-drystore-info" />
                <span className="text-sm">Mensagens</span>
              </div>
              <span className="font-bold">
                {dataLoading ? '...' : insightsData?.metrics.messagesToday || 0}
              </span>
            </div>
            
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Users className="h-4 w-4 text-drystore-success" />
                <span className="text-sm">Leads</span>
              </div>
              <span className="font-bold">
                {dataLoading ? '...' : insightsData?.metrics.leadsGenerated || 0}
              </span>
            </div>
            
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <TrendingUp className="h-4 w-4 text-drystore-warning" />
                <span className="text-sm">Conversões</span>
              </div>
              <span className="font-bold">
                {dataLoading ? '...' : `${Math.round(insightsData?.metrics.conversionRate || 0)}%`}
              </span>
            </div>
            
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Target className="h-4 w-4 text-drystore-error" />
                <span className="text-sm">Vendas</span>
              </div>
              <span className="font-bold">
                {dataLoading ? '...' : `R$ ${((insightsData?.metrics.totalRevenue || 0) / 1000).toFixed(0)}k`}
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Chat Interface */}
        <div className="lg:col-span-3">
          <Card className="shadow-card h-full flex flex-col">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center space-x-2">
                <Brain className="h-5 w-5 text-drystore-orange" />
                <span>Assistente de Análise Estratégica</span>
              </CardTitle>
            </CardHeader>
            
            <CardContent className="flex-1 flex flex-col p-0">
              {/* Messages */}
              <div className="flex-1 p-4 overflow-y-auto space-y-4 max-h-[calc(100vh-400px)]">
                {messages.map((message) => (
                  <div
                    key={message.id}
                    className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[70%] p-3 rounded-lg ${
                        message.role === 'user'
                          ? 'bg-drystore-orange text-white'
                          : 'bg-muted text-foreground'
                      }`}
                    >
                      <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                      <p className="text-xs opacity-70 mt-1">
                        {new Date(message.timestamp).toLocaleTimeString('pt-BR')}
                      </p>
                    </div>
                  </div>
                ))}
                
                {isLoading && (
                  <div className="flex justify-start">
                    <div className="bg-muted text-foreground p-3 rounded-lg">
                      <div className="flex items-center space-x-2">
                        <div className="animate-pulse flex space-x-1">
                          <div className="w-2 h-2 bg-drystore-orange rounded-full"></div>
                          <div className="w-2 h-2 bg-drystore-orange rounded-full"></div>
                          <div className="w-2 h-2 bg-drystore-orange rounded-full"></div>
                        </div>
                        <span className="text-sm">Analisando dados...</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
              
              {/* Quick Questions */}
              <div className="p-4 border-t">
                <div className="mb-3">
                  <p className="text-sm font-medium mb-2">Perguntas frequentes:</p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {quickQuestions.map((question, index) => (
                      <Button
                        key={index}
                        variant="outline"
                        size="sm"
                        onClick={() => handleSendMessage(question)}
                        className="text-xs text-left h-auto p-2 whitespace-normal"
                      >
                        {question}
                      </Button>
                    ))}
                  </div>
                </div>
                
                {/* Input */}
                <div className="flex space-x-2">
                  <Input
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    onKeyPress={handleKeyPress}
                    placeholder="Digite sua pergunta sobre vendas, leads, performance..."
                    className="flex-1"
                  />
                  <Button 
                    onClick={() => handleSendMessage(newMessage)}
                    disabled={!newMessage.trim() || isLoading}
                  >
                    Enviar
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
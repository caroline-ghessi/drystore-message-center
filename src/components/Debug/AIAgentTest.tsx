import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Brain, Play, RefreshCw, AlertCircle, CheckCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { aiAgent } from '@/services/aiAgentService';
import { useAIAgents } from '@/hooks/useAIAgents';

export const AIAgentTest = () => {
  const [selectedAgent, setSelectedAgent] = useState<string>('');
  const [testPrompt, setTestPrompt] = useState<string>('');
  const [isTestingAgent, setIsTestingAgent] = useState(false);
  const [testResult, setTestResult] = useState<string>('');
  const [testError, setTestError] = useState<string>('');
  
  const { agents, loading } = useAIAgents();
  const { toast } = useToast();

  const availableAgents = Object.entries(agents).map(([key, config]) => ({
    key,
    name: getAgentDisplayName(key),
    model: config.model || 'claude-3-5-sonnet-20241022'
  }));

  function getAgentDisplayName(key: string): string {
    const names: Record<string, string> = {
      'ai_agent_owner_insights_prompt': 'Assistente Estratégico',
      'ai_agent_lead_evaluator_prompt': 'Avaliador de Leads',
      'ai_agent_seller_matcher_prompt': 'Matcher de Vendedores',
      'ai_agent_quality_analyzer_prompt': 'Analisador de Qualidade',
      'ai_agent_summary_generator_prompt': 'Gerador de Resumos',
      'ai_agent_first_message_generator_prompt': 'Gerador de Primeira Mensagem'
    };
    return names[key] || key;
  }

  const handleTestAgent = async () => {
    if (!selectedAgent || !testPrompt.trim()) {
      toast({
        title: "Erro",
        description: "Selecione um agente e digite um prompt de teste",
        variant: "destructive"
      });
      return;
    }

    setIsTestingAgent(true);
    setTestResult('');
    setTestError('');

    try {
      const response = await aiAgent.testAgent(selectedAgent, testPrompt);
      setTestResult(response.result);
      
      toast({
        title: "Teste realizado com sucesso",
        description: `Agente ${getAgentDisplayName(selectedAgent)} respondeu corretamente`
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
      setTestError(errorMessage);
      
      toast({
        title: "Erro no teste",
        description: errorMessage,
        variant: "destructive"
      });
    } finally {
      setIsTestingAgent(false);
    }
  };

  const getTestPromptSuggestion = (agentKey: string): string => {
    const suggestions: Record<string, string> = {
      'ai_agent_owner_insights_prompt': 'Qual é a performance geral dos vendedores este mês?',
      'ai_agent_lead_evaluator_prompt': 'Avalie um lead interessado em telhas shingle para construção residencial',
      'ai_agent_seller_matcher_prompt': 'Match um lead qualificado de telhas com orçamento de R$ 50.000',
      'ai_agent_quality_analyzer_prompt': 'Analise a qualidade de um atendimento com 5 mensagens trocadas',
      'ai_agent_summary_generator_prompt': 'Resuma uma conversa sobre orçamento de drywall',
      'ai_agent_first_message_generator_prompt': 'Gere primeira mensagem para cliente interessado em ferramentas'
    };
    return suggestions[agentKey] || 'Digite seu prompt de teste aqui...';
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center h-32">
          <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Brain className="h-5 w-5" />
          Teste de Agentes de IA
        </CardTitle>
        <CardDescription>
          Teste o funcionamento dos agentes de IA com prompts personalizados
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Agente para testar</label>
            <Select
              value={selectedAgent}
              onValueChange={(value) => {
                setSelectedAgent(value);
                setTestPrompt(getTestPromptSuggestion(value));
                setTestResult('');
                setTestError('');
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione um agente" />
              </SelectTrigger>
              <SelectContent>
                {availableAgents.map((agent) => (
                  <SelectItem key={agent.key} value={agent.key}>
                    <div className="flex items-center gap-2">
                      {agent.name}
                      <Badge variant="outline" className="text-xs">
                        {agent.model.includes('claude') ? 'Claude' : 'Grok'}
                      </Badge>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Status da Conexão</label>
            <div className="flex items-center gap-2 p-2 border rounded">
              {availableAgents.length > 0 ? (
                <>
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  <span className="text-sm">Agentes configurados</span>
                </>
              ) : (
                <>
                  <AlertCircle className="h-4 w-4 text-orange-500" />
                  <span className="text-sm">Nenhum agente encontrado</span>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">Prompt de teste</label>
          <Textarea
            placeholder="Digite o prompt para testar o agente..."
            value={testPrompt}
            onChange={(e) => setTestPrompt(e.target.value)}
            className="min-h-[100px]"
          />
        </div>

        <Button
          onClick={handleTestAgent}
          disabled={!selectedAgent || !testPrompt.trim() || isTestingAgent}
          className="w-full"
        >
          {isTestingAgent ? (
            <>
              <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              Testando agente...
            </>
          ) : (
            <>
              <Play className="h-4 w-4 mr-2" />
              Executar teste
            </>
          )}
        </Button>

        {(testResult || testError) && (
          <>
            <Separator />
            <div className="space-y-2">
              <label className="text-sm font-medium">
                {testError ? 'Erro no teste' : 'Resultado do teste'}
              </label>
              <div className={`p-3 rounded border ${testError ? 'bg-destructive/10 border-destructive' : 'bg-muted'}`}>
                {testError ? (
                  <div className="flex items-start gap-2">
                    <AlertCircle className="h-4 w-4 text-destructive mt-0.5" />
                    <pre className="text-sm text-destructive whitespace-pre-wrap">{testError}</pre>
                  </div>
                ) : (
                  <pre className="text-sm whitespace-pre-wrap">{testResult}</pre>
                )}
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
};
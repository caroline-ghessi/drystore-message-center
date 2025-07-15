import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Brain, Save, RefreshCw, Settings, TestTube, AlertCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface AIAgentConfig {
  system_prompt: string;
  model: string;
  temperature: number;
  max_tokens: number;
}

interface AIAgent {
  key: string;
  title: string;
  description: string;
  category: 'analysis' | 'communication' | 'evaluation' | 'matching';
  config: AIAgentConfig;
  isActive: boolean;
}

const AgentesIA = () => {
  const [agents, setAgents] = useState<AIAgent[]>([]);
  const [selectedAgent, setSelectedAgent] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  const agentCategories = {
    analysis: { name: 'Análise', color: 'bg-blue-500' },
    communication: { name: 'Comunicação', color: 'bg-green-500' },
    evaluation: { name: 'Avaliação', color: 'bg-orange-500' },
    matching: { name: 'Matching', color: 'bg-purple-500' }
  };

  const availableModels = [
    { value: 'claude-3-5-haiku-20241022', label: 'Claude 3.5 Haiku (Rápido)' },
    { value: 'claude-3-5-sonnet-20241022', label: 'Claude 3.5 Sonnet (Inteligente)' },
    { value: 'claude-3-opus-20240229', label: 'Claude 3 Opus (Máxima Qualidade)' },
    { value: 'grok-beta', label: 'Grok (Criativo)' },
    { value: 'grok-vision-beta', label: 'Grok Vision (Multimodal)' }
  ];

  useEffect(() => {
    loadAgents();
  }, []);

  const loadAgents = async () => {
    try {
      const { data, error } = await supabase
        .from('settings')
        .select('*')
        .like('key', 'ai_agent_%_prompt');

      if (error) throw error;

      const agentData: AIAgent[] = data?.map(setting => {
        const config = setting.value as unknown as AIAgentConfig;
        return {
          key: setting.key,
          title: getAgentTitle(setting.key),
          description: setting.description || '',
          category: getAgentCategory(setting.key),
          config,
          isActive: true
        };
      }) || [];

      setAgents(agentData);
      if (agentData.length > 0 && !selectedAgent) {
        setSelectedAgent(agentData[0].key);
      }
    } catch (error) {
      console.error('Erro ao carregar agentes:', error);
      toast({
        title: "Erro",
        description: "Não foi possível carregar os agentes de IA",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const getAgentTitle = (key: string): string => {
    const titles: Record<string, string> = {
      'ai_agent_owner_insights_prompt': 'Assistente Estratégico (Visão do Dono)',
      'ai_agent_lead_evaluator_prompt': 'Avaliador de Leads',
      'ai_agent_seller_matcher_prompt': 'Matcher de Vendedores',
      'ai_agent_quality_analyzer_prompt': 'Analisador de Qualidade',
      'ai_agent_summary_generator_prompt': 'Gerador de Resumos',
      'ai_agent_first_message_generator_prompt': 'Gerador de Primeira Mensagem'
    };
    return titles[key] || key;
  };

  const getAgentCategory = (key: string): 'analysis' | 'communication' | 'evaluation' | 'matching' => {
    if (key.includes('owner_insights') || key.includes('quality_analyzer')) return 'analysis';
    if (key.includes('first_message') || key.includes('summary_generator')) return 'communication';
    if (key.includes('lead_evaluator')) return 'evaluation';
    if (key.includes('seller_matcher')) return 'matching';
    return 'analysis';
  };

  const saveAgent = async (agentKey: string, config: AIAgentConfig) => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from('settings')
        .update({ value: config as any })
        .eq('key', agentKey);

      if (error) throw error;

      setAgents(prev => prev.map(agent => 
        agent.key === agentKey ? { ...agent, config } : agent
      ));

      toast({
        title: "Sucesso",
        description: "Configurações do agente salvas com sucesso"
      });
    } catch (error) {
      console.error('Erro ao salvar agente:', error);
      toast({
        title: "Erro",
        description: "Não foi possível salvar as configurações",
        variant: "destructive"
      });
    } finally {
      setSaving(false);
    }
  };

  const currentAgent = agents.find(agent => agent.key === selectedAgent);

  if (loading) {
    return (
      <div className="container mx-auto py-8">
        <div className="flex items-center justify-center h-64">
          <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 space-y-6">
      <div className="flex items-center gap-3">
        <Brain className="h-8 w-8 text-primary" />
        <div>
          <h1 className="text-3xl font-bold">Agentes de IA</h1>
          <p className="text-muted-foreground">
            Gerencie os prompts e configurações dos agentes de inteligência artificial
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Lista de Agentes */}
        <div className="lg:col-span-1">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Agentes Disponíveis</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {agents.map((agent) => (
                <Button
                  key={agent.key}
                  variant={selectedAgent === agent.key ? "default" : "ghost"}
                  className="w-full justify-start h-auto p-3"
                  onClick={() => setSelectedAgent(agent.key)}
                >
                  <div className="flex items-start gap-2 w-full">
                    <div className={`w-2 h-2 rounded-full mt-1 ${agentCategories[agent.category].color}`} />
                    <div className="text-left">
                      <div className="font-medium text-sm">{agent.title}</div>
                      <div className="text-xs text-muted-foreground">
                        {agentCategories[agent.category].name}
                      </div>
                    </div>
                  </div>
                </Button>
              ))}
            </CardContent>
          </Card>
        </div>

        {/* Editor de Configurações */}
        <div className="lg:col-span-3">
          {currentAgent ? (
            <AgentEditor
              agent={currentAgent}
              onSave={saveAgent}
              saving={saving}
              models={availableModels}
            />
          ) : (
            <Card>
              <CardContent className="flex items-center justify-center h-64">
                <div className="text-center space-y-2">
                  <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto" />
                  <p className="text-muted-foreground">Selecione um agente para configurar</p>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
};

interface AgentEditorProps {
  agent: AIAgent;
  onSave: (key: string, config: AIAgentConfig) => Promise<void>;
  saving: boolean;
  models: Array<{ value: string; label: string }>;
}

const AgentEditor: React.FC<AgentEditorProps> = ({ agent, onSave, saving, models }) => {
  const [config, setConfig] = useState<AIAgentConfig>(agent.config);

  useEffect(() => {
    setConfig(agent.config);
  }, [agent]);

  const handleSave = () => {
    onSave(agent.key, config);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Settings className="h-5 w-5" />
          {agent.title}
        </CardTitle>
        <CardDescription>{agent.description}</CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="prompt" className="space-y-4">
          <TabsList>
            <TabsTrigger value="prompt">Prompt do Sistema</TabsTrigger>
            <TabsTrigger value="config">Configurações</TabsTrigger>
          </TabsList>

          <TabsContent value="prompt" className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="system-prompt">Prompt do Sistema</Label>
              <Textarea
                id="system-prompt"
                placeholder="Digite o prompt do sistema para este agente..."
                value={config.system_prompt}
                onChange={(e) => setConfig(prev => ({ ...prev, system_prompt: e.target.value }))}
                className="min-h-[200px] font-mono text-sm"
              />
              <p className="text-xs text-muted-foreground">
                Este prompt define o comportamento e personalidade do agente de IA.
              </p>
            </div>
          </TabsContent>

          <TabsContent value="config" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="model">Modelo de IA</Label>
                <Select
                  value={config.model}
                  onValueChange={(value) => setConfig(prev => ({ ...prev, model: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione um modelo" />
                  </SelectTrigger>
                  <SelectContent>
                    {models.map((model) => (
                      <SelectItem key={model.value} value={model.value}>
                        {model.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="max-tokens">Tokens Máximos</Label>
                <Input
                  id="max-tokens"
                  type="number"
                  min="100"
                  max="4000"
                  value={config.max_tokens}
                  onChange={(e) => setConfig(prev => ({ ...prev, max_tokens: parseInt(e.target.value) || 1000 }))}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="temperature">Temperatura ({config.temperature})</Label>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.1"
                  value={config.temperature}
                  onChange={(e) => setConfig(prev => ({ ...prev, temperature: parseFloat(e.target.value) }))}
                  className="w-full"
                />
                <p className="text-xs text-muted-foreground">
                  Controla a criatividade das respostas (0 = conservador, 1 = criativo)
                </p>
              </div>
            </div>
          </TabsContent>
        </Tabs>

        <Separator className="my-6" />

        <div className="flex justify-end gap-2">
          <Button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2"
          >
            {saving ? (
              <RefreshCw className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            Salvar Configurações
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default AgentesIA;
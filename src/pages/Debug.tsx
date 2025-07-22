
import WhatsAppTester from "@/components/Debug/WhatsAppTester";
import { DifyChatTest } from "@/components/Debug/DifyChatTest";
import { DifyChatTestWithFiles } from "@/components/Debug/DifyChatTestWithFiles";
import { AIAgentTest } from "@/components/Debug/AIAgentTest";
import LogViewer from "@/components/Debug/LogViewer";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { MediaRetryTest } from "@/components/Debug/MediaRetryTest";
import { MessageQueueMonitor } from "@/components/Debug/MessageQueueMonitor";
import { MessageDeliveryMonitor } from "@/components/Debug/MessageDeliveryMonitor";
import { DeliveryStatusPanel } from "@/components/WhatsApp/DeliveryStatusPanel";
import { DeliveryTestPanel } from "@/components/Debug/DeliveryTestPanel";

export default function Debug() {
  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Debug & Testes</h1>
        <Badge variant="secondary">Ambiente de Desenvolvimento</Badge>
      </div>

      <Tabs defaultValue="whatsapp" className="w-full">
        <TabsList className="grid w-full grid-cols-8">
          <TabsTrigger value="whatsapp">WhatsApp</TabsTrigger>
          <TabsTrigger value="dify">Dify</TabsTrigger>
          <TabsTrigger value="ai-agents">Agentes IA</TabsTrigger>
          <TabsTrigger value="queue">Fila</TabsTrigger>
          <TabsTrigger value="delivery">Entrega</TabsTrigger>
          <TabsTrigger value="delivery-test">Teste Entrega</TabsTrigger>
          <TabsTrigger value="monitoring">Monitoramento</TabsTrigger>
          <TabsTrigger value="logs">Logs</TabsTrigger>
        </TabsList>

        <TabsContent value="whatsapp" className="space-y-6">
          <WhatsAppTester />
          <MediaRetryTest />
        </TabsContent>

        <TabsContent value="dify" className="space-y-6">
          <DifyChatTest />
          <DifyChatTestWithFiles />
        </TabsContent>

        <TabsContent value="ai-agents" className="space-y-6">
          <AIAgentTest />
        </TabsContent>

        <TabsContent value="queue" className="space-y-6">
          <MessageQueueMonitor />
        </TabsContent>

        <TabsContent value="delivery" className="space-y-6">
          <MessageDeliveryMonitor />
        </TabsContent>

        <TabsContent value="delivery-test" className="space-y-6">
          <DeliveryTestPanel />
        </TabsContent>

        <TabsContent value="monitoring" className="space-y-6">
          <DeliveryStatusPanel />
        </TabsContent>

        <TabsContent value="logs" className="space-y-6">
          <LogViewer />
        </TabsContent>
      </Tabs>
    </div>
  );
}

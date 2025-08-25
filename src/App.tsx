import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Sidebar } from "@/components/Layout/Sidebar";
import { AuthProvider } from "@/components/AuthProvider";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import Login from "./pages/Login";
import Index from "./pages/Index";
import Dashboard from "./pages/Dashboard";
import MensagensOficial from "./pages/MensagensOficial";
import MensagensVendedores from "./pages/MensagensVendedores";
import WhatsAppClone from "./pages/WhatsAppClone";
import Leads from "./pages/Leads";
import Configuracoes from "./pages/Configuracoes";
import Debug from "./pages/Debug";
import VisaoDono from "./pages/VisaoDono";
import AgentesIA from "./pages/AgentesIA";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/" element={<Index />} />
            <Route path="/dashboard" element={
              <ProtectedRoute>
                <div className="flex h-screen bg-background">
                  <Sidebar />
                  <main className="flex-1 overflow-hidden">
                    <Dashboard />
                  </main>
                </div>
              </ProtectedRoute>
            } />
            <Route path="/mensagens/oficial" element={
              <ProtectedRoute>
                <div className="flex h-screen bg-background">
                  <Sidebar />
                  <main className="flex-1 overflow-hidden">
                    <MensagensOficial />
                  </main>
                </div>
              </ProtectedRoute>
            } />
            <Route path="/whatsapp-clone" element={
              <ProtectedRoute>
                <div className="flex h-screen bg-background">
                  <Sidebar />
                  <main className="flex-1 overflow-hidden">
                    <WhatsAppClone />
                  </main>
                </div>
              </ProtectedRoute>
            } />
            <Route path="/leads" element={
              <ProtectedRoute>
                <div className="flex h-screen bg-background">
                  <Sidebar />
                  <main className="flex-1 overflow-hidden">
                    <Leads />
                  </main>
                </div>
              </ProtectedRoute>
            } />
            <Route path="/configuracoes" element={
              <ProtectedRoute>
                <div className="flex h-screen bg-background">
                  <Sidebar />
                  <main className="flex-1 overflow-hidden">
                    <Configuracoes />
                  </main>
                </div>
              </ProtectedRoute>
            } />
            <Route path="/debug" element={
              <ProtectedRoute>
                <div className="flex h-screen bg-background">
                  <Sidebar />
                  <main className="flex-1 overflow-hidden">
                    <Debug />
                  </main>
                </div>
              </ProtectedRoute>
            } />
            <Route path="/visao-dono" element={
              <ProtectedRoute>
                <div className="flex h-screen bg-background">
                  <Sidebar />
                  <main className="flex-1 overflow-hidden">
                    <VisaoDono />
                  </main>
                </div>
              </ProtectedRoute>
            } />
            <Route path="/agentes-ia" element={
              <ProtectedRoute>
                <div className="flex h-screen bg-background">
                  <Sidebar />
                  <main className="flex-1 overflow-hidden">
                    <AgentesIA />
                  </main>
                </div>
              </ProtectedRoute>
            } />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;

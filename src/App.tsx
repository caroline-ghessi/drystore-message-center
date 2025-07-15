import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Sidebar } from "@/components/Layout/Sidebar";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import MensagensOficial from "./pages/MensagensOficial";
import MensagensVendedores from "./pages/MensagensVendedores";
import Leads from "./pages/Leads";
import Configuracoes from "./pages/Configuracoes";
import Debug from "./pages/Debug";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/" element={<Login />} />
          <Route path="/dashboard" element={
            <div className="flex h-screen">
              <Sidebar />
              <main className="flex-1 overflow-auto">
                <Dashboard />
              </main>
            </div>
          } />
          <Route path="/mensagens/oficial" element={
            <div className="flex h-screen">
              <Sidebar />
              <main className="flex-1 overflow-auto">
                <MensagensOficial />
              </main>
            </div>
          } />
          <Route path="/mensagens/vendedores" element={
            <div className="flex h-screen">
              <Sidebar />
              <main className="flex-1 overflow-auto">
                <MensagensVendedores />
              </main>
            </div>
          } />
          <Route path="/leads" element={
            <div className="flex h-screen">
              <Sidebar />
              <main className="flex-1 overflow-auto">
                <Leads />
              </main>
            </div>
          } />
          <Route path="/configuracoes" element={
            <div className="flex h-screen">
              <Sidebar />
              <main className="flex-1 overflow-auto">
                <Configuracoes />
              </main>
            </div>
          } />
          <Route path="/debug" element={
            <div className="flex h-screen">
              <Sidebar />
              <main className="flex-1 overflow-auto">
                <Debug />
              </main>
            </div>
          } />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;

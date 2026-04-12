import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import { I18nProvider } from "@/i18n";
import { CustomerAuthProvider } from "@/hooks/useCustomerAuth";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import ScrollToTop from "@/components/ScrollToTop";
import { AdminLayout } from "@/components/AdminLayout";
import Login from "./pages/Login";
import Index from "./pages/Index";
import ContaEmAnalise from "./pages/ContaEmAnalise";
import Dashboard from "./pages/admin/Dashboard";
import Produtos from "./pages/admin/Produtos";
import Pedidos from "./pages/admin/Pedidos";
import Configuracoes from "./pages/admin/Configuracoes";
import Cupons from "./pages/admin/Cupons";
import Gateway from "./pages/admin/Gateway";
import Frete from "./pages/admin/Frete";
import Clientes from "./pages/admin/Clientes";
import Pagamentos from "./pages/admin/Pagamentos";
import MeuPlano from "./pages/admin/MeuPlano";
import Paginas from "./pages/admin/Paginas";
import Automacao from "./pages/admin/Automacao";
import SetupStore from "./pages/admin/SetupStore";
import Cerebro from "./pages/admin/Cerebro";
import Indicacoes from "./pages/admin/Indicacoes";
import Politicas from "./pages/admin/Politicas";
import Fidelidade from "./pages/admin/Fidelidade";
import Lucro from "./pages/admin/Lucro";
import Analytics from "./pages/admin/Analytics";
import WhatsAppIA from "./pages/admin/WhatsAppIA";
import Suporte from "./pages/admin/Suporte";
import LojaPolitica from "./pages/loja/LojaPolitica";
import LojaLayout from "./pages/loja/LojaLayout";
import LojaHome from "./pages/loja/LojaHome";
import LojaProduto from "./pages/loja/LojaProduto";
import LojaCheckout from "./pages/loja/LojaCheckout";
import LojaRastreio from "./pages/loja/LojaRastreio";
import LojaCupons from "./pages/loja/LojaCupons";
import LojaPagina from "./pages/loja/LojaPagina";
import SuperAdminLayout from "./pages/superadmin/SuperAdminLayout";
import SuperAdminDashboard from "./pages/superadmin/SuperAdminDashboard";
import SuperAdminTenants from "./pages/superadmin/SuperAdminTenants";
import SuperAdminPlanos from "./pages/superadmin/SuperAdminPlanos";
import SuperAdminNotificacoes from "./pages/superadmin/SuperAdminNotificacoes";
import SuperAdminConfig from "./pages/superadmin/SuperAdminConfig";
import SuperAdminSolicitacoes from "./pages/superadmin/SuperAdminSolicitacoes";
import SuperAdminAuditLogs from "./pages/superadmin/SuperAdminAuditLogs";
import SuperAdminIndicacoes from "./pages/superadmin/SuperAdminIndicacoes";
import SuperAdminBanners from "./pages/superadmin/SuperAdminBanners";
import ResetPassword from "./pages/ResetPassword";
import Termos from "./pages/Termos";
import Privacidade from "./pages/Privacidade";
import NotFound from "./pages/NotFound";
import { isPlatformHost } from "./lib/storeDomain";
import StoreRoutes from "./StoreRoutes";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

// Simple error boundary to catch and show something if it crashes
import React from "react";
class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean }> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() { return { hasError: true }; }
  componentDidCatch(error: any, errorInfo: any) { console.error("React Error Boundary caught:", error, errorInfo); }
  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-white p-8 text-center">
          <div className="max-w-md space-y-4">
            <div className="text-6xl">⚠️</div>
            <h1 className="text-2xl font-bold">Ocorreu um erro inesperado</h1>
            <p className="text-gray-500">Tente recarregar a página ou entre em contato com o suporte.</p>
            <button onClick={() => window.location.reload()} className="px-4 py-2 bg-black text-white rounded-md">
              Recarregar Página
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}



const App = () => {
  const isPlatform = isPlatformHost(window.location.hostname);

  return (
    <ErrorBoundary>
      <I18nProvider>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <ScrollToTop />
            <AuthProvider>
              {!isPlatform ? (
                <StoreRoutes />
              ) : (
                <Routes>
                  <Route path="/" element={<Index />} />
                  <Route path="/loja-layout-test" element={<CustomerAuthProvider><LojaLayout /></CustomerAuthProvider>}>
                    <Route index element={<LojaHome />} />
                    <Route path="produto/:id" element={<LojaProduto />} />
                    <Route path="checkout" element={<LojaCheckout />} />
                    <Route path="rastreio" element={<LojaRastreio />} />
                    <Route path="rastreio/:orderId" element={<LojaRastreio />} />
                    <Route path="cupons" element={<LojaCupons />} />
                  </Route>
                  <Route path="/login" element={<Login />} />
                  <Route path="/reset-password" element={<ResetPassword />} />
                  <Route path="/termos" element={<Termos />} />
                  <Route path="/privacidade" element={<Privacidade />} />
                  <Route path="/setup-store" element={<ProtectedRoute><SetupStore /></ProtectedRoute>} />
                  <Route path="/conta-em-analise" element={<ContaEmAnalise />} />
                  {/* Super Admin */}
                  <Route path="/superadmin" element={<ProtectedRoute><SuperAdminLayout /></ProtectedRoute>}>
                    <Route index element={<SuperAdminDashboard />} />
                    <Route path="tenants" element={<SuperAdminTenants />} />
                    <Route path="solicitacoes" element={<SuperAdminSolicitacoes />} />
                    <Route path="planos" element={<SuperAdminPlanos />} />
                    <Route path="notificacoes" element={<SuperAdminNotificacoes />} />
                    <Route path="audit-logs" element={<SuperAdminAuditLogs />} />
                    <Route path="indicacoes" element={<SuperAdminIndicacoes />} />
                    <Route path="banners" element={<SuperAdminBanners />} />
                    <Route path="config" element={<SuperAdminConfig />} />
                  </Route>
                  {/* Tenant Admin */}
                  <Route path="/admin" element={<ProtectedRoute><AdminLayout /></ProtectedRoute>}>
                    <Route index element={<Dashboard />} />
                    <Route path="produtos" element={<Produtos />} />
                    <Route path="pedidos" element={<Pedidos />} />
                    <Route path="cupons" element={<Cupons />} />
                    <Route path="config" element={<Configuracoes />} />
                    <Route path="gateway" element={<Gateway />} />
                    <Route path="frete" element={<Frete />} />
                    <Route path="pagamentos" element={<Pagamentos />} />
                    <Route path="clientes" element={<Clientes />} />
                    <Route path="plano" element={<MeuPlano />} />
                    <Route path="paginas" element={<Paginas />} />
                    <Route path="automacao" element={<Automacao />} />
                    <Route path="cerebro" element={<Cerebro />} />
                    <Route path="indicacoes" element={<Indicacoes />} />
                    <Route path="politicas" element={<Politicas />} />
                    <Route path="fidelidade" element={<Fidelidade />} />
                    <Route path="lucro" element={<Lucro />} />
                    <Route path="analytics" element={<Analytics />} />
                    <Route path="whatsapp-ia" element={<WhatsAppIA />} />
                  </Route>
                  {/* Multi-tenant: store by slug only — no default /loja */}
                  <Route path="/loja" element={<Navigate to="/" replace />} />
                  <Route path="/loja/:slug" element={<CustomerAuthProvider><LojaLayout /></CustomerAuthProvider>}>
                    <Route index element={<LojaHome />} />
                    <Route path="produto/:id" element={<LojaProduto />} />
                    <Route path="checkout" element={<LojaCheckout />} />
                    <Route path="rastreio" element={<LojaRastreio />} />
                    <Route path="rastreio/:orderId" element={<LojaRastreio />} />
                    <Route path="cupons" element={<LojaCupons />} />
                    <Route path="p/:pageSlug" element={<LojaPagina />} />
                    <Route path="legal/:policySlug" element={<LojaPolitica />} />
                  </Route>
                  <Route path="*" element={<NotFound />} />
                </Routes>
              )}
            </AuthProvider>
          </BrowserRouter>
        </TooltipProvider>
      </QueryClientProvider>
      </I18nProvider>
    </ErrorBoundary>
  );
};

export default App;

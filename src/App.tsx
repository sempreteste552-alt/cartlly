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
import { Loader2 } from "lucide-react";
const AdminLayout = React.lazy(() => import("./components/AdminLayout"));
const Login = React.lazy(() => import("./pages/Login"));
const Index = React.lazy(() => import("./pages/Index"));
const ContaEmAnalise = React.lazy(() => import("./pages/ContaEmAnalise"));
const Dashboard = React.lazy(() => import("./pages/admin/Dashboard"));
const Produtos = React.lazy(() => import("./pages/admin/Produtos"));
const Pedidos = React.lazy(() => import("./pages/admin/Pedidos"));
const Configuracoes = React.lazy(() => import("./pages/admin/Configuracoes"));
const Cupons = React.lazy(() => import("./pages/admin/Cupons"));
const Gateway = React.lazy(() => import("./pages/admin/Gateway"));
const Frete = React.lazy(() => import("./pages/admin/Frete"));
const Clientes = React.lazy(() => import("./pages/admin/Clientes"));
const Pagamentos = React.lazy(() => import("./pages/admin/Pagamentos"));
const MeuPlano = React.lazy(() => import("./pages/admin/MeuPlano"));
const Paginas = React.lazy(() => import("./pages/admin/Paginas"));
const Automacao = React.lazy(() => import("./pages/admin/Automacao"));
const SetupStore = React.lazy(() => import("./pages/admin/SetupStore"));
const Cerebro = React.lazy(() => import("./pages/admin/Cerebro"));
const Indicacoes = React.lazy(() => import("./pages/admin/Indicacoes"));
const Politicas = React.lazy(() => import("./pages/admin/Politicas"));
const Fidelidade = React.lazy(() => import("./pages/admin/Fidelidade"));
const Lucro = React.lazy(() => import("./pages/admin/Lucro"));
const Analytics = React.lazy(() => import("./pages/admin/Analytics"));
const WhatsAppIA = React.lazy(() => import("./pages/admin/WhatsAppIA"));
const Notificacoes = React.lazy(() => import("./pages/admin/Notificacoes"));
const Suporte = React.lazy(() => import("./pages/admin/Suporte"));
const LojaPolitica = React.lazy(() => import("./pages/loja/LojaPolitica"));
const LojaLayout = React.lazy(() => import("./pages/loja/LojaLayout"));
const LojaHome = React.lazy(() => import("./pages/loja/LojaHome"));
const LojaProduto = React.lazy(() => import("./pages/loja/LojaProduto"));
const LojaCheckout = React.lazy(() => import("./pages/loja/LojaCheckout"));
const LojaRastreio = React.lazy(() => import("./pages/loja/LojaRastreio"));
const LojaCupons = React.lazy(() => import("./pages/loja/LojaCupons"));
const LojaPagina = React.lazy(() => import("./pages/loja/LojaPagina"));
const SuperAdminLayout = React.lazy(() => import("./pages/superadmin/SuperAdminLayout"));
const SuperAdminDashboard = React.lazy(() => import("./pages/superadmin/SuperAdminDashboard"));
const SuperAdminTenants = React.lazy(() => import("./pages/superadmin/SuperAdminTenants"));
const SuperAdminPlanos = React.lazy(() => import("./pages/superadmin/SuperAdminPlanos"));
const SuperAdminNotificacoes = React.lazy(() => import("./pages/superadmin/SuperAdminNotificacoes"));
const SuperAdminConfig = React.lazy(() => import("./pages/superadmin/SuperAdminConfig"));
const SuperAdminSolicitacoes = React.lazy(() => import("./pages/superadmin/SuperAdminSolicitacoes"));
const SuperAdminAuditLogs = React.lazy(() => import("./pages/superadmin/SuperAdminAuditLogs"));
const SuperAdminIndicacoes = React.lazy(() => import("./pages/superadmin/SuperAdminIndicacoes"));
const SuperAdminBanners = React.lazy(() => import("./pages/superadmin/SuperAdminBanners"));
const SuperAdminRoulette = React.lazy(() => import("./pages/superadmin/SuperAdminRoulette"));
const SuperAdminDominios = React.lazy(() => import("./pages/superadmin/SuperAdminDominios"));
const MinhaRoleta = React.lazy(() => import("./pages/admin/MinhaRoleta"));
const ResetPassword = React.lazy(() => import("./pages/ResetPassword"));
const Termos = React.lazy(() => import("./pages/Termos"));
const Privacidade = React.lazy(() => import("./pages/Privacidade"));
const NotFound = React.lazy(() => import("./pages/NotFound"));
const StoreRoutes = React.lazy(() => import("./StoreRoutes"));

import { isPlatformHost } from "./lib/storeDomain";

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
            <React.Suspense fallback={<div className="min-h-screen flex items-center justify-center"><Loader2 className="h-10 w-10 animate-spin text-muted-foreground" /></div>}>
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
                    <Route path="roulette" element={<SuperAdminRoulette />} />
                    <Route path="dominios" element={<SuperAdminDominios />} />
                  </Route>
                  {/* Tenant Admin */}
                  <Route path="/admin" element={<Navigate to="/" replace />} />
                  <Route path="/painel/:slug" element={<ProtectedRoute><AdminLayout /></ProtectedRoute>}>
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
                    <Route path="notificacoes" element={<Notificacoes />} />
                    <Route path="suporte" element={<Suporte />} />
                    <Route path="roleta" element={<MinhaRoleta />} />
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
            </React.Suspense>
          </BrowserRouter>
        </TooltipProvider>
      </QueryClientProvider>
      </I18nProvider>
    </ErrorBoundary>
  );
};

export default App;

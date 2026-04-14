import React, { Suspense, lazy } from "react";
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

const AdminLayout = lazy(() => import("./components/AdminLayout").then(m => ({ default: m.AdminLayout })));
const Login = lazy(() => import("./pages/Login"));
const Index = lazy(() => import("./pages/Index"));
const ContaEmAnalise = lazy(() => import("./pages/ContaEmAnalise"));
const Dashboard = lazy(() => import("./pages/admin/Dashboard"));
const Produtos = lazy(() => import("./pages/admin/Produtos"));
const Pedidos = lazy(() => import("./pages/admin/Pedidos"));
const Configuracoes = lazy(() => import("./pages/admin/Configuracoes"));
const Cupons = lazy(() => import("./pages/admin/Cupons"));

const Frete = lazy(() => import("./pages/admin/Frete"));
const Clientes = lazy(() => import("./pages/admin/Clientes"));
const Pagamentos = lazy(() => import("./pages/admin/Pagamentos"));
const MeuPlano = lazy(() => import("./pages/admin/MeuPlano"));
const Paginas = lazy(() => import("./pages/admin/Paginas"));
const Automacao = lazy(() => import("./pages/admin/Automacao"));
const SetupStore = lazy(() => import("./pages/admin/SetupStore"));
const Cerebro = lazy(() => import("./pages/admin/Cerebro"));
const Indicacoes = lazy(() => import("./pages/admin/Indicacoes"));
const Politicas = lazy(() => import("./pages/admin/Politicas"));
const Fidelidade = lazy(() => import("./pages/admin/Fidelidade"));
const Lucro = lazy(() => import("./pages/admin/Lucro"));
const Analytics = lazy(() => import("./pages/admin/Analytics"));
const WhatsAppIA = lazy(() => import("./pages/admin/WhatsAppIA"));
const Notificacoes = lazy(() => import("./pages/admin/Notificacoes"));
const Suporte = lazy(() => import("./pages/admin/Suporte"));
const LojaPolitica = lazy(() => import("./pages/loja/LojaPolitica"));
const LojaLayout = lazy(() => import("./pages/loja/LojaLayout"));
const LojaHome = lazy(() => import("./pages/loja/LojaHome"));
const LojaProduto = lazy(() => import("./pages/loja/LojaProduto"));
const LojaCheckout = lazy(() => import("./pages/loja/LojaCheckout"));
const LojaRastreio = lazy(() => import("./pages/loja/LojaRastreio"));
const LojaCupons = lazy(() => import("./pages/loja/LojaCupons"));
const LojaPagina = lazy(() => import("./pages/loja/LojaPagina"));
const SuperAdminLayout = lazy(() => import("./pages/superadmin/SuperAdminLayout"));
const SuperAdminDashboard = lazy(() => import("./pages/superadmin/SuperAdminDashboard"));
const SuperAdminTenants = lazy(() => import("./pages/superadmin/SuperAdminTenants"));
const SuperAdminPlanos = lazy(() => import("./pages/superadmin/SuperAdminPlanos"));
const SuperAdminNotificacoes = lazy(() => import("./pages/superadmin/SuperAdminNotificacoes"));
const SuperAdminConfig = lazy(() => import("./pages/superadmin/SuperAdminConfig"));
const SuperAdminSolicitacoes = lazy(() => import("./pages/superadmin/SuperAdminSolicitacoes"));
const SuperAdminAuditLogs = lazy(() => import("./pages/superadmin/SuperAdminAuditLogs"));
const SuperAdminIndicacoes = lazy(() => import("./pages/superadmin/SuperAdminIndicacoes"));
const SuperAdminBanners = lazy(() => import("./pages/superadmin/SuperAdminBanners"));
const SuperAdminRoulette = lazy(() => import("./pages/superadmin/SuperAdminRoulette"));
const SuperAdminDominios = lazy(() => import("./pages/superadmin/SuperAdminDominios"));
const MinhaRoleta = lazy(() => import("./pages/admin/MinhaRoleta"));
const ResetPassword = lazy(() => import("./pages/ResetPassword"));
const Termos = lazy(() => import("./pages/Termos"));
const Privacidade = lazy(() => import("./pages/Privacidade"));
const NotFound = lazy(() => import("./pages/NotFound"));
const StoreRoutes = lazy(() => import("./StoreRoutes"));

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
// React import moved to top
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
            <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><Loader2 className="h-10 w-10 animate-spin text-muted-foreground" /></div>}>
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
            </Suspense>
          </BrowserRouter>
        </TooltipProvider>
      </QueryClientProvider>
      </I18nProvider>
    </ErrorBoundary>
  );
};

export default App;

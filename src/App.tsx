import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import { CustomerAuthProvider } from "@/hooks/useCustomerAuth";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { AdminLayout } from "@/components/AdminLayout";
import Login from "./pages/Login";
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
import LojaLayout from "./pages/loja/LojaLayout";
import LojaHome from "./pages/loja/LojaHome";
import LojaProduto from "./pages/loja/LojaProduto";
import LojaCheckout from "./pages/loja/LojaCheckout";
import LojaRastreio from "./pages/loja/LojaRastreio";
import SuperAdminLayout from "./pages/superadmin/SuperAdminLayout";
import SuperAdminDashboard from "./pages/superadmin/SuperAdminDashboard";
import SuperAdminTenants from "./pages/superadmin/SuperAdminTenants";
import SuperAdminPlanos from "./pages/superadmin/SuperAdminPlanos";
import SuperAdminNotificacoes from "./pages/superadmin/SuperAdminNotificacoes";
import SuperAdminConfig from "./pages/superadmin/SuperAdminConfig";
import ResetPassword from "./pages/ResetPassword";
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
            <Route path="/" element={<Navigate to="/login" replace />} />
            <Route path="/login" element={<Login />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/conta-em-analise" element={<ContaEmAnalise />} />
            {/* Super Admin */}
            <Route path="/superadmin" element={<ProtectedRoute><SuperAdminLayout /></ProtectedRoute>}>
              <Route index element={<SuperAdminDashboard />} />
              <Route path="tenants" element={<SuperAdminTenants />} />
              <Route path="planos" element={<SuperAdminPlanos />} />
              <Route path="notificacoes" element={<SuperAdminNotificacoes />} />
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
            </Route>
            {/* Multi-tenant: store by slug only — no default /loja */}
            <Route path="/loja" element={<Navigate to="/login" replace />} />
            <Route path="/loja/:slug" element={<CustomerAuthProvider><LojaLayout /></CustomerAuthProvider>}>
              <Route index element={<LojaHome />} />
              <Route path="produto/:id" element={<LojaProduto />} />
              <Route path="checkout" element={<LojaCheckout />} />
              <Route path="rastreio" element={<LojaRastreio />} />
              <Route path="rastreio/:orderId" element={<LojaRastreio />} />
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;

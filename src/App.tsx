import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { AdminLayout } from "@/components/AdminLayout";
import Login from "./pages/Login";
import Dashboard from "./pages/admin/Dashboard";
import Produtos from "./pages/admin/Produtos";
import Pedidos from "./pages/admin/Pedidos";
import Configuracoes from "./pages/admin/Configuracoes";
import LojaLayout from "./pages/loja/LojaLayout";
import LojaHome from "./pages/loja/LojaHome";
import LojaProduto from "./pages/loja/LojaProduto";
import LojaCheckout from "./pages/loja/LojaCheckout";
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
            <Route path="/" element={<Navigate to="/loja" replace />} />
            <Route path="/login" element={<Login />} />
            <Route path="/admin" element={<ProtectedRoute><AdminLayout /></ProtectedRoute>}>
              <Route index element={<Dashboard />} />
              <Route path="produtos" element={<Produtos />} />
              <Route path="pedidos" element={<Pedidos />} />
              <Route path="config" element={<Configuracoes />} />
            </Route>
            {/* Default store (first store) */}
            <Route path="/loja" element={<LojaLayout />}>
              <Route index element={<LojaHome />} />
              <Route path="produto/:id" element={<LojaProduto />} />
              <Route path="checkout" element={<LojaCheckout />} />
            </Route>
            {/* Multi-tenant: store by slug */}
            <Route path="/loja/:slug" element={<LojaLayout />}>
              <Route index element={<LojaHome />} />
              <Route path="produto/:id" element={<LojaProduto />} />
              <Route path="checkout" element={<LojaCheckout />} />
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;

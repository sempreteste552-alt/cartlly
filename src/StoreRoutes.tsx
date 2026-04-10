import { Route, Routes } from "react-router-dom";
import { CustomerAuthProvider } from "@/hooks/useCustomerAuth";
import LojaLayout from "./pages/loja/LojaLayout";
import LojaHome from "./pages/loja/LojaHome";
import LojaProduto from "./pages/loja/LojaProduto";
import LojaCheckout from "./pages/loja/LojaCheckout";
import LojaRastreio from "./pages/loja/LojaRastreio";
import LojaCupons from "./pages/loja/LojaCupons";
import LojaPagina from "./pages/loja/LojaPagina";

export default function StoreRoutes() {
  return (
    <CustomerAuthProvider>
      <Routes>
        <Route element={<LojaLayout />}>
          <index element={<LojaHome />} />
          <Route path="produto/:id" element={<LojaProduto />} />
          <Route path="checkout" element={<LojaCheckout />} />
          <Route path="rastreio" element={<LojaRastreio />} />
          <Route path="rastreio/:orderId" element={<LojaRastreio />} />
          <Route path="cupons" element={<LojaCupons />} />
          <Route path="p/:pageSlug" element={<LojaPagina />} />
        </Route>
      </Routes>
    </CustomerAuthProvider>
  );
}

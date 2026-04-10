import { Route, Routes } from "react-router-dom";
import { CustomerAuthProvider } from "@/hooks/useCustomerAuth";
import LojaLayout from "./pages/loja/LojaLayout";
import LojaHome from "./pages/loja/LojaHome";
import LojaProduto from "./pages/loja/LojaProduto";
import LojaCheckout from "./pages/loja/LojaCheckout";
import LojaRastreio from "./pages/loja/LojaRastreio";
import LojaCupons from "./pages/loja/LojaCupons";
import LojaPagina from "./pages/loja/LojaPagina";
import LojaPolitica from "./pages/loja/LojaPolitica";

export default function StoreRoutes() {
  return (
    <CustomerAuthProvider>
      <Routes>
        <Route element={<LojaLayout />}>
          <Route index element={<LojaHome />} />
          <Route path="produto/:id" element={<LojaProduto />} />
          <Route path="checkout" element={<LojaCheckout />} />
          <Route path="rastreio" element={<LojaRastreio />} />
          <Route path="rastreio/:orderId" element={<LojaRastreio />} />
          <Route path="cupons" element={<LojaCupons />} />
          <Route path="p/:pageSlug" element={<LojaPagina />} />
          <Route path="legal/:policySlug" element={<LojaPolitica />} />
        </Route>
      </Routes>
    </CustomerAuthProvider>
  );
}

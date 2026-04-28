import { Route, Routes } from "react-router-dom";
import { CustomerAuthProvider } from "@/hooks/useCustomerAuth";
import { StoreLogoSplash } from "@/components/storefront/StoreLogoSplash";
import React from "react";
const LojaLayout = React.lazy(() => import("./pages/loja/LojaLayout"));
const LojaHome = React.lazy(() => import("./pages/loja/LojaHome"));
const LojaProduto = React.lazy(() => import("./pages/loja/LojaProduto"));
const LojaCheckout = React.lazy(() => import("./pages/loja/LojaCheckout"));
const LojaRastreio = React.lazy(() => import("./pages/loja/LojaRastreio"));
const LojaCupons = React.lazy(() => import("./pages/loja/LojaCupons"));
const LojaPagina = React.lazy(() => import("./pages/loja/LojaPagina"));
const LojaPolitica = React.lazy(() => import("./pages/loja/LojaPolitica"));

export default function StoreRoutes() {
  return (
    <CustomerAuthProvider>
      <React.Suspense fallback={<StoreLogoSplash />}>
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
      </React.Suspense>
    </CustomerAuthProvider>
  );
}

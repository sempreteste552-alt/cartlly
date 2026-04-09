import { useEffect, useState } from "react";
import { driver } from "driver.js";
import "driver.js/dist/driver.css";
import { useLocation, useNavigate } from "react-router-dom";

export const OnboardingTutorial = () => {
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    const isTutorialMode = sessionStorage.getItem("onboarding_tutorial_active");
    if (!isTutorialMode) return;

    const currentPath = location.pathname;

    if (currentPath === "/admin") {
      const driverObj = driver({
        showProgress: true,
        animate: true,
        doneBtnText: "Próximo Passo",
        nextBtnText: "Próximo",
        prevBtnText: "Anterior",
        steps: [
          {
            element: "#dashboard-welcome",
            popover: {
              title: "Bem-vindo ao seu Painel! 👋",
              description: "Este é o seu centro de controle. Aqui você tem uma visão geral de tudo o que acontece na sua loja em tempo real.",
              side: "bottom",
              align: "start",
            },
          },
          {
            element: "#kpi-cards",
            popover: {
              title: "Indicadores de Desempenho (Cards) 📊",
              description: "Estes cards mostram seus números principais. Qualquer venda ou novo produto cadastrado será refletido aqui instantaneamente.",
              side: "bottom",
              align: "start",
            },
          },
          {
            element: "#sidebar-products",
            popover: {
              title: "Gestão de Produtos 📦",
              description: "Aqui você cadastra e gerencia seus itens. Vamos ver como funciona?",
              side: "right",
              align: "start",
            },
          },
        ],
        onDestroyed: () => {
          // If the user closed manually, don't auto-navigate?
          // But if they clicked "Done" (which is actually just closing it in driver.js)
        },
        onCloseClick: () => {
          sessionStorage.removeItem("onboarding_tutorial_active");
        },
        onDestroyStarted: () => {
           // This is a hacky way to know if we should navigate
           // But driver.js doesn't tell us *how* it was destroyed
        }
      });

      // Simple hack: listen for the "done" button (last step button)
      const observer = new MutationObserver(() => {
        const doneBtn = document.querySelector(".driver-popover-footer button:last-child");
        if (doneBtn && doneBtn.textContent === "Próximo Passo") {
           doneBtn.addEventListener("click", () => {
             navigate("/admin/produtos");
           }, { once: true });
        }
      });
      observer.observe(document.body, { childList: true, subtree: true });

      driverObj.drive();
      return () => observer.disconnect();
    }

    if (currentPath === "/admin/produtos") {
       const driverObj = driver({
        showProgress: true,
        animate: true,
        doneBtnText: "Próximo Passo",
        nextBtnText: "Próximo",
        prevBtnText: "Anterior",
        steps: [
          {
            element: "#products-header",
            popover: {
              title: "Seu Catálogo 📦",
              description: "Aqui você gerencia todos os seus produtos. Você pode ativar ou desativar itens conforme a disponibilidade.",
              side: "bottom",
              align: "start",
            },
          },
          {
            element: "#new-product-btn",
            popover: {
              title: "Novo Produto ➕",
              description: "Adicione novos itens aqui. Você pode definir fotos, preços, variantes e estoque.",
              side: "bottom",
              align: "start",
            },
          },
          {
            element: "#products-table",
            popover: {
              title: "Lista de Produtos 📝",
              description: "Veja rapidamente o status de cada item. Alterações de preço aqui refletem no checkout do cliente.",
              side: "top",
              align: "start",
            },
          },
        ],
        onCloseClick: () => {
          sessionStorage.removeItem("onboarding_tutorial_active");
        }
      });

      const observer = new MutationObserver(() => {
        const doneBtn = document.querySelector(".driver-popover-footer button:last-child");
        if (doneBtn && doneBtn.textContent === "Próximo Passo") {
           doneBtn.addEventListener("click", () => {
             navigate("/admin/pedidos");
           }, { once: true });
        }
      });
      observer.observe(document.body, { childList: true, subtree: true });

      driverObj.drive();
      return () => observer.disconnect();
    }

    if (currentPath === "/admin/pedidos") {
       const driverObj = driver({
        showProgress: true,
        animate: true,
        doneBtnText: "Concluir",
        nextBtnText: "Próximo",
        prevBtnText: "Anterior",
        steps: [
          {
            element: "#orders-header",
            popover: {
              title: "Gerenciamento de Pedidos 🛒",
              description: "Aqui aparecem todas as vendas. Você pode filtrar por status para organizar sua expedição.",
              side: "bottom",
              align: "start",
            },
          },
          {
            element: "#orders-table",
            popover: {
              title: "Acompanhamento 🔍",
              description: "Clique no ícone de olho para ver detalhes do cliente, endereço e itens do pedido.",
              side: "top",
              align: "start",
            },
          },
        ],
        onCloseClick: () => {
          sessionStorage.removeItem("onboarding_tutorial_active");
        }
      });

      const observer = new MutationObserver(() => {
        const doneBtn = document.querySelector(".driver-popover-footer button:last-child");
        if (doneBtn && doneBtn.textContent === "Concluir") {
           doneBtn.addEventListener("click", () => {
             sessionStorage.removeItem("onboarding_tutorial_active");
             localStorage.setItem("onboarding_tutorial_completed", "true");
           }, { once: true });
        }
      });
      observer.observe(document.body, { childList: true, subtree: true });

      driverObj.drive();
      return () => observer.disconnect();
    }

  }, [location.pathname, navigate]);

  return null;
};

export const startTutorial = () => {
  sessionStorage.setItem("onboarding_tutorial_active", "true");
  window.location.href = "/admin"; // Force reload to start from dashboard
};

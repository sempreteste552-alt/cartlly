import { useEffect, useState } from "react";
import { driver } from "driver.js";
import "driver.js/dist/driver.css";
import { useLocation, useNavigate } from "react-router-dom";

export const OnboardingTutorial = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [hasRun, setHasRun] = useState(false);

  useEffect(() => {
    const tutorialCompleted = localStorage.getItem("onboarding_tutorial_completed");
    if (tutorialCompleted || hasRun) return;

    // Start on Dashboard
    if (location.pathname === "/admin") {
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
          // If we are at the last step of dashboard, maybe navigate?
          // For now, let's just use the "done" button to go to next section
        },
        onDeselected: (element, step, { config, state }) => {
          if (step.element === "#sidebar-products" && state.activeStep === 2) {
             // This is the last step of dashboard
             // We can't easily trigger navigation from here with driver.js without complex state
          }
        }
      });

      // Override the "Done" button behavior for the last step
      // But driver.js doesn't easily expose the button click
      // So let's use a simpler approach: multiple tutorials based on route
      
      driverObj.drive();
    }

    if (location.pathname === "/admin/produtos") {
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
      });
      driverObj.drive();
    }

    if (location.pathname === "/admin/pedidos") {
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
      });
      driverObj.drive();
    }

  }, [location.pathname]);

  return null;
};

export const startTutorial = () => {
  localStorage.removeItem("onboarding_tutorial_completed");
  window.location.href = "/admin"; // Restart from dashboard
};

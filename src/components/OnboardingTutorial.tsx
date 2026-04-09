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

    // Only start on dashboard
    if (location.pathname !== "/admin") return;

    const driverObj = driver({
      showProgress: true,
      animate: true,
      doneBtnText: "Concluir",
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
            description: "Estes cards mostram seus números principais: produtos, pedidos, receita e clientes. Qualquer venda ou novo produto cadastrado será refletido aqui instantaneamente.",
            side: "bottom",
            align: "start",
          },
        },
        {
          element: "#sidebar-products",
          popover: {
            title: "Gestão de Produtos 📦",
            description: "Aqui você cadastra e gerencia seus itens. Alterações feitas lá mudam o que o seu cliente vê na vitrine da loja.",
            side: "right",
            align: "start",
          },
        },
        {
          element: "#sidebar-orders",
          popover: {
            title: "Pedidos 🛒",
            description: "Acompanhe todas as vendas realizadas. Quando um cliente compra, o pedido aparece aqui para você processar.",
            side: "right",
            align: "start",
          },
        },
        {
          element: "#sidebar-config",
          popover: {
            title: "Configurações da Loja ⚙️",
            description: "Personalize sua loja, mude cores, logo e nome. As alterações aqui refletem diretamente na identidade visual da sua loja online.",
            side: "right",
            align: "start",
          },
        },
        {
          element: "#store-preview-btn",
          popover: {
            title: "Ver sua Loja 🌐",
            description: "Clique aqui a qualquer momento para ver como sua loja está ficando para os seus clientes.",
            side: "bottom",
            align: "end",
          },
        },
      ],
      onDestroyed: () => {
        localStorage.setItem("onboarding_tutorial_completed", "true");
        setHasRun(true);
      },
    });

    driverObj.drive();
  }, [location.pathname, hasRun]);

  return null;
};

export const startTutorial = () => {
  localStorage.removeItem("onboarding_tutorial_completed");
  window.location.reload();
};

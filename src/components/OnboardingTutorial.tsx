import { useEffect, useState } from "react";
import { driver } from "driver.js";
import "driver.js/dist/driver.css";
import { useLocation, useNavigate } from "react-router-dom";

export const OnboardingTutorial = () => {
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    const tutorialCompleted = localStorage.getItem("onboarding_tutorial_completed");
    const tutorialActive = sessionStorage.getItem("onboarding_tutorial_active");

    // Automatically activate tutorial for new users on their first visit to dashboard
    if (!tutorialCompleted && !tutorialActive && location.pathname === "/admin") {
      sessionStorage.setItem("onboarding_tutorial_active", "true");
    }

    if (!sessionStorage.getItem("onboarding_tutorial_active")) return;

    const currentPath = location.pathname;

    const commonConfig = {
      showProgress: true,
      animate: true,
      doneBtnText: "Próximo Passo",
      nextBtnText: "Próximo",
      prevBtnText: "Anterior",
    };

    if (currentPath === "/admin") {
      const driverObj = driver({
        ...commonConfig,
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
            element: "#sidebar-produtos",
            popover: {
              title: "Gestão de Produtos 📦",
              description: "Aqui você cadastra e gerencia seus itens. Vamos ver como funciona?",
              side: "right",
              align: "start",
            },
          },
        ],
      });

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
        ...commonConfig,
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
            element: "#sidebar-pedidos",
            popover: {
              title: "Gestão de Pedidos 🛒",
              description: "Agora vamos ver como gerenciar suas vendas?",
              side: "right",
              align: "start",
            },
          },
        ],
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
        ...commonConfig,
        steps: [
          {
            element: "#orders-header",
            popover: {
              title: "Vendas e Pedidos 🛒",
              description: "Aqui aparecem todas as vendas. Você pode filtrar por status para organizar sua expedição.",
              side: "bottom",
              align: "start",
            },
          },
          {
            element: "#sidebar-clientes",
            popover: {
              title: "Base de Clientes 👥",
              description: "Saiba quem são seus clientes e o histórico de compras de cada um.",
              side: "right",
              align: "start",
            },
          },
        ],
      });

      const observer = new MutationObserver(() => {
        const doneBtn = document.querySelector(".driver-popover-footer button:last-child");
        if (doneBtn && doneBtn.textContent === "Próximo Passo") {
           doneBtn.addEventListener("click", () => {
             navigate("/admin/clientes");
           }, { once: true });
        }
      });
      observer.observe(document.body, { childList: true, subtree: true });

      driverObj.drive();
      return () => observer.disconnect();
    }

    if (currentPath === "/admin/clientes") {
      const driverObj = driver({
        ...commonConfig,
        steps: [
          {
            element: "#customers-header",
            popover: {
              title: "CRM de Clientes 👥",
              description: "Aqui você tem acesso a todos os dados dos seus clientes para um atendimento personalizado.",
              side: "bottom",
              align: "start",
            },
          },
          {
            element: "#sidebar-cupons",
            popover: {
              title: "Marketing e Cupons 🎫",
              description: "Crie promoções e cupons de desconto para alavancar suas vendas.",
              side: "right",
              align: "start",
            },
          },
        ],
      });

      const observer = new MutationObserver(() => {
        const doneBtn = document.querySelector(".driver-popover-footer button:last-child");
        if (doneBtn && doneBtn.textContent === "Próximo Passo") {
          doneBtn.addEventListener("click", () => {
            navigate("/admin/cupons");
          }, { once: true });
        }
      });
      observer.observe(document.body, { childList: true, subtree: true });

      driverObj.drive();
      return () => observer.disconnect();
    }

    if (currentPath === "/admin/cupons") {
      const driverObj = driver({
        ...commonConfig,
        steps: [
          {
            element: "#coupons-header",
            popover: {
              title: "Promoções 🎫",
              description: "Gerencie seus cupons de desconto aqui. Defina limites de uso, datas de expiração e valores.",
              side: "bottom",
              align: "start",
            },
          },
          {
            element: "#sidebar-loja",
            popover: {
              title: "Configurações da Loja ⚙️",
              description: "Personalize o visual, domínio e informações da sua loja.",
              side: "right",
              align: "start",
            },
          },
        ],
      });

      const observer = new MutationObserver(() => {
        const doneBtn = document.querySelector(".driver-popover-footer button:last-child");
        if (doneBtn && doneBtn.textContent === "Próximo Passo") {
          doneBtn.addEventListener("click", () => {
            navigate("/admin/config");
          }, { once: true });
        }
      });
      observer.observe(document.body, { childList: true, subtree: true });

      driverObj.drive();
      return () => observer.disconnect();
    }

    if (currentPath === "/admin/config") {
      const driverObj = driver({
        ...commonConfig,
        doneBtnText: "Concluir",
        steps: [
          {
            element: "h1:contains('Configurações')",
            popover: {
              title: "Sua Identidade 🎨",
              description: "Altere cores, logos, banners e conecte seu domínio próprio para dar profissionalismo à sua marca.",
              side: "bottom",
              align: "start",
            },
          },
          {
            element: "#store-preview-btn",
            popover: {
              title: "Pronto para decolar! 🚀",
              description: "Clique aqui a qualquer momento para ver como sua loja está ficando para os seus clientes.",
              side: "right",
              align: "start",
            },
          },
        ],
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
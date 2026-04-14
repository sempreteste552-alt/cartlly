import { useEffect, useState } from "react";
import { driver } from "driver.js";
import "driver.js/dist/driver.css";
import { useLocation, useNavigate, useParams } from "react-router-dom";

export const OnboardingTutorial = () => {
  const { slug } = useParams();
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    const tutorialCompleted = localStorage.getItem("onboarding_tutorial_completed");
    const tutorialViews = parseInt(localStorage.getItem("onboarding_tutorial_views") || "0");
    const tutorialActive = sessionStorage.getItem("onboarding_tutorial_active");

    // Automatically activate tutorial for new users on their first visit to dashboard, but only up to 1 time
    // We check for /painel/:slug
    const isDashboard = location.pathname === `/painel/${slug}` || location.pathname === `/painel/${slug}/`;

    if (!tutorialCompleted && !tutorialActive && isDashboard && tutorialViews < 1) {
      sessionStorage.setItem("onboarding_tutorial_active", "true");
      localStorage.setItem("onboarding_tutorial_views", (tutorialViews + 1).toString());
    }

    if (!sessionStorage.getItem("onboarding_tutorial_active")) return;

    const currentPath = location.pathname;

    const commonConfig = {
      showProgress: true,
      animate: true,
      doneBtnText: "Próximo Passo",
      nextBtnText: "Próximo",
      prevBtnText: "Anterior",
      allowClose: true,
      onDestroyed: () => {
        // If the tutorial is destroyed (closed/finished), we should consider if it was finished or just closed
        // But for simplicity, if it's closed, we stop the auto-progression in this session
        sessionStorage.removeItem("onboarding_tutorial_active");
      },
    };

    if (currentPath === `/painel/${slug}` || currentPath === `/painel/${slug}/`) {
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
             navigate(`/painel/${slug}/produtos`);
           }, { once: true });
        }
      });
      observer.observe(document.body, { childList: true, subtree: true });

      driverObj.drive();
      return () => observer.disconnect();
    }

    if (currentPath === `/painel/${slug}/produtos`) {
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
             navigate(`/painel/${slug}/pedidos`);
           }, { once: true });
        }
      });
      observer.observe(document.body, { childList: true, subtree: true });

      driverObj.drive();
      return () => observer.disconnect();
    }

    if (currentPath === `/painel/${slug}/pedidos`) {
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
             navigate(`/painel/${slug}/clientes`);
           }, { once: true });
        }
      });
      observer.observe(document.body, { childList: true, subtree: true });

      driverObj.drive();
      return () => observer.disconnect();
    }

    if (currentPath === `/painel/${slug}/clientes`) {
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
            navigate(`/painel/${slug}/cupons`);
          }, { once: true });
        }
      });
      observer.observe(document.body, { childList: true, subtree: true });

      driverObj.drive();
      return () => observer.disconnect();
    }

    if (currentPath === `/painel/${slug}/cupons`) {
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
            navigate(`/painel/${slug}/config`);
          }, { once: true });
        }
      });
      observer.observe(document.body, { childList: true, subtree: true });

      driverObj.drive();
      return () => observer.disconnect();
    }

    if (currentPath === `/painel/${slug}/config`) {
      const driverObj = driver({
        ...commonConfig,
        doneBtnText: "Concluir",
        steps: [
          {
            element: "#config-header",
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

  }, [location.pathname, navigate, slug]);

  return null;
};

export const startTutorial = () => {
  sessionStorage.setItem("onboarding_tutorial_active", "true");
  window.location.href = "/"; // Navigate to home to restart
};
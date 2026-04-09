import { Lock, ArrowUpCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Sparkles } from "lucide-react";

/** Persuasive copy for each locked feature */
const FEATURE_COPY: Record<string, { hook: string; benefit: string; minPlan: string }> = {
  "Gateway de Pagamento": { hook: "Seus clientes querem pagar com PIX e cartão agora", benefit: "Lojas que aceitam pagamento online convertem até 3× mais. Enquanto você força o manual, o concorrente já recebeu.", minPlan: "STARTER" },
  "Cupons de Desconto": { hook: "Cupom é a isca que traz cliente de volta", benefit: "Desconto estratégico aumenta recompra e ticket médio. Sem ele, você perde a alavanca mais barata de conversão.", minPlan: "STARTER" },
  "Páginas Personalizadas": { hook: "Sua loja sem 'Sobre' e 'Política' passa zero confiança", benefit: "Páginas como FAQ, Termos e Sobre eliminam objeções e fazem o visitante confiar antes de comprar.", minPlan: "STARTER" },
  "Importar com IA": { hook: "Cadastrar produto no braço é perda de tempo e dinheiro", benefit: "A IA importa catálogo inteiro em segundos — foto, título, descrição e preço. Você economiza horas e lança mais rápido que qualquer concorrente.", minPlan: "PREMIUM" },
  "Ferramentas de IA": { hook: "IA gera descrição, sugere preço e analisa produto em segundos", benefit: "Enquanto você escreve na mão, a IA já otimizou SEO, precificou corretamente e gerou conteúdo que vende. Pare de operar no lento.", minPlan: "PREMIUM" },
  "Banners da Loja": { hook: "Sem banner, sua home parece amadora", benefit: "Banners promocionais guiam o olho do cliente direto para a oferta. Home sem destaque = visitante que sai sem clicar em nada.", minPlan: "PRO" },
  "Domínio Personalizado": { hook: "URL genérica mata credibilidade", benefit: "Com seu próprio domínio, o cliente confia mais, o Google indexa melhor e sua marca ganha peso real.", minPlan: "PRO" },
  "Automação de Marketing": { hook: "Vender manualmente escala até certo ponto — depois trava", benefit: "Automação envia mensagem certa na hora certa: carrinho abandonado, pós-venda, reengajamento. Isso funciona enquanto você dorme.", minPlan: "PRO" },
  "Alerta de Reposição": { hook: "Cliente quer o produto e você nem sabe que acabou", benefit: "Alertas de reposição avisam antes de você perder a venda. Sem isso, o estoque zera e você descobre tarde demais.", minPlan: "PRO" },
  "Destaques (Stories)": { hook: "Stories geram urgência e mantêm o cliente navegando", benefit: "Igual ao Instagram: quem clica, se envolve. Quem se envolve, compra. Sem Stories sua home é estática e esquecível.", minPlan: "PRO" },
  "Personalização de Aparência": { hook: "Visual genérico = loja que ninguém lembra", benefit: "Tipografia, cores e cards personalizados criam identidade. Loja com cara própria converte mais porque transmite profissionalismo.", minPlan: "PRO" },
  "Galeria e Mídia": { hook: "Zoom e galeria de qualidade mudam a decisão de compra", benefit: "O cliente quer ver detalhes antes de pagar. Sem zoom, ele desiste. Com galeria rica, a confiança sobe e o carrinho enche.", minPlan: "STARTER" },
  "Ações de Compra": { hook: "Botão fixo de compra recupera quem já ia embora", benefit: "O visitante rola, se distrai e some. Botão sticky mantém o CTA visível o tempo todo — menos abandono, mais conversão.", minPlan: "PRO" },
  "Prova Social": { hook: "Avaliação de cliente vale mais que qualquer propaganda", benefit: "92% das pessoas leem reviews antes de comprar. Sem isso, sua loja perde a prova social que elimina objeção e fecha venda.", minPlan: "STARTER" },
  "Informações Extras": { hook: "FAQ no produto elimina dúvida e acelera a decisão", benefit: "Se o cliente tem pergunta sem resposta, ele sai. FAQ e guia de tamanhos respondem na hora e reduzem troca e devolução.", minPlan: "PRO" },
  "Recomendações": { hook: "Produto relacionado é venda extra sem esforço", benefit: "Cross-sell automático aumenta ticket médio em até 30%. Sem ele, o cliente compra 1 item quando poderia comprar 3.", minPlan: "PRO" },
  "Push para Clientes": { hook: "Push traz o cliente de volta sem gastar com anúncio", benefit: "Notificação push aparece direto no celular — sem algoritmo, sem custo por clique. É o canal mais barato de reengajamento.", minPlan: "PRO" },
  "Personalização de Cores": { hook: "Cores certas criam identidade e confiança", benefit: "Uma paleta coerente faz sua loja parecer profissional. Cores aleatórias passam amadorismo e afastam o comprador exigente.", minPlan: "PRO" },
  "Selo de Verificado": { hook: "Selo de verificado é prova instantânea de credibilidade", benefit: "Lojas verificadas passam confiança imediata. O cliente vê o selo e sabe que pode comprar sem medo.", minPlan: "PREMIUM" },
  "Letreiro (Marquee)": { hook: "Letreiro animado chama atenção para promoções ativas", benefit: "Uma faixa que roda com oferta ativa mantém o cliente atento. Sem ela, sua promoção passa despercebida.", minPlan: "PRO" },
  "Vídeos no Produto": { hook: "Vídeo no produto aumenta confiança e reduz devolução", benefit: "Cliente que vê o produto em vídeo tem 73% mais chance de comprar. Foto estática não mostra textura, tamanho real nem uso.", minPlan: "PREMIUM" },
};

const DEFAULT_COPY = {
  hook: "Essa função existe pra você vender mais",
  benefit: "Enquanto fica travada, sua loja opera abaixo do potencial. Concorrentes que já desbloquearam vendem mais, convertem melhor e crescem mais rápido.",
  minPlan: "PRO",
};

interface LockedFeatureProps {
  children: React.ReactNode;
  isLocked: boolean;
  featureName?: string;
  logoUrl?: string;
  minPlan?: string;
}

export function LockedFeature({ children, isLocked, featureName, logoUrl, minPlan }: LockedFeatureProps) {
  const navigate = useNavigate();

  if (!isLocked) return <>{children}</>;

  const copy = FEATURE_COPY[featureName || ""] || DEFAULT_COPY;
  const upgradePlan = minPlan || copy.minPlan;

  return (
    <div className="relative">
      <div className="pointer-events-none select-none filter blur-[3px] opacity-50">
        {children}
      </div>
      <div className="absolute inset-0 flex flex-col items-center justify-center bg-background/75 backdrop-blur-sm rounded-lg z-10">
        {logoUrl && (
          <img src={logoUrl} alt="Logo" className="h-12 w-auto mb-3 opacity-30" />
        )}
        <div className="flex flex-col items-center gap-3 text-center px-6 max-w-md">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 border-2 border-primary/20">
            <Lock className="h-7 w-7 text-primary" />
          </div>
          <div className="space-y-1">
            <p className="text-base font-bold text-foreground">
              {featureName || "Funcionalidade"} 🔒
            </p>
            <p className="text-sm font-semibold text-primary">
              {copy.hook}
            </p>
          </div>
          <p className="text-sm text-muted-foreground leading-relaxed max-w-sm">
            {copy.benefit}
          </p>
          <Badge variant="outline" className="text-[10px] gap-1">
            <Sparkles className="h-3 w-3" /> Disponível no plano {upgradePlan}+
          </Badge>
          <Button
            onClick={() => navigate(`/admin/plano?upgrade=${upgradePlan}`)}
            className="mt-1 gap-2"
            size="sm"
          >
            <ArrowUpCircle className="h-4 w-4" />
            Fazer upgrade e desbloquear
          </Button>
        </div>
      </div>
    </div>
  );
}

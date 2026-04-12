import { Link } from "react-router-dom";
import { ChevronLeft } from "lucide-react";
import msktelemarktingLogo from "@/assets/msktelemarkting-logo.png";

export default function Termos() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="max-w-3xl mx-auto px-4 py-12">
        <Link to="/login" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-8 transition-colors">
          <ChevronLeft className="mr-1 h-4 w-4" /> Voltar
        </Link>

        <div className="flex items-center gap-3 mb-8">
          <img src={msktelemarktingLogo} alt="MSK Telemarketing" className="h-10 w-auto" />
        </div>

        <article className="prose prose-sm dark:prose-invert max-w-none space-y-6">
          <h1 className="text-3xl font-bold">Termos de Uso</h1>
          <p className="text-sm text-muted-foreground">Última atualização: 10 de abril de 2026</p>

          <h2>1. Aceitação dos Termos</h2>
          <p>
            Ao criar uma conta na plataforma MSK Telemarketing, você concorda com estes Termos de Uso em sua totalidade. 
            Caso não concorde, não utilize nossos serviços.
          </p>

          <h2>2. Descrição do Serviço</h2>
          <p>
            A MSK Telemarketing é uma plataforma SaaS (Software como Serviço) que permite a criação e gestão de lojas virtuais. 
            Oferecemos ferramentas para cadastro de produtos, gestão de pedidos, integração com gateways de pagamento, 
            automação de marketing e personalização da loja.
          </p>

          <h2>3. Cadastro e Conta</h2>
          <p>
            Para utilizar a plataforma, é necessário criar uma conta com informações verdadeiras e completas. 
            Você é responsável por manter a segurança da sua senha e por todas as atividades realizadas na sua conta.
          </p>

          <h2>4. Planos e Pagamentos</h2>
          <p>
            A MSK Telemarketing oferece planos gratuitos e pagos. Os valores e funcionalidades de cada plano estão disponíveis 
            na seção "Meu Plano" dentro do painel administrativo. Pagamentos são processados mensalmente e não são reembolsáveis, 
            exceto em casos previstos pelo Código de Defesa do Consumidor.
          </p>

          <h2>5. Uso Aceitável</h2>
          <p>Você se compromete a não utilizar a plataforma para:</p>
          <ul>
            <li>Vender produtos ilegais ou proibidos por lei</li>
            <li>Praticar fraudes ou atividades enganosas</li>
            <li>Violar direitos de propriedade intelectual de terceiros</li>
            <li>Enviar spam ou comunicações não solicitadas</li>
            <li>Tentar acessar áreas restritas do sistema</li>
          </ul>

          <h2>6. Propriedade Intelectual</h2>
          <p>
            Todo o conteúdo da plataforma (código, design, marcas e logos) pertence à MSK Telemarketing. 
            O conteúdo que você criar (produtos, imagens, textos da loja) permanece de sua propriedade.
          </p>

          <h2>7. Suspensão e Encerramento</h2>
          <p>
            Reservamo-nos o direito de suspender ou encerrar contas que violem estes termos, 
            pratiquem atividades fraudulentas ou gerem risco à plataforma e seus usuários.
          </p>

          <h2>8. Limitação de Responsabilidade</h2>
          <p>
            A MSK Telemarketing não se responsabiliza por perdas de vendas, dados ou lucros cessantes decorrentes 
            de indisponibilidades temporárias, falhas de terceiros (gateways de pagamento, provedores de internet) 
            ou uso inadequado da plataforma.
          </p>

          <h2>9. Alterações nos Termos</h2>
          <p>
            Podemos atualizar estes termos periodicamente. Alterações significativas serão comunicadas 
            por e-mail ou notificação dentro da plataforma. O uso continuado após as alterações constitui aceitação.
          </p>

          <h2>10. Contato</h2>
          <p>
            Para dúvidas sobre estes termos, entre em contato pelo suporte disponível na plataforma.
          </p>
        </article>
      </div>
    </div>
  );
}

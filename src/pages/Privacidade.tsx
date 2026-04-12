import { Link } from "react-router-dom";
import { ChevronLeft } from "lucide-react";
import cartlyLogo from "@/assets/cartly-logo.png";

export default function Privacidade() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="max-w-3xl mx-auto px-4 py-12">
        <Link to="/login" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-8 transition-colors">
          <ChevronLeft className="mr-1 h-4 w-4" /> Voltar
        </Link>

        <div className="flex items-center gap-3 mb-8">
          <img src={cartlyLogo} alt="MSK Telemarketing" className="h-10 w-auto" />
        </div>

        <article className="prose prose-sm dark:prose-invert max-w-none space-y-6">
          <h1 className="text-3xl font-bold">Política de Privacidade</h1>
          <p className="text-sm text-muted-foreground">Última atualização: 10 de abril de 2026</p>

          <h2>1. Informações que Coletamos</h2>
          <p>Coletamos as seguintes informações quando você usa a MSK Telemarketing:</p>
          <ul>
            <li><strong>Dados de cadastro:</strong> nome, e-mail, telefone e informações da loja</li>
            <li><strong>Dados de uso:</strong> páginas visitadas, funcionalidades utilizadas, horários de acesso</li>
            <li><strong>Dados de clientes das lojas:</strong> informações fornecidas pelos compradores durante pedidos (nome, endereço, CPF, e-mail)</li>
            <li><strong>Dados técnicos:</strong> endereço IP, tipo de navegador, sistema operacional e dispositivo</li>
          </ul>

          <h2>2. Como Usamos seus Dados</h2>
          <p>Utilizamos as informações coletadas para:</p>
          <ul>
            <li>Fornecer e manter nossos serviços</li>
            <li>Processar pagamentos e pedidos</li>
            <li>Enviar comunicações importantes sobre a plataforma</li>
            <li>Melhorar a experiência do usuário e personalizar funcionalidades</li>
            <li>Prevenir fraudes e garantir a segurança</li>
            <li>Cumprir obrigações legais</li>
          </ul>

          <h2>3. Compartilhamento de Dados</h2>
          <p>Não vendemos seus dados pessoais. Podemos compartilhar informações com:</p>
          <ul>
            <li><strong>Processadores de pagamento:</strong> para completar transações financeiras</li>
            <li><strong>Provedores de infraestrutura:</strong> para hospedar e manter a plataforma</li>
            <li><strong>Autoridades legais:</strong> quando exigido por lei ou ordem judicial</li>
          </ul>

          <h2>4. Proteção dos Dados</h2>
          <p>
            Adotamos medidas de segurança técnicas e organizacionais para proteger seus dados, incluindo 
            criptografia SSL/TLS, controle de acesso, backups regulares e monitoramento de segurança.
          </p>

          <h2>5. Seus Direitos (LGPD)</h2>
          <p>De acordo com a Lei Geral de Proteção de Dados (LGPD), você tem direito a:</p>
          <ul>
            <li>Acessar seus dados pessoais</li>
            <li>Corrigir dados incompletos ou desatualizados</li>
            <li>Solicitar a exclusão de seus dados</li>
            <li>Revogar consentimentos fornecidos</li>
            <li>Solicitar a portabilidade dos dados</li>
          </ul>

          <h2>6. Cookies e Tecnologias de Rastreamento</h2>
          <p>
            Utilizamos cookies e tecnologias similares para manter sua sessão, lembrar preferências 
            e entender como você usa a plataforma. Você pode configurar seu navegador para bloquear cookies, 
            mas isso pode afetar o funcionamento de algumas funcionalidades.
          </p>

          <h2>7. Retenção de Dados</h2>
          <p>
            Mantemos seus dados enquanto sua conta estiver ativa ou conforme necessário para cumprir 
            obrigações legais. Após a exclusão da conta, os dados são removidos em até 30 dias, 
            exceto quando a retenção for exigida por lei.
          </p>

          <h2>8. Dados de Menores</h2>
          <p>
            A MSK Telemarketing não é direcionada a menores de 18 anos. Não coletamos intencionalmente dados 
            de menores. Se tomarmos conhecimento de que coletamos dados de um menor, tomaremos medidas 
            para excluí-los.
          </p>

          <h2>9. Alterações nesta Política</h2>
          <p>
            Podemos atualizar esta política periodicamente. Notificaremos sobre alterações significativas 
            por e-mail ou notificação na plataforma.
          </p>

          <h2>10. Contato</h2>
          <p>
            Para exercer seus direitos ou esclarecer dúvidas sobre esta política, entre em contato 
            pelo suporte disponível na plataforma.
          </p>
        </article>
      </div>
    </div>
  );
}

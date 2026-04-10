
-- Store policies table (one per tenant)
CREATE TABLE public.store_policies (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  privacy_policy TEXT NOT NULL DEFAULT '',
  terms_of_service TEXT NOT NULL DEFAULT '',
  cookie_policy TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.store_policies ENABLE ROW LEVEL SECURITY;

-- Owner can do everything
CREATE POLICY "Owner can manage own policies"
  ON public.store_policies FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Public read for storefront display
CREATE POLICY "Anyone can read policies"
  ON public.store_policies FOR SELECT
  USING (true);

-- Timestamp trigger
CREATE TRIGGER update_store_policies_updated_at
  BEFORE UPDATE ON public.store_policies
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Auto-generate policies when store_settings is created
CREATE OR REPLACE FUNCTION public.auto_create_store_policies()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $$
DECLARE
  v_store_name TEXT;
BEGIN
  -- Only create if not exists
  IF EXISTS (SELECT 1 FROM public.store_policies WHERE user_id = NEW.user_id) THEN
    RETURN NEW;
  END IF;

  v_store_name := COALESCE(NEW.store_name, 'Nossa Loja');

  INSERT INTO public.store_policies (user_id, privacy_policy, terms_of_service, cookie_policy)
  VALUES (
    NEW.user_id,
    '# Política de Privacidade — ' || v_store_name || E'\n\n' ||
    'Última atualização: ' || to_char(now(), 'DD/MM/YYYY') || E'\n\n' ||
    '## 1. Informações que coletamos' || E'\n' ||
    'Coletamos informações pessoais como nome, e-mail, telefone, endereço e CPF quando você realiza um pedido ou se cadastra em nossa loja.' || E'\n\n' ||
    '## 2. Como usamos suas informações' || E'\n' ||
    'Utilizamos seus dados para processar pedidos, enviar atualizações sobre entregas, melhorar nossos serviços e, com seu consentimento, enviar comunicações de marketing.' || E'\n\n' ||
    '## 3. Compartilhamento de dados' || E'\n' ||
    'Não vendemos ou compartilhamos seus dados pessoais com terceiros, exceto quando necessário para processar pagamentos, realizar entregas ou cumprir obrigações legais.' || E'\n\n' ||
    '## 4. Segurança' || E'\n' ||
    'Adotamos medidas técnicas e organizacionais para proteger seus dados pessoais contra acesso não autorizado, perda ou destruição.' || E'\n\n' ||
    '## 5. Seus direitos' || E'\n' ||
    'Você pode solicitar acesso, correção ou exclusão dos seus dados pessoais a qualquer momento entrando em contato conosco.' || E'\n\n' ||
    '## 6. Contato' || E'\n' ||
    'Para dúvidas sobre esta política, entre em contato com ' || v_store_name || '.',

    '# Termos de Uso — ' || v_store_name || E'\n\n' ||
    'Última atualização: ' || to_char(now(), 'DD/MM/YYYY') || E'\n\n' ||
    '## 1. Aceitação dos termos' || E'\n' ||
    'Ao acessar e utilizar esta loja, você concorda com estes termos de uso.' || E'\n\n' ||
    '## 2. Produtos e preços' || E'\n' ||
    'Os preços e disponibilidade dos produtos estão sujeitos a alterações sem aviso prévio. Nos esforçamos para manter as informações atualizadas.' || E'\n\n' ||
    '## 3. Pedidos e pagamentos' || E'\n' ||
    'Ao realizar um pedido, você declara que as informações fornecidas são verdadeiras. O processamento do pedido está sujeito à confirmação do pagamento.' || E'\n\n' ||
    '## 4. Entregas' || E'\n' ||
    'Os prazos de entrega são estimativas e podem variar conforme a região. Não nos responsabilizamos por atrasos causados por transportadoras.' || E'\n\n' ||
    '## 5. Trocas e devoluções' || E'\n' ||
    'Aceitamos trocas e devoluções conforme o Código de Defesa do Consumidor (Lei nº 8.078/90), dentro do prazo de 7 dias corridos após o recebimento.' || E'\n\n' ||
    '## 6. Propriedade intelectual' || E'\n' ||
    'Todo o conteúdo desta loja (imagens, textos, marcas) é de propriedade de ' || v_store_name || ' e não pode ser reproduzido sem autorização.' || E'\n\n' ||
    '## 7. Alterações' || E'\n' ||
    v_store_name || ' reserva-se o direito de modificar estes termos a qualquer momento.',

    '# Política de Cookies — ' || v_store_name || E'\n\n' ||
    'Última atualização: ' || to_char(now(), 'DD/MM/YYYY') || E'\n\n' ||
    '## 1. O que são cookies?' || E'\n' ||
    'Cookies são pequenos arquivos de texto armazenados no seu navegador quando você visita nossa loja.' || E'\n\n' ||
    '## 2. Cookies que utilizamos' || E'\n' ||
    '- **Essenciais**: necessários para o funcionamento da loja (carrinho, login).' || E'\n' ||
    '- **Analíticos**: nos ajudam a entender como você navega na loja.' || E'\n' ||
    '- **Marketing**: utilizados para personalizar ofertas e anúncios.' || E'\n\n' ||
    '## 3. Gerenciamento de cookies' || E'\n' ||
    'Você pode configurar seu navegador para bloquear ou excluir cookies, mas isso pode afetar o funcionamento da loja.' || E'\n\n' ||
    '## 4. Consentimento' || E'\n' ||
    'Ao continuar navegando em ' || v_store_name || ', você concorda com o uso de cookies conforme descrito nesta política.'
  );

  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_auto_create_store_policies
  AFTER INSERT ON public.store_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_create_store_policies();

-- Backfill existing stores
INSERT INTO public.store_policies (user_id, privacy_policy, terms_of_service, cookie_policy)
SELECT
  ss.user_id,
  '# Política de Privacidade — ' || COALESCE(ss.store_name, 'Nossa Loja') || E'\n\nEsta política descreve como coletamos, usamos e protegemos seus dados pessoais.\n\n## Informações coletadas\nColetamos nome, e-mail, telefone, endereço e CPF para processar pedidos.\n\n## Uso dos dados\nSeus dados são usados para processar pedidos, enviar atualizações e melhorar nossos serviços.\n\n## Segurança\nAdotamos medidas técnicas para proteger seus dados.\n\n## Contato\nPara dúvidas, entre em contato com ' || COALESCE(ss.store_name, 'Nossa Loja') || '.',
  '# Termos de Uso — ' || COALESCE(ss.store_name, 'Nossa Loja') || E'\n\nAo utilizar esta loja, você concorda com estes termos.\n\n## Produtos\nPreços e disponibilidade sujeitos a alteração.\n\n## Pedidos\nO processamento depende da confirmação do pagamento.\n\n## Trocas\nAceitamos devoluções conforme o CDC (7 dias).\n\n## Propriedade\nTodo conteúdo pertence a ' || COALESCE(ss.store_name, 'Nossa Loja') || '.',
  '# Política de Cookies — ' || COALESCE(ss.store_name, 'Nossa Loja') || E'\n\nUtilizamos cookies essenciais, analíticos e de marketing.\n\nVocê pode gerenciar cookies nas configurações do navegador.\n\nAo continuar navegando, você concorda com o uso de cookies.'
FROM public.store_settings ss
WHERE NOT EXISTS (SELECT 1 FROM public.store_policies sp WHERE sp.user_id = ss.user_id);

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.store_policies;

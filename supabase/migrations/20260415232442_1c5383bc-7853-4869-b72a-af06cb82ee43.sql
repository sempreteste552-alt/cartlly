-- Update the trigger function to include the required 'text' parameter
CREATE OR REPLACE FUNCTION public.on_store_invitation_created()
RETURNS TRIGGER AS $$
DECLARE
    v_store_name TEXT;
    v_inviter_name TEXT;
    v_payload JSONB;
BEGIN
    -- Get store name from store_settings associated with the inviter (store_owner_id)
    SELECT store_name INTO v_store_name
    FROM public.store_settings
    WHERE user_id = NEW.store_owner_id
    LIMIT 1;

    -- Get inviter name from profiles
    SELECT display_name INTO v_inviter_name
    FROM public.profiles
    WHERE user_id = NEW.store_owner_id;

    -- Fallbacks
    IF v_store_name IS NULL OR v_store_name = '' THEN
        v_store_name := 'Bella';
    END IF;
    
    IF v_inviter_name IS NULL OR v_inviter_name = '' THEN
        v_inviter_name := 'Um administrador';
    END IF;

    -- Build the email payload
    v_payload := jsonb_build_object(
        'to', NEW.email,
        'from', 'noreply@drpsemshiping.store',
        'subject', 'Convite para colaborar na loja ' || v_store_name,
        'html', '<!DOCTYPE html><html><head><style>body { font-family: sans-serif; line-height: 1.6; color: #333; }.container { max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 8px; }.header { text-align: center; margin-bottom: 20px; }.button { display: inline-block; padding: 12px 24px; background-color: #7c3aed; color: #ffffff !important; text-decoration: none; border-radius: 6px; font-weight: bold; }.footer { margin-top: 30px; font-size: 12px; color: #666; text-align: center; }</style></head><body><div class="container"><div class="header"><h1 style="color: #7c3aed;">Convite para Colaborador</h1></div><p>Olá,</p><p>Você foi convidado por <strong>' || v_inviter_name || '</strong> para colaborar na gestão da loja <strong>' || v_store_name || '</strong> no Bella.</p><p>Como colaborador, você poderá acessar o painel administrativo e ajudar a gerenciar produtos, pedidos e configurações da loja.</p><div style="text-align: center; margin: 30px 0;"><a href="https://usebella.store/auth" class="button">Aceitar Convite</a></div><p>Para aceitar este convite, basta entrar no Bella utilizando este e-mail.</p><p>Se você ainda não tem uma conta, será necessário criar uma.</p><div class="footer"><p>Este é um e-mail automático enviado pelo Bella.</p></div></div></body></html>',
        'text', 'Olá, Você foi convidado por ' || v_inviter_name || ' para colaborar na gestão da loja ' || v_store_name || ' no Bella. Para aceitar o convite, acesse https://usebella.store/auth',
        'purpose', 'transactional',
        'idempotency_key', 'store_invite_' || NEW.id::text,
        'label', 'store_invitation'
    );

    -- Enqueue the email
    PERFORM public.enqueue_email('transactional_emails', v_payload);

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

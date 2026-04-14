-- Função para notificar o admin sobre novas indicações
CREATE OR REPLACE FUNCTION public.handle_new_referral_notification()
RETURNS TRIGGER AS $$
DECLARE
    referrer_name TEXT;
    admin_id UUID;
BEGIN
    -- Buscar o ID do super_admin dinamicamente
    SELECT user_id INTO admin_id 
    FROM public.user_roles 
    WHERE role = 'super_admin' 
    LIMIT 1;

    -- Se não encontrar super_admin, não faz nada (evita erro)
    IF admin_id IS NULL THEN
        RETURN NEW;
    END IF;

    -- Buscar o nome da loja do indicador
    SELECT store_name INTO referrer_name 
    FROM public.store_settings 
    WHERE user_id = NEW.referrer_tenant_id 
    LIMIT 1;

    -- Fallback para ID resumido se não encontrar nome
    IF referrer_name IS NULL THEN
        referrer_name := 'Cliente ' || substr(NEW.referrer_tenant_id::text, 1, 8);
    END IF;

    -- Inserir na tabela de notificações administrativa
    -- Isso já dispara o push através do gatilho on_notification_send_push existente
    INSERT INTO public.admin_notifications (
        target_user_id,
        sender_user_id,
        title,
        message,
        type
    ) VALUES (
        admin_id,
        NEW.referrer_tenant_id,
        '🎯 Novo Indicado!',
        'ADMIN EEX: ' || referrer_name || ' indicou um novo cliente (' || COALESCE(NEW.referred_email, 'novo usuário') || ')',
        'info'
    );

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Garantir que o gatilho antigo não exista (caso de re-execução)
DROP TRIGGER IF EXISTS on_new_referral_notify_admin ON public.referrals;

-- Criar o gatilho na tabela de indicações
CREATE TRIGGER on_new_referral_notify_admin
AFTER INSERT ON public.referrals
FOR EACH ROW
EXECUTE FUNCTION public.handle_new_referral_notification();
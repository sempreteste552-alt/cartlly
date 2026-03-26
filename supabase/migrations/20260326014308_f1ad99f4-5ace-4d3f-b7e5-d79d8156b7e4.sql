
-- Trigger to notify super admins when a new tenant profile is created (pending approval)
CREATE OR REPLACE FUNCTION public.notify_new_tenant_signup()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  super_admin_id uuid;
  tenant_email text;
BEGIN
  -- Only notify for new profiles with 'pending' status
  IF NEW.status = 'pending' THEN
    -- Get the tenant email from auth.users
    SELECT email INTO tenant_email FROM auth.users WHERE id = NEW.user_id;
    
    -- Notify all super admins
    FOR super_admin_id IN
      SELECT user_id FROM public.user_roles WHERE role = 'super_admin'
    LOOP
      INSERT INTO public.admin_notifications (sender_user_id, target_user_id, title, message, type)
      VALUES (
        NEW.user_id,
        super_admin_id,
        '🆕 Novo Tenant Aguardando Aprovação',
        'O tenant ' || COALESCE(NEW.display_name, 'Desconhecido') || ' (' || COALESCE(tenant_email, '') || ') está aguardando aprovação.',
        'new_tenant'
      );
    END LOOP;
  END IF;
  RETURN NEW;
END;
$$;

-- Drop existing trigger if any, then create
DROP TRIGGER IF EXISTS on_new_tenant_signup ON public.profiles;
CREATE TRIGGER on_new_tenant_signup
  AFTER INSERT ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_new_tenant_signup();

-- Also notify when tenant status changes (approved/rejected)
CREATE OR REPLACE FUNCTION public.notify_tenant_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status AND NEW.status IN ('approved', 'rejected', 'blocked') THEN
    INSERT INTO public.admin_notifications (sender_user_id, target_user_id, title, message, type)
    VALUES (
      NEW.user_id,
      NEW.user_id,
      CASE NEW.status
        WHEN 'approved' THEN '✅ Conta Aprovada!'
        WHEN 'rejected' THEN '❌ Conta Rejeitada'
        WHEN 'blocked' THEN '🚫 Conta Bloqueada'
      END,
      CASE NEW.status
        WHEN 'approved' THEN 'Sua conta foi aprovada! Você já pode acessar o painel administrativo.'
        WHEN 'rejected' THEN 'Sua conta foi rejeitada pelo administrador da plataforma.'
        WHEN 'blocked' THEN 'Sua conta foi bloqueada. Entre em contato com o suporte.'
      END,
      'tenant_status_' || NEW.status
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_tenant_status_change ON public.profiles;
CREATE TRIGGER on_tenant_status_change
  AFTER UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_tenant_status_change();

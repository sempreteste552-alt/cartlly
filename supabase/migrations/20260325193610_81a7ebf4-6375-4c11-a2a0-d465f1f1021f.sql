-- Trigger function to create admin notification on new order
CREATE OR REPLACE FUNCTION public.notify_new_order()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.admin_notifications (sender_user_id, target_user_id, title, message, type)
  VALUES (
    NEW.user_id,
    NEW.user_id,
    '🛒 Novo Pedido #' || LEFT(NEW.id::text, 8),
    'Pedido de ' || NEW.customer_name || ' no valor de R$ ' || ROUND(NEW.total::numeric, 2),
    'new_order'
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_notify_new_order ON public.orders;
CREATE TRIGGER trigger_notify_new_order
  AFTER INSERT ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_new_order();

-- Trigger function to notify on order status change
CREATE OR REPLACE FUNCTION public.notify_order_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  status_label text;
BEGIN
  IF OLD.status = NEW.status THEN
    RETURN NEW;
  END IF;

  SELECT CASE NEW.status
    WHEN 'processando' THEN 'Processando'
    WHEN 'enviado' THEN 'Enviado'
    WHEN 'entregue' THEN 'Entregue'
    WHEN 'cancelado' THEN 'Cancelado'
    ELSE NEW.status
  END INTO status_label;

  INSERT INTO public.admin_notifications (sender_user_id, target_user_id, title, message, type)
  VALUES (
    NEW.user_id,
    NEW.user_id,
    'Pedido #' || LEFT(NEW.id::text, 8) || ' → ' || status_label,
    'O pedido de ' || NEW.customer_name || ' foi atualizado para ' || status_label,
    'order_' || NEW.status
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_notify_order_status ON public.orders;
CREATE TRIGGER trigger_notify_order_status
  AFTER UPDATE ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_order_status_change();

-- Trigger for new customer registration
CREATE OR REPLACE FUNCTION public.notify_new_customer()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.admin_notifications (sender_user_id, target_user_id, title, message, type)
  VALUES (
    NEW.store_user_id,
    NEW.store_user_id,
    '👤 Novo Cliente: ' || NEW.name,
    'O cliente ' || NEW.name || ' (' || NEW.email || ') se cadastrou na sua loja',
    'new_customer'
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_notify_new_customer ON public.customers;
CREATE TRIGGER trigger_notify_new_customer
  AFTER INSERT ON public.customers
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_new_customer();

-- Trigger for payment status changes
CREATE OR REPLACE FUNCTION public.notify_payment_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  order_rec record;
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.status = NEW.status THEN
    RETURN NEW;
  END IF;

  SELECT customer_name INTO order_rec FROM public.orders WHERE id = NEW.order_id;

  IF NEW.status = 'approved' OR NEW.status = 'paid' THEN
    INSERT INTO public.admin_notifications (sender_user_id, target_user_id, title, message, type)
    VALUES (
      NEW.user_id,
      NEW.user_id,
      '💰 Pagamento Aprovado',
      'Pagamento de R$ ' || ROUND(NEW.amount::numeric, 2) || ' do pedido #' || LEFT(NEW.order_id::text, 8) || ' (' || COALESCE(order_rec.customer_name, '') || ') foi aprovado',
      'payment_approved'
    );
  ELSIF NEW.status = 'refused' OR NEW.status = 'failed' THEN
    INSERT INTO public.admin_notifications (sender_user_id, target_user_id, title, message, type)
    VALUES (
      NEW.user_id,
      NEW.user_id,
      '🚫 Pagamento Recusado',
      'Pagamento de R$ ' || ROUND(NEW.amount::numeric, 2) || ' do pedido #' || LEFT(NEW.order_id::text, 8) || ' foi recusado',
      'payment_refused'
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_notify_payment ON public.payments;
CREATE TRIGGER trigger_notify_payment
  AFTER INSERT OR UPDATE ON public.payments
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_payment_status();

-- Super admin notification for tenant plan changes
CREATE OR REPLACE FUNCTION public.notify_plan_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  tenant_name text;
  plan_name text;
  old_plan_name text;
  super_admin_id uuid;
BEGIN
  SELECT display_name INTO tenant_name FROM public.profiles WHERE user_id = NEW.user_id LIMIT 1;
  SELECT name INTO plan_name FROM public.tenant_plans WHERE id = NEW.plan_id LIMIT 1;

  FOR super_admin_id IN
    SELECT user_id FROM public.user_roles WHERE role = 'super_admin'
  LOOP
    IF TG_OP = 'UPDATE' AND OLD.plan_id IS DISTINCT FROM NEW.plan_id THEN
      SELECT name INTO old_plan_name FROM public.tenant_plans WHERE id = OLD.plan_id LIMIT 1;
      INSERT INTO public.admin_notifications (sender_user_id, target_user_id, title, message, type)
      VALUES (
        NEW.user_id,
        super_admin_id,
        '📊 Mudança de Plano',
        COALESCE(tenant_name, 'Tenant') || ' alterou de ' || COALESCE(old_plan_name, '—') || ' para ' || COALESCE(plan_name, '—'),
        'info'
      );
    ELSIF TG_OP = 'INSERT' THEN
      INSERT INTO public.admin_notifications (sender_user_id, target_user_id, title, message, type)
      VALUES (
        NEW.user_id,
        super_admin_id,
        '🆕 Nova Assinatura',
        COALESCE(tenant_name, 'Tenant') || ' assinou o plano ' || COALESCE(plan_name, '—'),
        'info'
      );
    END IF;
  END LOOP;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_notify_plan_change ON public.tenant_subscriptions;
CREATE TRIGGER trigger_notify_plan_change
  AFTER INSERT OR UPDATE ON public.tenant_subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_plan_change();
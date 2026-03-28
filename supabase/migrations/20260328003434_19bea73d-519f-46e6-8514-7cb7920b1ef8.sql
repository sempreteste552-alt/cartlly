-- 1. Update handle_new_user to set status='active' instead of 'pending'
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, display_name, status)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.email), 'active');
  RETURN NEW;
END;
$$;

-- 2. Add domain verification columns to store_settings
ALTER TABLE public.store_settings 
  ADD COLUMN IF NOT EXISTS domain_status text NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS domain_last_check timestamptz;

-- 3. Update tenant signup notification to be informational
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
  SELECT email INTO tenant_email FROM auth.users WHERE id = NEW.user_id;
  
  FOR super_admin_id IN
    SELECT user_id FROM public.user_roles WHERE role = 'super_admin'
  LOOP
    INSERT INTO public.admin_notifications (sender_user_id, target_user_id, title, message, type)
    VALUES (
      NEW.user_id,
      super_admin_id,
      '🆕 Novo Tenant Cadastrado',
      'O tenant ' || COALESCE(NEW.display_name, 'Desconhecido') || ' (' || COALESCE(tenant_email, '') || ') se cadastrou na plataforma.',
      'new_tenant'
    );
  END LOOP;
  RETURN NEW;
END;
$$;
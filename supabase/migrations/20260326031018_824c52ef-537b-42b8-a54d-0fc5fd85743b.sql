
-- Table for plan change requests (upgrade/downgrade approval flow)
CREATE TABLE public.plan_change_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  current_plan_id uuid REFERENCES public.tenant_plans(id),
  requested_plan_id uuid NOT NULL REFERENCES public.tenant_plans(id),
  request_type text NOT NULL DEFAULT 'upgrade',
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  resolved_by uuid
);

ALTER TABLE public.plan_change_requests ENABLE ROW LEVEL SECURITY;

-- Users can view their own requests
CREATE POLICY "Users can view own plan requests" ON public.plan_change_requests
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- Users can create their own requests
CREATE POLICY "Users can create plan requests" ON public.plan_change_requests
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- Super admins can manage all requests
CREATE POLICY "Super admins manage plan requests" ON public.plan_change_requests
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'super_admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role));

-- Trigger to notify super admin on new plan change request
CREATE OR REPLACE FUNCTION public.notify_plan_change_request()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  super_admin_id uuid;
  tenant_name text;
  req_plan_name text;
  cur_plan_name text;
BEGIN
  SELECT display_name INTO tenant_name FROM public.profiles WHERE user_id = NEW.user_id LIMIT 1;
  SELECT name INTO req_plan_name FROM public.tenant_plans WHERE id = NEW.requested_plan_id LIMIT 1;
  SELECT name INTO cur_plan_name FROM public.tenant_plans WHERE id = NEW.current_plan_id LIMIT 1;

  FOR super_admin_id IN SELECT user_id FROM public.user_roles WHERE role = 'super_admin'
  LOOP
    INSERT INTO public.admin_notifications (sender_user_id, target_user_id, title, message, type)
    VALUES (
      NEW.user_id,
      super_admin_id,
      CASE NEW.request_type
        WHEN 'upgrade' THEN '⬆️ Solicitação de Upgrade'
        ELSE '⬇️ Solicitação de Downgrade'
      END,
      COALESCE(tenant_name, 'Tenant') || ' solicitou ' || NEW.request_type || ' de ' || COALESCE(cur_plan_name, 'Grátis') || ' para ' || COALESCE(req_plan_name, '—'),
      'plan_request'
    );
  END LOOP;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_plan_change_request
  AFTER INSERT ON public.plan_change_requests
  FOR EACH ROW EXECUTE FUNCTION public.notify_plan_change_request();


CREATE TABLE public.admin_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_user_id uuid NOT NULL,
  target_user_id uuid,
  title text NOT NULL,
  message text NOT NULL,
  type text NOT NULL DEFAULT 'info',
  read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.admin_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admins can manage notifications" ON public.admin_notifications
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'super_admin'))
  WITH CHECK (has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Users can view own notifications" ON public.admin_notifications
  FOR SELECT TO authenticated
  USING (target_user_id = auth.uid() OR target_user_id IS NULL);

CREATE POLICY "Users can mark own notifications read" ON public.admin_notifications
  FOR UPDATE TO authenticated
  USING (target_user_id = auth.uid() OR target_user_id IS NULL);

CREATE TABLE public.platform_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text UNIQUE NOT NULL,
  value jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.platform_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admins can manage platform settings" ON public.platform_settings
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'super_admin'))
  WITH CHECK (has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Anyone can read platform settings" ON public.platform_settings
  FOR SELECT TO authenticated
  USING (true);

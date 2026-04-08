
-- 1. Add store_user_id to push_subscriptions for tenant isolation
ALTER TABLE public.push_subscriptions ADD COLUMN store_user_id uuid;

-- Create index for tenant-scoped queries
CREATE INDEX idx_push_subscriptions_store_user_id ON public.push_subscriptions(store_user_id);

-- 2. Create tenant_messages table for complete message audit trail
CREATE TABLE public.tenant_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_tenant_id uuid NOT NULL,
  sender_type text NOT NULL DEFAULT 'tenant_admin',
  sender_user_id uuid NOT NULL,
  audience_type text NOT NULL,
  target_area text NOT NULL DEFAULT 'admin_panel',
  target_tenant_id uuid,
  target_user_id uuid,
  target_slug text,
  channel text NOT NULL DEFAULT 'in_app',
  title text NOT NULL,
  body text,
  message_type text NOT NULL DEFAULT 'info',
  priority text NOT NULL DEFAULT 'normal',
  is_global boolean NOT NULL DEFAULT false,
  delivered_count integer NOT NULL DEFAULT 0,
  failed_count integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'sent',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.tenant_messages ENABLE ROW LEVEL SECURITY;

-- Super admins full access
CREATE POLICY "Super admins manage all messages"
  ON public.tenant_messages FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

-- Tenant admins can create messages from their own tenant
CREATE POLICY "Tenant admins can create own messages"
  ON public.tenant_messages FOR INSERT TO authenticated
  WITH CHECK (source_tenant_id = auth.uid() AND sender_type = 'tenant_admin');

-- Tenant admins can view their own sent messages
CREATE POLICY "Tenant admins can view sent messages"
  ON public.tenant_messages FOR SELECT TO authenticated
  USING (source_tenant_id = auth.uid());

-- Target tenants can view messages addressed to them
CREATE POLICY "Tenants can view messages targeting them"
  ON public.tenant_messages FOR SELECT TO authenticated
  USING (
    target_tenant_id = auth.uid() 
    OR (is_global = true AND audience_type = 'super_admin_to_tenant_admins')
  );

-- 3. Add service role policy for push_subscriptions (edge functions)
CREATE POLICY "Service role can manage all push subscriptions"
  ON public.push_subscriptions FOR ALL TO public
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- 4. Create indexes for tenant_messages
CREATE INDEX idx_tenant_messages_source ON public.tenant_messages(source_tenant_id);
CREATE INDEX idx_tenant_messages_target ON public.tenant_messages(target_tenant_id);
CREATE INDEX idx_tenant_messages_audience ON public.tenant_messages(audience_type);
CREATE INDEX idx_tenant_messages_created ON public.tenant_messages(created_at DESC);

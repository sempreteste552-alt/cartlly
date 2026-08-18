-- 1. Global AI switch: default OFF + support message
ALTER TABLE public.ai_global_settings
  ADD COLUMN IF NOT EXISTS disabled_message text
    DEFAULT 'Os recursos de Inteligência Artificial ainda não estão liberados para a sua loja. Fale com o suporte para ativar.',
  ADD COLUMN IF NOT EXISTS support_contact text DEFAULT 'contato@cartlly.store';

ALTER TABLE public.ai_global_settings
  ALTER COLUMN is_ai_enabled_globally SET DEFAULT false;

INSERT INTO public.ai_global_settings (is_ai_enabled_globally)
SELECT false
WHERE NOT EXISTS (SELECT 1 FROM public.ai_global_settings);

-- 2. Public status function (no sensitive data)
CREATE OR REPLACE FUNCTION public.get_ai_platform_status()
RETURNS TABLE(enabled boolean, has_provider boolean, message text, support_contact text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    COALESCE(g.is_ai_enabled_globally, false)
      AND EXISTS (SELECT 1 FROM public.ai_providers p WHERE p.is_active = true) AS enabled,
    EXISTS (SELECT 1 FROM public.ai_providers p WHERE p.is_active = true) AS has_provider,
    COALESCE(g.disabled_message, 'Os recursos de Inteligência Artificial ainda não estão liberados. Fale com o suporte para ativar.') AS message,
    COALESCE(g.support_contact, 'contato@cartlly.store') AS support_contact
  FROM (SELECT * FROM public.ai_global_settings LIMIT 1) g;
$$;

GRANT EXECUTE ON FUNCTION public.get_ai_platform_status() TO anon, authenticated, service_role;

-- 3. Billing lifecycle tracking on subscriptions
ALTER TABLE public.tenant_subscriptions
  ADD COLUMN IF NOT EXISTS last_due_warning_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_overdue_notice_at timestamptz,
  ADD COLUMN IF NOT EXISTS grace_ends_at timestamptz,
  ADD COLUMN IF NOT EXISTS blocked_at timestamptz;
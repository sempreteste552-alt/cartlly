-- Restrict ai settings write to super_admin only
DROP POLICY IF EXISTS "Tenants insert own ai settings" ON public.tenant_ai_settings;
DROP POLICY IF EXISTS "Tenants update own ai settings" ON public.tenant_ai_settings;
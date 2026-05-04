
DROP POLICY IF EXISTS "Tenants insert own feature limits" ON public.tenant_ai_feature_limits;
CREATE POLICY "Tenants insert own feature limits"
ON public.tenant_ai_feature_limits
FOR INSERT
WITH CHECK (tenant_id = auth.uid());

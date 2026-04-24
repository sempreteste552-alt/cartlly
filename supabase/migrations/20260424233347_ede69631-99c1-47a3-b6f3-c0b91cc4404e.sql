-- AI Providers table
CREATE TABLE IF NOT EXISTS public.ai_providers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    api_key TEXT NOT NULL,
    model_text_default TEXT,
    model_image_default TEXT,
    model_cheap TEXT,
    model_premium TEXT,
    is_active BOOLEAN DEFAULT true,
    cost_per_text_token NUMERIC DEFAULT 0,
    cost_per_image NUMERIC DEFAULT 0,
    monthly_limit_usd NUMERIC DEFAULT 0,
    daily_limit_usd NUMERIC DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- AI Global Settings
CREATE TABLE IF NOT EXISTS public.ai_global_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    default_provider_id UUID REFERENCES public.ai_providers(id),
    global_monthly_limit_usd NUMERIC DEFAULT 100,
    global_daily_limit_usd NUMERIC DEFAULT 10,
    is_ai_enabled_globally BOOLEAN DEFAULT true,
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Tenant AI Settings
CREATE TABLE IF NOT EXISTS public.tenant_ai_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    is_ai_enabled BOOLEAN DEFAULT true,
    is_text_gen_enabled BOOLEAN DEFAULT true,
    is_image_gen_enabled BOOLEAN DEFAULT true,
    is_smart_automation_enabled BOOLEAN DEFAULT true,
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(tenant_id)
);

-- Tenant AI Quotas
CREATE TABLE IF NOT EXISTS public.tenant_ai_quotas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    monthly_token_limit BIGINT DEFAULT 1000000,
    daily_token_limit BIGINT DEFAULT 50000,
    monthly_image_limit INTEGER DEFAULT 100,
    monthly_text_limit INTEGER DEFAULT 1000,
    monthly_push_limit INTEGER DEFAULT 5000,
    allow_overage BOOLEAN DEFAULT false,
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(tenant_id)
);

-- Tenant AI Balances
CREATE TABLE IF NOT EXISTS public.tenant_ai_balances (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    balance NUMERIC DEFAULT 0,
    currency TEXT DEFAULT 'BRL',
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(tenant_id)
);

-- Update existing ai_usage_logs
ALTER TABLE public.ai_usage_logs 
ADD COLUMN IF NOT EXISTS images_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'success',
ADD COLUMN IF NOT EXISTS error_message TEXT,
ADD COLUMN IF NOT EXISTS cost_billed NUMERIC DEFAULT 0;

-- Enable RLS
ALTER TABLE public.ai_providers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_global_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenant_ai_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenant_ai_quotas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenant_ai_balances ENABLE ROW LEVEL SECURITY;

-- Policies for AI Providers (SuperAdmin only)
CREATE POLICY "SuperAdmins can manage AI providers" 
ON public.ai_providers 
FOR ALL 
USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'super_admin'));

-- Policies for AI Global Settings (SuperAdmin only)
CREATE POLICY "SuperAdmins can manage global AI settings" 
ON public.ai_global_settings 
FOR ALL 
USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'super_admin'));

-- Policies for Tenant AI Settings
CREATE POLICY "Tenants can view their own AI settings" 
ON public.tenant_ai_settings 
FOR SELECT 
USING (tenant_id = auth.uid() OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'super_admin'));

CREATE POLICY "SuperAdmins can manage all tenant AI settings" 
ON public.tenant_ai_settings 
FOR ALL 
USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'super_admin'));

-- Policies for Tenant AI Quotas
CREATE POLICY "Tenants can view their own AI quotas" 
ON public.tenant_ai_quotas 
FOR SELECT 
USING (tenant_id = auth.uid() OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'super_admin'));

CREATE POLICY "SuperAdmins can manage all tenant AI quotas" 
ON public.tenant_ai_quotas 
FOR ALL 
USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'super_admin'));

-- Policies for Tenant AI Balances
CREATE POLICY "Tenants can view their own AI balance" 
ON public.tenant_ai_balances 
FOR SELECT 
USING (tenant_id = auth.uid() OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'super_admin'));

CREATE POLICY "SuperAdmins can manage all tenant AI balances" 
ON public.tenant_ai_balances 
FOR ALL 
USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'super_admin'));

-- Functions for updated_at
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers
CREATE TRIGGER set_updated_at_ai_providers BEFORE UPDATE ON public.ai_providers FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE TRIGGER set_updated_at_ai_global_settings BEFORE UPDATE ON public.ai_global_settings FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE TRIGGER set_updated_at_tenant_ai_settings BEFORE UPDATE ON public.tenant_ai_settings FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE TRIGGER set_updated_at_tenant_ai_quotas BEFORE UPDATE ON public.tenant_ai_quotas FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE TRIGGER set_updated_at_tenant_ai_balances BEFORE UPDATE ON public.tenant_ai_balances FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

ALTER TABLE public.tenant_subscriptions 
ADD COLUMN custom_price NUMERIC,
ADD COLUMN custom_price_reason TEXT;

COMMENT ON COLUMN public.tenant_subscriptions.custom_price IS 'Preço customizado definido pelo super admin para este tenant';
COMMENT ON COLUMN public.tenant_subscriptions.custom_price_reason IS 'Motivo pelo qual o preço customizado foi aplicado';
-- Update PRO plan to include push_customers
UPDATE public.tenant_plans
SET features = features || '{"push_customers": true}'::jsonb
WHERE name = 'PRO';

-- Update PREMIUM plan to include push_customers
UPDATE public.tenant_plans
SET features = features || '{"push_customers": true}'::jsonb
WHERE name = 'PREMIUM';

-- Also ensure it's false for STARTER and FREE just in case
UPDATE public.tenant_plans
SET features = features || '{"push_customers": false}'::jsonb
WHERE name IN ('STARTER', 'FREE');

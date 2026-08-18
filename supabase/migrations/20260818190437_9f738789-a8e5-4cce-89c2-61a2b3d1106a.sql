UPDATE public.store_settings SET store_blocked = false WHERE store_blocked = true;

UPDATE public.profiles SET status = 'ativo' WHERE status = 'inativo';

UPDATE public.tenant_subscriptions ts
SET status = 'active', blocked_at = NULL, grace_ends_at = NULL
FROM public.tenant_plans p
WHERE p.id = ts.plan_id
  AND upper(p.name) <> 'FREE'
  AND ts.status IN ('trial_expired','suspended','past_due');
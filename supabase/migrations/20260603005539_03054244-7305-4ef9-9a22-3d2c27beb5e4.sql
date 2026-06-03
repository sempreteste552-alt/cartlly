-- Remove tabelas sensíveis da publicação Realtime para evitar broadcast de PII
-- Cliente, pedidos, pagamentos e dados de perfil não devem trafegar via Realtime,
-- pois realtime.messages não tem RLS por canal.

DO $$
DECLARE
  t text;
  sensitive_tables text[] := ARRAY[
    'customers',
    'orders',
    'payments',
    'abandoned_carts',
    'profiles',
    'product_reviews',
    'tenant_subscriptions',
    'plan_change_requests',
    'referrals',
    'referral_codes',
    'store_domains'
  ];
BEGIN
  FOREACH t IN ARRAY sensitive_tables LOOP
    IF EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime'
        AND schemaname = 'public'
        AND tablename = t
    ) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime DROP TABLE public.%I', t);
    END IF;
  END LOOP;
END $$;
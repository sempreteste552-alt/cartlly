
-- 1) CUSTOMERS: remover policy permissiva
DROP POLICY IF EXISTS "Anyone can find a customer by referral code" ON public.customers;

CREATE OR REPLACE FUNCTION public.find_customer_by_referral_code(_code text, _store_user_id uuid)
RETURNS TABLE(id uuid, name text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT id, name FROM public.customers
  WHERE referral_code = _code AND store_user_id = _store_user_id LIMIT 1;
$$;

-- 2) STORE_DOMAINS: bloquear leitura geral
DROP POLICY IF EXISTS "Anyone can check hostname existence" ON public.store_domains;

CREATE OR REPLACE FUNCTION public.check_hostname_exists(_hostname text)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.store_domains WHERE hostname = _hostname);
$$;

-- 3) PROFILES: remover policy de leitura ampla
DROP POLICY IF EXISTS "Allow users to search profiles by email" ON public.profiles;

CREATE OR REPLACE FUNCTION public.lookup_profile_for_invite(_email text)
RETURNS TABLE(user_id uuid, display_name text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT user_id, display_name FROM public.profiles WHERE email = _email LIMIT 1;
$$;

-- 4) CUSTOMER_VIEW_STATS: remover cross-tenant leak
DROP POLICY IF EXISTS "Admins can view all view stats" ON public.customer_view_stats;

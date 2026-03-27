CREATE OR REPLACE FUNCTION public.customer_email_exists_globally(_email text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM auth.users
    WHERE lower(email) = lower(_email)
  )
  OR EXISTS (
    SELECT 1
    FROM public.customers
    WHERE lower(email) = lower(_email)
  );
$$;
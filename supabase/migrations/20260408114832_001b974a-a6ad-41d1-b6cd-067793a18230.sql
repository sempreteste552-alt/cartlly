
CREATE TABLE public.customer_states (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  customer_id uuid NOT NULL,
  store_user_id uuid NOT NULL,
  state text NOT NULL DEFAULT 'browsing',
  last_activity_at timestamp with time zone NOT NULL DEFAULT now(),
  state_changed_at timestamp with time zone NOT NULL DEFAULT now(),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (customer_id, store_user_id)
);

ALTER TABLE public.customer_states ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Store owners can view customer states"
  ON public.customer_states FOR SELECT
  TO authenticated
  USING (store_user_id = auth.uid());

CREATE POLICY "Super admins can view all customer states"
  ON public.customer_states FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Service role full access"
  ON public.customer_states FOR ALL
  TO public
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE INDEX idx_customer_states_store ON public.customer_states (store_user_id);
CREATE INDEX idx_customer_states_state ON public.customer_states (state);

CREATE TRIGGER update_customer_states_updated_at
  BEFORE UPDATE ON public.customer_states
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

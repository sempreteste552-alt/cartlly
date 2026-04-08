
CREATE TABLE public.store_restock_alerts (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  title text NOT NULL DEFAULT '🔥 Produtos de volta ao estoque!',
  subtitle text DEFAULT 'Corra antes que acabe novamente!',
  cta_text text NOT NULL DEFAULT 'Ver Produto',
  product_ids uuid[] NOT NULL DEFAULT '{}',
  active boolean NOT NULL DEFAULT true,
  push_enabled boolean NOT NULL DEFAULT false,
  push_title text DEFAULT 'Reposição de estoque!',
  push_body text DEFAULT 'Produtos que você estava esperando voltaram ao estoque!',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.store_restock_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anon can view active restock alerts"
  ON public.store_restock_alerts FOR SELECT
  TO anon
  USING (active = true);

CREATE POLICY "Auth can view active restock alerts"
  ON public.store_restock_alerts FOR SELECT
  TO authenticated
  USING (active = true);

CREATE POLICY "Users can manage own restock alerts"
  ON public.store_restock_alerts FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

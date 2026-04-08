-- Track multi-step retargeting sequences per customer+product
CREATE TABLE public.retargeting_sequences (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  customer_id UUID NOT NULL,
  store_user_id UUID NOT NULL,
  product_id UUID,
  current_step INTEGER NOT NULL DEFAULT 1,
  max_steps INTEGER NOT NULL DEFAULT 3,
  status TEXT NOT NULL DEFAULT 'active',
  stopped_reason TEXT,
  next_push_at TIMESTAMP WITH TIME ZONE,
  last_push_at TIMESTAMP WITH TIME ZONE,
  pushes_sent INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Unique constraint: one active sequence per customer+product+store
CREATE UNIQUE INDEX idx_retargeting_active_unique 
  ON public.retargeting_sequences (customer_id, store_user_id, COALESCE(product_id, '00000000-0000-0000-0000-000000000000'))
  WHERE status = 'active';

-- Index for scheduler queries
CREATE INDEX idx_retargeting_next_push ON public.retargeting_sequences (status, next_push_at) WHERE status = 'active';
CREATE INDEX idx_retargeting_customer ON public.retargeting_sequences (customer_id, status);

-- Enable RLS
ALTER TABLE public.retargeting_sequences ENABLE ROW LEVEL SECURITY;

-- Service role full access (edge functions use service role)
CREATE POLICY "Service role full access on retargeting"
  ON public.retargeting_sequences FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- Store owners can view their sequences
CREATE POLICY "Store owners can view retargeting sequences"
  ON public.retargeting_sequences FOR SELECT
  TO authenticated
  USING (store_user_id = auth.uid());

-- Super admins can view all
CREATE POLICY "Super admins can view all retargeting"
  ON public.retargeting_sequences FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'super_admin'));

-- Trigger for updated_at
CREATE TRIGGER update_retargeting_sequences_updated_at
  BEFORE UPDATE ON public.retargeting_sequences
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
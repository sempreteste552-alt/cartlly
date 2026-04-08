-- Add intent level and revenue signals to customer_states
ALTER TABLE public.customer_states
  ADD COLUMN IF NOT EXISTS intent_level TEXT NOT NULL DEFAULT 'low',
  ADD COLUMN IF NOT EXISTS low_stock BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS discount_available BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS last_product_id UUID,
  ADD COLUMN IF NOT EXISTS last_product_name TEXT;

-- Index for priority queries (high intent first)
CREATE INDEX IF NOT EXISTS idx_customer_states_intent ON public.customer_states (intent_level, state) WHERE state != 'active';
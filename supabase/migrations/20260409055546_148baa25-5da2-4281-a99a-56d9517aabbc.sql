ALTER TABLE public.payments 
ADD COLUMN IF NOT EXISTS status_detail TEXT,
ADD COLUMN IF NOT EXISTS issuer_id TEXT,
ADD COLUMN IF NOT EXISTS payment_method_id TEXT;

-- Index para facilitar buscas posteriores se necessário
CREATE INDEX IF NOT EXISTS idx_payments_status_detail ON public.payments(status_detail);
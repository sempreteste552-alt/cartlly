ALTER TABLE public.store_settings
  ADD COLUMN IF NOT EXISTS installments_interest_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS installments_interest_rate numeric NOT NULL DEFAULT 2.99,
  ADD COLUMN IF NOT EXISTS installments_free_up_to integer NOT NULL DEFAULT 1;

COMMENT ON COLUMN public.store_settings.installments_interest_enabled IS 'If true, charge interest on installments above installments_free_up_to';
COMMENT ON COLUMN public.store_settings.installments_interest_rate IS 'Monthly interest rate in percentage (e.g. 2.99 = 2.99%/month, compound)';
COMMENT ON COLUMN public.store_settings.installments_free_up_to IS 'Number of installments without interest (e.g. 3 = up to 3x interest-free)';
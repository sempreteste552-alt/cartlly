ALTER TABLE public.store_restock_alerts
  ADD COLUMN IF NOT EXISTS bg_color text NOT NULL DEFAULT '#6d28d9',
  ADD COLUMN IF NOT EXISTS text_color text NOT NULL DEFAULT '#ffffff',
  ADD COLUMN IF NOT EXISTS card_bg_color text NOT NULL DEFAULT '#ffffff',
  ADD COLUMN IF NOT EXISTS accent_color text NOT NULL DEFAULT '#6d28d9';
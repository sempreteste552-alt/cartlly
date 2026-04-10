-- Create store_domains table
CREATE TABLE IF NOT EXISTS public.store_domains (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    store_id UUID NOT NULL REFERENCES public.store_settings(id) ON DELETE CASCADE,
    hostname TEXT NOT NULL UNIQUE,
    is_primary BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Index for performance
CREATE INDEX IF NOT EXISTS idx_store_domains_hostname ON public.store_domains(hostname);
CREATE INDEX IF NOT EXISTS idx_store_domains_store_id ON public.store_domains(store_id);

-- Enable RLS
ALTER TABLE public.store_domains ENABLE ROW LEVEL SECURITY;

-- Public read access for domain resolution
CREATE POLICY "Public can read store domains for resolution"
ON public.store_domains
FOR SELECT
USING (true);

-- Store owner can manage their domains
CREATE POLICY "Store owners can manage their domains"
ON public.store_domains
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.store_settings
    WHERE store_settings.id = store_domains.store_id
    AND store_settings.user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.store_settings
    WHERE store_settings.id = store_domains.store_id
    AND store_settings.user_id = auth.uid()
  )
);

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_store_domains_updated_at ON public.store_domains;
CREATE TRIGGER tr_store_domains_updated_at
    BEFORE UPDATE ON public.store_domains
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

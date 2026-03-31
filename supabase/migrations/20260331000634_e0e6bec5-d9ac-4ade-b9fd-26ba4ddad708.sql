
-- Store pages table for institutional pages
CREATE TABLE public.store_pages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  title TEXT NOT NULL,
  slug TEXT NOT NULL,
  content TEXT NOT NULL DEFAULT '',
  published BOOLEAN NOT NULL DEFAULT false,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add unique constraint per tenant
CREATE UNIQUE INDEX store_pages_user_slug ON public.store_pages (user_id, slug);

-- Enable RLS
ALTER TABLE public.store_pages ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can manage their own pages"
  ON public.store_pages FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Anyone can view published pages"
  ON public.store_pages FOR SELECT
  TO anon
  USING (published = true);

-- Trigger for updated_at
CREATE TRIGGER set_store_pages_updated_at
  BEFORE UPDATE ON public.store_pages
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();


-- Highlights (stories) main table
CREATE TABLE public.store_highlights (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  cover_url TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.store_highlights ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner can manage highlights"
  ON public.store_highlights FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Public can view active highlights"
  ON public.store_highlights FOR SELECT
  USING (active = true);

-- Highlight media items
CREATE TABLE public.store_highlight_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  highlight_id UUID NOT NULL REFERENCES public.store_highlights(id) ON DELETE CASCADE,
  media_type TEXT NOT NULL DEFAULT 'image',
  media_url TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.store_highlight_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner can manage highlight items"
  ON public.store_highlight_items FOR ALL
  USING (
    EXISTS (SELECT 1 FROM public.store_highlights h WHERE h.id = highlight_id AND h.user_id = auth.uid())
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.store_highlights h WHERE h.id = highlight_id AND h.user_id = auth.uid())
  );

CREATE POLICY "Public can view highlight items"
  ON public.store_highlight_items FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM public.store_highlights h WHERE h.id = highlight_id AND h.active = true)
  );

-- Trigger for updated_at
CREATE TRIGGER update_store_highlights_updated_at
  BEFORE UPDATE ON public.store_highlights
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

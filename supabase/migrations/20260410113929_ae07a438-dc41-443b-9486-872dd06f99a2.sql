
CREATE TABLE public.admin_announcements (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  body TEXT,
  banner_type TEXT NOT NULL DEFAULT 'info',
  bg_color TEXT DEFAULT '#1a1a2e',
  text_color TEXT DEFAULT '#ffffff',
  active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.admin_announcements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can view active announcements"
ON public.admin_announcements
FOR SELECT
TO authenticated
USING (active = true);

CREATE POLICY "Super admins can manage announcements"
ON public.admin_announcements
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'super_admin'))
WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

CREATE TRIGGER update_admin_announcements_updated_at
BEFORE UPDATE ON public.admin_announcements
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

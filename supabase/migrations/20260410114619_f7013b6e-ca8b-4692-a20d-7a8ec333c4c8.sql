
ALTER TABLE public.admin_announcements
  ADD COLUMN target_audience TEXT NOT NULL DEFAULT 'all',
  ADD COLUMN target_tenant_ids UUID[] DEFAULT '{}',
  ADD COLUMN marquee BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN link_url TEXT;

-- Drop old select policy and create a more specific one
DROP POLICY IF EXISTS "Anyone authenticated can view active announcements" ON public.admin_announcements;

CREATE POLICY "Tenants can view targeted active announcements"
ON public.admin_announcements
FOR SELECT
TO authenticated
USING (
  active = true AND (
    target_audience = 'all'
    OR auth.uid() = ANY(target_tenant_ids)
  )
);

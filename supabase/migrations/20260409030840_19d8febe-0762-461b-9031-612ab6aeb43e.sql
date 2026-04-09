-- Refine policy for search_logs
DROP POLICY "Anyone can insert search logs" ON public.search_logs;

CREATE POLICY "Anyone can insert search logs"
ON public.search_logs
FOR INSERT
WITH CHECK (user_id IS NOT NULL);

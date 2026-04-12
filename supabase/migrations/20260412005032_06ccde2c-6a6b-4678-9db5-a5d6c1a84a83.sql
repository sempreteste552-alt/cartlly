-- Set search_path for helper functions
ALTER FUNCTION public.match_tenant_knowledge(VECTOR(768), UUID, TEXT, FLOAT, INT) SET search_path = public;
ALTER FUNCTION public.match_customer_insights(VECTOR(768), UUID, UUID, FLOAT, INT) SET search_path = public;

-- Ensure RLS is active on all new tables
ALTER TABLE public.tenant_ai_knowledge ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_ai_insights ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_feedback_loop ENABLE ROW LEVEL SECURITY;

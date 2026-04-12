-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Tenant AI Knowledge Base (for training, rules, styles, examples)
CREATE TABLE IF NOT EXISTS public.tenant_ai_knowledge (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    embedding VECTOR(768), -- Adjusted for Google Gemini (768) or others
    category TEXT NOT NULL CHECK (category IN ('training', 'rule', 'style', 'example', 'prohibition', 'preference')),
    metadata JSONB DEFAULT '{}'::jsonb,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS for tenant_ai_knowledge
ALTER TABLE public.tenant_ai_knowledge ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenants can view their own AI knowledge"
    ON public.tenant_ai_knowledge FOR SELECT
    USING (auth.uid() = tenant_id);

CREATE POLICY "Tenants can manage their own AI knowledge"
    ON public.tenant_ai_knowledge FOR ALL
    USING (auth.uid() = tenant_id)
    WITH CHECK (auth.uid() = tenant_id);

-- Customer AI Insights (personalized memory per customer)
CREATE TABLE IF NOT EXISTS public.customer_ai_insights (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID REFERENCES public.customers(id) ON DELETE CASCADE,
    tenant_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    insight TEXT NOT NULL,
    insight_vector VECTOR(768),
    category TEXT DEFAULT 'behavior' CHECK (category IN ('preference', 'behavior', 'buying_pattern', 'sensitivity', 'interaction_history')),
    relevance_score FLOAT DEFAULT 1.0,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS for customer_ai_insights
ALTER TABLE public.customer_ai_insights ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenants can view insights of their own customers"
    ON public.customer_ai_insights FOR SELECT
    USING (auth.uid() = tenant_id);

CREATE POLICY "Tenants can manage insights of their own customers"
    ON public.customer_ai_insights FOR ALL
    USING (auth.uid() = tenant_id)
    WITH CHECK (auth.uid() = tenant_id);

-- AI Feedback Loop (tracks outcomes for learning)
CREATE TABLE IF NOT EXISTS public.ai_feedback_loop (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    customer_id UUID REFERENCES public.customers(id) ON DELETE CASCADE,
    message_id UUID, -- References to admin_notifications or tenant_messages (optional link)
    action_type TEXT NOT NULL CHECK (action_type IN ('click', 'purchase', 'ignore', 'reply', 'negative_feedback')),
    content_sent TEXT,
    insight_generated TEXT,
    is_processed BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS for ai_feedback_loop
ALTER TABLE public.ai_feedback_loop ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenants can view feedback loop data"
    ON public.ai_feedback_loop FOR SELECT
    USING (auth.uid() = tenant_id);

-- Helper function for vector search (RAG)
CREATE OR REPLACE FUNCTION public.match_tenant_knowledge (
  query_embedding VECTOR(768),
  p_tenant_id UUID,
  p_category TEXT DEFAULT NULL,
  match_threshold FLOAT DEFAULT 0.5,
  match_count INT DEFAULT 5
)
RETURNS TABLE (
  id UUID,
  content TEXT,
  category TEXT,
  similarity FLOAT
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    tk.id,
    tk.content,
    tk.category,
    1 - (tk.embedding <=> query_embedding) AS similarity
  FROM public.tenant_ai_knowledge tk
  WHERE tk.tenant_id = p_tenant_id
    AND (p_category IS NULL OR tk.category = p_category)
    AND tk.is_active = true
    AND 1 - (tk.embedding <=> query_embedding) > match_threshold
  ORDER BY tk.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- Helper function for customer insight search
CREATE OR REPLACE FUNCTION public.match_customer_insights (
  query_embedding VECTOR(768),
  p_customer_id UUID,
  p_tenant_id UUID,
  match_threshold FLOAT DEFAULT 0.5,
  match_count INT DEFAULT 5
)
RETURNS TABLE (
  id UUID,
  insight TEXT,
  category TEXT,
  similarity FLOAT
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    ci.id,
    ci.insight,
    ci.category,
    1 - (ci.insight_vector <=> query_embedding) AS similarity
  FROM public.customer_ai_insights ci
  WHERE ci.customer_id = p_customer_id
    AND ci.tenant_id = p_tenant_id
    AND 1 - (ci.insight_vector <=> query_embedding) > match_threshold
  ORDER BY ci.insight_vector <=> query_embedding
  LIMIT match_count;
END;
$$;

-- Trigger to update updated_at
CREATE TRIGGER update_tenant_ai_knowledge_updated_at
BEFORE UPDATE ON public.tenant_ai_knowledge
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_customer_ai_insights_updated_at
BEFORE UPDATE ON public.customer_ai_insights
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

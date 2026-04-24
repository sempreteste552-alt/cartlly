-- Create ai_usage_logs table
CREATE TABLE IF NOT EXISTS public.ai_usage_logs (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id),
    store_user_id UUID REFERENCES auth.users(id),
    provider TEXT NOT NULL,
    model TEXT NOT NULL,
    tokens_prompt INTEGER NOT NULL DEFAULT 0,
    tokens_completion INTEGER NOT NULL DEFAULT 0,
    total_tokens INTEGER GENERATED ALWAYS AS (tokens_prompt + tokens_completion) STORED,
    estimated_cost NUMERIC(10, 6) DEFAULT 0,
    feature TEXT, -- e.g., 'ceo_brain', 'push_notification', 'catalog_enhance'
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.ai_usage_logs ENABLE ROW LEVEL SECURITY;

-- Policies for ai_usage_logs
CREATE POLICY "Super admins can view all AI logs" 
ON public.ai_usage_logs 
FOR SELECT 
USING (
    EXISTS (
        SELECT 1 FROM public.user_roles 
        WHERE user_id = auth.uid() 
        AND role = 'super_admin'
    )
);

CREATE POLICY "Users can view their own store AI logs" 
ON public.ai_usage_logs 
FOR SELECT 
USING (
    auth.uid() = store_user_id OR auth.uid() = user_id
);

-- Create function to get AI usage stats
CREATE OR REPLACE FUNCTION public.get_ai_usage_stats(p_start_date TIMESTAMP WITH TIME ZONE DEFAULT now() - interval '30 days')
RETURNS TABLE (
    total_tokens BIGINT,
    total_cost NUMERIC,
    call_count BIGINT,
    usage_by_provider JSONB,
    usage_by_feature JSONB
) LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
    RETURN QUERY
    SELECT 
        SUM(l.total_tokens)::BIGINT as total_tokens,
        SUM(l.estimated_cost)::NUMERIC as total_cost,
        COUNT(*)::BIGINT as call_count,
        jsonb_object_agg(l.provider, provider_usage) as usage_by_provider,
        jsonb_object_agg(l.feature, feature_usage) as usage_by_feature
    FROM public.ai_usage_logs l
    CROSS JOIN LATERAL (
        SELECT SUM(total_tokens) as provider_usage FROM public.ai_usage_logs WHERE provider = l.provider AND created_at >= p_start_date
    ) p
    CROSS JOIN LATERAL (
        SELECT SUM(total_tokens) as feature_usage FROM public.ai_usage_logs WHERE feature = l.feature AND created_at >= p_start_date
    ) f
    WHERE l.created_at >= p_start_date
    GROUP BY 1, 2, 3;
END;
$$;

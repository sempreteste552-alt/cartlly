-- Table for AI Brain configuration per tenant
CREATE TABLE public.tenant_ai_brain_config (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    ai_name TEXT DEFAULT 'Gerente IA',
    custom_instructions TEXT,
    store_knowledge JSONB DEFAULT '{}'::jsonb,
    personality TEXT DEFAULT 'profissional',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE(user_id)
);

-- Table for scheduled tasks created by the AI
CREATE TABLE public.ai_scheduled_tasks (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    task_type TEXT NOT NULL, -- 'send_push', 'send_email', 'stock_check', 'custom'
    scheduled_at TIMESTAMP WITH TIME ZONE NOT NULL,
    payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'processing', 'completed', 'failed', 'cancelled'
    ai_instruction TEXT, -- The original natural language instruction
    error_message TEXT,
    retry_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Table for admin chat history with the AI brain
CREATE TABLE public.admin_ai_chats (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    role TEXT NOT NULL, -- 'user', 'assistant', 'system'
    content TEXT NOT NULL,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.tenant_ai_brain_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_scheduled_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_ai_chats ENABLE ROW LEVEL SECURITY;

-- Policies for tenant_ai_brain_config
CREATE POLICY "Users can manage their own AI config"
ON public.tenant_ai_brain_config
FOR ALL
USING (auth.uid() = user_id);

-- Policies for ai_scheduled_tasks
CREATE POLICY "Users can manage their own scheduled tasks"
ON public.ai_scheduled_tasks
FOR ALL
USING (auth.uid() = user_id);

-- Policies for admin_ai_chats
CREATE POLICY "Users can view their own AI chat history"
ON public.admin_ai_chats
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own AI chat history"
ON public.admin_ai_chats
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Updated at triggers
CREATE TRIGGER update_tenant_ai_brain_config_updated_at
BEFORE UPDATE ON public.tenant_ai_brain_config
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_ai_scheduled_tasks_updated_at
BEFORE UPDATE ON public.ai_scheduled_tasks
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create index for faster task processing
CREATE INDEX idx_ai_scheduled_tasks_status_time ON public.ai_scheduled_tasks(status, scheduled_at);

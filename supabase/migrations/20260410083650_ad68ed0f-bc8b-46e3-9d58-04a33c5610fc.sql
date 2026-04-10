-- Create store_ai_reminders table
CREATE TABLE IF NOT EXISTS public.store_ai_reminders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    remind_at TIMESTAMP WITH TIME ZONE NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending', -- pending, sent, cancelled
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.store_ai_reminders ENABLE ROW LEVEL SECURITY;

-- Policies for store_ai_reminders
CREATE POLICY "Users can view their own reminders" ON public.store_ai_reminders
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own reminders" ON public.store_ai_reminders
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own reminders" ON public.store_ai_reminders
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own reminders" ON public.store_ai_reminders
    FOR DELETE USING (auth.uid() = user_id);

-- Add ai_last_analysis_at to store_settings if it doesn't exist
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'store_settings' AND column_name = 'ai_last_analysis_at') THEN
        ALTER TABLE public.store_settings ADD COLUMN ai_last_analysis_at TIMESTAMP WITH TIME ZONE;
    END IF;
END $$;

-- Create table for search logs
CREATE TABLE public.search_logs (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id),
    term TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.search_logs ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view their own search logs"
ON public.search_logs
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Anyone can insert search logs"
ON public.search_logs
FOR INSERT
WITH CHECK (true);

-- Create index for performance
CREATE INDEX idx_search_logs_user_id ON public.search_logs(user_id);
CREATE INDEX idx_search_logs_term ON public.search_logs(term);

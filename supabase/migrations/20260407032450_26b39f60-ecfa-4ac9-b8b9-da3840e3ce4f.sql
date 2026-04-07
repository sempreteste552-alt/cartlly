-- Add header_text_color column
ALTER TABLE public.store_settings 
ADD COLUMN header_text_color TEXT DEFAULT '#000000';

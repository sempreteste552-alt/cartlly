-- Create product_videos table
CREATE TABLE public.product_videos (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
    video_url TEXT NOT NULL,
    thumbnail_url TEXT,
    title TEXT,
    description TEXT,
    user_id UUID NOT NULL REFERENCES auth.users(id),
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.product_videos ENABLE ROW LEVEL SECURITY;

-- Create policies for product_videos
CREATE POLICY "Product videos are viewable by everyone" 
ON public.product_videos 
FOR SELECT 
USING (true);

CREATE POLICY "Users can insert their own product videos" 
ON public.product_videos 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own product videos" 
ON public.product_videos 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own product videos" 
ON public.product_videos 
FOR DELETE 
USING (auth.uid() = user_id);

-- Create function to update timestamps
CREATE TRIGGER update_product_videos_updated_at
BEFORE UPDATE ON public.product_videos
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create storage bucket for product videos
INSERT INTO storage.buckets (id, name, public) 
VALUES ('product-videos', 'product-videos', true)
ON CONFLICT (id) DO NOTHING;

-- Create storage policies for product videos
CREATE POLICY "Product videos are publicly accessible" 
ON storage.objects 
FOR SELECT 
USING (bucket_id = 'product-videos');

CREATE POLICY "Users can upload product videos" 
ON storage.objects 
FOR INSERT 
WITH CHECK (bucket_id = 'product-videos' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can update their own product videos in storage" 
ON storage.objects 
FOR UPDATE 
USING (bucket_id = 'product-videos' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete their own product videos in storage" 
ON storage.objects 
FOR DELETE 
USING (bucket_id = 'product-videos' AND auth.uid()::text = (storage.foldername(name))[1]);

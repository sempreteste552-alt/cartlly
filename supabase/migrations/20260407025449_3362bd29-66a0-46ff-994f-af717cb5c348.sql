-- Drop the restrictive anon-only policy
DROP POLICY IF EXISTS "Anyone can view published products" ON public.products;

-- Create a new policy that covers both anon and authenticated users
CREATE POLICY "Anyone can view published products" 
ON public.products 
FOR SELECT 
USING (published = true);

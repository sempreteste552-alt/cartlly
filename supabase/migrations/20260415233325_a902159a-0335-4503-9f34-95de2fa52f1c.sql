-- Drop existing function with CASCADE to remove dependent policies automatically
DROP FUNCTION IF EXISTS public.is_collaborator(UUID, TEXT) CASCADE;

-- Re-create function to check if user is a collaborator with specific roles
CREATE OR REPLACE FUNCTION public.is_collaborator(owner_id UUID, required_roles TEXT[] DEFAULT ARRAY['admin', 'editor', 'viewer'])
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.store_collaborators
    WHERE store_owner_id = owner_id
    AND collaborator_id = auth.uid()
    AND (role = ANY(required_roles) OR role = 'admin')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Re-create store_settings policies
DROP POLICY IF EXISTS "Users and collaborators can view settings" ON public.store_settings;
CREATE POLICY "Users and collaborators can view settings" ON public.store_settings
FOR SELECT USING (auth.uid() = user_id OR public.is_collaborator(user_id));

DROP POLICY IF EXISTS "Users and admin/editor collaborators can update settings" ON public.store_settings;
CREATE POLICY "Users and admin/editor collaborators can update settings" ON public.store_settings
FOR UPDATE USING (auth.uid() = user_id OR public.is_collaborator(user_id, ARRAY['admin', 'editor']));

-- Re-create products policies
DROP POLICY IF EXISTS "Users and collaborators can view products" ON public.products;
CREATE POLICY "Users and collaborators can view products" ON public.products
FOR SELECT USING (auth.uid() = user_id OR public.is_collaborator(user_id));

DROP POLICY IF EXISTS "Users and admin/editor collaborators can insert products" ON public.products;
CREATE POLICY "Users and admin/editor collaborators can insert products" ON public.products
FOR INSERT WITH CHECK (auth.uid() = user_id OR public.is_collaborator(user_id, ARRAY['admin', 'editor']));

DROP POLICY IF EXISTS "Users and admin/editor collaborators can update products" ON public.products;
CREATE POLICY "Users and admin/editor collaborators can update products" ON public.products
FOR UPDATE USING (auth.uid() = user_id OR public.is_collaborator(user_id, ARRAY['admin', 'editor']));

DROP POLICY IF EXISTS "Users and admin/editor collaborators can delete products" ON public.products;
CREATE POLICY "Users and admin/editor collaborators can delete products" ON public.products
FOR DELETE USING (auth.uid() = user_id OR public.is_collaborator(user_id, ARRAY['admin', 'editor']));

-- Re-create orders policies
DROP POLICY IF EXISTS "Users and collaborators can view orders" ON public.orders;
CREATE POLICY "Users and collaborators can view orders" ON public.orders
FOR SELECT USING (auth.uid() = user_id OR public.is_collaborator(user_id));

-- Re-create categories policies
DROP POLICY IF EXISTS "Users and collaborators can view categories" ON public.categories;
CREATE POLICY "Users and collaborators can view categories" ON public.categories
FOR SELECT USING (auth.uid() = user_id OR public.is_collaborator(user_id));

-- Re-create coupons policies
DROP POLICY IF EXISTS "Users and collaborators can view coupons" ON public.coupons;
CREATE POLICY "Users and collaborators can view coupons" ON public.coupons
FOR SELECT USING (auth.uid() = user_id OR public.is_collaborator(user_id));

-- Re-create customers policies (using store_user_id)
DROP POLICY IF EXISTS "Users and collaborators can view customers" ON public.customers;
CREATE POLICY "Users and collaborators can view customers" ON public.customers
FOR SELECT USING (auth.uid() = store_user_id OR public.is_collaborator(store_user_id));

-- Super admin can update any profile (approve/reject/block)
CREATE POLICY "Super admins can update all profiles"
ON public.profiles FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'super_admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role));

-- Super admin can delete profiles
CREATE POLICY "Super admins can delete profiles"
ON public.profiles FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'super_admin'::app_role));

-- Super admin can update any store_settings (block/unblock store/panel)
CREATE POLICY "Super admins can update all store settings"
ON public.store_settings FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'super_admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role));

-- Super admin can delete store_settings
CREATE POLICY "Super admins can delete store settings"
ON public.store_settings FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'super_admin'::app_role));

-- Super admin can delete products
CREATE POLICY "Super admins can delete products"
ON public.products FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'super_admin'::app_role));

-- Super admin can delete orders
CREATE POLICY "Super admins can delete orders"
ON public.orders FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'super_admin'::app_role));

-- Super admin can delete categories
CREATE POLICY "Super admins can delete categories"
ON public.categories FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'super_admin'::app_role));

-- Super admin can delete coupons
CREATE POLICY "Super admins can delete coupons"
ON public.coupons FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'super_admin'::app_role));

-- Super admin can delete shipping_zones
CREATE POLICY "Super admins can delete shipping zones"
ON public.shipping_zones FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'super_admin'::app_role));

-- Super admin can delete store_banners
CREATE POLICY "Super admins can delete store banners"
ON public.store_banners FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'super_admin'::app_role));

-- Super admin can delete admin_notifications
CREATE POLICY "Super admins can delete notifications"
ON public.admin_notifications FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'super_admin'::app_role));

-- Super admin can delete push_subscriptions
CREATE POLICY "Super admins can delete push subscriptions"
ON public.push_subscriptions FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'super_admin'::app_role));
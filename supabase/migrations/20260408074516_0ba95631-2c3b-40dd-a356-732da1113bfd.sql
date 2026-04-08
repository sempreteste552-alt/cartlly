
-- Allow customers to read messages intended for them
CREATE POLICY "Customers can view store messages"
  ON public.tenant_messages FOR SELECT TO authenticated
  USING (
    target_area IN ('public_store', 'customer_account')
    AND audience_type IN ('tenant_admin_to_all_customers', 'tenant_admin_to_one_customer', 'tenant_admin_to_customer_segment')
    AND (target_user_id IS NULL OR target_user_id = auth.uid())
  );

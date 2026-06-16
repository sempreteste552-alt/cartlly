UPDATE public.store_settings
SET gateway_environment = 'sandbox'
WHERE user_id = '3ac3791a-5e44-427d-b6c1-63de8fd663b5'
  AND payment_gateway = 'asaas'
  AND gateway_environment = 'production'
  AND gateway_secret_key LIKE '%\_hmlg\_%';
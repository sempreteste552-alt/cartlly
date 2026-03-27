UPDATE tenant_plans 
SET max_products = 10, 
    max_orders_month = 0, 
    features = '{"gateway": false, "ai_tools": false, "coupons": false, "shipping_zones": false, "banners": false, "custom_domain": false, "whatsapp_sales": false, "reviews": false}'::jsonb
WHERE id = '8d6c8c81-c920-45a2-9f60-9880d6528120';

UPDATE tenant_plans 
SET max_products = 100, 
    max_orders_month = 100
WHERE id = 'd17a65f8-402f-4fa2-b8cb-ed499d894725';
Admin store management system (Loja Admin V0). Portuguese UI language.
- Backend: Lovable Cloud (Supabase) - PostgreSQL, auth, storage
- Design: Dark sidebar (hsl 224 30% 12%), primary purple (hsl 243 75% 59%)
- Auth: Supabase email/password with auto-profile creation trigger
- Routes: /login, /admin (dashboard), /admin/produtos, /admin/pedidos, /admin/config, /loja, /loja/rastreio
- Tables: profiles, products, product_variants, categories, orders, order_items, order_status_history, payments, coupons, store_settings, store_banners, product_images, product_reviews, shipping_zones, user_roles, tenant_plans, tenant_subscriptions
- Features: Multi-gateway payments (MercadoPago/PagBank), product variants (color/size/model), ViaCEP shipping zones, realtime order tracking, advanced analytics dashboard, coupon system
- Gateways: mercadopago, pagbank, pagarme - credentials per tenant

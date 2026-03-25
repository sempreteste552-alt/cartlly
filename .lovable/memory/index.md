Admin store management system (Loja Admin V0). Portuguese UI language.
- Backend: Lovable Cloud (Supabase) - PostgreSQL, auth, storage
- Design: Dark sidebar admin (hsl 224 30% 12%), primary purple (hsl 243 75% 59%). Public store: black & white theme.
- Auth: Supabase email/password with auto-profile creation trigger
- Routes: /login, /admin (dashboard, produtos, pedidos, config), /loja (home, produto/:id, checkout), /loja/:slug (multi-tenant)
- Tables: profiles, products, categories, orders, order_items, order_status_history, store_settings, store_banners, product_reviews
- Store settings: name, logo, colors, payment methods, gateway (mercadopago/pagbank/pagarme), address, phone, whatsapp, social URLs, google maps, open/closed, sell_via_whatsapp, location, description, store_slug (unique), admin_primary_color, admin_accent_color
- Features: Product CRUD with categories, Order management with status flow (pendente→processando→enviado→entregue), Public store with carousel banners, cart, checkout, WhatsApp ordering, under construction page, similar products, product reviews with stars, dynamic dashboard with charts, configurable admin+store colors, multi-tenant via slug routing
- Buckets: product-images, store-assets (both public)

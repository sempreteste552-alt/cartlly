# Memory: index.md
Updated: now

Admin store management system (Loja Admin V0). Portuguese UI language.
- Backend: Lovable Cloud (Supabase) - PostgreSQL, auth, storage
- Design: Dark sidebar (hsl 224 30% 12%), primary purple (hsl 243 75% 59%)
- Auth: Supabase email/password with auto-profile creation trigger
- Super Admin Email: evelynesantoscruivinel@gmail.com
- Routes: /login, /admin (dashboard), /admin/produtos, /admin/pedidos, /admin/config, /admin/clientes
- Tables: profiles, customers (store customers), store_settings (with marquee/logo_size fields)
- Features: AI tools (descriptions, pricing, image), AI Chat, Customer auth on store, Marquee, Feature gating by plan
- Plans control features: gateway, ai_tools, coupons, shipping_zones, banners, custom_domain
- LockedFeature component shows blur + padlock when feature disabled by plan

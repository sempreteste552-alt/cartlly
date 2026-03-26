# Memory: index.md
Updated: now

Admin store management system (Loja Admin V0). Portuguese UI language.
- Backend: Lovable Cloud (Supabase) - PostgreSQL, auth, storage
- Design: Dark sidebar (hsl 224 30% 12%), primary purple (hsl 243 75% 59%)
- Auth: Supabase email/password with auto-profile creation trigger
- Routes: /login, /admin (tenant dashboard), /superadmin, /loja/:slug (store by slug only)
- NO default /loja route — stores are only accessible via slug
- "/" redirects to /login, not /loja
- Tables: profiles (user_id, display_name, avatar_url, status)
- Tenant isolation: all queries filter by user_id, RLS enforced
- Push notifications: VAPID keys configured, sw-push.js service worker
- DB triggers: notify on new orders, customers, payments, plan changes

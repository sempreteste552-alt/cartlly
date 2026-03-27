# Project Memory

## Core
Admin store management system (Loja Admin V0). Portuguese UI language.
- Backend: Lovable Cloud (Supabase) - PostgreSQL, auth, storage
- Design: Dark sidebar (hsl 224 30% 12%), primary purple (hsl 243 75% 59%)
- Auth: Supabase email/password with auto-profile creation trigger
- Super Admin email: evelynesantoscruivinel@gmail.com (user_id: e1091578-7cdf-4e64-9036-dd4385e3b088)
- Theme isolation: scoped per context (superadmin/admin/store-{slug}) via localStorage keys
- Dark mode: pure black (#000) background, all store elements use semantic tokens (bg-background, text-foreground, bg-card, etc.)
- Realtime enabled on: profiles, plan_change_requests

## Memories
- [Theme isolation](mem://design/theme-isolation) — Scoped ThemeToggle with scope prop, store dark mode applied via useThemeScope hook

# Project Memory

## Core
Admin store management system (Loja Admin V0). Portuguese UI language.
- Backend: Lovable Cloud (Supabase) - PostgreSQL, auth, storage
- Design: Dark sidebar (hsl 224 30% 12%), primary purple (hsl 243 75% 59%)
- Auth: Supabase email/password with auto-profile creation trigger
- Payment Gateway: Amplopay (x-public-key, x-secret-key headers)
- Plans: Gratuito R$0 (10 products only), Básico R$49.90, Profissional R$89.90

## Memories
- [Theme isolation](mem://design/theme-isolation) — Dark/light theme isolated per tenant/store
- [Amplopay integration](mem://features/amplopay) — API docs, endpoints, webhook format

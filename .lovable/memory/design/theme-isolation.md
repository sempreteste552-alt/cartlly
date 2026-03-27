---
name: Theme isolation per context
description: ThemeToggle uses scope prop (superadmin/admin/store-{slug}) for isolated dark mode per panel
type: design
---
- ThemeToggle component accepts `scope` (localStorage key prefix) and `applyToRoot` props
- SuperAdmin uses scope="superadmin", Admin uses scope="admin", Store uses scope="store-{slug}"
- Each layout cleans up dark class on unmount so contexts don't leak
- Store layout reads theme via useThemeScope hook and applies dark class in its own useEffect
- All store components use semantic tokens (bg-background, text-foreground, bg-card, border-border) — no hardcoded gray/white/black

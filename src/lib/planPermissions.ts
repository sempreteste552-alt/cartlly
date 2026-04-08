/**
 * Centralized Plan Permissions Engine — 4-tier system
 * FREE → STARTER → PRO → PREMIUM
 */

// ─── Feature definitions ───────────────────────────────────────────
export type FeatureKey =
  | "manage_products" | "manage_categories" | "manage_orders"
  | "custom_domain" | "premium_themes" | "design_customization"
  | "home_builder" | "banner_manager" | "product_video"
  | "product_reviews" | "product_faq" | "related_products"
  | "coupons" | "seo_basic" | "seo_advanced"
  | "analytics_basic" | "analytics_advanced"
  | "upsell" | "cross_sell" | "order_bump" | "abandoned_cart"
  | "ai_content" | "ai_store_builder"
  | "premium_checkout" | "scripts_custom" | "integrations_advanced"
  | "gateway" | "ai_tools" | "shipping_zones" | "banners"
  | "whatsapp_sales" | "reviews"
  | "mega_menu" | "custom_fonts" | "video_blocks" | "conversion_widgets"
  | "advanced_product_cards" | "custom_home_sections" | "premium_banners"
  | "push_customers"
  | "enterprise_permissions";

export type PlanSlug = "FREE" | "STARTER" | "PRO" | "PREMIUM";

export type SubscriptionStatus =
  | "trial" | "trial_expired" | "active"
  | "past_due" | "canceled" | "suspended";

// ─── Feature metadata for UI ──────────────────────────────────────
export interface FeatureMeta {
  label: string;
  description: string;
  minPlan: PlanSlug;
  category: "basic" | "design" | "marketing" | "advanced" | "ai" | "enterprise";
}

export const FEATURE_CATALOG: Record<FeatureKey, FeatureMeta> = {
  // FREE
  manage_products:      { label: "Gerenciar Produtos", description: "Cadastrar e editar produtos", minPlan: "FREE", category: "basic" },
  manage_categories:    { label: "Categorias", description: "Organizar produtos por categorias", minPlan: "FREE", category: "basic" },
  manage_orders:        { label: "Gerenciar Pedidos", description: "Visualizar e gerenciar pedidos", minPlan: "FREE", category: "basic" },
  whatsapp_sales:       { label: "Vendas via WhatsApp", description: "Receber pedidos via WhatsApp", minPlan: "FREE", category: "basic" },
  analytics_basic:      { label: "Analytics Básico", description: "Métricas simples da loja", minPlan: "FREE", category: "basic" },

  // STARTER
  gateway:              { label: "Gateway de Pagamento", description: "Aceitar pagamentos online", minPlan: "STARTER", category: "marketing" },
  coupons:              { label: "Cupons de Desconto", description: "Criar cupons e promoções", minPlan: "STARTER", category: "marketing" },
  shipping_zones:       { label: "Zonas de Frete", description: "Configurar regiões de entrega", minPlan: "STARTER", category: "marketing" },
  product_reviews:      { label: "Avaliações", description: "Avaliações de clientes", minPlan: "STARTER", category: "marketing" },
  reviews:              { label: "Sistema de Reviews", description: "Reviews completos", minPlan: "STARTER", category: "marketing" },
  seo_basic:            { label: "SEO Básico", description: "Meta tags e títulos", minPlan: "STARTER", category: "marketing" },

  // PRO
  banners:              { label: "Banners da Loja", description: "Banners promocionais", minPlan: "PRO", category: "design" },
  banner_manager:       { label: "Gerenciador de Banners", description: "Upload e organização de banners", minPlan: "PRO", category: "design" },
  premium_banners:      { label: "Banners Premium", description: "Banners com vídeo e animações", minPlan: "PRO", category: "design" },
  custom_domain:        { label: "Domínio Personalizado", description: "Usar seu próprio domínio", minPlan: "PRO", category: "advanced" },
  premium_themes:       { label: "Temas Premium", description: "Temas visuais exclusivos", minPlan: "PRO", category: "design" },
  design_customization: { label: "Personalização Visual", description: "Cores, fontes e estilos", minPlan: "PRO", category: "design" },
  home_builder:         { label: "Editor da Home", description: "Montar a home por blocos", minPlan: "PRO", category: "design" },
  custom_home_sections: { label: "Seções Customizadas", description: "Criar seções personalizadas na home", minPlan: "PRO", category: "design" },
  product_video:        { label: "Vídeos no Produto", description: "Adicionar vídeos aos produtos", minPlan: "PRO", category: "design" },
  video_blocks:         { label: "Blocos de Vídeo", description: "Seções com vídeo na loja", minPlan: "PRO", category: "design" },
  product_faq:          { label: "FAQ do Produto", description: "Perguntas frequentes no produto", minPlan: "PRO", category: "marketing" },
  related_products:     { label: "Produtos Relacionados", description: "Sugestões automáticas", minPlan: "PRO", category: "marketing" },
  premium_checkout:     { label: "Checkout Premium", description: "Checkout otimizado para conversão", minPlan: "PRO", category: "marketing" },
  advanced_product_cards:{ label: "Cards Premium", description: "Cards de produto com hover, selos e animações", minPlan: "PRO", category: "design" },
  custom_fonts:         { label: "Fontes Personalizadas", description: "Tipografia customizada", minPlan: "PRO", category: "design" },
  mega_menu:            { label: "Mega Menu", description: "Menu de navegação avançado", minPlan: "PRO", category: "design" },
  conversion_widgets:   { label: "Widgets de Conversão", description: "Selos, contagem regressiva, urgência", minPlan: "PRO", category: "marketing" },

  // PREMIUM
  seo_advanced:         { label: "SEO Avançado", description: "Schema, sitemap e otimizações", minPlan: "PREMIUM", category: "advanced" },
  analytics_advanced:   { label: "Analytics Avançado", description: "Métricas detalhadas e relatórios", minPlan: "PREMIUM", category: "advanced" },
  upsell:               { label: "Upsell", description: "Oferecer upgrades ao cliente", minPlan: "PREMIUM", category: "advanced" },
  cross_sell:           { label: "Cross-sell", description: "Produtos complementares", minPlan: "PREMIUM", category: "advanced" },
  order_bump:           { label: "Order Bump", description: "Oferta extra no checkout", minPlan: "PREMIUM", category: "advanced" },
  abandoned_cart:       { label: "Carrinho Abandonado", description: "Recuperação automática", minPlan: "PREMIUM", category: "advanced" },
  ai_content:           { label: "IA de Conteúdo", description: "Gerar descrições e textos com IA", minPlan: "PREMIUM", category: "ai" },
  ai_store_builder:     { label: "IA Monta Loja", description: "Montar loja com inteligência artificial", minPlan: "PREMIUM", category: "ai" },
  ai_tools:             { label: "Ferramentas de IA", description: "Todas as ferramentas de IA", minPlan: "PREMIUM", category: "ai" },
  scripts_custom:       { label: "Scripts & Pixels", description: "Inserir scripts e pixels", minPlan: "PREMIUM", category: "enterprise" },
  integrations_advanced:{ label: "Integrações Avançadas", description: "APIs e integrações externas", minPlan: "PREMIUM", category: "enterprise" },
  enterprise_permissions:{ label: "Permissões Enterprise", description: "Controle granular de acessos", minPlan: "PREMIUM", category: "enterprise" },
};

// ─── Plan hierarchy ───────────────────────────────────────────────
const PLAN_HIERARCHY: Record<PlanSlug, number> = {
  FREE: 0,
  STARTER: 1,
  PRO: 2,
  PREMIUM: 3,
};

export function planLevel(slug: PlanSlug): number {
  return PLAN_HIERARCHY[slug] ?? 0;
}

// ─── Tenant context type ──────────────────────────────────────────
export interface TenantContext {
  planSlug: PlanSlug;
  planFeatures: Record<string, any>;
  maxProducts: number;
  maxOrdersMonth: number;
  currentProductCount: number;
  subscriptionStatus: SubscriptionStatus | null;
  isTrial: boolean;
  trialDaysLeft: number;
  isTrialExpired: boolean;
}

// ─── Core permission functions ────────────────────────────────────

/** Check if a tenant can access a specific feature */
export function canAccess(feature: FeatureKey, ctx: TenantContext): boolean {
  if (ctx.isTrial && !ctx.isTrialExpired) return true;
  if (isBlocked(ctx)) {
    const basicFeatures: FeatureKey[] = ["manage_products", "manage_categories", "manage_orders", "analytics_basic"];
    return basicFeatures.includes(feature);
  }
  // Check hierarchy: tenant plan level must be >= feature minimum plan level
  const meta = FEATURE_CATALOG[feature];
  if (!meta) return false;
  return planLevel(ctx.planSlug) >= planLevel(meta.minPlan);
}

/** Check if a tenant can create more products */
export function canCreateProduct(ctx: TenantContext): boolean {
  if (isBlocked(ctx)) return false;
  if (ctx.isTrial && !ctx.isTrialExpired) return true;
  return ctx.currentProductCount < ctx.maxProducts;
}

/** Get the reason a feature is blocked */
export function getBlockedReason(feature: FeatureKey, ctx: TenantContext): string | null {
  if (canAccess(feature, ctx)) return null;
  if (isBlocked(ctx)) return "Sua assinatura está inativa. Ative seu plano para acessar este recurso.";
  const meta = FEATURE_CATALOG[feature];
  if (!meta) return "Recurso indisponível no seu plano atual.";
  return `Disponível a partir do plano ${meta.minPlan}. Faça upgrade para desbloquear.`;
}

/** Get the reason product creation is blocked */
export function getProductLimitReason(ctx: TenantContext): string | null {
  if (canCreateProduct(ctx)) return null;
  if (isBlocked(ctx)) return "Sua assinatura está inativa. Ative seu plano para cadastrar produtos.";
  return `Você atingiu o limite de ${ctx.maxProducts} produtos do plano ${ctx.planSlug}. Faça upgrade para cadastrar mais.`;
}

/** Check if tenant is in an active (operational) state */
export function isTenantActive(ctx: TenantContext): boolean {
  if (ctx.isTrial && !ctx.isTrialExpired) return true;
  return ctx.subscriptionStatus === "active";
}

/** Check if tenant is in a blocked state */
export function isBlocked(ctx: TenantContext): boolean {
  if (!ctx.subscriptionStatus) return true;
  const blockedStatuses: SubscriptionStatus[] = ["trial_expired", "past_due", "canceled", "suspended"];
  if (blockedStatuses.includes(ctx.subscriptionStatus)) return true;
  if (ctx.isTrial && ctx.isTrialExpired) return true;
  return false;
}

/** Get the minimum plan required for a feature */
export function getMinPlan(feature: FeatureKey): PlanSlug {
  return FEATURE_CATALOG[feature]?.minPlan ?? "PREMIUM";
}

/** Get plan limits */
export function getPlanLimits(ctx: TenantContext) {
  return {
    maxProducts: ctx.maxProducts,
    maxOrdersMonth: ctx.maxOrdersMonth,
    currentProducts: ctx.currentProductCount,
    productsUsagePercent: ctx.maxProducts > 0 ? Math.min(100, (ctx.currentProductCount / ctx.maxProducts) * 100) : 0,
  };
}

/** Get features grouped by category */
export function getFeaturesByCategory(ctx: TenantContext) {
  const categories = {
    basic: [] as { key: FeatureKey; meta: FeatureMeta; unlocked: boolean }[],
    design: [] as { key: FeatureKey; meta: FeatureMeta; unlocked: boolean }[],
    marketing: [] as { key: FeatureKey; meta: FeatureMeta; unlocked: boolean }[],
    advanced: [] as { key: FeatureKey; meta: FeatureMeta; unlocked: boolean }[],
    ai: [] as { key: FeatureKey; meta: FeatureMeta; unlocked: boolean }[],
    enterprise: [] as { key: FeatureKey; meta: FeatureMeta; unlocked: boolean }[],
  };
  for (const [key, meta] of Object.entries(FEATURE_CATALOG)) {
    const featureKey = key as FeatureKey;
    categories[meta.category].push({ key: featureKey, meta, unlocked: canAccess(featureKey, ctx) });
  }
  return categories;
}

/** Category labels */
export const CATEGORY_LABELS: Record<string, string> = {
  basic: "Recursos Básicos",
  design: "Design & Aparência",
  marketing: "Marketing & Vendas",
  advanced: "Avançado",
  ai: "Inteligência Artificial",
  enterprise: "Enterprise",
};

/** Plan display info */
export const PLAN_INFO: Record<PlanSlug, { label: string; color: string; gradient: string; badgeClass: string; description: string }> = {
  FREE: {
    label: "Free",
    color: "text-muted-foreground",
    gradient: "from-slate-400 to-slate-500",
    badgeClass: "bg-muted text-muted-foreground",
    description: "Para quem está começando",
  },
  STARTER: {
    label: "Starter",
    color: "text-emerald-600",
    gradient: "from-emerald-500 to-teal-500",
    badgeClass: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
    description: "Para lojas em crescimento",
  },
  PRO: {
    label: "Pro",
    color: "text-blue-600",
    gradient: "from-blue-500 to-cyan-500",
    badgeClass: "bg-blue-500/10 text-blue-600 border-blue-500/20",
    description: "Para lojas profissionais",
  },
  PREMIUM: {
    label: "Premium",
    color: "text-amber-600",
    gradient: "from-amber-500 to-orange-500",
    badgeClass: "bg-gradient-to-r from-amber-500 to-orange-500 text-white border-0",
    description: "Para quem quer o máximo",
  },
};

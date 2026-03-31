/**
 * Centralized Plan Permissions Engine
 * All plan-related logic lives here. No scattered ifs across components.
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
  | "whatsapp_sales" | "reviews";

export type PlanSlug = "FREE" | "PRO" | "ELITE";

export type SubscriptionStatus =
  | "trial" | "trial_expired" | "active"
  | "past_due" | "canceled" | "suspended";

// ─── Feature metadata for UI ──────────────────────────────────────
export interface FeatureMeta {
  label: string;
  description: string;
  minPlan: PlanSlug;
  category: "basic" | "design" | "marketing" | "advanced" | "ai";
}

export const FEATURE_CATALOG: Record<FeatureKey, FeatureMeta> = {
  manage_products:      { label: "Gerenciar Produtos", description: "Cadastrar e editar produtos", minPlan: "FREE", category: "basic" },
  manage_categories:    { label: "Categorias", description: "Organizar produtos por categorias", minPlan: "FREE", category: "basic" },
  manage_orders:        { label: "Gerenciar Pedidos", description: "Visualizar e gerenciar pedidos", minPlan: "FREE", category: "basic" },
  whatsapp_sales:       { label: "Vendas via WhatsApp", description: "Receber pedidos via WhatsApp", minPlan: "FREE", category: "basic" },
  analytics_basic:      { label: "Analytics Básico", description: "Métricas simples da loja", minPlan: "FREE", category: "basic" },
  gateway:              { label: "Gateway de Pagamento", description: "Aceitar pagamentos online", minPlan: "PRO", category: "marketing" },
  coupons:              { label: "Cupons de Desconto", description: "Criar cupons e promoções", minPlan: "PRO", category: "marketing" },
  shipping_zones:       { label: "Zonas de Frete", description: "Configurar regiões de entrega", minPlan: "PRO", category: "marketing" },
  banners:              { label: "Banners da Loja", description: "Banners promocionais", minPlan: "PRO", category: "design" },
  banner_manager:       { label: "Gerenciador de Banners", description: "Upload e organização de banners", minPlan: "PRO", category: "design" },
  custom_domain:        { label: "Domínio Personalizado", description: "Usar seu próprio domínio", minPlan: "PRO", category: "advanced" },
  premium_themes:       { label: "Temas Premium", description: "Temas visuais exclusivos", minPlan: "PRO", category: "design" },
  design_customization: { label: "Personalização Visual", description: "Cores, fontes e estilos", minPlan: "PRO", category: "design" },
  home_builder:         { label: "Editor da Home", description: "Montar a home por blocos", minPlan: "PRO", category: "design" },
  product_video:        { label: "Vídeos no Produto", description: "Adicionar vídeos aos produtos", minPlan: "PRO", category: "design" },
  product_reviews:      { label: "Avaliações", description: "Avaliações de clientes", minPlan: "PRO", category: "marketing" },
  reviews:              { label: "Sistema de Reviews", description: "Reviews completos", minPlan: "PRO", category: "marketing" },
  product_faq:          { label: "FAQ do Produto", description: "Perguntas frequentes no produto", minPlan: "PRO", category: "marketing" },
  related_products:     { label: "Produtos Relacionados", description: "Sugestões automáticas", minPlan: "PRO", category: "marketing" },
  seo_basic:            { label: "SEO Básico", description: "Meta tags e títulos", minPlan: "PRO", category: "marketing" },
  premium_checkout:     { label: "Checkout Premium", description: "Checkout otimizado para conversão", minPlan: "PRO", category: "marketing" },
  seo_advanced:         { label: "SEO Avançado", description: "Schema, sitemap e otimizações", minPlan: "ELITE", category: "advanced" },
  analytics_advanced:   { label: "Analytics Avançado", description: "Métricas detalhadas e relatórios", minPlan: "ELITE", category: "advanced" },
  upsell:               { label: "Upsell", description: "Oferecer upgrades ao cliente", minPlan: "ELITE", category: "advanced" },
  cross_sell:           { label: "Cross-sell", description: "Produtos complementares", minPlan: "ELITE", category: "advanced" },
  order_bump:           { label: "Order Bump", description: "Oferta extra no checkout", minPlan: "ELITE", category: "advanced" },
  abandoned_cart:       { label: "Carrinho Abandonado", description: "Recuperação automática", minPlan: "ELITE", category: "advanced" },
  ai_content:           { label: "IA de Conteúdo", description: "Gerar descrições e textos com IA", minPlan: "ELITE", category: "ai" },
  ai_store_builder:     { label: "IA Monta Loja", description: "Montar loja com inteligência artificial", minPlan: "ELITE", category: "ai" },
  ai_tools:             { label: "Ferramentas de IA", description: "Todas as ferramentas de IA", minPlan: "ELITE", category: "ai" },
  scripts_custom:       { label: "Scripts Personalizados", description: "Inserir scripts e pixels", minPlan: "ELITE", category: "advanced" },
  integrations_advanced:{ label: "Integrações Avançadas", description: "APIs e integrações externas", minPlan: "ELITE", category: "advanced" },
};

// ─── Plan hierarchy ───────────────────────────────────────────────
const PLAN_HIERARCHY: Record<PlanSlug, number> = { FREE: 0, PRO: 1, ELITE: 2 };

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
  // During active trial, all features are available
  if (ctx.isTrial && !ctx.isTrialExpired) return true;

  // Blocked statuses deny everything except basics
  if (isBlocked(ctx)) {
    const basicFeatures: FeatureKey[] = ["manage_products", "manage_categories", "manage_orders", "analytics_basic"];
    return basicFeatures.includes(feature);
  }

  // Check feature flags from plan
  return ctx.planFeatures[feature] === true;
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

  if (isBlocked(ctx)) {
    return "Sua assinatura está inativa. Ative seu plano para acessar este recurso.";
  }

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
  return FEATURE_CATALOG[feature]?.minPlan ?? "ELITE";
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
  };

  for (const [key, meta] of Object.entries(FEATURE_CATALOG)) {
    const featureKey = key as FeatureKey;
    categories[meta.category].push({
      key: featureKey,
      meta,
      unlocked: canAccess(featureKey, ctx),
    });
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
};

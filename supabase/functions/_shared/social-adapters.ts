// ============================================================
// Social Provider Adapters (extensível: instagram, facebook, ...)
// Somente APIs oficiais da Meta. Nunca scraping/senhas.
// ============================================================

export const GRAPH = "https://graph.facebook.com/v21.0";

export type ProviderId = "instagram" | "facebook" | "tiktok" | "youtube" | "pinterest";

export interface NormalizedPost {
  external_post_id: string;
  post_url?: string | null;
  media_url?: string | null;
  caption?: string | null;
  published_at?: string | null;
}

export interface SocialProviderAdapter {
  id: ProviderId;
  label: string;
  scopes: string[];
  /** Monta URL de autorização oficial */
  authorizeUrl(appId: string, redirectUri: string, state: string): string;
  /** Busca posts recentes (usado como fallback controlado, sem polling agressivo) */
  fetchRecentPosts(accountId: string, token: string, limit?: number): Promise<NormalizedPost[]>;
  /** Normaliza um evento de webhook oficial */
  normalizeWebhookChange(change: any): NormalizedPost | null;
}

const metaAuthorize = (appId: string, redirectUri: string, state: string, scopes: string[]) =>
  `https://www.facebook.com/v21.0/dialog/oauth?client_id=${appId}` +
  `&redirect_uri=${encodeURIComponent(redirectUri)}` +
  `&state=${encodeURIComponent(state)}` +
  `&response_type=code&scope=${encodeURIComponent(scopes.join(","))}`;

export const InstagramAdapter: SocialProviderAdapter = {
  id: "instagram",
  label: "Instagram",
  scopes: [
    "instagram_basic",
    "instagram_manage_insights",
    "pages_show_list",
    "pages_read_engagement",
    "business_management",
  ],
  authorizeUrl: (a, r, s) => metaAuthorize(a, r, s, InstagramAdapter.scopes),
  async fetchRecentPosts(accountId, token, limit = 5) {
    const url = `${GRAPH}/${accountId}/media?fields=id,caption,media_url,thumbnail_url,permalink,timestamp,media_type&limit=${limit}&access_token=${token}`;
    const res = await fetch(url);
    const json = await res.json();
    if (!res.ok) throw new Error(json?.error?.message || "Instagram API error");
    return (json.data || []).map((m: any) => ({
      external_post_id: String(m.id),
      post_url: m.permalink ?? null,
      media_url: m.media_url || m.thumbnail_url || null,
      caption: m.caption ?? null,
      published_at: m.timestamp ?? null,
    }));
  },
  normalizeWebhookChange(change) {
    const v = change?.value;
    if (!v) return null;
    const id = v.media_id || v.id;
    if (!id) return null;
    return {
      external_post_id: String(id),
      post_url: v.permalink ?? null,
      media_url: v.media_url ?? null,
      caption: v.caption ?? v.text ?? null,
      published_at: v.created_time ? new Date(Number(v.created_time) * 1000).toISOString() : null,
    };
  },
};

export const FacebookAdapter: SocialProviderAdapter = {
  id: "facebook",
  label: "Facebook",
  scopes: ["pages_show_list", "pages_read_engagement", "pages_manage_metadata", "business_management"],
  authorizeUrl: (a, r, s) => metaAuthorize(a, r, s, FacebookAdapter.scopes),
  async fetchRecentPosts(accountId, token, limit = 5) {
    const url = `${GRAPH}/${accountId}/posts?fields=id,message,permalink_url,full_picture,created_time&limit=${limit}&access_token=${token}`;
    const res = await fetch(url);
    const json = await res.json();
    if (!res.ok) throw new Error(json?.error?.message || "Facebook API error");
    return (json.data || []).map((m: any) => ({
      external_post_id: String(m.id),
      post_url: m.permalink_url ?? null,
      media_url: m.full_picture ?? null,
      caption: m.message ?? null,
      published_at: m.created_time ?? null,
    }));
  },
  normalizeWebhookChange(change) {
    const v = change?.value;
    if (!v) return null;
    const id = v.post_id || v.photo_id || v.item_id;
    if (!id) return null;
    return {
      external_post_id: String(id),
      post_url: v.link ?? null,
      media_url: v.photo ?? v.full_picture ?? null,
      caption: v.message ?? null,
      published_at: v.created_time ? new Date(Number(v.created_time) * 1000).toISOString() : null,
    };
  },
};

export const ADAPTERS: Record<string, SocialProviderAdapter> = {
  instagram: InstagramAdapter,
  facebook: FacebookAdapter,
};

export function getAdapter(provider: string): SocialProviderAdapter {
  const a = ADAPTERS[provider];
  if (!a) throw new Error(`Provider não suportado: ${provider}`);
  return a;
}

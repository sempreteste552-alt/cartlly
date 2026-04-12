import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Simple in-memory cache for the current execution context/concurrency
// In a real middleware scenario, this would be Redis or a longer-lived cache
const cache = new Map<string, { storeId: string; isPrimary: boolean; primaryDomain: string | null; expiry: number }>();
const CACHE_TTL = 60 * 1000; // 1 minute

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const host = req.headers.get("host") || url.hostname;
    const hostname = host.toLowerCase().replace(/^www\./, "");
    const fullHostname = host.toLowerCase();

    // 1. Check Cache
    const cached = cache.get(fullHostname);
    if (cached && cached.expiry > Date.now()) {
      console.log(`[Cache Hit] ${fullHostname}`);
      if (!cached.isPrimary && cached.primaryDomain) {
        return new Response(null, {
          status: 301,
          headers: { "Location": `https://${cached.primaryDomain}${url.pathname}${url.search}` },
        });
      }
      return new Response(JSON.stringify({ store_id: cached.storeId }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // 2. Resolve Domain in DB
    const { data: domains, error: domainError } = await supabase
      .from("store_domains")
      .select("store_id, is_primary, hostname")
      .or(`hostname.eq.${fullHostname},hostname.eq.${hostname}`);

    if (domainError) throw domainError;

    if (domains && domains.length > 0) {
      // Find the one that matches perfectly (priority) or matches without www
      const match = domains.find(d => d.hostname === fullHostname) || domains[0];
      const storeId = match.store_id;

      // Find primary domain for this store for redirection logic
      const { data: primaryDomainData } = await supabase
        .from("store_domains")
        .select("hostname")
        .eq("store_id", storeId)
        .eq("is_primary", true)
        .maybeSingle();

      const primaryDomain = primaryDomainData?.hostname || null;
      const isPrimary = match.is_primary;

      // Update Cache
      cache.set(fullHostname, {
        storeId,
        isPrimary,
        primaryDomain,
        expiry: Date.now() + CACHE_TTL,
      });

      // 3. Handle 301 Redirection
      if (!isPrimary && primaryDomain && primaryDomain !== fullHostname) {
        return new Response(null, {
          status: 301,
          headers: { "Location": `https://${primaryDomain}${url.pathname}${url.search}` },
        });
      }

      return new Response(JSON.stringify({ store_id: storeId }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 4. Fallback to Subdomain (Existing system)
    // Example: my-store.msktelemarkting.com.br -> my-store
    // Assuming the platform domains are known
    const platformDomains = ["msktelemarkting.com", "msktelemarkting.com.br", "lovable.app", "lovableproject.com"];
    const domainParts = fullHostname.split(".");
    
    // Check if it's a subdomain of a platform domain
    const isSubdomain = domainParts.length > 2 && platformDomains.some(d => fullHostname.endsWith(d));
    
    if (isSubdomain) {
      const slug = domainParts[0];
      const { data: store, error: storeError } = await supabase
        .from("store_settings")
        .select("id")
        .eq("store_slug", slug)
        .maybeSingle();

      if (store) {
         return new Response(JSON.stringify({ store_id: store.id }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    return new Response(JSON.stringify({ error: "Store not found" }), {
      status: 404,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("Resolver Error:", error);
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

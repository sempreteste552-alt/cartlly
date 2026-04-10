import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const PLATFORM_IPS = new Set([
  "185.158.133.1",
  "185.41.148.1",
  "185.41.148.2",
]);

const PLATFORM_HOST_SUFFIXES = [".lovable.app", ".lovableproject.com"];

function sanitizeDomain(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/\/.*$/, "")
    .replace(/\.$/, "");
}

async function resolveDns(name: string, type: string) {
  const response = await fetch(`https://dns.google/resolve?name=${encodeURIComponent(name)}&type=${type}`);
  return response.json();
}

function normalizeDnsValue(value: string) {
  return value.trim().toLowerCase().replace(/\.$/, "");
}

function pointsToPlatformIp(value: string) {
  return PLATFORM_IPS.has(normalizeDnsValue(value));
}

function pointsToPlatformHostname(value: string) {
  const normalized = normalizeDnsValue(value);
  return PLATFORM_HOST_SUFFIXES.some((suffix) => normalized.endsWith(suffix));
}

async function inspectHostResolution(host: string) {
  const aData = await resolveDns(host, "A");
  const answers = Array.isArray(aData?.Answer) ? aData.Answer : [];
  const records = answers
    .map((record: any) => String(record?.data || ""))
    .filter(Boolean)
    .map(normalizeDnsValue);

  const aRecords = answers
    .filter((record: any) => record?.type === 1)
    .map((record: any) => normalizeDnsValue(String(record?.data || "")));

  const cnameRecords = answers
    .filter((record: any) => record?.type === 5)
    .map((record: any) => normalizeDnsValue(String(record?.data || "")));

  const matchedBy = aRecords.some(pointsToPlatformIp)
    ? "a"
    : cnameRecords.some(pointsToPlatformHostname)
      ? "cname"
      : null;

  return {
    host,
    records,
    aRecords,
    cnameRecords,
    matchedBy,
    matched: matchedBy !== null,
  };
}

async function checkHttps(domain: string) {
  for (const method of ["HEAD", "GET"]) {
    try {
      const response = await fetch(`https://${domain}`, {
        method,
        redirect: "manual",
      });

      if (response.status >= 200 && response.status < 500) {
        return true;
      }
    } catch (_error) {
      // Try the next method before considering SSL unavailable.
    }
  }

  return false;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { settingsId, domain } = await req.json();
    const requestedDomain = sanitizeDomain(domain || "");

    if (!settingsId || !requestedDomain) {
      return new Response(JSON.stringify({ error: "Missing settingsId or domain" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!/^[a-zA-Z0-9][a-zA-Z0-9.-]*\.[a-zA-Z]{2,}$/.test(requestedDomain)) {
      return new Response(JSON.stringify({ error: "Invalid domain format" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const apexDomain = requestedDomain.replace(/^www\./, "");
    const aHosts = Array.from(new Set([requestedDomain, apexDomain].filter(Boolean)));
    const txtHosts = Array.from(
      new Set([
        `_lovable.${requestedDomain}`,
        `_lovable.${apexDomain}`,
      ].filter(Boolean)),
    );

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const { data: settings, error: settingsError } = await supabase
      .from("store_settings")
      .select("id, custom_domain, user_id, domain_status")
      .eq("id", settingsId)
      .single();

    if (settingsError || !settings) {
      return new Response(JSON.stringify({ error: "Settings not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const expectedTxt = `lovable_verify=${settingsId}`;

    let aRecordFound = false;
    let txtRecordFound = false;
    let nameservers: string[] = [];
    let detectedProvider = "other";
    const checkedAHosts: Array<{ host: string; records: string[]; aRecords?: string[]; cnameRecords?: string[]; matchedBy?: string | null }> = [];
    const checkedTxtHosts: Array<{ host: string; records: string[] }> = [];

    const providerMap: Record<string, string[]> = {
      hostinger: ["hostinger", "dns-parking"],
      godaddy: ["godaddy", "domaincontrol"],
      cloudflare: ["cloudflare"],
      registrobr: ["registro.br", "dns.br"],
      namecheap: ["namecheap", "registrar-servers"],
    };

    try {
      const nsData = await resolveDns(apexDomain, "NS");
      if (nsData.Answer) {
        nameservers = nsData.Answer.map((r: any) => (r.data || "").toLowerCase());
        for (const [provider, patterns] of Object.entries(providerMap)) {
          if (nameservers.some((ns: string) => patterns.some((p) => ns.includes(p)))) {
            detectedProvider = provider;
            break;
          }
        }
      }
    } catch (e) {
      console.error("NS lookup error:", e);
    }

    for (const host of aHosts) {
      try {
        const resolution = await inspectHostResolution(host);
        checkedAHosts.push({
          host,
          records: resolution.records,
          aRecords: resolution.aRecords,
          cnameRecords: resolution.cnameRecords,
          matchedBy: resolution.matchedBy,
        });

        if (host === requestedDomain && resolution.matched) {
          aRecordFound = true;
        }
      } catch (e) {
        console.error(`A record check error for ${host}:`, e);
      }
    }

    for (const host of txtHosts) {
      try {
        const txtData = await resolveDns(host, "TXT");
        const records = (txtData.Answer || []).map((r: any) => String(r.data || "").replace(/"/g, "").trim());
        checkedTxtHosts.push({ host, records });
        if (records.some((record) => record === expectedTxt)) {
          txtRecordFound = true;
        }
      } catch (e) {
        console.error(`TXT record check error for ${host}:`, e);
      }
    }

    const dnsVerified = aRecordFound && txtRecordFound;
    const sslReady = dnsVerified ? await checkHttps(requestedDomain) : false;
    const newStatus = sslReady
      ? "verified"
      : (dnsVerified || aRecordFound || txtRecordFound ? "pending" : "failed");
    const dnsComplete = aRecordFound && txtRecordFound;

    const verifyDetails = {
      aRecord: aRecordFound,
      txtRecord: txtRecordFound,
      sslReady,
      dnsComplete,
      pointsToPlatform: aRecordFound,
      provider: detectedProvider,
      checkedAt: new Date().toISOString(),
    };

    // Check previous status to detect transition to verified
    const previousStatus = settings.custom_domain === requestedDomain
      ? settings.domain_status
      : null;

    const { error: updateError } = await supabase
      .from("store_settings")
      .update({
        domain_status: newStatus,
        domain_last_check: new Date().toISOString(),
        custom_domain: requestedDomain,
        domain_verify_details: verifyDetails,
      })
      .eq("id", settingsId);

    if (updateError) {
      console.error("Update error:", updateError);
    }

    // Send push + admin notification when domain becomes verified
    if (newStatus === "verified" && previousStatus !== "verified" && settings.user_id) {
      try {
        await supabase.from("admin_notifications").insert({
          sender_user_id: settings.user_id,
          target_user_id: settings.user_id,
          title: "🌐 Domínio Online!",
          message: `Seu domínio ${requestedDomain} está verificado e ativo com SSL! Sua loja já está acessível em https://${requestedDomain}`,
          type: "domain_verified",
        });

        // Trigger push notification
        const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
        await fetch(`${supabaseUrl}/functions/v1/send-push-internal`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            target_user_id: settings.user_id,
            title: "🌐 Domínio Online!",
            body: `${requestedDomain} está verificado com SSL ativo! Sua loja já está no ar.`,
            url: "/admin/configuracoes",
            type: "domain_verified",
          }),
        });
      } catch (e) {
        console.error("Notification error:", e);
      }
    }

    return new Response(
      JSON.stringify({
        status: newStatus,
        aRecord: aRecordFound,
        txtRecord: txtRecordFound,
        sslReady,
        dnsComplete,
        domain: requestedDomain,
        provider: detectedProvider,
        nameservers,
        checkedAHosts,
        checkedTxtHosts,
        expectedTxt,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("Error:", error);
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

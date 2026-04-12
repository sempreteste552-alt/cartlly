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
  try {
    const response = await fetch(`https://dns.google/resolve?name=${encodeURIComponent(name)}&type=${type}`);
    return await response.json();
  } catch (e) {
    console.error(`DNS Resolution Error (${type} for ${name}):`, e);
    return {};
  }
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
    aRecords,
    cnameRecords,
    matchedBy,
    matched: matchedBy !== null,
  };
}

async function checkHttps(domain: string) {
  let lastError = null;
  // Try with different protocols and methods
  const methods = ["HEAD", "GET"];
  for (const method of methods) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      
      const response = await fetch(`https://${domain}`, {
        method,
        redirect: "manual",
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);

      if (response.status >= 200 && response.status < 500) {
        return { ready: true, error: null };
      }
    } catch (error: any) {
      lastError = error.message;
    }
  }

  return { ready: false, error: lastError || "SSL certificate not yet active or untrusted" };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { settingsId, domain, domainId } = await req.json();
    const requestedDomain = sanitizeDomain(domain || "");

    if (!settingsId || !requestedDomain) {
      return new Response(JSON.stringify({ error: "Missing settingsId or domain" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const apexDomain = requestedDomain.replace(/^www\./, "");
    const aHosts = Array.from(new Set([requestedDomain, apexDomain].filter(Boolean)));
    const txtHosts = Array.from(new Set([`_lovable.${requestedDomain}`, `_lovable.${apexDomain}`]));

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // 1. Fetch domain info
    let domainRecord;
    if (domainId) {
      const { data } = await supabase.from("store_domains").select("*").eq("id", domainId).single();
      domainRecord = data;
    } else {
      const { data } = await supabase.from("store_domains").select("*").eq("store_id", settingsId).eq("hostname", requestedDomain).single();
      domainRecord = data;
    }

    const verificationToken = domainRecord?.verification_token || settingsId;
    const possibleTxts = [
      `lovable_verify=${verificationToken}`,
      verificationToken,
      `lovable_verify=${settingsId}`,
      settingsId,
    ];

    let aRecordFound = false;
    let txtRecordFound = false;
    let checkedAHosts = [];
    let checkedTxtHosts = [];

    // Check A/CNAME records
    for (const host of aHosts) {
      const resolution = await inspectHostResolution(host);
      checkedAHosts.push(resolution);
      if (resolution.matched) aRecordFound = true;
    }

    // Check TXT records
    for (const host of txtHosts) {
      const txtData = await resolveDns(host, "TXT");
      const records = (txtData.Answer || []).map((r: any) => String(r.data || "").replace(/["']/g, "").trim());
      checkedTxtHosts.push({ host, records });
      if (records.some((record) => possibleTxts.some(p => record.includes(p) || p.includes(record)))) {
        txtRecordFound = true;
      }
    }

    const dnsVerified = aRecordFound;
    const { ready: sslReady, error: sslError } = dnsVerified ? await checkHttps(requestedDomain) : { ready: false, error: "DNS incomplete" };
    
    // Status Mapping
    // pending_dns: No A record found
    // pending_verification: A record found but TXT missing
    // pending_ssl: DNS/TXT ok but SSL failing
    // active: All ok
    let newStatus = "failed";
    if (sslReady) {
      newStatus = "active";
    } else if (dnsVerified && txtRecordFound) {
      newStatus = "pending_ssl";
    } else if (dnsVerified) {
      newStatus = "pending_verification";
    } else {
      newStatus = "pending_dns";
    }

    const updateData = {
      status: newStatus,
      txt_status: txtRecordFound ? "verified" : "pending",
      dns_status: aRecordFound ? "propagated" : "pending",
      ssl_status: sslReady ? "active" : (dnsVerified && txtRecordFound ? "pending" : "failed"),
      is_published: sslReady && domainRecord?.is_primary,
      last_verified_at: new Date().toISOString(),
      last_ssl_error: sslError,
    };

    if (sslReady) {
      (updateData as any).ssl_issued_at = new Date().toISOString();
    }

    if (domainRecord) {
      await supabase.from("store_domains").update(updateData).eq("id", domainRecord.id);
    }

    // Legacy support update for store_settings
    await supabase
      .from("store_settings")
      .update({
        domain_status: newStatus === "active" ? "verified" : "pending",
        domain_last_check: new Date().toISOString(),
        custom_domain: (newStatus === "active" && domainRecord?.is_primary) ? requestedDomain : undefined,
        domain_verify_details: {
          aRecord: aRecordFound,
          txtRecord: txtRecordFound,
          sslReady,
          dnsComplete: dnsVerified && txtRecordFound,
          status: newStatus,
          checkedAt: new Date().toISOString(),
        },
      })
      .eq("id", settingsId);

    return new Response(
      JSON.stringify({
        status: newStatus,
        txtStatus: updateData.txt_status,
        dnsStatus: updateData.dns_status,
        sslStatus: updateData.ssl_status,
        sslError,
        domain: requestedDomain,
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
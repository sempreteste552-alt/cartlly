// ============================================================
// Cartlly AI Gateway (provider-agnostic)
// ------------------------------------------------------------
// Camada central para TODAS as chamadas de IA da plataforma.
// Responsável por: validação de cota, seleção de provedor/modelo,
// chamada HTTP, parsing, métricas (latência, tokens, custo) e
// log persistente em ai_usage_logs.
//
// Erros estruturados (sempre lançados como Error com prefixo):
//   AI_BLOCKED:<motivo>           -> tenant sem permissão/cota
//   INSUFFICIENT_AI_CREDITS       -> sem créditos (HTTP 402-like)
//   AI_RATE_LIMITED               -> rate limit do provedor (429)
//   AI_PROVIDER_ERROR:<status>    -> erro genérico do provedor
// ============================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

export interface AICallOptions {
  model?: string;
  messages: any[];
  temperature?: number;
  max_tokens?: number;
  response_format?: { type: string };
  tools?: any[];
  tool_choice?: any;
  feature?: string;
  store_user_id?: string;
  user_id?: string;
  stream?: boolean;
  /** Se true, NÃO valida cota (uso interno/super admin). Default: false. */
  skipQuotaCheck?: boolean;
}

export interface AICallResult {
  content: string;
  tool_calls?: any[];
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
  provider: string;
  model: string;
  latency_ms: number;
  estimated_cost: number;
}

// Modelo default oficial (memory: edge-functions-model-standard)
const DEFAULT_MODEL = "google/gemini-2.5-flash";

export async function callAI(
  options: AICallOptions
): Promise<AICallResult | Response> {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  const startedAt = Date.now();

  // 1. Validação de cota / permissão
  if (options.store_user_id && !options.skipQuotaCheck) {
    const { data: validation, error: vError } = await supabase.rpc("can_use_ai", {
      p_tenant_id: options.store_user_id,
      p_feature: options.feature || "other",
      p_estimated_cost: 0,
    });
    if (vError) {
      console.warn("[ai-service] can_use_ai error:", vError.message);
    } else if (validation && !validation[0]?.allowed) {
      const reason = validation[0]?.reason || "IA bloqueada";
      const code =
        reason.toLowerCase().includes("crédito") ||
        reason.toLowerCase().includes("credit")
          ? "INSUFFICIENT_AI_CREDITS"
          : "AI_BLOCKED";
      throw new Error(`${code}:${reason}`);
    }
  }

  // 2. Seleção de provedor (DB-driven, com fallback Lovable Gateway)
  const { data: activeProviders } = await supabase
    .from("ai_providers")
    .select("*")
    .eq("is_active", true)
    .order("created_at", { ascending: true });

  const providerData = activeProviders?.[0];
  let provider = (providerData?.name || "lovable").toLowerCase();
  let apiKey: string | undefined = providerData?.api_key;
  const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");

  // Se não há provedor configurado OU é "lovable", usa o gateway nativo
  const useLovableGateway =
    !providerData ||
    provider === "lovable" ||
    provider === "lovable-ai" ||
    !apiKey;

  const model =
    options.model ||
    providerData?.model_text_default ||
    DEFAULT_MODEL;

  let url = "";
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  let body: any = {
    model,
    messages: options.messages,
    temperature: options.temperature ?? 0.7,
    max_tokens: options.max_tokens,
    stream: options.stream || false,
  };
  if (options.response_format) body.response_format = options.response_format;
  if (options.tools) body.tools = options.tools;
  if (options.tool_choice) body.tool_choice = options.tool_choice;

  if (useLovableGateway) {
    provider = "lovable";
    url = "https://ai.gateway.lovable.dev/v1/chat/completions";
    headers["Authorization"] = `Bearer ${lovableApiKey}`;
  } else if (provider === "openai") {
    url = "https://api.openai.com/v1/chat/completions";
    headers["Authorization"] = `Bearer ${apiKey}`;
  } else if (provider === "anthropic") {
    url = "https://api.anthropic.com/v1/messages";
    headers["x-api-key"] = apiKey!;
    headers["anthropic-version"] = "2023-06-01";
    const systemMessage = options.messages.find((m) => m.role === "system")?.content;
    body = {
      model,
      system: systemMessage,
      messages: options.messages.filter((m) => m.role !== "system"),
      max_tokens: options.max_tokens || 4096,
      stream: options.stream || false,
    };
  } else if (provider === "google") {
    url = `https://generativelanguage.googleapis.com/v1beta/openai/chat/completions?key=${apiKey}`;
  } else {
    // Provedor desconhecido -> fallback gateway
    provider = "lovable";
    url = "https://ai.gateway.lovable.dev/v1/chat/completions";
    headers["Authorization"] = `Bearer ${lovableApiKey}`;
  }

  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });
  } catch (err: any) {
    await logUsage(supabase, {
      ...options,
      provider,
      model,
      status: "error",
      error_message: `network: ${err.message}`,
      latency_ms: Date.now() - startedAt,
    });
    throw new Error(`AI_PROVIDER_ERROR:network:${err.message}`);
  }

  if (!response.ok) {
    const errorText = await response.text().catch(() => "");
    const latency = Date.now() - startedAt;
    await logUsage(supabase, {
      ...options,
      provider,
      model,
      status: "error",
      error_message: `${response.status}: ${errorText.slice(0, 500)}`,
      latency_ms: latency,
    });

    if (response.status === 429) throw new Error("AI_RATE_LIMITED:rate limit do provedor");
    if (response.status === 402) throw new Error("INSUFFICIENT_AI_CREDITS:sem créditos no provedor");
    throw new Error(`AI_PROVIDER_ERROR:${response.status}:${errorText.slice(0, 200)}`);
  }

  if (options.stream) return response;

  const data = await response.json();
  let content = "";
  let tool_calls: any[] | undefined;
  let usage = { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 };

  if (provider === "anthropic") {
    content = data.content?.[0]?.text || "";
    usage = {
      prompt_tokens: data.usage?.input_tokens || 0,
      completion_tokens: data.usage?.output_tokens || 0,
      total_tokens:
        (data.usage?.input_tokens || 0) + (data.usage?.output_tokens || 0),
    };
  } else {
    const choice = data.choices?.[0]?.message;
    content = choice?.content || "";
    tool_calls = choice?.tool_calls;
    usage = {
      prompt_tokens: data.usage?.prompt_tokens || 0,
      completion_tokens: data.usage?.completion_tokens || 0,
      total_tokens: data.usage?.total_tokens || 0,
    };
  }

  const costFactor =
    providerData?.cost_per_text_token ||
    calculateFallbackCostFactor(provider, model);
  const estimated_cost = (usage.total_tokens / 1000) * costFactor;
  const latency_ms = Date.now() - startedAt;

  // Consome créditos (não bloqueia resposta se falhar)
  if (options.store_user_id && !options.skipQuotaCheck) {
    supabase
      .rpc("consume_ai_credits", {
        p_tenant_id: options.store_user_id,
        p_feature: options.feature || "other",
        p_tokens: usage.total_tokens,
        p_cost_usd: estimated_cost,
      })
      .then(({ error }: any) => {
        if (error) console.warn("[ai-service] consume_ai_credits failed:", error.message);
      });
  }

  // Log assíncrono
  logUsage(supabase, {
    ...options,
    provider,
    model,
    status: "success",
    usage,
    estimated_cost,
    latency_ms,
  });

  return {
    content,
    tool_calls,
    usage,
    provider,
    model,
    latency_ms,
    estimated_cost,
  };
}

// ------------------------------------------------------------
// Helpers
// ------------------------------------------------------------

function calculateFallbackCostFactor(provider: string, model: string): number {
  // USD por 1k tokens (média prompt+completion). Valores conservadores.
  if (model.includes("gemini-2.5-flash-lite")) return 0.0002;
  if (model.includes("gemini-2.5-flash")) return 0.0008;
  if (model.includes("gemini-2.5-pro")) return 0.005;
  if (model.includes("gpt-5-nano")) return 0.0003;
  if (model.includes("gpt-5-mini")) return 0.0015;
  if (model.includes("gpt-5")) return 0.015;
  if (model.includes("gpt-4o-mini")) return 0.0008;
  if (model.includes("gpt-4o")) return 0.012;
  return 0.001;
}

async function logUsage(
  supabase: any,
  payload: {
    user_id?: string;
    store_user_id?: string;
    provider: string;
    model: string;
    feature?: string;
    status: "success" | "error";
    usage?: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
    estimated_cost?: number;
    latency_ms?: number;
    error_message?: string;
  }
) {
  try {
    await supabase.from("ai_usage_logs").insert({
      user_id: payload.user_id,
      store_user_id: payload.store_user_id,
      provider: payload.provider,
      model: payload.model,
      feature: payload.feature || "other",
      status: payload.status,
      tokens_prompt: payload.usage?.prompt_tokens || 0,
      tokens_completion: payload.usage?.completion_tokens || 0,
      total_tokens: payload.usage?.total_tokens || 0,
      estimated_cost: payload.estimated_cost || 0,
      cost_billed: payload.estimated_cost || 0,
      latency_ms: payload.latency_ms || 0,
      error_message: payload.error_message,
    });
  } catch (e: any) {
    console.warn("[ai-service] log insert failed:", e?.message);
  }
}

/**
 * Helper para edge functions converterem erros do AI Gateway em respostas HTTP
 * padronizadas (JSON 200 para INSUFFICIENT_AI_CREDITS conforme memory).
 */
export function aiErrorToResponse(err: any, corsHeaders: Record<string, string>): Response {
  const msg = String(err?.message || err);
  const headers = { ...corsHeaders, "Content-Type": "application/json" };

  if (msg.startsWith("INSUFFICIENT_AI_CREDITS")) {
    return new Response(
      JSON.stringify({
        error: "INSUFFICIENT_AI_CREDITS",
        message: "⚠️ Sem créditos de IA no momento. Adicione créditos ou faça upgrade do plano.",
      }),
      { status: 200, headers }
    );
  }
  if (msg.startsWith("AI_RATE_LIMITED")) {
    return new Response(
      JSON.stringify({ error: "AI_RATE_LIMITED", message: "Muitas requisições, tente novamente em instantes." }),
      { status: 429, headers }
    );
  }
  if (msg.startsWith("AI_BLOCKED")) {
    return new Response(
      JSON.stringify({ error: "AI_BLOCKED", message: msg.replace("AI_BLOCKED:", "") }),
      { status: 200, headers }
    );
  }
  console.error("[ai-service] unhandled error:", msg);
  return new Response(
    JSON.stringify({ error: "AI_PROVIDER_ERROR", message: "Erro temporário na IA. Tente novamente." }),
    { status: 500, headers }
  );
}

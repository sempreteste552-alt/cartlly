import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// ========== PRIORITY SYSTEM ==========
type Priority = "high" | "medium" | "low";

const PRIORITY_CONFIG = {
  high: { bypassSoftLimit: true, minCooldownMinutes: 10 },   // cart, product_view
  medium: { bypassSoftLimit: false, minCooldownMinutes: 20 }, // inactivity
  low: { bypassSoftLimit: false, minCooldownMinutes: 30 },    // promotions
};

// Frequency presets (admin-configurable via automation_rules.max_sends_per_day)
const FREQUENCY_PRESETS: Record<string, { softDailyLimit: number; cooldownMinutes: number }> = {
  low: { softDailyLimit: 8, cooldownMinutes: 30 },
  medium: { softDailyLimit: 12, cooldownMinutes: 20 },
  aggressive: { softDailyLimit: 20, cooldownMinutes: 10 },
};

function getFrequencyConfig(maxSendsPerDay: number | null) {
  if (!maxSendsPerDay) return FREQUENCY_PRESETS.medium;
  if (maxSendsPerDay <= 3) return { softDailyLimit: maxSendsPerDay, cooldownMinutes: 60 };
  if (maxSendsPerDay <= 5) return { softDailyLimit: maxSendsPerDay, cooldownMinutes: 30 };
  if (maxSendsPerDay <= 8) return FREQUENCY_PRESETS.low;
  if (maxSendsPerDay <= 12) return FREQUENCY_PRESETS.medium;
  return FREQUENCY_PRESETS.aggressive;
}

// ========== ANTI-SPAM LOGIC ==========
async function shouldSkipAntiSpam(
  supabase: any,
  customerId: string,
  productId: string | null,
  triggerCount: number,
  priority: Priority,
  freqConfig: { softDailyLimit: number; cooldownMinutes: number },
  triggerType?: string
): Promise<{ skip: boolean; reason?: string }> {
  // Specific limit: use freqConfig or default to 5 for high priority types
  const typeLimit = freqConfig.softDailyLimit || 5;
  if (triggerType === "abandoned_cart" || triggerType === "product_view" || triggerType === "wishlist_reminder") {
    if (triggerCount >= typeLimit) {
      return { skip: true, reason: "type_daily_limit" };
    }
  }

  // Hard ceiling for any single type
  if (triggerCount >= 25) {
    return { skip: true, reason: "hard_daily_ceiling" };
  }

  // Check cooldown: last push must be > cooldownMinutes ago
  // Hourly engagement has its own 60min cooldown
  const cooldown = triggerType === "hourly_engagement" 
    ? 60 
    : Math.max(PRIORITY_CONFIG[priority].minCooldownMinutes, freqConfig.cooldownMinutes);
    
  const cooldownCutoff = new Date(Date.now() - cooldown * 60 * 1000).toISOString();
  
  let recentQuery = supabase
    .from("automation_executions")
    .select("id")
    .eq("customer_id", customerId)
    .eq("status", "sent")
    .gte("sent_at", cooldownCutoff);

  // If hourly engagement, only check against other hourly engagements
  if (triggerType === "hourly_engagement") {
    recentQuery = recentQuery.eq("trigger_type", "hourly_engagement");
  }

  const { data: recentPush } = await recentQuery.limit(1);

  if (recentPush && recentPush.length > 0) {
    return { skip: true, reason: "cooldown" };
  }

  // Anti-spam: skip if user ignored last 5 pushes (more lenient for hourly)
  const ignoredLimit = triggerType === "hourly_engagement" ? 10 : 3;
  const { data: lastPushes } = await supabase
    .from("automation_executions")
    .select("clicked_at")
    .eq("customer_id", customerId)
    .eq("status", "sent")
    .order("sent_at", { ascending: false })
    .limit(ignoredLimit);

  if (lastPushes && lastPushes.length >= ignoredLimit) {
    const allIgnored = lastPushes.every((p: any) => !p.clicked_at);
    if (allIgnored) {
      return { skip: true, reason: "ignored_consecutive" };
    }
  }

  // Anti-spam: don't repeat same product within 1 hour
  if (productId && triggerType !== "hourly_engagement") {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { data: recentProduct } = await supabase
      .from("automation_executions")
      .select("id")
      .eq("customer_id", customerId)
      .eq("related_product_id", productId)
      .gte("sent_at", oneHourAgo)
      .limit(1);
    if (recentProduct && recentProduct.length > 0) {
      return { skip: true, reason: "same_product_recently" };
    }
  }

  return { skip: false };
}

// ========== SEQUENCE DEFINITIONS ==========

interface SequenceStep {
  delayMinutes: number;
  intensity: "soft" | "medium" | "aggressive";
  templates: { title: string; body: string }[];
}

const PRODUCT_VIEW_SEQUENCE: SequenceStep[] = [
  {
    delayMinutes: 10, // 10 minutes after viewing
    intensity: "soft",
    templates: [
      { title: "👀 Gostou do {product}?", body: "{name}, o {product} chamou sua atenção na {store}? Que tal conferir de novo? ✨" },
      { title: "💭 Ainda pensando no {product}?", body: "Oi {name}! O {product} está esperando por você na {store}! 🛍️" },
      { title: "🌟 Notamos seu interesse!", body: "{name}, achamos que você adorou o {product}. Volte à {store} para ver mais! 💜" },
      { title: "✨ Detalhes do {product}", body: "Oi {name}! Sabia que o {product} é um dos mais buscados na {store}? Dê uma olhadinha! 😊" },
      { title: "💫 Uma escolha incrível!", body: "{name}, o {product} combina muito com seu estilo. Disponível na {store}! 🛒" },
      { title: "😍 Ficou na dúvida?", body: "{name}, o {product} da {store} é realmente especial. Quer tirar alguma dúvida? 💕" },
      { title: "🛍️ Lembra do {product}?", body: "Oi {name}! Vimos que você curtiu o {product} na {store}. Ele ainda está aqui! ✨" },
      { title: "💜 Espiadinha no {product}", body: "{name}, o {product} da {store} pode ser seu hoje. Que tal uma nova olhada? 😉" },
      { title: "🎯 No seu radar: {product}", body: "Oi {name}! O {product} da {store} continua disponível para você. Confira! 🌟" },
      { title: "🔖 Salvo pra você: {product}", body: "{name}, o {product} que você viu na {store} está reservado no seu histórico! 💫" },
    ],
  },
  {
    delayMinutes: 15, // +15 minutes (25m total)
    intensity: "soft",
    templates: [
      { title: "💡 Sabia disso sobre o {product}?", body: "{name}, o {product} na {store} tem detalhes que você vai amar. Confira! ✨" },
      { title: "✨ {product}: Feito pra você", body: "Oi {name}, o {product} na {store} é perfeito para o que você procura! 🛍️" },
      { title: "🔍 Olhe de perto o {product}", body: "{name}, veja as fotos reais do {product} na {store}. É apaixonante! 😍" },
      { title: "🌈 {product} em destaque", body: "Oi {name}, o {product} é a estrela da {store} hoje. Não deixe passar! 🌟" },
      { title: "🎀 Um mimo: {product}", body: "{name}, você merece o {product}! Garanta o seu na {store} agora. 🎁" },
      { title: "⭐ {product}: 5 estrelas!", body: "{name}, o {product} da {store} é super bem avaliado. Veja os comentários! ✅" },
      { title: "🍭 Doce desejo: {product}", body: "Oi {name}, que tal se presentear com o {product} da {store} hoje? 🍬" },
      { title: "🌊 {product}: Sinta a diferença", body: "{name}, a qualidade do {product} na {store} vai te surpreender! 💎" },
      { title: "🍃 {product}: Leveza e estilo", body: "Oi {name}, o {product} da {store} traz o equilíbrio que você busca. ✨" },
      { title: "🎨 Combine com {product}", body: "{name}, o {product} da {store} fica ótimo com tudo. Experimente! 👗" },
    ],
  },
  {
    delayMinutes: 30, // +30 minutes (55m total)
    intensity: "medium",
    templates: [
      { title: "🔥 {product} está voando!", body: "{name}, o {product} da {store} está com estoque baixíssimo! Garanta o seu ⚡" },
      { title: "⚡ Não perca o {product}!", body: "{name}! A demanda pelo {product} na {store} aumentou muito. Corra! 🏃" },
      { title: "⏰ {product} saindo agora!", body: "Alerta {name}! O {product} da {store} está sendo muito visualizado. Aproveite! 🔥" },
      { title: "🚨 Últimas unidades: {product}", body: "{name}, restam pouquíssimos {product} na {store}! Não fique sem o seu 💨" },
      { title: "📢 {product}: Alta procura!", body: "{name}, o {product} da {store} pode esgotar a qualquer momento! ⚡" },
      { title: "🏃 Corra pelo {product}!", body: "{name}, outros clientes estão de olho no {product} da {store}. Seja rápido! 🔥" },
      { title: "⚠️ {product} quase esgotado", body: "{name}! O {product} está saindo rápido da {store}. Garanta agora! 💫" },
      { title: "🔥 Sucesso total: {product}!", body: "{name}, o {product} da {store} é o queridinho do momento! Corre! 🏃" },
      { title: "💥 {product} vai acabar!", body: "Ei {name}! O {product} é sucesso na {store}. Garanta antes que acabe de vez! ⚡" },
      { title: "🌡️ Clima quente para {product}", body: "{name}, todo mundo quer o {product} da {store} hoje! Não perca 🔥" },
    ],
  },
];

const CART_ABANDONMENT_SEQUENCE: SequenceStep[] = [
  {
    delayMinutes: 30,
    intensity: "soft",
    templates: [
      { title: "🛒 Esqueceu algo no carrinho?", body: "{name}, seus itens na {store} estão te esperando! Finalize sua compra 😊" },
      { title: "💭 Seu carrinho te espera!", body: "Oi {name}! Você deixou itens especiais no carrinho da {store}. Volte! 🛍️" },
      { title: "🛍️ Itens reservados pra você!", body: "{name}, guardamos seu carrinho na {store}! Que tal finalizar? ✨" },
      { title: "😊 Voltando pra finalizar?", body: "{name}, seu carrinho na {store} está pronto! Só falta clicar em comprar 💜" },
      { title: "🔖 Carrinho salvo, {name}!", body: "Seus itens na {store} estão guardadinhos esperando você finalizar! 🛒" },
      { title: "💫 Falta pouco, {name}!", body: "Seu carrinho na {store} está quase completo. Finalize sua compra! ✨" },
      { title: "🎁 Seus itens te esperam!", body: "{name}, não esquece do seu carrinho na {store}! Está tudo pronto 🛍️" },
      { title: "💜 Guardamos pra você!", body: "Oi {name}! Seu carrinho na {store} está salvo. Volte quando quiser! 😊" },
      { title: "🛒 Carrinho pronto!", body: "{name}, seus produtos na {store} estão prontos para envio! Finalize 💫" },
      { title: "✨ Quase lá, {name}!", body: "Falta só um clique! Seu carrinho na {store} está esperando 🛒💜" },
    ],
  },
  {
    delayMinutes: 120,
    intensity: "medium",
    templates: [
      { title: "⏰ Seu carrinho vai expirar!", body: "{name}, os itens no seu carrinho da {store} podem esgotar! Finalize agora ⚡" },
      { title: "🔥 Itens do carrinho sumindo!", body: "{name}! Outros clientes estão comprando os mesmos itens da {store}. Corra! 🏃" },
      { title: "⚡ Carrinho em risco!", body: "{name}, seu carrinho na {store} tem itens com estoque baixo! Não perca! 🔥" },
      { title: "📢 Alerta: carrinho expirando!", body: "{name}, seus itens na {store} estão com alta procura! Garanta agora ⏰" },
      { title: "🚨 Itens quase esgotados!", body: "{name}! Os produtos do seu carrinho na {store} estão acabando. CORRA! ⚡" },
      { title: "🏃 Seus itens estão voando!", body: "{name}, o estoque dos seus itens na {store} está caindo rápido! Finalize 🔥" },
      { title: "⚠️ Carrinho sob risco!", body: "{name}, não garantimos os itens do seu carrinho na {store} por muito tempo! ⏰" },
      { title: "🔥 Demanda alta no carrinho!", body: "{name}, outros compradores querem seus itens na {store}! Finalize já ⚡" },
      { title: "💨 Carrinho pode esvaziar!", body: "{name}! Itens do seu carrinho na {store} com estoque crítico. Garanta! 🚨" },
      { title: "⏳ Tempo limitado!", body: "{name}, seu carrinho na {store} está com itens quase esgotados. Finalize! 🏃" },
    ],
  },
  {
    delayMinutes: 720,
    intensity: "aggressive",
    templates: [
      { title: "🚨 ÚLTIMA CHANCE: seu carrinho!", body: "{name}, é AGORA ou NUNCA! Seus itens na {store} vão acabar! FINALIZE JÁ 🔥" },
      { title: "⛔ CARRINHO EXPIRANDO!", body: "ATENÇÃO {name}! Seu carrinho na {store} será limpo em breve. COMPRE AGORA! ⚡" },
      { title: "💣 SÓ HOJE: finalize!", body: "{name}, ÚLTIMA OPORTUNIDADE de finalizar seu carrinho na {store}! VÁ AGORA 🏃" },
      { title: "🔴 URGENTE: carrinho!", body: "{name}! Seus itens na {store} estão nas ÚLTIMAS unidades. FINALIZE AGORA! 💨" },
      { title: "⏳ TEMPO ACABANDO!", body: "{name}, seu carrinho na {store} será removido em breve! COMPRE ANTES QUE ACABE! 🚨" },
      { title: "🆘 SALVE SEU CARRINHO!", body: "ÚLTIMA CHAMADA {name}! Finalize agora na {store} ou perca seus itens! 🔥" },
      { title: "💀 CARRINHO EM PERIGO!", body: "{name}, seus itens na {store} estão quase ESGOTADOS! É AGORA! COMPRE JÁ ⚡" },
      { title: "🔥 FINALIZAR AGORA!", body: "{name}! Última chance de salvar seu carrinho na {store}. NÃO PERCA! 🏃💨" },
      { title: "⚡ AGORA OU PERDE TUDO!", body: "{name}, o carrinho na {store} não vai esperar mais! GARANTA SEUS ITENS! 🚨" },
      { title: "🎯 DECISÃO FINAL!", body: "{name}, é sua ÚLTIMA CHANCE na {store}! Finalize ou perca tudo! COMPRE AGORA 💥" },
    ],
  },
];

const WISHLIST_SEQUENCE: SequenceStep[] = [
  {
    delayMinutes: 30, // 30m after favoriting
    intensity: "soft",
    templates: [
      { title: "❤️ No seu radar: {product}", body: "{name}, o {product} que você favoritou na {store} ainda está aqui! ✨" },
      { title: "⭐ Uma escolha brilhante!", body: "Oi {name}! O {product} nos seus favoritos combina muito com você. Confira na {store}! 🛍️" },
      { title: "💭 Lembra do {product}?", body: "{name}, o {product} que você favoritou na {store} está te esperando! 💜" },
      { title: "✨ Favoritado pra você!", body: "Oi {name}, guardamos o {product} nos seus favoritos na {store}. Que tal levá-lo agora? 😊" },
    ],
  },
  {
    delayMinutes: 180, // 3 hours (total)
    intensity: "medium",
    templates: [
      { title: "🎁 {product}: Tratamento VIP!", body: "{name}, seu favorito {product} está com alta procura na {store}. Garanta o seu! 🔥" },
      { title: "⚡ Não perca seu favorito!", body: "Oi {name}! O {product} da sua lista de desejos na {store} está voando! 🏃" },
      { title: "🔥 Favorito em destaque!", body: "{name}, o {product} que você amou na {store} é sucesso absoluto! Garanta o seu. 💫" },
    ],
  },
  {
    delayMinutes: 720, // 12 hours (total)
    intensity: "aggressive",
    templates: [
      { title: "🚨 Última chance: {product}!", body: "{name}, o {product} nos seus favoritos na {store} está quase esgotado! Compre agora ⚡" },
      { title: "⚠️ Favorito em risco!", body: "Atenção {name}! O {product} da sua lista na {store} pode acabar a qualquer momento! 💨" },
      { title: "🛑 AGORA OU NUNCA: {product}", body: "{name}, o estoque do seu favorito {product} na {store} está no fim! CORRA! 🔥" },
    ],
  },
];

const HOURLY_ENGAGEMENT_TEMPLATES = [
  // Morning (8h - 12h)
  { title: "☀️ Bom dia, {name}!", body: "Que sua {day} comece maravilhosa! Já viu as novidades na {store}? 🛍️", hourStart: 8, hourEnd: 12 },
  { title: "☕ Café e {store}!", body: "Nada melhor que um café e uma espiadinha nas ofertas da {store}. Aproveite! ✨", hourStart: 8, hourEnd: 11 },
  
  // Afternoon (12h - 18h)
  { title: "🌈 Boa tarde, {name}!", body: "Passando para desejar uma ótima {day}. Que tal um mimo na {store} hoje? 💜", hourStart: 12, hourEnd: 18 },
  { title: "🍕 Pausa do almoço?", body: "{name}, aproveite sua pausa para conferir o que chegou na {store}! 🌟", hourStart: 12, hourEnd: 14 },
  
  // Evening (18h - 23h)
  { title: "🌙 Boa noite, {name}!", body: "Finalize sua {day} com chave de ouro na {store}. Você merece! ✨", hourStart: 18, hourEnd: 23 },
  { title: "🧸 Hora de relaxar!", body: "{name}, relaxe e veja as promoções que separamos para você na {store} 💤🛍️", hourStart: 20, hourEnd: 23 },
  
  // Weekend
  { title: "🎉 Final de semana chegou!", body: "{name}, aproveite o sábado para garantir seus favoritos na {store}! 🎈", dayOfWeek: [6] },
  { title: "🏖️ Domingo de ofertas!", body: "Oi {name}! Que tal renovar seus itens na {store} hoje? Bom descanso! ☀️", dayOfWeek: [0] },
  
  // General
  { title: "✨ Momento de brilhar!", body: "Oi {name}! Que tal um presente hoje na {store}? Você merece tudo de bom! 💜" },
  { title: "💫 Novidades chegando!", body: "{name}, a {store} está cheia de coisas lindas hoje. Vem ver! 🌟" },
];

const INACTIVITY_SEQUENCE: SequenceStep[] = [
  {
    delayMinutes: 120,
    intensity: "soft",
    templates: [
      { title: "👋 Voltou, {name}?", body: "Sentimos sua falta na {store}! Tem novidades te esperando ✨" },
      { title: "😊 Oi, {name}!", body: "Faz um tempinho que não te vemos na {store}. Vem conferir! 🛍️" },
      { title: "💜 Saudades, {name}!", body: "A {store} preparou coisas novas pra você! Venha dar uma olhada 🌟" },
      { title: "🌟 Novidades pra você!", body: "{name}, muita coisa nova chegou na {store}! Confira agora ✨" },
      { title: "🎁 Surpresas na {store}!", body: "Oi {name}! Temos novidades especiais esperando por você 💫" },
      { title: "✨ Coisas novas na {store}!", body: "{name}, a {store} se renovou! Venha ver o que há de novo 🛍️" },
      { title: "💫 {name}, venha ver!", body: "A {store} tem novidades incríveis! Não perca as últimas adições ✨" },
      { title: "🛍️ Produtos fresquinhos!", body: "{name}, a {store} acabou de receber novidades! Dê uma olhada 😊" },
    ],
  },
  {
    delayMinutes: 360,
    intensity: "medium",
    templates: [
      { title: "🔥 {name}, você está perdendo!", body: "Ofertas imperdíveis na {store} agora! Não fique de fora ⚡" },
      { title: "⚡ Promoções rolando!", body: "{name}, a {store} está com ofertas especiais AGORA! Confira antes que acabe 🔥" },
      { title: "📢 Alerta de ofertas!", body: "{name}! A {store} preparou descontos exclusivos. Aproveite! 🏃" },
      { title: "🏷️ Descontos limitados!", body: "{name}, ofertas exclusivas na {store} por TEMPO LIMITADO! Corra! ⚡" },
      { title: "💰 Economia na {store}!", body: "{name}, aproveite as promoções da {store} antes que acabem! 🔥" },
      { title: "🎯 Feito pra você!", body: "{name}, selecionamos ofertas especiais na {store} baseadas no seu gosto! ⚡" },
      { title: "🔥 Está perdendo muito!", body: "{name}! A {store} tem promoções que você NÃO pode perder! Confira 🏃" },
      { title: "⏰ Ofertas expirando!", body: "{name}, as promoções da {store} estão acabando! Aproveite agora 🔥" },
    ],
  },
  {
    delayMinutes: 1440,
    intensity: "aggressive",
    templates: [
      { title: "🚨 ÚLTIMA CHANCE, {name}!", body: "Suas ofertas exclusivas na {store} EXPIRAM HOJE! NÃO PERCA! ACESSE AGORA 🔥" },
      { title: "⛔ EXPIRANDO HOJE!", body: "{name}, ÚLTIMA OPORTUNIDADE na {store}! Ofertas vão embora à meia-noite! VÁ AGORA ⚡" },
      { title: "💣 SÓ HOJE na {store}!", body: "{name}, promoções EXCLUSIVAS na {store} acabam HOJE! APROVEITE AGORA! 🏃" },
      { title: "🔴 URGENTE, {name}!", body: "Ofertas IMPERDÍVEIS na {store} terminam em horas! NÃO DEIXE ESCAPAR! 🚨" },
      { title: "⏳ ÚLTIMAS HORAS!", body: "{name}, as ofertas da {store} acabam HOJE! É agora ou nunca! CORRA! 🔥" },
      { title: "🆘 NÃO PERCA, {name}!", body: "ÚLTIMA CHAMADA! Ofertas exclusivas na {store} expirando! ACESSE AGORA! ⚡" },
      { title: "💥 OFERTA FINAL!", body: "{name}, a {store} fez uma oferta IMPERDÍVEL que acaba HOJE! VÁ AGORA! 🏃" },
      { title: "🎯 AGORA OU NUNCA!", body: "{name}, as melhores ofertas da {store} expiram em breve! GARANTA JÁ! 🚨" },
    ],
  },
];

// Promotional campaign templates for trending/random products
const PROMO_CAMPAIGN_TEMPLATES = [
  { title: "🔥 Em alta na {store}!", body: "{name}, o {product} é tendência! Confira na {store} ⚡" },
  { title: "👀 Você vai adorar isso!", body: "{name}, dê uma olhada no {product} na {store}! 🛍️" },
  { title: "⚡ Novidades chegaram!", body: "{name}, o {product} acabou de chegar na {store}! Veja 🌟" },
  { title: "🌟 Recomendado pra você!", body: "{name}, selecionamos o {product} especialmente pra você na {store} ✨" },
  { title: "💎 Destaque da {store}!", body: "{name}, o {product} é um dos favoritos! Confira 🔥" },
  { title: "🛍️ Imperdível na {store}!", body: "{name}, o {product} está fazendo sucesso! Garanta o seu ⚡" },
  { title: "✨ Top vendas: {product}!", body: "{name}, esse produto é queridinho na {store}! Veja 💫" },
  { title: "🎯 Feito pra você!", body: "{name}, achamos que o {product} combina com você. Confira na {store}! 😊" },
  { title: "💫 Não perca: {product}!", body: "{name}, o {product} da {store} está com ótima demanda! 🔥" },
  { title: "🏷️ Oportunidade: {product}!", body: "{name}, o {product} na {store} pode ser a escolha certa! 🛒" },
];

// ========== MAIN HANDLER ==========

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabase = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");

    const results = {
      product_view: { processed: 0, sent: 0, skipped: 0 },
      cart_abandonment: { processed: 0, sent: 0, skipped: 0 },
      wishlist_reminder: { processed: 0, sent: 0, skipped: 0 },
      inactivity: { processed: 0, sent: 0, skipped: 0 },
      hourly_engagement: { processed: 0, sent: 0, skipped: 0 },
      promo_campaign: { processed: 0, sent: 0, skipped: 0 },
      sequences_created: 0,
      sequences_advanced: 0,
      anti_spam_blocked: 0,
    };

    // ========== LOAD STORE FREQUENCY CONFIGS ==========
    const { data: allRules } = await supabase
      .from("automation_rules")
      .select("user_id, max_sends_per_day, enabled, trigger_type")
      .eq("enabled", true);
    
    const storeFreqMap = new Map<string, { softDailyLimit: number; cooldownMinutes: number }>();
    for (const r of allRules || []) {
      if (!storeFreqMap.has(r.user_id)) {
        storeFreqMap.set(r.user_id, getFrequencyConfig(r.max_sends_per_day));
      }
    }
    const defaultFreq = FREQUENCY_PRESETS.medium;

    // ========== LOAD STORE SETTINGS (Global Map) ==========
    const { data: allStores } = await supabase
      .from("store_settings")
      .select("user_id, store_name, store_slug");
    const storeMap = new Map((allStores || []).map((s: any) => [s.user_id, s]));

    // ========== LOAD DAILY COUNTS FOR ALL CUSTOMERS ==========
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const { data: todayExecsAll } = await supabase
      .from("automation_executions")
      .select("customer_id, trigger_type")
      .eq("status", "sent")
      .gte("sent_at", today.toISOString())
      .limit(10000); // Increased limit for counts
    
    // triggerCountsByCustomer: customer_id -> trigger_type -> count
    const triggerCountsByCustomer = new Map<string, Map<string, number>>();
    (todayExecsAll || []).forEach((e: any) => {
      if (e.customer_id) {
        if (!triggerCountsByCustomer.has(e.customer_id)) {
          triggerCountsByCustomer.set(e.customer_id, new Map());
        }
        const counts = triggerCountsByCustomer.get(e.customer_id)!;
        counts.set(e.trigger_type, (counts.get(e.trigger_type) || 0) + 1);
      }
    });

    // ========== 1) PROCESS EXISTING SEQUENCES ==========
    const now = new Date();
    const { data: activeSeqs } = await supabase
      .from("retargeting_sequences")
      .select("*")
      .eq("status", "active")
      .lte("next_push_at", now.toISOString())
      .limit(100);

    if (activeSeqs && activeSeqs.length > 0) {
      const customerIds = [...new Set(activeSeqs.map((s: any) => s.customer_id))];
      const { data: customers } = await supabase
        .from("customers")
        .select("id, name, auth_user_id, store_user_id")
        .in("id", customerIds);
      const customerMap = new Map((customers || []).map((c: any) => [c.id, c]));

      const productIds = [...new Set(activeSeqs.map((s: any) => s.product_id).filter(Boolean))];
      const { data: products } = await supabase
        .from("products")
        .select("id, name, price, image_url")
        .in("id", productIds.length > 0 ? productIds : ["00000000-0000-0000-0000-000000000000"]);
      const productMap = new Map((products || []).map((p: any) => [p.id, p]));

      const storeIds = [...new Set(activeSeqs.map((s: any) => s.store_user_id))];
      // storeMap is now global


      // Check if customers purchased the product (stop sequence)
      const { data: recentOrders } = await supabase
        .from("order_items")
        .select("product_id, order_id")
        .in("product_id", productIds.length > 0 ? productIds : ["00000000-0000-0000-0000-000000000000"]);
      const purchasedProducts = new Set((recentOrders || []).map((o: any) => o.product_id));

      for (const seq of activeSeqs) {
        const customer = customerMap.get(seq.customer_id);
        if (!customer?.auth_user_id) {
          await supabase.from("retargeting_sequences").update({ status: "stopped", stopped_reason: "no_auth" }).eq("id", seq.id);
          continue;
        }

        // Determine sequence type and priority
        const seqMeta = seq.metadata as any || {};
        const seqType = seqMeta?.sequence_type || "product_view";
        
        let priority: Priority;
        let sequenceDef: SequenceStep[];
        let triggerType: string;

        if (seqType === "cart_abandonment") {
          sequenceDef = CART_ABANDONMENT_SEQUENCE;
          triggerType = "abandoned_cart";
          priority = "high";
        } else if (seqType === "wishlist") {
          sequenceDef = WISHLIST_SEQUENCE;
          triggerType = "wishlist_reminder";
          priority = "high";
        } else if (seqType === "inactivity") {
          sequenceDef = INACTIVITY_SEQUENCE;
          triggerType = "inactivity";
          priority = "medium";
        } else {
          sequenceDef = PRODUCT_VIEW_SEQUENCE;
          triggerType = "product_view";
          priority = "high";
        }

        // Smart rate limiting via anti-spam
        const userCounts = triggerCountsByCustomer.get(seq.customer_id);
        const triggerCount = userCounts?.get(triggerType) || 0;
        
        const freqConfig = storeFreqMap.get(seq.store_user_id) || defaultFreq;
        const spamCheck = await shouldSkipAntiSpam(supabase, seq.customer_id, seq.product_id, triggerCount, priority, freqConfig, triggerType);
        
        if (spamCheck.skip) {
          // Reschedule with short delays
          const rescheduleMinutes = spamCheck.reason === "cooldown" ? 30 : 60;
          const nextTime = new Date(Date.now() + rescheduleMinutes * 60 * 1000).toISOString();
          await supabase.from("retargeting_sequences").update({ next_push_at: nextTime }).eq("id", seq.id);
          results.anti_spam_blocked++;
          continue;
        }

        // Check if purchased → stop
        if (seq.product_id && purchasedProducts.has(seq.product_id)) {
          await supabase.from("retargeting_sequences").update({ status: "converted", stopped_reason: "purchased" }).eq("id", seq.id);
          continue;
        }

        const stepIndex = seq.current_step;
        if (stepIndex >= sequenceDef.length || stepIndex >= seq.max_steps) {
          await supabase.from("retargeting_sequences").update({ status: "completed", stopped_reason: "all_steps_done" }).eq("id", seq.id);
          continue;
        }

        const step = sequenceDef[stepIndex];
        const product = productMap.get(seq.product_id);
        const store = storeMap.get(seq.store_user_id);
        const storeName = store?.store_name || store?.store_slug || "nossa loja";
        const productName = product?.name || "";

        // Pick message
        let msg: { title: string; body: string };

        if (lovableApiKey && (seqType === "product_view" || seqType === "cart_abandonment" || seqType === "pending_order")) {
          try {
            msg = await generateAISequenceMessage(lovableApiKey, {
              customerName: customer.name,
              productName,
              productPrice: product?.price,
              storeName,
              step: stepIndex + 1,
              totalSteps: seq.max_steps,
              intensity: step.intensity,
              sequenceType: seqType,
            });
          } catch {
            msg = pickVariedMessage(step.templates, customer.name, productName, storeName, stepIndex, seq.customer_id, seq.product_id);
          }
        } else {
          msg = pickVariedMessage(step.templates, customer.name, productName, storeName, stepIndex, seq.customer_id, seq.product_id);
        }

        // Send push
        try {
          const pushResp = await fetch(`${supabaseUrl}/functions/v1/send-push-internal`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              target_user_id: customer.auth_user_id,
              title: msg.title,
              body: msg.body,
              url: "/",
              type: triggerType,
              store_user_id: seq.store_user_id,
            }),
          });
          const pushData = await pushResp.json();

          const wasSent = pushData.sent > 0;

          await supabase.from("automation_executions").insert({
            user_id: seq.store_user_id,
            customer_id: seq.customer_id,
            trigger_type: triggerType,
            channel: "push",
            message_text: `[Step ${stepIndex + 1}/${seq.max_steps} ${step.intensity}] ${msg.title} — ${msg.body}`,
            ai_generated: !!lovableApiKey,
            status: wasSent ? "sent" : "failed",
            error_message: wasSent ? null : JSON.stringify(pushData).slice(0, 200),
            related_product_id: seq.product_id,
          });

          // Update daily count in memory
          if (wasSent) {
            const counts = triggerCountsByCustomer.get(seq.customer_id) || new Map();
            counts.set(triggerType, (counts.get(triggerType) || 0) + 1);
            triggerCountsByCustomer.set(seq.customer_id, counts);
          }

          // Advance sequence
          const nextStep = stepIndex + 1;
          if (nextStep >= sequenceDef.length || nextStep >= seq.max_steps) {
            await supabase.from("retargeting_sequences").update({
              status: "completed",
              stopped_reason: "all_steps_done",
              current_step: nextStep,
              pushes_sent: seq.pushes_sent + 1,
              last_push_at: now.toISOString(),
            }).eq("id", seq.id);
          } else {
            const nextDelay = sequenceDef[nextStep].delayMinutes;
            const nextPushAt = new Date(Date.now() + nextDelay * 60 * 1000).toISOString();
            await supabase.from("retargeting_sequences").update({
              current_step: nextStep,
              pushes_sent: seq.pushes_sent + 1,
              last_push_at: now.toISOString(),
              next_push_at: nextPushAt,
            }).eq("id", seq.id);
          }

          results.sequences_advanced++;
          if (seqType === "product_view") {
            results.product_view.processed++;
            wasSent ? results.product_view.sent++ : results.product_view.skipped++;
          } else if (seqType === "cart_abandonment") {
            results.cart_abandonment.processed++;
            wasSent ? results.cart_abandonment.sent++ : results.cart_abandonment.skipped++;
          } else if (seqType === "wishlist") {
            results.wishlist_reminder.processed++;
            wasSent ? results.wishlist_reminder.sent++ : results.wishlist_reminder.skipped++;
          } else {
            results.inactivity.processed++;
            wasSent ? results.inactivity.sent++ : results.inactivity.skipped++;
          }
        } catch (err: any) {
          console.error(`Sequence push error ${seq.id}:`, err);
        }
      }
    }

    // ========== 2) CREATE NEW PRODUCT VIEW SEQUENCES ==========
    const pvStart = new Date(Date.now() - 30 * 60 * 1000).toISOString();
    const pvEnd = new Date(Date.now() - 10 * 60 * 1000).toISOString();

    const { data: viewEvents } = await supabase
      .from("customer_behavior_events")
      .select("customer_id, product_id, user_id, created_at")
      .eq("event_type", "product_view")
      .gte("created_at", pvStart)
      .lte("created_at", pvEnd)
      .not("customer_id", "is", null)
      .not("product_id", "is", null);

    if (viewEvents && viewEvents.length > 0) {
      const uniqueViews = new Map<string, typeof viewEvents[0]>();
      for (const ev of viewEvents) {
        const key = `${ev.customer_id}:${ev.product_id}`;
        if (!uniqueViews.has(key)) uniqueViews.set(key, ev);
      }

      const custIds = [...new Set([...uniqueViews.values()].map(v => v.customer_id))];
      const { data: existingSeqs } = await supabase
        .from("retargeting_sequences")
        .select("customer_id, product_id, status")
        .in("customer_id", custIds)
        .in("status", ["active", "completed"]);
      const existingKeys = new Set((existingSeqs || []).map((s: any) => `${s.customer_id}:${s.product_id}`));

      const prodIds = [...new Set([...uniqueViews.values()].map(v => v.product_id))];
      const { data: purchasedItems } = await supabase
        .from("order_items")
        .select("product_id")
        .in("product_id", prodIds);
      const purchasedSet = new Set((purchasedItems || []).map((o: any) => o.product_id));

      for (const [key, ev] of uniqueViews) {
        if (existingKeys.has(key)) continue;
        if (purchasedSet.has(ev.product_id)) continue;

        const firstStepDelay = PRODUCT_VIEW_SEQUENCE[0].delayMinutes;
        const nextPushAt = new Date(Date.now() + firstStepDelay * 60 * 1000).toISOString();

        await supabase.from("retargeting_sequences").insert({
          customer_id: ev.customer_id,
          store_user_id: ev.user_id,
          product_id: ev.product_id,
          status: "active",
          current_step: 0,
          max_steps: PRODUCT_VIEW_SEQUENCE.length,
          next_push_at: nextPushAt,
          metadata: { sequence_type: "product_view" },
        });
        results.sequences_created++;
      }
    }

    // ========== 4) CREATE PENDING ORDER SEQUENCES (Salva Pedidos) ==========
    const orderCutoff = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { data: pendingOrders } = await supabase
      .from("orders")
      .select("id, customer_id, user_id, created_at")
      .eq("status", "pendente")
      .gt("created_at", orderCutoff)
      .not("customer_id", "is", null)
      .limit(50);

    if (pendingOrders && pendingOrders.length > 0) {
      const orderCustIds = pendingOrders.map((o: any) => o.customer_id);
      const { data: activeOrderSeqs } = await supabase
        .from("retargeting_sequences")
        .select("customer_id")
        .in("customer_id", orderCustIds)
        .eq("status", "active")
        .eq("metadata->>sequence_type", "pending_order");
      const hasActiveOrderSeq = new Set((activeOrderSeqs || []).map((s: any) => s.customer_id));

      for (const order of pendingOrders) {
        if (hasActiveOrderSeq.has(order.customer_id)) continue;

        const firstStepDelay = PENDING_ORDER_SEQUENCE[0].delayMinutes;
        const nextPushAt = new Date(Date.now() + firstStepDelay * 60 * 1000).toISOString();

        await supabase.from("retargeting_sequences").insert({
          customer_id: order.customer_id,
          store_user_id: order.user_id,
          product_id: null,
          status: "active",
          current_step: 0,
          max_steps: PENDING_ORDER_SEQUENCE.length,
          next_push_at: nextPushAt,
          metadata: { sequence_type: "pending_order", order_id: order.id },
        });
        results.sequences_created++;
      }
    }

    // ========== 3) CREATE CART ABANDONMENT SEQUENCES ==========
    const cartCutoff = new Date(Date.now() - 25 * 60 * 1000).toISOString();
    const { data: abandonedCarts } = await supabase
      .from("abandoned_carts")
      .select("id, customer_id, user_id, abandoned_at")
      .eq("recovered", false)
      .lt("abandoned_at", cartCutoff)
      .not("customer_id", "is", null)
      .limit(50);

    if (abandonedCarts && abandonedCarts.length > 0) {
      const cartCustIds = abandonedCarts.map((c: any) => c.customer_id);
      const { data: activeCartSeqs } = await supabase
        .from("retargeting_sequences")
        .select("customer_id")
        .in("customer_id", cartCustIds)
        .eq("status", "active");
      const hasActiveSeq = new Set((activeCartSeqs || []).map((s: any) => s.customer_id));

      for (const cart of abandonedCarts) {
        if (hasActiveSeq.has(cart.customer_id)) continue;

        const firstStepDelay = CART_ABANDONMENT_SEQUENCE[0].delayMinutes;
        const nextPushAt = new Date(Date.now() + firstStepDelay * 60 * 1000).toISOString();

        await supabase.from("retargeting_sequences").insert({
          customer_id: cart.customer_id,
          store_user_id: cart.user_id,
          product_id: null,
          status: "active",
          current_step: 0,
          max_steps: CART_ABANDONMENT_SEQUENCE.length,
          next_push_at: nextPushAt,
          metadata: { sequence_type: "cart_abandonment", cart_id: cart.id },
        });
        results.sequences_created++;
      }
    }
    // ========== 3.1) CREATE WISHLIST SEQUENCES ==========
    const wishlistCutoff = new Date(Date.now() - 30 * 60 * 1000).toISOString();
    const { data: recentWishlist } = await supabase
      .from("customer_wishlist")
      .select("customer_id, product_id, store_user_id, created_at")
      .gte("created_at", wishlistCutoff)
      .limit(50);

    if (recentWishlist && recentWishlist.length > 0) {
      const wishCustIds = [...new Set(recentWishlist.map((w: any) => w.customer_id))];
      const { data: activeWishSeqs } = await supabase
        .from("retargeting_sequences")
        .select("customer_id, product_id")
        .in("customer_id", wishCustIds)
        .eq("status", "active")
        .eq("metadata->>sequence_type", "wishlist");
      
      const hasActiveWish = new Set((activeWishSeqs || []).map((s: any) => `${s.customer_id}:${s.product_id}`));

      for (const wish of recentWishlist) {
        const key = `${wish.customer_id}:${wish.product_id}`;
        if (hasActiveWish.has(key)) continue;

        const firstStepDelay = WISHLIST_SEQUENCE[0].delayMinutes;
        const nextPushAt = new Date(Date.now() + firstStepDelay * 60 * 1000).toISOString();

        await supabase.from("retargeting_sequences").insert({
          customer_id: wish.customer_id,
          store_user_id: wish.store_user_id,
          product_id: wish.product_id,
          status: "active",
          current_step: 0,
          max_steps: WISHLIST_SEQUENCE.length,
          next_push_at: nextPushAt,
          metadata: { sequence_type: "wishlist" },
        });
        results.sequences_created++;
      }
    }

    // ========== 4) CREATE INACTIVITY SEQUENCES ==========
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

    const { data: inactiveCustomers } = await supabase
      .from("customer_states")
      .select("customer_id, store_user_id, last_activity_at")
      .lt("last_activity_at", twoHoursAgo)
      .gte("last_activity_at", sevenDaysAgo)
      .limit(50);

    if (inactiveCustomers && inactiveCustomers.length > 0) {
      const inactiveCustIds = inactiveCustomers.map((c: any) => c.customer_id);
      const { data: existingInactSeqs } = await supabase
        .from("retargeting_sequences")
        .select("customer_id")
        .in("customer_id", inactiveCustIds)
        .eq("status", "active");
      const hasInactSeq = new Set((existingInactSeqs || []).map((s: any) => s.customer_id));

      const twoDaysAgo = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
      const { data: recentCompleted } = await supabase
        .from("retargeting_sequences")
        .select("customer_id")
        .in("customer_id", inactiveCustIds)
        .in("status", ["completed", "stopped"])
        .gte("updated_at", twoDaysAgo);
      const recentlyDone = new Set((recentCompleted || []).map((s: any) => s.customer_id));

      for (const state of inactiveCustomers) {
        if (hasInactSeq.has(state.customer_id)) continue;
        if (recentlyDone.has(state.customer_id)) continue;

        const firstStepDelay = INACTIVITY_SEQUENCE[0].delayMinutes;
        const nextPushAt = new Date(Date.now() + firstStepDelay * 60 * 1000).toISOString();

        await supabase.from("retargeting_sequences").insert({
          customer_id: state.customer_id,
          store_user_id: state.store_user_id,
          product_id: null,
          status: "active",
          current_step: 0,
          max_steps: INACTIVITY_SEQUENCE.length,
          next_push_at: nextPushAt,
          metadata: { sequence_type: "inactivity" },
        });
        results.sequences_created++;
      }
    }

    // ========== 5) PROMOTIONAL CAMPAIGNS (Flow 2: Store Campaigns) ==========
    // Send trending/random product pushes to customers who haven't been active
    const { data: promoRules } = await supabase
      .from("automation_rules")
      .select("user_id, max_sends_per_day")
      .eq("trigger_type", "daily_promo")
      .eq("enabled", true);

    if (promoRules && promoRules.length > 0) {
      // Only run campaigns every ~3 hours (check last campaign execution)
      const threeHoursAgo = new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString();

      for (const rule of promoRules) {
        const { data: recentCampaign } = await supabase
          .from("automation_executions")
          .select("id")
          .eq("user_id", rule.user_id)
          .eq("trigger_type", "promo_campaign")
          .gte("sent_at", threeHoursAgo)
          .limit(1);

        if (recentCampaign && recentCampaign.length > 0) continue;

        // Get store info
        const { data: storeData } = await supabase
          .from("store_settings")
          .select("store_name, store_slug")
          .eq("user_id", rule.user_id)
          .single();
        const storeName = storeData?.store_name || storeData?.store_slug || "nossa loja";

        // Get trending/random products
        const { data: trendingProducts } = await supabase
          .from("products")
          .select("id, name, price, image_url")
          .eq("user_id", rule.user_id)
          .eq("published", true)
          .gt("stock", 0)
          .order("created_at", { ascending: false })
          .limit(10);

        if (!trendingProducts || trendingProducts.length === 0) continue;

        // Pick a random product
        const product = trendingProducts[Math.floor(Math.random() * trendingProducts.length)];

        // Get customers with push subscriptions
        const { data: storeCustomers } = await supabase
          .from("customers")
          .select("id, name, auth_user_id")
          .eq("store_user_id", rule.user_id);

        if (!storeCustomers || storeCustomers.length === 0) continue;

        const custAuthIds = storeCustomers.map((c: any) => c.auth_user_id).filter(Boolean);
        const { data: pushSubs } = await supabase
          .from("push_subscriptions")
          .select("user_id")
          .in("user_id", custAuthIds);

        const pushUserSet = new Set((pushSubs || []).map((s: any) => s.user_id));
        const eligibleCustomers = storeCustomers.filter((c: any) => pushUserSet.has(c.auth_user_id));

        if (eligibleCustomers.length === 0) continue;

        // Get customer_id mapping for anti-spam
        const custByAuth = new Map(storeCustomers.map((c: any) => [c.auth_user_id, c]));

        let campaignSent = 0;
        const freqConfig = storeFreqMap.get(rule.user_id) || defaultFreq;

        for (const customer of eligibleCustomers) {
          const userCounts = triggerCountsByCustomer.get(customer.id);
          const triggerCount = userCounts?.get("promo_campaign") || 0;
          
          const spamCheck = await shouldSkipAntiSpam(supabase, customer.id, product.id, triggerCount, "low", freqConfig, "promo_campaign");
          
          if (spamCheck.skip) {
            results.promo_campaign.skipped++;
            results.anti_spam_blocked++;
            continue;
          }

          // Personalize: check if customer viewed any product recently
          const { data: recentViews } = await supabase
            .from("customer_behavior_events")
            .select("product_id")
            .eq("customer_id", customer.id)
            .eq("event_type", "product_view")
            .order("created_at", { ascending: false })
            .limit(5);

          let selectedProduct = product;
          if (recentViews && recentViews.length > 0) {
            // Prioritize products the user has viewed before (but not the last one to avoid repetition)
            const viewedIds = new Set(recentViews.map((v: any) => v.product_id));
            const personalizedProduct = trendingProducts.find((p: any) => viewedIds.has(p.id) && p.id !== recentViews[0]?.product_id);
            if (personalizedProduct) selectedProduct = personalizedProduct;
          }

          const msg = pickVariedMessage(PROMO_CAMPAIGN_TEMPLATES, customer.name, selectedProduct.name, storeName, triggerCount, customer.id, selectedProduct.id);

          try {
            const pushResp = await fetch(`${supabaseUrl}/functions/v1/send-push-internal`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                target_user_id: customer.auth_user_id,
                title: msg.title,
                body: msg.body,
                url: "/",
                type: "promo_campaign",
                store_user_id: rule.user_id,
              }),
            });
            const pushData = await pushResp.json();

            if (pushData.sent > 0) {
              campaignSent++;
              const counts = triggerCountsByCustomer.get(customer.id) || new Map();
              counts.set("promo_campaign", (counts.get("promo_campaign") || 0) + 1);
              triggerCountsByCustomer.set(customer.id, counts);
            }

            results.promo_campaign.processed++;
            pushData.sent > 0 ? results.promo_campaign.sent++ : results.promo_campaign.skipped++;
          } catch (err: any) {
            console.error("Promo campaign push error:", err);
            results.promo_campaign.skipped++;
          }
        }

        // Log campaign execution
        if (campaignSent > 0 || eligibleCustomers.length > 0) {
          await supabase.from("automation_executions").insert({
            user_id: rule.user_id,
            trigger_type: "promo_campaign",
            channel: "push",
            message_text: `[Campaign] ${product.name} → ${campaignSent} sent / ${eligibleCustomers.length} eligible`,
            ai_generated: false,
            status: campaignSent > 0 ? "sent" : "skipped",
            related_product_id: product.id,
          });
        }
      }
    }

    // ========== 6) HOURLY ENGAGEMENT (Every hour, 24/7) ==========
    const oneHourAgoEng = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    
    // Get all customers who have push enabled
    const { data: allPushSubs } = await supabase
      .from("push_subscriptions")
      .select("user_id");
    
    if (allPushSubs && allPushSubs.length > 0) {
      const pushUserIds = allPushSubs.map((s: any) => s.user_id);
      const { data: customersWithPush } = await supabase
        .from("customers")
        .select("id, name, auth_user_id, store_user_id")
        .in("auth_user_id", pushUserIds)
        .limit(200); // Increased limit to reach more customers per run

      if (customersWithPush && customersWithPush.length > 0) {
        const { data: recentEngagements } = await supabase
          .from("automation_executions")
          .select("customer_id")
          .eq("trigger_type", "hourly_engagement")
          .gte("sent_at", oneHourAgoEng);
        
        const recentlyEngaged = new Set((recentEngagements || []).map((e: any) => e.customer_id));
        const dayNames = ["domingo", "segunda-feira", "terça-feira", "quarta-feira", "quinta-feira", "sexta-feira", "sábado"];
        const now = new Date();
        const dayName = dayNames[now.getDay()];
        
        // Special dates context
        const specialDates: Record<string, string> = {
          "25/12": "Natal",
          "01/01": "Ano Novo",
          "12/06": "Dia dos Namorados",
          "09/04": "Páscoa", // Example for today
        };
        const dateStr = `${now.getDate().toString().padStart(2, '0')}/${(now.getMonth() + 1).toString().padStart(2, '0')}`;
        const specialEvent = specialDates[dateStr];


        const hour = new Date().getHours();
        const dayOfWeek = new Date().getDay();

        for (const customer of customersWithPush) {
          if (recentlyEngaged.has(customer.id)) continue;

          const freqConfig = storeFreqMap.get(customer.store_user_id) || defaultFreq;
          const spamCheck = await shouldSkipAntiSpam(supabase, customer.id, null, 0, "low", freqConfig, "hourly_engagement");
          
          if (spamCheck.skip) continue;

          // Filter templates by time and day
          const validTemplates = HOURLY_ENGAGEMENT_TEMPLATES.filter((t: any) => {
            if (t.hourStart !== undefined && (hour < t.hourStart || hour > t.hourEnd)) return false;
            if (t.dayOfWeek !== undefined && !t.dayOfWeek.includes(dayOfWeek)) return false;
            return true;
          });

          const template = validTemplates.length > 0 
            ? validTemplates[Math.floor(Math.random() * validTemplates.length)]
            : HOURLY_ENGAGEMENT_TEMPLATES[Math.floor(Math.random() * HOURLY_ENGAGEMENT_TEMPLATES.length)];

          const store = storeMap.get(customer.store_user_id);
          const storeName = store?.store_name || "nossa loja";
          
          let title = template.title.replace("{name}", customer.name || "amigo(a)").replace("{day}", dayName).replace("{store}", storeName);
          let body = template.body.replace("{name}", customer.name || "amigo(a)").replace("{day}", dayName).replace("{store}", storeName);
          
          if (specialEvent) {
            title = `🎁 Especial ${specialEvent}: ${title}`;
            body = `Em clima de ${specialEvent}, ${body}`;
          }


          try {
            const pushResp = await fetch(`${supabaseUrl}/functions/v1/send-push-internal`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                target_user_id: customer.auth_user_id,
                title, body, url: "/", type: "hourly_engagement",
                store_user_id: customer.store_user_id,
              }),
            });
            const pushData = await pushResp.json();

            if (pushData.sent > 0) {
              await supabase.from("automation_executions").insert({
                user_id: customer.store_user_id,
                customer_id: customer.id,
                trigger_type: "hourly_engagement",
                channel: "push",
                message_text: `${title} — ${body}`,
                status: "sent",
              });
              results.hourly_engagement.sent++;
            }
            results.hourly_engagement.processed++;
          } catch (e) { console.error("Hourly push error:", e); }
        }
      }
    }

    console.log("[push-scheduler] Results:", JSON.stringify(results));
    return json({ success: true, ...results });
  } catch (error: any) {
    console.error("[push-scheduler] Fatal error:", error);
    return json({ error: error.message }, 500);
  }
});

// ========== HELPERS ==========

function pickVariedMessage(
  templates: { title: string; body: string }[],
  name: string,
  product: string,
  store: string,
  stepIndex: number,
  customerId: string,
  productId: string | null
): { title: string; body: string } {
  // Use a hash of customerId + productId + stepIndex to ensure stability for this specific notification
  // while differentiating it from others.
  const hashStr = `${customerId}-${productId || "noprod"}-${stepIndex}`;
  let hashVal = 0;
  for (let i = 0; i < hashStr.length; i++) {
    hashVal = ((hashVal << 5) - hashVal) + hashStr.charCodeAt(i);
    hashVal |= 0;
  }
  
  // Pick template using the stable hash + some randomness for freshness
  const idx = Math.abs(hashVal) % templates.length;
  const t = templates[idx];
  
  return {
    title: t.title.replace(/\{product\}/g, product).replace(/\{name\}/g, name).replace(/\{store\}/g, store).slice(0, 50),
    body: t.body.replace(/\{product\}/g, product).replace(/\{name\}/g, name).replace(/\{store\}/g, store).slice(0, 130),
  };
}

async function generateAISequenceMessage(
  apiKey: string,
  ctx: {
    customerName: string;
    productName: string;
    productPrice?: number;
    storeName: string;
    step: number;
    totalSteps: number;
    intensity: string;
    sequenceType: string;
  }
): Promise<{ title: string; body: string }> {
  const hour = new Date().getHours();
  const greetings = hour < 12 ? "Bom dia" : hour < 18 ? "Boa tarde" : "Boa noite";
  const priceFormatted = ctx.productPrice ? `R$ ${Number(ctx.productPrice).toFixed(2)}` : "";
  const seed = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  const intensityGuide = {
    soft: "Tom suave e amigável. Sem pressão. Apenas lembre o cliente com carinho.",
    medium: "Tom de urgência moderada. Mencione estoque baixo ou alta demanda. Crie FOMO sutil.",
    aggressive: "Tom MUITO urgente e agressivo. Use CAPS em palavras-chave. CTAs fortes como COMPRE AGORA, ÚLTIMA CHANCE, É AGORA OU NUNCA. Máxima urgência!",
  }[ctx.intensity] || "Tom amigável.";

  let typeGuide = "";
  if (ctx.sequenceType === "cart_abandonment") {
    typeGuide = `O cliente "${ctx.customerName}" ABANDONOU O CARRINHO na loja "${ctx.storeName}". Traga-o de volta para FINALIZAR A COMPRA.`;
  } else if (ctx.sequenceType === "pending_order") {
    typeGuide = `O cliente "${ctx.customerName}" SALVOU UM PEDIDO (status pendente) na loja "${ctx.storeName}". Lembre-o de FINALIZAR O PAGAMENTO (PIX ou Boleto).`;
  } else {
    typeGuide = `O cliente "${ctx.customerName}" visualizou o produto "${ctx.productName}" ${priceFormatted ? `(${priceFormatted})` : ""} na loja "${ctx.storeName}" mas NÃO COMPROU.`;
  }

  const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash-lite",
      messages: [
        {
          role: "system",
          content: `Você é uma especialista em marketing de conversão da loja "${ctx.storeName}".
${typeGuide}

Esta é a mensagem ${ctx.step} de ${ctx.totalSteps} de uma SEQUÊNCIA de retargeting.
${intensityGuide}

REGRAS RÍGIDAS:
- Responda APENAS com JSON: {"title": "...", "body": "..."}
- title: máximo 50 caracteres, comece com emoji variado
- body: máximo 130 caracteres
- Mencione o nome do cliente "${ctx.customerName}" e a loja "${ctx.storeName}"
${ctx.productName ? `- Mencione o produto "${ctx.productName}"` : ""}
- Saudação: "${greetings}"
- NUNCA repita mensagens. Seed: ${seed}
- ${ctx.intensity === "aggressive" ? "Use CTAs FORTES: COMPRE AGORA, GARANTA JÁ, É AGORA, CORRA, VÁ AGORA" : ""}`,
        },
        {
          role: "user",
          content: `Gere a mensagem push para Step ${ctx.step}/${ctx.totalSteps} (${ctx.intensity}).`,
        },
      ],
      max_tokens: 150,
      temperature: 0.95,
    }),
  });

  if (!resp.ok) throw new Error(`AI API error: ${resp.status}`);

  const data = await resp.json();
  const content = data.choices?.[0]?.message?.content || "";
  const cleaned = content.replace(/```json\n?/g, "").replace(/```/g, "").trim();
  const parsed = JSON.parse(cleaned);

  if (parsed.title && parsed.body) {
    return { title: parsed.title.slice(0, 50), body: parsed.body.slice(0, 130) };
  }
  throw new Error("Invalid AI response");
}

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

// ========== NICHE DETECTION ==========
type StoreNiche = "moda" | "acessorios" | "beleza" | "tech" | "casa" | "fitness" | "food" | "kids" | "pet" | "geral";

const NICHE_KEYWORDS: Record<StoreNiche, string[]> = {
  moda: ["roupa", "camiseta", "vestido", "calça", "blusa", "saia", "jaqueta", "moletom", "shorts", "bermuda", "cropped", "moda", "fashion", "look", "outfit", "conjunto", "lingerie", "pijama", "biquini", "maiô"],
  acessorios: ["brinco", "colar", "pulseira", "anel", "relógio", "óculos", "bolsa", "carteira", "cinto", "chapéu", "boné", "joia", "bijuteria", "acessório", "pingente", "cordão", "mochila"],
  beleza: ["maquiagem", "batom", "base", "rímel", "skincare", "creme", "perfume", "shampoo", "condicionador", "esmalte", "hidratante", "protetor", "máscara", "sérum", "beleza", "cosmético"],
  tech: ["celular", "fone", "cabo", "carregador", "capa", "película", "notebook", "mouse", "teclado", "monitor", "eletrônico", "smart", "bluetooth", "tech", "gadget"],
  casa: ["decoração", "vela", "almofada", "quadro", "organizador", "tapete", "cortina", "luminária", "vaso", "cozinha", "utensílio", "casa", "jardim", "planta"],
  fitness: ["treino", "academia", "legging", "top", "suplemento", "whey", "tênis", "esporte", "fitness", "yoga", "corrida", "gym"],
  food: ["chocolate", "café", "doce", "bolo", "gourmet", "tempero", "receita", "comida", "alimento", "orgânico", "natural"],
  kids: ["infantil", "bebê", "criança", "brinquedo", "fralda", "kids", "baby", "mamãe"],
  pet: ["pet", "cachorro", "gato", "ração", "coleira", "brinquedo pet", "cama pet", "animal"],
  geral: [],
};

function detectStoreNiche(products: any[], categories: string[]): StoreNiche {
  const allText = [
    ...products.map((p: any) => `${p.name || ""} ${p.description || ""}`),
    ...categories,
  ].join(" ").toLowerCase();

  let bestNiche: StoreNiche = "geral";
  let bestScore = 0;

  for (const [niche, keywords] of Object.entries(NICHE_KEYWORDS)) {
    if (niche === "geral") continue;
    const score = keywords.reduce((acc, kw) => acc + (allText.includes(kw) ? 1 : 0), 0);
    if (score > bestScore) {
      bestScore = score;
      bestNiche = niche as StoreNiche;
    }
  }

  return bestScore >= 2 ? bestNiche : "geral";
}

// ========== GENDER DETECTION (Brazilian names heuristic) ==========
type Gender = "male" | "female" | "neutral";

const FEMALE_SUFFIXES = ["a", "ia", "na", "ne", "da", "ina", "ane", "ice", "ete", "ise", "ene", "ile"];
const MALE_SUFFIXES = ["o", "os", "son", "ton", "ro", "do", "go", "lo", "rdo", "ldo"];
const FEMALE_NAMES = new Set(["ana", "maria", "julia", "amanda", "bruna", "camila", "carla", "clara", "daniela", "débora", "eduarda", "fernanda", "gabriela", "helena", "isabela", "jéssica", "juliana", "larissa", "letícia", "luana", "mariana", "nathalia", "patricia", "priscila", "raquel", "renata", "sabrina", "tatiana", "vanessa", "vitória", "beatriz", "alice", "laura", "luiza", "valentina", "manuela", "sofia", "giovanna", "cecília", "lorena", "bianca"]);
const MALE_NAMES = new Set(["joão", "pedro", "lucas", "matheus", "rafael", "gabriel", "bruno", "carlos", "daniel", "diego", "eduardo", "felipe", "fernando", "guilherme", "gustavo", "henrique", "igor", "josé", "leonardo", "marcos", "miguel", "nicolas", "paulo", "ricardo", "rodrigo", "thiago", "vinicius", "anderson", "andre", "caio", "enzo", "arthur", "bernardo", "davi", "heitor", "theo", "samuel", "noah", "isaac"]);

function detectGender(name: string): Gender {
  if (!name) return "neutral";
  const first = name.trim().split(" ")[0].toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  if (FEMALE_NAMES.has(first)) return "female";
  if (MALE_NAMES.has(first)) return "male";
  for (const s of FEMALE_SUFFIXES) { if (first.endsWith(s) && first.length > 3) return "female"; }
  for (const s of MALE_SUFFIXES) { if (first.endsWith(s) && first.length > 3) return "male"; }
  return "neutral";
}

// ========== NICHE + GENDER TEMPLATES ==========
interface NicheTemplate { title: string; body: string; gender?: Gender; }

const NICHE_TEMPLATES: Record<StoreNiche, NicheTemplate[]> = {
  moda: [
    { title: "👗 {product}: Seu estilo!", body: "{name}, o {product} da {store} é a peça que faltava no seu guarda-roupa! ✨", gender: "female" },
    { title: "💃 Arrasa com o {product}!", body: "{name}, você vai arrasar com o {product}! Confira na {store} 💕", gender: "female" },
    { title: "🌸 {product} pra você!", body: "{name}, esse {product} tem a sua cara! Disponível na {store} 🌷", gender: "female" },
    { title: "👔 {product}: Estilo masculino", body: "{name}, o {product} da {store} é a escolha certa pra sua coleção! 🔥", gender: "male" },
    { title: "🧥 Look top: {product}!", body: "{name}, eleve seu visual com o {product} da {store}! Confira 💪", gender: "male" },
    { title: "😎 {product} com atitude!", body: "{name}, o {product} combina com seu estilo. Veja na {store}! 🎯", gender: "male" },
    { title: "✨ {product}: Nova coleção!", body: "{name}, o {product} acabou de chegar na {store}! Vem conferir 🛍️" },
    { title: "🎨 {product} em destaque!", body: "{name}, o {product} é tendência na {store}! Garanta o seu ⚡" },
  ],
  acessorios: [
    { title: "💍 {product}: Brilho puro!", body: "{name}, o {product} da {store} vai completar seu look! Confira 💎", gender: "female" },
    { title: "✨ {product} deslumbrante!", body: "{name}, ilumine seu dia com o {product} da {store}! 🌟💕", gender: "female" },
    { title: "💫 {product}: Elegância!", body: "{name}, o {product} da {store} é pura sofisticação! Veja 💜", gender: "female" },
    { title: "⌚ {product}: Estilo firme!", body: "{name}, o {product} da {store} é perfeito pro seu dia a dia! 🔥", gender: "male" },
    { title: "🎩 {product} com classe!", body: "{name}, o {product} adiciona aquele toque especial! Confira na {store} 😎", gender: "male" },
    { title: "💎 {product}: Acessório top!", body: "{name}, o {product} da {store} é a tendência do momento! ✨" },
  ],
  beleza: [
    { title: "💄 {product}: Beleza real!", body: "{name}, o {product} da {store} vai realçar toda sua beleza! 🌸💕", gender: "female" },
    { title: "🌹 {product}: Autocuidado!", body: "{name}, você merece o {product}! Cuide-se com a {store} 💆‍♀️", gender: "female" },
    { title: "✨ {product}: Glow up!", body: "{name}, brilhe ainda mais com o {product} da {store}! 🌟", gender: "female" },
    { title: "🧴 {product}: Cuidado pessoal", body: "{name}, o {product} da {store} é essencial pra sua rotina! 💪", gender: "male" },
    { title: "💎 {product}: Premium!", body: "{name}, qualidade premium no {product} da {store}. Confira! ✨" },
  ],
  tech: [
    { title: "🔌 {product}: Tech novo!", body: "{name}, o {product} da {store} é o upgrade que você precisa! ⚡" },
    { title: "📱 {product} incrível!", body: "{name}, tecnologia de ponta: {product} na {store}! Confira 🚀" },
    { title: "🎮 {product}: Performance!", body: "{name}, o {product} da {store} vai turbinar seu setup! 💻🔥" },
  ],
  casa: [
    { title: "🏠 {product}: Seu lar!", body: "{name}, o {product} da {store} vai transformar sua casa! ✨🏡" },
    { title: "🕯️ {product}: Aconchego!", body: "{name}, deixe tudo mais lindo com o {product} da {store}! 🌿" },
  ],
  fitness: [
    { title: "💪 {product}: Treino top!", body: "{name}, o {product} da {store} é perfeito pra seu treino! 🔥🏋️" },
    { title: "🏃 {product}: Performance!", body: "{name}, eleve sua performance com o {product} da {store}! ⚡" },
  ],
  food: [
    { title: "🍫 {product}: Delícia!", body: "{name}, o {product} da {store} é irresistível! Experimente 😋🤤" },
    { title: "☕ {product}: Sabor único!", body: "{name}, se presenteie com o {product} da {store}! Imperdível 🍰" },
  ],
  kids: [
    { title: "🧸 {product}: Fofura!", body: "{name}, o {product} da {store} é perfeito pros pequenos! 👶💕" },
    { title: "🎈 {product}: Diversão!", body: "{name}, a criançada vai amar o {product} da {store}! 🌈" },
  ],
  pet: [
    { title: "🐾 {product}: Pro pet!", body: "{name}, o {product} da {store} é perfeito pro seu bichinho! 🐶💕" },
    { title: "🦴 {product}: Pet feliz!", body: "{name}, seu pet merece o {product} da {store}! Confira 🐱✨" },
  ],
  geral: [
    { title: "✨ {product}: Pra você!", body: "{name}, o {product} da {store} foi feito pra você! Confira 🛍️" },
    { title: "🔥 {product} imperdível!", body: "{name}, não perca o {product} da {store}! Garanta agora ⚡" },
  ],
};

function pickNicheTemplate(niche: StoreNiche, gender: Gender, name: string, product: string, store: string): { title: string; body: string } {
  const templates = NICHE_TEMPLATES[niche] || NICHE_TEMPLATES.geral;
  // Filter by gender preference
  let filtered = templates.filter(t => !t.gender || t.gender === gender || gender === "neutral");
  if (filtered.length === 0) filtered = templates.filter(t => !t.gender);
  if (filtered.length === 0) filtered = templates;
  const t = filtered[Math.floor(Math.random() * filtered.length)];
  return {
    title: t.title.replace(/\{product\}/g, product).replace(/\{name\}/g, name).replace(/\{store\}/g, store).slice(0, 50),
    body: t.body.replace(/\{product\}/g, product).replace(/\{name\}/g, name).replace(/\{store\}/g, store).slice(0, 130),
  };
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

// Product-focused hourly templates (use {product} and {price} placeholders)
const HOURLY_PRODUCT_TEMPLATES = [
  // Dawn / Madrugada (0h - 6h)
  { title: "🌌 Noite de {product}!", body: "{name}, insônia? Aproveite pra conferir o {product} na {store}! {priceTag} 🛒", hourStart: 0, hourEnd: 5 },
  { title: "🦉 Coruja esperta: {product}", body: "{name}, pra quem está acordado: o {product} na {store} vale a pena! {priceTag} ✨", hourStart: 0, hourEnd: 4 },
  { title: "🌃 Madrugada + {product}!", body: "{name}, aproveite a calma da madrugada pra ver o {product} na {store}! {priceTag} 💫", hourStart: 0, hourEnd: 5 },
  { title: "💤 Não dorme? Veja o {product}", body: "{name}, já que está por aqui, dê uma olhada no {product} da {store}! {priceTag} 🌙", hourStart: 1, hourEnd: 5 },

  // Early morning (6h - 8h)
  { title: "🌅 Amanheceu! E o {product}?", body: "{name}, comece o dia com o pé direito! O {product} espera na {store} {priceTag} ☀️", hourStart: 6, hourEnd: 8 },
  { title: "⏰ Cedo e com estilo!", body: "{name}, acordou cedo? O {product} da {store} já está te esperando! {priceTag} 🌤️", hourStart: 6, hourEnd: 8 },

  // Morning (8h - 12h)
  { title: "☀️ Bom dia! Olha o {product}!", body: "{name}, comece a {day} com o {product} na {store}! {priceTag} 🛍️", hourStart: 8, hourEnd: 12 },
  { title: "☕ {product} + café = perfeição!", body: "{name}, o {product} combina com sua manhã! Confira na {store} ✨", hourStart: 8, hourEnd: 11 },
  { title: "🌅 Novidade matinal: {product}", body: "Bom dia {name}! O {product} acabou de ganhar destaque na {store}! {priceTag} 💫", hourStart: 8, hourEnd: 10 },
  { title: "🌤️ Que tal o {product}?", body: "{name}, o {product} é a escolha perfeita pra hoje! Veja na {store} {priceTag} ☀️", hourStart: 9, hourEnd: 12 },
  
  // Afternoon (12h - 18h)
  { title: "🌈 {product} em destaque!", body: "{name}, o {product} está bombando na {store}! {priceTag} Confira agora 💜", hourStart: 12, hourEnd: 18 },
  { title: "🍕 Pausa + {product}!", body: "{name}, na sua pausa, olha o {product} na {store}! {priceTag} 🌟", hourStart: 12, hourEnd: 14 },
  { title: "🎯 Feito pra você: {product}", body: "{name}, selecionamos o {product} especialmente pra você! {priceTag} Na {store} ✨", hourStart: 14, hourEnd: 18 },
  { title: "💎 Destaque: {product}!", body: "{name}, o {product} é favorito na {store}! {priceTag} Garanta o seu 🔥", hourStart: 13, hourEnd: 17 },
  
  // Evening (18h - 23h)
  { title: "🌙 {product} te espera!", body: "{name}, feche o dia com o {product} na {store}! {priceTag} Você merece ✨", hourStart: 18, hourEnd: 23 },
  { title: "🧸 Mimo noturno: {product}", body: "{name}, o {product} combina com sua noite! Confira na {store} {priceTag} 💤🛍️", hourStart: 20, hourEnd: 23 },
  { title: "🌟 Últimos acessos: {product}", body: "{name}, antes de dormir, dê uma olhada no {product} da {store}! {priceTag} 😴✨", hourStart: 21, hourEnd: 23 },
  
  // Weekend product
  { title: "🎉 Fim de semana + {product}!", body: "{name}, aproveite o sábado pra garantir o {product} na {store}! {priceTag} 🎈", dayOfWeek: [6] },
  { title: "🏖️ Domingo de {product}!", body: "Oi {name}! Que tal levar o {product} da {store}? {priceTag} Bom descanso! ☀️", dayOfWeek: [0] },
  
  // General product (any hour)
  { title: "✨ {product} brilhando!", body: "{name}, o {product} é estrela na {store} hoje! {priceTag} Vem ver 💜" },
  { title: "💫 Achamos algo pra você!", body: "{name}, o {product} combina com seu estilo! {priceTag} Na {store} 🌟" },
  { title: "🔥 Top da {store}: {product}", body: "{name}, o {product} é um dos mais vendidos! {priceTag} Confira agora ⚡" },
  { title: "🛒 {product} voando!", body: "{name}, o {product} está saindo rápido na {store}! {priceTag} Garanta 🏃" },
  { title: "💝 Presente? {product}!", body: "{name}, o {product} é ótimo presente! {priceTag} Veja na {store} 🎁" },
  { title: "🏷️ {product} imperdível!", body: "{name}, não perca o {product} na {store}! {priceTag} Corra! ⚡" },
];

// VIP-specific templates (with discount)
const VIP_DISCOUNT_TEMPLATES = [
  { title: "👑 VIP: {discount} no {product}!", body: "{name}, como cliente especial, use {code} e ganhe {discount} no {product}! Só na {store} 💎" },
  { title: "🌟 Exclusivo pra você, {name}!", body: "Você é VIP na {store}! Use {code} e ganhe {discount} no {product}! Aproveite 💜" },
  { title: "💎 Desconto VIP: {product}!", body: "{name}, cupom exclusivo {code} → {discount} OFF no {product}! Só pra VIPs da {store} 👑" },
  { title: "🎁 Presente VIP: {discount}!", body: "{name}, como top cliente, use {code} no {product} e economize {discount}! {store} ama você 💝" },
  { title: "👑 {name}, oferta exclusiva!", body: "Desconto VIP no {product}: use {code} e ganhe {discount}! Só pra você na {store} ✨" },
];

// Generic engagement (fallback when no products)
const HOURLY_ENGAGEMENT_TEMPLATES = [
  // Madrugada (0h - 6h)
  { title: "🌌 Boa madrugada, {name}!", body: "Ainda acordado(a)? A {store} tem novidades te esperando! Dê uma olhada 🦉✨", hourStart: 0, hourEnd: 5 },
  { title: "🌃 Noite longa, {name}?", body: "Aproveite a calma da madrugada pra ver as ofertas da {store}! 💤🛒", hourStart: 0, hourEnd: 5 },

  // Morning (6h - 12h)
  { title: "☀️ Bom dia, {name}!", body: "Que sua {day} comece maravilhosa! Já viu as novidades na {store}? 🛍️", hourStart: 6, hourEnd: 12 },
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

  // General (any time)
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

    // ========== LOAD CATEGORIES PER STORE (for niche detection) ==========
    const allStoreUserIds = (allStores || []).map((s: any) => s.user_id);
    const { data: allCategories } = await supabase
      .from("categories")
      .select("user_id, name")
      .in("user_id", allStoreUserIds.length > 0 ? allStoreUserIds : ["00000000-0000-0000-0000-000000000000"]);
    
    const storeCategoriesMap = new Map<string, string[]>();
    (allCategories || []).forEach((c: any) => {
      if (!storeCategoriesMap.has(c.user_id)) storeCategoriesMap.set(c.user_id, []);
      storeCategoriesMap.get(c.user_id)!.push(c.name);
    });

    // Cache niche per store (computed lazily)
    const storeNicheCache = new Map<string, StoreNiche>();

    // ========== LOAD TENANT AI BRAIN CONFIG (per store) ==========
    const { data: allAiConfigs } = await supabase
      .from("tenant_ai_brain_config")
      .select("user_id, niche, personality, store_knowledge, custom_instructions, tone_of_voice, writing_style, approach_type, sending_rules, approved_examples, prohibitions, language_preferences, formality_level, emoji_usage, persuasion_style, brand_identity")
      .in("user_id", allStoreUserIds.length > 0 ? allStoreUserIds : ["00000000-0000-0000-0000-000000000000"]);
    
    const tenantAiConfigMap = new Map<string, any>();
    (allAiConfigs || []).forEach((c: any) => {
      tenantAiConfigMap.set(c.user_id, c);
    });

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
          // Detect niche and gender for AI personalization
          if (!storeNicheCache.has(seq.store_user_id)) {
            const storeProds = [];
            for (const [, p] of productMap) storeProds.push(p);
            const cats = storeCategoriesMap.get(seq.store_user_id) || [];
            storeNicheCache.set(seq.store_user_id, detectStoreNiche(storeProds, cats));
          }
          const seqNiche = storeNicheCache.get(seq.store_user_id) || "geral";
          const seqGender = detectGender(customer.name);

          try {
            const customerHistory = await fetchCustomerPushHistory(supabase, seq.customer_id, seq.store_user_id);
            msg = await generateAISequenceMessage(lovableApiKey, {
              customerName: customer.name,
              productName,
              productPrice: product?.price,
              storeName,
              step: stepIndex + 1,
              totalSteps: seq.max_steps,
              intensity: step.intensity,
              sequenceType: seqType,
              niche: seqNiche,
              gender: seqGender,
              tenantAiConfig: tenantAiConfigMap.get(seq.store_user_id),
              customerHistory,
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

    // ========== 6) HOURLY ENGAGEMENT WITH PRODUCT DIVERSITY & VIP DISCOUNTS ==========
    const oneHourAgoEng = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    
    const { data: allPushSubs } = await supabase
      .from("push_subscriptions")
      .select("user_id");
    
    if (allPushSubs && allPushSubs.length > 0) {
      const pushUserIds = allPushSubs.map((s: any) => s.user_id);
      const { data: customersWithPush } = await supabase
        .from("customers")
        .select("id, name, auth_user_id, store_user_id")
        .in("auth_user_id", pushUserIds)
        .limit(200);

      if (customersWithPush && customersWithPush.length > 0) {
        const { data: recentEngagements } = await supabase
          .from("automation_executions")
          .select("customer_id, related_product_id")
          .eq("trigger_type", "hourly_engagement")
          .gte("sent_at", oneHourAgoEng);
        
        const recentlyEngaged = new Set((recentEngagements || []).map((e: any) => e.customer_id));
        
        // Track products already sent today to avoid repeating
        const { data: todayEngagements } = await supabase
          .from("automation_executions")
          .select("customer_id, related_product_id")
          .eq("trigger_type", "hourly_engagement")
          .gte("sent_at", today.toISOString());
        
        const sentProductsByCustomer = new Map<string, Set<string>>();
        (todayEngagements || []).forEach((e: any) => {
          if (e.customer_id && e.related_product_id) {
            if (!sentProductsByCustomer.has(e.customer_id)) sentProductsByCustomer.set(e.customer_id, new Set());
            sentProductsByCustomer.get(e.customer_id)!.add(e.related_product_id);
          }
        });

        const dayNames = ["domingo", "segunda-feira", "terça-feira", "quarta-feira", "quinta-feira", "sexta-feira", "sábado"];
        const formatter = new Intl.DateTimeFormat("en-US", {
          timeZone: "America/Sao_Paulo",
          year: "numeric",
          month: "numeric",
          day: "numeric",
          hour: "numeric",
          minute: "numeric",
          second: "numeric",
          hour12: false,
        });
        const parts = formatter.formatToParts(new Date());
        const d: any = {};
        parts.forEach(({ type, value }) => { d[type] = value; });
        
        const nowBrasilia = new Date(
          parseInt(d.year),
          parseInt(d.month) - 1,
          parseInt(d.day),
          parseInt(d.hour),
          parseInt(d.minute),
          parseInt(d.second)
        );
        const dayName = dayNames[nowBrasilia.getDay()];
        const hour = nowBrasilia.getHours();
        const dayOfWeek = nowBrasilia.getDay();

        // Special dates
        const specialDates: Record<string, string> = {
          "25/12": "Natal", "01/01": "Ano Novo", "12/06": "Dia dos Namorados",
          "14/05": "Dia das Mães", "11/08": "Dia dos Pais", "12/10": "Dia das Crianças",
          "29/11": "Black Friday", "25/11": "Black Friday se aproxima",
        };
        const dateStr = `${nowBrasilia.getDate().toString().padStart(2, '0')}/${(nowBrasilia.getMonth() + 1).toString().padStart(2, '0')}`;
        const specialEvent = specialDates[dateStr];

        // Load products per store (cached)
        const storeProducts = new Map<string, any[]>();
        const storeUserIdsEng = [...new Set(customersWithPush.map((c: any) => c.store_user_id))];
        for (const sid of storeUserIdsEng) {
          const { data: prods } = await supabase
            .from("products")
            .select("id, name, price, image_url, views, created_at")
            .eq("user_id", sid)
            .eq("published", true)
            .gt("stock", 0)
            .order("created_at", { ascending: false })
            .limit(30);
          storeProducts.set(sid, prods || []);
        }

        // Load VIP data: customers with most orders & revenue
        const { data: vipData } = await supabase
          .from("orders")
          .select("customer_email, user_id, total")
          .eq("status", "entregue")
          .limit(500);

        // Build VIP scores: customer email → { totalSpent, orderCount, storeUserId }
        const vipScores = new Map<string, { totalSpent: number; orderCount: number; storeUserId: string }>();
        (vipData || []).forEach((o: any) => {
          if (!o.customer_email) return;
          const key = `${o.customer_email}:${o.user_id}`;
          const existing = vipScores.get(key) || { totalSpent: 0, orderCount: 0, storeUserId: o.user_id };
          existing.totalSpent += Number(o.total || 0);
          existing.orderCount += 1;
          vipScores.set(key, existing);
        });

        // Load active coupons per store to check if VIP coupon already exists
        const { data: activeCoupons } = await supabase
          .from("coupons")
          .select("code, user_id")
          .eq("active", true)
          .in("user_id", storeUserIdsEng);
        
        const storeCouponCodes = new Map<string, Set<string>>();
        (activeCoupons || []).forEach((c: any) => {
          if (!storeCouponCodes.has(c.user_id)) storeCouponCodes.set(c.user_id, new Set());
          storeCouponCodes.get(c.user_id)!.add(c.code);
        });

        // Load customer emails for VIP matching
        const custIds = customersWithPush.map((c: any) => c.id);
        const { data: custEmails } = await supabase
          .from("customers")
          .select("id, email")
          .in("id", custIds);
        const custEmailMap = new Map((custEmails || []).map((c: any) => [c.id, c.email]));

        for (const customer of customersWithPush) {
          if (recentlyEngaged.has(customer.id)) continue;

          const freqConfig = storeFreqMap.get(customer.store_user_id) || defaultFreq;
          const spamCheck = await shouldSkipAntiSpam(supabase, customer.id, null, 0, "low", freqConfig, "hourly_engagement");
          if (spamCheck.skip) continue;

          const store = storeMap.get(customer.store_user_id);
          const storeName = store?.store_name || "nossa loja";
          const products = storeProducts.get(customer.store_user_id) || [];
          const alreadySentProducts = sentProductsByCustomer.get(customer.id) || new Set();

          // Detect store niche (cached)
          if (!storeNicheCache.has(customer.store_user_id)) {
            const cats = storeCategoriesMap.get(customer.store_user_id) || [];
            storeNicheCache.set(customer.store_user_id, detectStoreNiche(products, cats));
          }
          const storeNiche = storeNicheCache.get(customer.store_user_id) || "geral";
          const customerGender = detectGender(customer.name);

          // Pick a DIFFERENT product each hour (not sent today)
          const availableProducts = products.filter((p: any) => !alreadySentProducts.has(p.id));
          const selectedProduct = availableProducts.length > 0
            ? availableProducts[Math.floor(Math.random() * availableProducts.length)]
            : products.length > 0
              ? products[Math.floor(Math.random() * products.length)]
              : null;

          // Check if customer is VIP (3+ orders or R$300+ spent)
          const custEmail = custEmailMap.get(customer.id);
          const vipKey = custEmail ? `${custEmail}:${customer.store_user_id}` : null;
          const vipInfo = vipKey ? vipScores.get(vipKey) : null;
          const isVIP = vipInfo && (vipInfo.orderCount >= 3 || vipInfo.totalSpent >= 300);

          let title = "";
          let body = "";
          let relatedProductId: string | null = null;

          if (selectedProduct && isVIP && Math.random() < 0.3) {
            // VIP smart discount: 5-15% based on loyalty
            const discountPercent = vipInfo!.orderCount >= 10 ? 15 : vipInfo!.orderCount >= 5 ? 10 : 5;
            const vipCode = `VIP${discountPercent}${customer.name.slice(0, 3).toUpperCase()}`;

            const existingCodes = storeCouponCodes.get(customer.store_user_id) || new Set();
            if (!existingCodes.has(vipCode)) {
              const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();
              await supabase.from("coupons").insert({
                code: vipCode,
                user_id: customer.store_user_id,
                discount_type: "percentage",
                discount_value: discountPercent,
                max_uses: 1,
                min_order_value: Math.max(50, selectedProduct.price * 0.8),
                expires_at: expiresAt,
                active: true,
              });
              existingCodes.add(vipCode);
              storeCouponCodes.set(customer.store_user_id, existingCodes);
            }

            const tmpl = VIP_DISCOUNT_TEMPLATES[Math.floor(Math.random() * VIP_DISCOUNT_TEMPLATES.length)];
            title = tmpl.title
              .replace(/\{name\}/g, customer.name || "amigo(a)")
              .replace(/\{product\}/g, selectedProduct.name)
              .replace(/\{store\}/g, storeName)
              .replace(/\{discount\}/g, `${discountPercent}%`)
              .replace(/\{code\}/g, vipCode)
              .slice(0, 50);
            body = tmpl.body
              .replace(/\{name\}/g, customer.name || "amigo(a)")
              .replace(/\{product\}/g, selectedProduct.name)
              .replace(/\{store\}/g, storeName)
              .replace(/\{discount\}/g, `${discountPercent}%`)
              .replace(/\{code\}/g, vipCode)
              .slice(0, 130);
            relatedProductId = selectedProduct.id;

          } else if (selectedProduct) {
            // Use AI-generated messages with tenant config and customer history
            if (lovableApiKey) {
              try {
                const customerHistory = await fetchCustomerPushHistory(supabase, customer.id, customer.store_user_id);
                const aiMsg = await generateAISequenceMessage(lovableApiKey, {
                  customerName: customer.name || "amigo(a)",
                  productName: selectedProduct.name,
                  productPrice: selectedProduct.price,
                  storeName,
                  step: 1,
                  totalSteps: 1,
                  intensity: "soft",
                  sequenceType: "hourly_engagement",
                  niche: storeNiche as StoreNiche,
                  gender: customerGender,
                  tenantAiConfig: tenantAiConfigMap.get(customer.store_user_id),
                  customerHistory,
                });
                title = aiMsg.title;
                body = aiMsg.body;
              } catch {
                // Fallback to niche template
                const nicheMsg = pickNicheTemplate(storeNiche as StoreNiche, customerGender, customer.name || "amigo(a)", selectedProduct.name, storeName);
                title = nicheMsg.title;
                body = nicheMsg.body;
              }
            } else if (storeNiche !== "geral" && Math.random() < 0.4) {
              const nicheMsg = pickNicheTemplate(storeNiche as StoreNiche, customerGender, customer.name || "amigo(a)", selectedProduct.name, storeName);
              title = nicheMsg.title;
              body = nicheMsg.body;
            } else {
              const priceTag = selectedProduct.price > 0 ? `R$${Number(selectedProduct.price).toFixed(2)}` : "";
              const validTemplates = HOURLY_PRODUCT_TEMPLATES.filter((t: any) => {
                if (t.hourStart !== undefined && (hour < t.hourStart || hour > t.hourEnd)) return false;
                if (t.dayOfWeek !== undefined && !t.dayOfWeek.includes(dayOfWeek)) return false;
                return true;
              });
              const tmplList = validTemplates.length > 0 ? validTemplates : HOURLY_PRODUCT_TEMPLATES;
              const tmpl = tmplList[Math.floor(Math.random() * tmplList.length)];
              
              title = tmpl.title
                .replace(/\{name\}/g, customer.name || "amigo(a)")
                .replace(/\{product\}/g, selectedProduct.name)
                .replace(/\{store\}/g, storeName)
                .replace(/\{day\}/g, dayName)
                .replace(/\{priceTag\}/g, priceTag)
                .slice(0, 50);
              body = tmpl.body
                .replace(/\{name\}/g, customer.name || "amigo(a)")
                .replace(/\{product\}/g, selectedProduct.name)
                .replace(/\{store\}/g, storeName)
                .replace(/\{day\}/g, dayName)
                .replace(/\{priceTag\}/g, priceTag)
                .slice(0, 130);
            }
            relatedProductId = selectedProduct.id;

          } else {
            // Fallback: AI engagement without product or static templates
            if (lovableApiKey) {
              try {
                const customerHistory = await fetchCustomerPushHistory(supabase, customer.id, customer.store_user_id);
                const aiMsg = await generateAISequenceMessage(lovableApiKey, {
                  customerName: customer.name || "amigo(a)",
                  productName: "",
                  storeName,
                  step: 1,
                  totalSteps: 1,
                  intensity: "soft",
                  sequenceType: "hourly_engagement",
                  niche: storeNiche as StoreNiche,
                  gender: customerGender,
                  tenantAiConfig: tenantAiConfigMap.get(customer.store_user_id),
                  customerHistory,
                });
                title = aiMsg.title;
                body = aiMsg.body;
              } catch {
                const validTemplates = HOURLY_ENGAGEMENT_TEMPLATES.filter((t: any) => {
                  if (t.hourStart !== undefined && (hour < t.hourStart || hour > t.hourEnd)) return false;
                  if (t.dayOfWeek !== undefined && !t.dayOfWeek.includes(dayOfWeek)) return false;
                  return true;
                });
                const tmpl = validTemplates.length > 0
                  ? validTemplates[Math.floor(Math.random() * validTemplates.length)]
                  : HOURLY_ENGAGEMENT_TEMPLATES[Math.floor(Math.random() * HOURLY_ENGAGEMENT_TEMPLATES.length)];
                title = tmpl.title.replace(/\{name\}/g, customer.name || "amigo(a)").replace(/\{day\}/g, dayName).replace(/\{store\}/g, storeName);
                body = tmpl.body.replace(/\{name\}/g, customer.name || "amigo(a)").replace(/\{day\}/g, dayName).replace(/\{store\}/g, storeName);
              }
            } else {
              const validTemplates = HOURLY_ENGAGEMENT_TEMPLATES.filter((t: any) => {
                if (t.hourStart !== undefined && (hour < t.hourStart || hour > t.hourEnd)) return false;
                if (t.dayOfWeek !== undefined && !t.dayOfWeek.includes(dayOfWeek)) return false;
                return true;
              });
              const tmpl = validTemplates.length > 0
                ? validTemplates[Math.floor(Math.random() * validTemplates.length)]
                : HOURLY_ENGAGEMENT_TEMPLATES[Math.floor(Math.random() * HOURLY_ENGAGEMENT_TEMPLATES.length)];
              title = tmpl.title.replace(/\{name\}/g, customer.name || "amigo(a)").replace(/\{day\}/g, dayName).replace(/\{store\}/g, storeName);
              body = tmpl.body.replace(/\{name\}/g, customer.name || "amigo(a)").replace(/\{day\}/g, dayName).replace(/\{store\}/g, storeName);
            }
          }

          if (specialEvent) {
            title = `🎁 ${specialEvent}: ${title}`.slice(0, 50);
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
                related_product_id: relatedProductId,
              });
              results.hourly_engagement.sent++;
            }
            results.hourly_engagement.processed++;
          } catch (e) { console.error("Hourly push error:", e); }
        }
      }
    }

    // ========== 7) LOW STOCK URGENCY: Alert customers who viewed/carted products that are selling out ==========
    const LOW_STOCK_URGENCY_TEMPLATES = [
      { title: "🚨 {product} quase esgotado!", body: "{name}, o {product} que você viu na {store} tem apenas {stock} unidade(s)! Garanta antes que acabe! ⚡" },
      { title: "⚡ Corra! {product} acabando!", body: "{name}, restam só {stock} do {product} na {store}! Se venderam rápido, corra! 🏃" },
      { title: "🔥 Últimas unidades: {product}!", body: "{name}, o {product} da {store} está nas últimas {stock} unidade(s)! Não fique sem! 💨" },
      { title: "⏰ {product} vai acabar!", body: "Alerta {name}! O {product} que te interessou na {store} tem só {stock} restantes! 🔥" },
      { title: "💨 Voando: {product}!", body: "{name}, o {product} da {store} está voando! Apenas {stock} restantes. Garanta o seu! ⚡" },
      { title: "🛑 Não perca o {product}!", body: "{name}, outros clientes compraram o {product}. Restam {stock} na {store}! Corra! 🏃" },
    ];

    const CART_LOW_STOCK_TEMPLATES = [
      { title: "🛒⚠️ Itens do carrinho acabando!", body: "{name}, o {product} no seu carrinho na {store} tem apenas {stock} unidade(s)! Finalize agora! 🏃" },
      { title: "🚨 Carrinho em risco!", body: "{name}, o {product} que está no seu carrinho na {store} pode esgotar! Só {stock} restantes! ⚡" },
      { title: "⏰ Corre pro carrinho!", body: "{name}, o {product} do seu carrinho na {store} está acabando ({stock} un.)! Finalize antes que acabe! 🔥" },
      { title: "💨 Seu item vai acabar!", body: "{name}, o estoque do {product} no seu carrinho na {store} caiu para {stock}! Compre agora! 🏃" },
    ];

    try {
      // Find products with low stock (using min_stock_alert or default threshold of 5)
      const { data: lowStockProducts } = await supabase
        .from("products")
        .select("id, name, stock, min_stock_alert, user_id")
        .eq("published", true)
        .gt("stock", 0)
        .lte("stock", 10) // Pre-filter: only products with stock <= 10
        .limit(100);

      if (lowStockProducts && lowStockProducts.length > 0) {
        // Filter to truly low-stock products (stock <= min_stock_alert or stock <= 3)
        const trulyLowStock = lowStockProducts.filter((p: any) => {
          const threshold = Math.max(p.min_stock_alert || 5, 1);
          return p.stock <= threshold;
        });

        if (trulyLowStock.length > 0) {
          const lowStockProductIds = trulyLowStock.map((p: any) => p.id);
          const lowStockProductMap = new Map(trulyLowStock.map((p: any) => [p.id, p]));

          // 7a) Customers who VIEWED these low-stock products (last 7 days)
          const sevenDaysAgoLS = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
          const { data: viewStats } = await supabase
            .from("customer_view_stats")
            .select("customer_id, product_id")
            .in("product_id", lowStockProductIds)
            .gte("last_viewed_at", sevenDaysAgoLS)
            .limit(200);

          // 7b) Customers who have these products in ABANDONED CARTS
          const { data: cartsWithLowStock } = await supabase
            .from("abandoned_carts")
            .select("id, customer_id, user_id, items")
            .eq("recovered", false)
            .not("customer_id", "is", null)
            .limit(200);

          // Build set of customer+product pairs to notify
          const lowStockAlerts: { customerId: string; productId: string; source: "viewed" | "cart" }[] = [];

          // From views
          if (viewStats) {
            for (const vs of viewStats) {
              if (vs.customer_id && vs.product_id && lowStockProductMap.has(vs.product_id)) {
                lowStockAlerts.push({ customerId: vs.customer_id, productId: vs.product_id, source: "viewed" });
              }
            }
          }

          // From carts
          if (cartsWithLowStock) {
            for (const cart of cartsWithLowStock) {
              const items = Array.isArray(cart.items) ? cart.items : [];
              for (const item of items) {
                const pid = (item as any).product_id || (item as any).id;
                if (pid && lowStockProductMap.has(pid) && cart.customer_id) {
                  lowStockAlerts.push({ customerId: cart.customer_id, productId: pid, source: "cart" });
                }
              }
            }
          }

          // Deduplicate by customer+product
          const seenKeys = new Set<string>();
          const uniqueAlerts = lowStockAlerts.filter(a => {
            const key = `${a.customerId}:${a.productId}`;
            if (seenKeys.has(key)) return false;
            seenKeys.add(key);
            return true;
          });

          if (uniqueAlerts.length > 0) {
            // Load customer data
            const alertCustIds = [...new Set(uniqueAlerts.map(a => a.customerId))];
            const { data: alertCustomers } = await supabase
              .from("customers")
              .select("id, name, auth_user_id, store_user_id")
              .in("id", alertCustIds);
            const alertCustMap = new Map((alertCustomers || []).map((c: any) => [c.id, c]));

            // Check for recent low_stock_urgency pushes (avoid spamming - 6h cooldown)
            const sixHoursAgo = new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString();
            const { data: recentLSPushes } = await supabase
              .from("automation_executions")
              .select("customer_id, related_product_id")
              .eq("trigger_type", "low_stock_urgency")
              .gte("sent_at", sixHoursAgo);
            const recentLSKeys = new Set((recentLSPushes || []).map((e: any) => `${e.customer_id}:${e.related_product_id}`));

            let lsSent = 0;

            for (const alert of uniqueAlerts) {
              const key = `${alert.customerId}:${alert.productId}`;
              if (recentLSKeys.has(key)) continue;

              const customer = alertCustMap.get(alert.customerId);
              if (!customer?.auth_user_id) continue;

              const product = lowStockProductMap.get(alert.productId);
              if (!product) continue;

              const store = storeMap.get(customer.store_user_id);
              const storeName = store?.store_name || "nossa loja";

              const templates = alert.source === "cart" ? CART_LOW_STOCK_TEMPLATES : LOW_STOCK_URGENCY_TEMPLATES;
              const tmpl = templates[Math.floor(Math.random() * templates.length)];
              const title = tmpl.title
                .replace(/\{product\}/g, product.name)
                .replace(/\{name\}/g, customer.name)
                .replace(/\{store\}/g, storeName)
                .replace(/\{stock\}/g, String(product.stock))
                .slice(0, 50);
              const body = tmpl.body
                .replace(/\{product\}/g, product.name)
                .replace(/\{name\}/g, customer.name)
                .replace(/\{store\}/g, storeName)
                .replace(/\{stock\}/g, String(product.stock))
                .slice(0, 130);

              try {
                const pushResp = await fetch(`${supabaseUrl}/functions/v1/send-push-internal`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    target_user_id: customer.auth_user_id,
                    title, body, url: "/", type: "low_stock_urgency",
                    store_user_id: customer.store_user_id,
                  }),
                });
                const pushData = await pushResp.json();

                await supabase.from("automation_executions").insert({
                  user_id: customer.store_user_id,
                  customer_id: alert.customerId,
                  trigger_type: "low_stock_urgency",
                  channel: "push",
                  message_text: `[${alert.source}] ${title} — ${body}`,
                  status: pushData.sent > 0 ? "sent" : "failed",
                  related_product_id: alert.productId,
                  ai_generated: false,
                });

                if (pushData.sent > 0) lsSent++;
                recentLSKeys.add(key);
              } catch (err: any) {
                console.error("Low stock urgency push error:", err);
              }
            }

            console.log(`[push-scheduler] Low stock urgency: ${uniqueAlerts.length} alerts, ${lsSent} sent`);
          }
        }
      }
    } catch (lsErr: any) {
      console.error("[push-scheduler] Low stock urgency error:", lsErr);
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
    niche?: StoreNiche;
    gender?: Gender;
    tenantAiConfig?: any;
    customerHistory?: string[];
  }
): Promise<{ title: string; body: string }> {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
    second: "numeric",
    hour12: false,
  });
  const parts = formatter.formatToParts(new Date());
  const d: any = {};
  parts.forEach(({ type, value }) => { d[type] = value; });
  
  const nowBR = new Date(
    parseInt(d.year),
    parseInt(d.month) - 1,
    parseInt(d.day),
    parseInt(d.hour),
    parseInt(d.minute),
    parseInt(d.second)
  );
  const hour = nowBR.getHours();
  const greetings = hour < 6 ? "Boa madrugada" : hour < 12 ? "Bom dia" : hour < 18 ? "Boa tarde" : "Boa noite";
  const priceFormatted = ctx.productPrice ? `R$ ${Number(ctx.productPrice).toFixed(2)}` : "";
  const seed = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  const intensityGuide = {
    soft: "Tom suave e amigável. Sem pressão. Apenas lembre o cliente com carinho.",
    medium: "Tom de urgência moderada. Mencione estoque baixo ou alta demanda. Crie FOMO sutil.",
    aggressive: "Tom MUITO urgente e agressivo. Use CAPS em palavras-chave. CTAs fortes como COMPRE AGORA, ÚLTIMA CHANCE, É AGORA OU NUNCA. Máxima urgência!",
  }[ctx.intensity] || "Tom amigável.";

  const nicheGuide: Record<string, string> = {
    moda: "Loja de MODA/ROUPAS. Use termos como 'look', 'estilo', 'tendência', 'coleção'. Linguagem fashion e moderna.",
    acessorios: "Loja de ACESSÓRIOS/JOIAS. Use termos como 'brilho', 'elegância', 'sofisticação', 'charme'. Linguagem refinada.",
    beleza: "Loja de BELEZA/COSMÉTICOS. Use termos como 'autocuidado', 'glow', 'skincare', 'beleza natural'. Linguagem de wellness.",
    tech: "Loja de TECNOLOGIA. Use termos como 'upgrade', 'performance', 'inovação', 'smart'. Linguagem tech e objetiva.",
    casa: "Loja de CASA/DECORAÇÃO. Use termos como 'lar', 'aconchego', 'ambiente', 'decoração'. Linguagem acolhedora.",
    fitness: "Loja de FITNESS/ESPORTE. Use termos como 'treino', 'superação', 'performance', 'energia'. Linguagem motivacional.",
    food: "Loja de ALIMENTAÇÃO. Use termos como 'sabor', 'delícia', 'gourmet', 'prazer'. Linguagem sensorial.",
    kids: "Loja INFANTIL. Use termos como 'fofura', 'diversão', 'alegria', 'carinho'. Linguagem doce e maternal.",
    pet: "Loja PET. Use termos como 'bichinho', 'amor pet', 'companheiro', 'patinha'. Linguagem afetiva.",
  };

  const genderGuide = ctx.gender === "female"
    ? "A cliente é MULHER. Use tom doce, empoderador e acolhedor. Diga 'Bom dia amiga' ou 'Oi querida'. Emojis como 💕🌸✨💜🌷💃. Linguagem mais delicada e carinhosa."
    : ctx.gender === "male"
    ? "O cliente é HOMEM. Use tom direto, suave e prático. Diga 'Bom dia amigo' ou 'E aí amigão'. Emojis como 🔥💪😎🎯⚡. Linguagem mais objetiva sem ser fria."
    : "Gênero neutro. Use tom universal e inclusivo. Use saudações neutras como 'Olá' ou 'Tudo bem?'.";

  let typeGuide = "";
  if (ctx.sequenceType === "cart_abandonment") {
    typeGuide = `O cliente "${ctx.customerName}" ABANDONOU O CARRINHO na loja "${ctx.storeName}". Traga-o de volta para FINALIZAR A COMPRA.`;
  } else if (ctx.sequenceType === "pending_order") {
    typeGuide = `O cliente "${ctx.customerName}" SALVOU UM PEDIDO (status pendente) na loja "${ctx.storeName}". Lembre-o de FINALIZAR O PAGAMENTO (PIX ou Boleto).`;
  } else if (ctx.sequenceType === "hourly_engagement") {
    typeGuide = ctx.productName
      ? `Engajamento periódico para o cliente "${ctx.customerName}" da loja "${ctx.storeName}". Destaque o produto "${ctx.productName}" ${priceFormatted ? `(${priceFormatted})` : ""} de forma natural e não invasiva.`
      : `Engajamento periódico para o cliente "${ctx.customerName}" da loja "${ctx.storeName}". Crie uma mensagem natural e relevante sobre a loja.`;
  } else {
    typeGuide = `O cliente "${ctx.customerName}" visualizou o produto "${ctx.productName}" ${priceFormatted ? `(${priceFormatted})` : ""} na loja "${ctx.storeName}" mas NÃO COMPROU.`;
  }

  // Build tenant-specific context from AI brain config
  const aiConfig = ctx.tenantAiConfig;
  let tenantContext = "";
  if (aiConfig) {
    const configuredNiche = aiConfig.niche || "";
    const personality = aiConfig.personality || "educada";
    const storeKnowledge = typeof aiConfig.store_knowledge === "object" && aiConfig.store_knowledge
      ? (aiConfig.store_knowledge as any).description || ""
      : "";
    const customInstructions = aiConfig.custom_instructions || "";
    
    const personalityMap: Record<string, string> = {
      amigavel: "Amigável e próxima — como uma amiga de confiança.",
      profissional: "Profissional e direta — com linguagem objetiva.",
      divertida: "Divertida e descontraída — com emojis e humor leve.",
      agressiva: "Agressiva e focada em conversão — com urgência e frases fortes.",
      educada: "Educada e formal — com linguagem refinada e respeitosa.",
    };
    
    tenantContext = `
MANDATORY MERCHANT TRAINING (MAX PRIORITY):
${aiConfig.brand_identity ? `IDENTIDADE DA MARCA: ${aiConfig.brand_identity}` : ""}
PERSONALIDADE DA LOJA: ${personalityMap[personality] || personalityMap.educada}
${aiConfig.tone_of_voice ? `TOM DE VOZ: ${aiConfig.tone_of_voice}` : ""}
${aiConfig.writing_style ? `ESTILO DE ESCRITA: ${aiConfig.writing_style}` : ""}
${aiConfig.emoji_usage ? `USO DE EMOJIS: ${aiConfig.emoji_usage}` : ""}
${aiConfig.prohibitions ? `PROIBIÇÕES: ${aiConfig.prohibitions}` : ""}
${aiConfig.sending_rules ? `REGRAS DE ENVIO: ${aiConfig.sending_rules}` : ""}
${configuredNiche ? `NICHO: ${configuredNiche}` : ""}
${storeKnowledge ? `SOBRE A LOJA: ${storeKnowledge}` : ""}
${customInstructions ? `INSTRUÇÕES EXTRAS: ${customInstructions}` : ""}
HIERARQUIA: TREINAMENTO DO LOJISTA > CONTEXTO DO CLIENTE > OTIMIZAÇÃO DA IA.
CORRIJA QUALQUER CONFLITO COM AS REGRAS ACIMA.`;
  }

  // Build anti-repetition context from customer's push history
  let historyContext = "";
  if (ctx.customerHistory && ctx.customerHistory.length > 0) {
    historyContext = `
ANTI-REPETIÇÃO OBRIGATÓRIA — Analise estas ${ctx.customerHistory.length} mensagens ANTERIORES enviadas para ESTE cliente:
${ctx.customerHistory.map((m, i) => `${i + 1}. ${m}`).join("\n")}

REGRAS:
- A nova mensagem DEVE ser TOTALMENTE diferente de TODAS as anteriores.
- NÃO repita: mesma frase de abertura, mesma estrutura, mesmo CTA, mesma ideia principal.
- Pode repetir o nome do produto, mas o TEXTO, ABORDAGEM e GANCHO devem ser completamente diferentes.
- Se perceber semelhança, REESCREVA até ficar genuinamente único.`;
  }

  const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "google/gemini-1.5-flash-lite",
      messages: [
        {
          role: "system",
          content: `Você é uma especialista em marketing de conversão da loja "${ctx.storeName}".
${typeGuide}
${tenantContext}
${ctx.niche && ctx.niche !== "geral" ? `NICHO DA LOJA: ${nicheGuide[ctx.niche] || ""}` : ""}
${genderGuide}

${ctx.sequenceType !== "hourly_engagement" ? `Esta é a mensagem ${ctx.step} de ${ctx.totalSteps} de uma SEQUÊNCIA de retargeting.` : ""}
${intensityGuide}
${historyContext}

REGRAS RÍGIDAS:
- Responda APENAS com JSON: {"title": "...", "body": "..."}
- title: máximo 50 caracteres, comece com emoji variado
- body: máximo 130 caracteres
- Mencione o nome do cliente "${ctx.customerName}" e a loja "${ctx.storeName}"
${ctx.productName ? `- Mencione o produto "${ctx.productName}"` : ""}
- Horário: ${hour}h (${greetings}). NUNCA use saudação errada para o horário.
- NUNCA repita mensagens. Seed: ${seed}
- Adapte a linguagem ao NICHO da loja e ao GÊNERO do cliente
- A mensagem deve ser NATURAL, RELEVANTE e NÃO INVASIVA
- ${ctx.intensity === "aggressive" ? "Use CTAs FORTES: COMPRE AGORA, GARANTA JÁ, É AGORA, CORRA, VÁ AGORA" : ""}`,
        },
        {
          role: "user",
          content: ctx.sequenceType === "hourly_engagement"
            ? `Gere uma mensagem push de engajamento única e personalizada para ${ctx.customerName}.`
            : `Gere a mensagem push para Step ${ctx.step}/${ctx.totalSteps} (${ctx.intensity}).`,
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

// Helper to fetch customer's recent push history for anti-repetition
async function fetchCustomerPushHistory(supabase: any, customerId: string, storeUserId: string): Promise<string[]> {
  const { data: recentPushes } = await supabase
    .from("push_logs")
    .select("title, body")
    .or(`customer_id.eq.${customerId},user_id.eq.${customerId}`)
    .eq("store_user_id", storeUserId)
    .eq("status", "sent")
    .order("created_at", { ascending: false })
    .limit(15);

  return (recentPushes || [])
    .map((p: any) => `${p.title || ""} ${p.body || ""}`.trim())
    .filter(Boolean);
}

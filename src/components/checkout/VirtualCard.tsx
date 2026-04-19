import { useMemo } from "react";
import { Wifi } from "lucide-react";
import {
  NubankLogo, ItauLogo, BBLogo, BradescoLogo, SantanderLogo, CaixaLogo,
  InterLogo, C6Logo, BTGLogo, XPLogo, PicPayLogo, MercadoPagoLogo,
  PagBankLogo, SafraLogo, NeonLogo, ItiLogo, NextLogo, DigioLogo, WillLogo,
  OriginalLogo, PanLogo, BMGLogo, ModalLogo, DaycovalLogo, BVLogo, SicoobLogo,
  SicrediLogo, BanrisulLogo, MercantilLogo, BanestesLogo, RennerLogo,
  CarrefourLogo, MagaluLogo, AmazonLogo, StoneLogo, SumUpLogo,
  VisaLogo, MastercardLogo, AmexLogo, EloLogo, HipercardLogo, GenericCardLogo,
} from "./BankLogos";

interface VirtualCardProps {
  number: string;
  name: string;
  expiry: string;
  cvv: string;
  flipped?: boolean;
  gatewayBankName?: string;
  gatewayBrandName?: string;
}

type BankKey =
  | "NUBANK" | "NUBANK_ULTRA" | "ITAU" | "ITAU_BLACK" | "ITI" | "BRADESCO" | "NEXT" | "DIGIO"
  | "BB" | "BB_BLACK" | "SANTANDER" | "CAIXA" | "INTER" | "C6" | "C6_CARBON"
  | "BTG" | "XP" | "PICPAY" | "MERCADOPAGO" | "PAGBANK" | "SAFRA" | "NEON"
  | "WILL" | "ORIGINAL" | "PAN" | "BMG" | "MODAL" | "DAYCOVAL" | "VOTORANTIM"
  | "SICOOB" | "SICREDI" | "BANRISUL" | "MERCANTIL" | "BANESTES"
  | "RENNER" | "CARREFOUR" | "MAGALU" | "AMAZON" | "STONE" | "SUMUP"
  | "GENERIC_PURPLE" | "GENERIC_RED" | "GENERIC_BLUE" | "GENERIC_GREEN" | "GENERIC_BLACK" | "GENERIC_ORANGE";

interface BankInfo {
  key: BankKey;
  label: string;
  gradient: string;
  textColor: string;
  chipGradient: string;
}

const BANKS: Record<BankKey, BankInfo> = {
  NUBANK: { key: "NUBANK", label: "Nubank", gradient: "from-purple-900 via-purple-800 to-fuchsia-900", textColor: "text-white", chipGradient: "from-fuchsia-300 to-purple-400" },
  NUBANK_ULTRA: { key: "NUBANK_ULTRA", label: "Ultravioleta", gradient: "from-zinc-950 via-purple-950 to-black", textColor: "text-purple-100", chipGradient: "from-purple-300 to-fuchsia-500" },
  ITAU: { key: "ITAU", label: "Itaú", gradient: "from-orange-600 via-orange-500 to-blue-900", textColor: "text-white", chipGradient: "from-yellow-300 to-orange-400" },
  ITAU_BLACK: { key: "ITAU_BLACK", label: "Itaú Black", gradient: "from-zinc-950 via-zinc-900 to-orange-950", textColor: "text-orange-100", chipGradient: "from-orange-400 to-amber-500" },
  ITI: { key: "ITI", label: "iti Itaú", gradient: "from-pink-500 via-fuchsia-500 to-orange-500", textColor: "text-white", chipGradient: "from-yellow-200 to-pink-300" },
  BRADESCO: { key: "BRADESCO", label: "Bradesco", gradient: "from-red-700 via-red-600 to-red-900", textColor: "text-white", chipGradient: "from-red-200 to-orange-300" },
  NEXT: { key: "NEXT", label: "Next", gradient: "from-lime-400 via-green-500 to-emerald-700", textColor: "text-zinc-900", chipGradient: "from-lime-200 to-green-300" },
  DIGIO: { key: "DIGIO", label: "Digio", gradient: "from-cyan-500 via-blue-600 to-indigo-700", textColor: "text-white", chipGradient: "from-cyan-200 to-blue-300" },
  BB: { key: "BB", label: "Banco do Brasil", gradient: "from-yellow-400 via-yellow-500 to-blue-900", textColor: "text-blue-950", chipGradient: "from-yellow-200 to-yellow-400" },
  BB_BLACK: { key: "BB_BLACK", label: "Ourocard Black", gradient: "from-zinc-950 via-stone-900 to-yellow-900", textColor: "text-yellow-100", chipGradient: "from-yellow-300 to-amber-500" },
  SANTANDER: { key: "SANTANDER", label: "Santander", gradient: "from-red-600 via-red-500 to-red-800", textColor: "text-white", chipGradient: "from-red-200 to-red-400" },
  CAIXA: { key: "CAIXA", label: "Caixa", gradient: "from-blue-700 via-blue-600 to-orange-600", textColor: "text-white", chipGradient: "from-orange-300 to-yellow-400" },
  INTER: { key: "INTER", label: "Inter", gradient: "from-orange-500 via-orange-600 to-red-700", textColor: "text-white", chipGradient: "from-yellow-300 to-orange-400" },
  C6: { key: "C6", label: "C6 Bank", gradient: "from-zinc-950 via-zinc-900 to-stone-800", textColor: "text-amber-100", chipGradient: "from-amber-300 to-yellow-500" },
  C6_CARBON: { key: "C6_CARBON", label: "C6 Carbon", gradient: "from-black via-zinc-950 to-stone-900", textColor: "text-stone-200", chipGradient: "from-stone-300 to-zinc-400" },
  BTG: { key: "BTG", label: "BTG Pactual", gradient: "from-slate-950 via-blue-950 to-black", textColor: "text-blue-100", chipGradient: "from-blue-300 to-cyan-400" },
  XP: { key: "XP", label: "XP", gradient: "from-zinc-900 via-yellow-900 to-black", textColor: "text-yellow-100", chipGradient: "from-yellow-300 to-amber-400" },
  PICPAY: { key: "PICPAY", label: "PicPay", gradient: "from-green-600 via-green-500 to-emerald-700", textColor: "text-white", chipGradient: "from-lime-300 to-green-400" },
  MERCADOPAGO: { key: "MERCADOPAGO", label: "Mercado Pago", gradient: "from-cyan-500 via-blue-500 to-blue-700", textColor: "text-white", chipGradient: "from-cyan-200 to-blue-300" },
  PAGBANK: { key: "PAGBANK", label: "PagBank", gradient: "from-yellow-400 via-yellow-500 to-orange-600", textColor: "text-zinc-900", chipGradient: "from-yellow-200 to-orange-300" },
  SAFRA: { key: "SAFRA", label: "Safra", gradient: "from-blue-900 via-indigo-900 to-slate-900", textColor: "text-white", chipGradient: "from-blue-300 to-indigo-400" },
  NEON: { key: "NEON", label: "Neon", gradient: "from-emerald-500 via-teal-500 to-cyan-600", textColor: "text-white", chipGradient: "from-emerald-200 to-teal-300" },
  WILL: { key: "WILL", label: "Will Bank", gradient: "from-yellow-300 via-yellow-400 to-orange-500", textColor: "text-zinc-900", chipGradient: "from-yellow-100 to-yellow-300" },
  ORIGINAL: { key: "ORIGINAL", label: "Original", gradient: "from-emerald-600 via-green-700 to-zinc-900", textColor: "text-white", chipGradient: "from-emerald-200 to-green-300" },
  PAN: { key: "PAN", label: "Banco Pan", gradient: "from-blue-600 via-cyan-500 to-teal-600", textColor: "text-white", chipGradient: "from-cyan-200 to-blue-300" },
  BMG: { key: "BMG", label: "BMG", gradient: "from-orange-500 via-red-600 to-red-900", textColor: "text-white", chipGradient: "from-orange-200 to-red-300" },
  MODAL: { key: "MODAL", label: "Modal", gradient: "from-slate-800 via-slate-900 to-black", textColor: "text-white", chipGradient: "from-slate-300 to-slate-400" },
  DAYCOVAL: { key: "DAYCOVAL", label: "Daycoval", gradient: "from-blue-800 via-blue-900 to-indigo-900", textColor: "text-white", chipGradient: "from-blue-300 to-indigo-400" },
  VOTORANTIM: { key: "VOTORANTIM", label: "BV", gradient: "from-orange-500 via-red-500 to-rose-700", textColor: "text-white", chipGradient: "from-orange-200 to-red-300" },
  SICOOB: { key: "SICOOB", label: "Sicoob", gradient: "from-emerald-700 via-green-700 to-teal-800", textColor: "text-white", chipGradient: "from-emerald-200 to-green-300" },
  SICREDI: { key: "SICREDI", label: "Sicredi", gradient: "from-green-700 via-emerald-800 to-green-900", textColor: "text-white", chipGradient: "from-green-200 to-emerald-300" },
  BANRISUL: { key: "BANRISUL", label: "Banrisul", gradient: "from-blue-700 via-sky-700 to-blue-900", textColor: "text-white", chipGradient: "from-sky-200 to-blue-300" },
  MERCANTIL: { key: "MERCANTIL", label: "Mercantil", gradient: "from-amber-600 via-orange-700 to-red-800", textColor: "text-white", chipGradient: "from-amber-200 to-orange-300" },
  BANESTES: { key: "BANESTES", label: "Banestes", gradient: "from-blue-600 via-blue-700 to-cyan-800", textColor: "text-white", chipGradient: "from-cyan-200 to-blue-300" },
  RENNER: { key: "RENNER", label: "Realize Renner", gradient: "from-zinc-800 via-stone-900 to-black", textColor: "text-white", chipGradient: "from-stone-200 to-zinc-300" },
  CARREFOUR: { key: "CARREFOUR", label: "Carrefour", gradient: "from-blue-600 via-red-600 to-red-800", textColor: "text-white", chipGradient: "from-red-200 to-blue-300" },
  MAGALU: { key: "MAGALU", label: "Luiza Card", gradient: "from-blue-500 via-cyan-500 to-blue-700", textColor: "text-white", chipGradient: "from-cyan-200 to-blue-300" },
  AMAZON: { key: "AMAZON", label: "Amazon", gradient: "from-zinc-900 via-stone-900 to-orange-900", textColor: "text-white", chipGradient: "from-orange-300 to-amber-400" },
  STONE: { key: "STONE", label: "Stone", gradient: "from-emerald-500 via-green-600 to-teal-700", textColor: "text-white", chipGradient: "from-emerald-200 to-green-300" },
  SUMUP: { key: "SUMUP", label: "SumUp", gradient: "from-cyan-500 via-teal-600 to-blue-700", textColor: "text-white", chipGradient: "from-cyan-200 to-teal-300" },
  GENERIC_PURPLE: { key: "GENERIC_PURPLE", label: "", gradient: "from-purple-700 via-purple-800 to-indigo-900", textColor: "text-white", chipGradient: "from-purple-200 to-fuchsia-300" },
  GENERIC_RED: { key: "GENERIC_RED", label: "", gradient: "from-red-700 via-red-800 to-rose-900", textColor: "text-white", chipGradient: "from-red-200 to-orange-300" },
  GENERIC_BLUE: { key: "GENERIC_BLUE", label: "", gradient: "from-blue-700 via-blue-800 to-indigo-900", textColor: "text-white", chipGradient: "from-blue-200 to-cyan-300" },
  GENERIC_GREEN: { key: "GENERIC_GREEN", label: "", gradient: "from-emerald-700 via-green-700 to-teal-800", textColor: "text-white", chipGradient: "from-emerald-200 to-green-300" },
  GENERIC_BLACK: { key: "GENERIC_BLACK", label: "", gradient: "from-zinc-900 via-stone-900 to-black", textColor: "text-white", chipGradient: "from-stone-300 to-zinc-400" },
  GENERIC_ORANGE: { key: "GENERIC_ORANGE", label: "", gradient: "from-orange-600 via-red-600 to-rose-800", textColor: "text-white", chipGradient: "from-yellow-200 to-orange-300" },
};

function detectBank(rawNumber: string): BankInfo | null {
  const n = rawNumber.replace(/\D/g, "");
  if (n.length < 4) return null;
  const bin6 = n.slice(0, 6);
  const bin4 = n.slice(0, 4);

  // ---- Tiers premium (BIN 6 dígitos exatos) ----
  if (/^(540516|540517|552337|554134|552641)/.test(bin6)) return BANKS.ITAU_BLACK;
  if (/^(556610|556611)/.test(bin6)) return BANKS.C6_CARBON;
  if (/^(533559|542530|552692)/.test(bin6)) return BANKS.NUBANK_ULTRA;
  if (/^(556059)/.test(bin6)) return BANKS.BB_BLACK;

  // ---- NUBANK (Mastercard 5162/5302/5234, Visa 4011/4389/4514, Elo 6505) ----
  if (/^(5162|5234|5302|5532|5550|6505|4011|4389|4514|4576|4577)/.test(bin4) &&
      /^(516292|516293|523445|530217|553248|555036|650516|401178|438935|451416|457631|457632)/.test(bin6)) {
    return BANKS.NUBANK;
  }
  if (/^(401178|438935|451416|457631|457632|516292|516293|523445|530217|553248|555036|650516|650487|650488|655595|655596|627780)/.test(bin6)) return BANKS.NUBANK;

  // ---- ITAÚ ----
  if (/^(498409|498410|516292|549035|549036|627892|636206|636207|549167|552033)/.test(bin6)) return BANKS.ITAU;

  // ---- BRADESCO ----
  if (/^(438568|448936|453978|516259|548787|552032|636370|627874|552025|554313)/.test(bin6)) return BANKS.BRADESCO;

  // ---- BANCO DO BRASIL ----
  if (/^(438476|453211|461353|490951|503879|548132|552032|627871|556057|556058)/.test(bin6)) return BANKS.BB;

  // ---- SANTANDER ----
  if (/^(411614|438970|448949|451476|452358|460628|516229|529965|540982|548932|552037|552038)/.test(bin6)) return BANKS.SANTANDER;

  // ---- CAIXA ----
  if (/^(401723|438622|453974|548126|552241|627780|636368)/.test(bin6)) return BANKS.CAIXA;

  // ---- INTER ----
  if (/^(458247|526438|527620|530988|552689|627892)/.test(bin6)) return BANKS.INTER;

  // ---- C6 BANK ----
  if (/^(467481|516454|529961|535129|542502)/.test(bin6)) return BANKS.C6;

  // ---- PICPAY ----
  if (/^(536428|552037|524301)/.test(bin6)) return BANKS.PICPAY;

  // ---- MERCADO PAGO ----
  if (/^(515590|535113|554115|552037)/.test(bin6)) return BANKS.MERCADOPAGO;

  // ---- PAGBANK ----
  if (/^(415230|526389|548126|516247)/.test(bin6)) return BANKS.PAGBANK;

  // ---- BTG / XP / SAFRA / NEON ----
  if (/^(530901|552037|554115)/.test(bin6)) return BANKS.BTG;
  if (/^(517288|552641)/.test(bin6)) return BANKS.XP;
  if (/^(553127|516229)/.test(bin6)) return BANKS.SAFRA;
  if (/^(553035|417400|438876)/.test(bin6)) return BANKS.NEON;

  return null;
}

function detectBrand(number: string): { name: string; Logo: React.FC<{ className?: string }>; gradient: string } {
  const n = number.replace(/\s/g, "");
  if (/^4/.test(n)) return { name: "VISA", Logo: VisaLogo, gradient: "from-blue-700 via-blue-600 to-indigo-800" };
  if (/^(5[1-5]|2[2-7])/.test(n)) return { name: "MASTERCARD", Logo: MastercardLogo, gradient: "from-red-700 via-orange-600 to-yellow-600" };
  if (/^3[47]/.test(n)) return { name: "AMEX", Logo: AmexLogo, gradient: "from-emerald-700 via-emerald-600 to-teal-700" };
  if (/^(606282|3841)/.test(n)) return { name: "HIPERCARD", Logo: HipercardLogo, gradient: "from-rose-700 via-red-600 to-rose-800" };
  if (/^(4011|4312|4389|4514|4573|5041|5066|5067|509|6277|6362|6363|6504|6509|6516|6550)/.test(n)) {
    return { name: "ELO", Logo: EloLogo, gradient: "from-zinc-800 via-zinc-700 to-zinc-900" };
  }
  return { name: "CARTÃO", Logo: GenericCardLogo, gradient: "from-slate-800 via-slate-700 to-slate-900" };
}

function getBankLogo(key: BankKey): React.FC<{ className?: string }> | null {
  switch (key) {
    case "NUBANK":
    case "NUBANK_ULTRA": return NubankLogo;
    case "ITAU":
    case "ITAU_BLACK":
      return ItauLogo;
    case "ITI": return ItiLogo;
    case "BB":
    case "BB_BLACK": return BBLogo;
    case "BRADESCO": return BradescoLogo;
    case "NEXT": return NextLogo;
    case "DIGIO": return DigioLogo;
    case "SANTANDER": return SantanderLogo;
    case "CAIXA": return CaixaLogo;
    case "INTER": return InterLogo;
    case "C6":
    case "C6_CARBON": return C6Logo;
    case "BTG": return BTGLogo;
    case "XP": return XPLogo;
    case "PICPAY": return PicPayLogo;
    case "MERCADOPAGO": return MercadoPagoLogo;
    case "PAGBANK": return PagBankLogo;
    case "SAFRA": return SafraLogo;
    case "NEON": return NeonLogo;
    case "WILL": return WillLogo;
    case "ORIGINAL": return OriginalLogo;
    case "PAN": return PanLogo;
    case "BMG": return BMGLogo;
    case "MODAL": return ModalLogo;
    case "DAYCOVAL": return DaycovalLogo;
    case "VOTORANTIM": return BVLogo;
    case "SICOOB": return SicoobLogo;
    case "SICREDI": return SicrediLogo;
    case "BANRISUL": return BanrisulLogo;
    case "MERCANTIL": return MercantilLogo;
    case "BANESTES": return BanestesLogo;
    case "RENNER": return RennerLogo;
    case "CARREFOUR": return CarrefourLogo;
    case "MAGALU": return MagaluLogo;
    case "AMAZON": return AmazonLogo;
    case "STONE": return StoneLogo;
    case "SUMUP": return SumUpLogo;
    default: return null;
  }
}

// Mapeia nome do banco vindo da API para nosso BankInfo
function bankFromApiName(name: string): BankInfo | null {
  const n = name.toUpperCase();
  // Digitais & big banks
  if (n.includes("NU PAGAMENTOS") || n.includes("NUBANK") || n.includes("NU FINANCEIRA")) return BANKS.NUBANK;
  if (n.includes("ITI ")) return BANKS.ITI;
  if (n.includes("ITAU") || n.includes("ITAÚ")) return BANKS.ITAU;
  if (n.includes("NEXT")) return BANKS.NEXT;
  if (n.includes("DIGIO")) return BANKS.DIGIO;
  if (n.includes("BRADESCO")) return BANKS.BRADESCO;
  if (n.includes("BANCO DO BRASIL") || n === "BB" || n.includes("BCO DO BRASIL") || n.includes("BANCO BRASIL")) return BANKS.BB;
  if (n.includes("SANTANDER")) return BANKS.SANTANDER;
  if (n.includes("CAIXA")) return BANKS.CAIXA;
  if (n.includes("INTER")) return BANKS.INTER;
  if (n.includes("C6")) return BANKS.C6;
  if (n.includes("BTG")) return BANKS.BTG;
  if (n.includes("BANCO XP") || n === "XP" || n.includes("XP INVEST")) return BANKS.XP;
  if (n.includes("PICPAY") || n.includes("PIC PAY")) return BANKS.PICPAY;
  if (n.includes("MERCADO PAGO") || n.includes("MERCADOPAGO")) return BANKS.MERCADOPAGO;
  if (n.includes("PAGSEGURO") || n.includes("PAGBANK") || n.includes("PAG SEGURO")) return BANKS.PAGBANK;
  if (n.includes("SAFRA")) return BANKS.SAFRA;
  if (n.includes("NEON")) return BANKS.NEON;
  // Outros digitais & médios
  if (n.includes("WILL") || n.includes("WILLBANK")) return BANKS.WILL;
  if (n.includes("ORIGINAL")) return BANKS.ORIGINAL;
  if (n.includes("PAN") || n.includes("BANCO PAN")) return BANKS.PAN;
  if (n.includes("BMG")) return BANKS.BMG;
  if (n.includes("MODAL")) return BANKS.MODAL;
  if (n.includes("DAYCOVAL")) return BANKS.DAYCOVAL;
  if (n.includes("VOTORANTIM") || n.includes("BANCO BV") || n === "BV") return BANKS.VOTORANTIM;
  // Cooperativas & regionais
  if (n.includes("SICOOB") || n.includes("BANCOOB")) return BANKS.SICOOB;
  if (n.includes("SICREDI")) return BANKS.SICREDI;
  if (n.includes("BANRISUL")) return BANKS.BANRISUL;
  if (n.includes("MERCANTIL")) return BANKS.MERCANTIL;
  if (n.includes("BANESTES")) return BANKS.BANESTES;
  // Cartões de varejo
  if (n.includes("RENNER") || n.includes("REALIZE")) return BANKS.RENNER;
  if (n.includes("CARREFOUR")) return BANKS.CARREFOUR;
  if (n.includes("LUIZACRED") || n.includes("MAGAZINE LUIZA") || n.includes("MAGALU")) return BANKS.MAGALU;
  if (n.includes("AMAZON")) return BANKS.AMAZON;
  // Adquirentes / sub-aquirentes
  if (n.includes("STONE")) return BANKS.STONE;
  if (n.includes("SUMUP")) return BANKS.SUMUP;
  return null;
}

// Quando não temos logo SVG mas API retornou nome, escolhe paleta inteligente
function genericBankByName(name: string): BankInfo {
  const n = name.toUpperCase();
  if (/NU |NU$|ROXO|UNIVERS|ULTRA/.test(n)) return BANKS.GENERIC_PURPLE;
  if (/RED|VERMELH|ROSE|CRIMSON|BRADESCO|SANTAND/.test(n)) return BANKS.GENERIC_RED;
  if (/GREEN|VERDE|EMERALD|TEAL|COOP|SICRED|SICOOB|ORIGIN/.test(n)) return BANKS.GENERIC_GREEN;
  if (/BLACK|NOIR|PRETO|DARK|PRIME|PLATIN/.test(n)) return BANKS.GENERIC_BLACK;
  if (/ORANGE|LARANJA|ITAÚ|ITAU|INTER|BMG|HIPER/.test(n)) return BANKS.GENERIC_ORANGE;
  return BANKS.GENERIC_BLUE;
}

// Detecta brand pelo nome retornado pela API (Visa, Master, Elo, Amex, Hiper)
function brandFromApiName(scheme: string): { name: string; Logo: React.FC<{ className?: string }>; gradient: string } | null {
  const s = scheme.toUpperCase();
  if (s.includes("VISA")) return { name: "VISA", Logo: VisaLogo, gradient: "from-blue-700 via-blue-600 to-indigo-800" };
  if (s.includes("MASTER")) return { name: "MASTERCARD", Logo: MastercardLogo, gradient: "from-red-700 via-orange-600 to-yellow-600" };
  if (s.includes("AMEX") || s.includes("AMERICAN")) return { name: "AMEX", Logo: AmexLogo, gradient: "from-emerald-700 via-emerald-600 to-teal-700" };
  if (s.includes("ELO")) return { name: "ELO", Logo: EloLogo, gradient: "from-zinc-800 via-zinc-700 to-zinc-900" };
  if (s.includes("HIPER")) return { name: "HIPERCARD", Logo: HipercardLogo, gradient: "from-rose-700 via-red-600 to-rose-800" };
  return null;
}

export function VirtualCard({ number, name, expiry, cvv, flipped, gatewayBankName, gatewayBrandName }: VirtualCardProps) {
  const cleanNumber = useMemo(() => number.replace(/\s/g, ""), [number]);

  // Detecção local imediata
  const local = useMemo(() => {
    const b = detectBrand(cleanNumber);
    const bk = detectBank(cleanNumber);
    return { brand: b, bank: bk };
  }, [cleanNumber]);

  const gatewayBank = gatewayBankName ? bankFromApiName(gatewayBankName) : null;
  const gatewayGeneric = gatewayBankName && !gatewayBank ? genericBankByName(gatewayBankName) : null;
  const gatewayBrand = gatewayBrandName ? brandFromApiName(gatewayBrandName) : null;

  // Banco final: 1) gateway real, 2) detecção local, 3) fallback inteligente pelo nome cru
  const bank = gatewayBank || local.bank || gatewayGeneric || null;
  const bankDisplayLabel = gatewayBank?.label || local.bank?.label || gatewayBankName || null;
  const brand = gatewayBrand || local.brand;
  const gradient = bank?.gradient || brand.gradient;
  const textColor = bank?.textColor || "text-white";
  const chipGradient = bank?.chipGradient || "from-yellow-300 to-yellow-500";
  const BankLogoComp = bank ? getBankLogo(bank.key) : null;
  const rawBankWordmark = !BankLogoComp && bankDisplayLabel ? bankDisplayLabel : null;

  const display = (number || "").padEnd(19, "•").slice(0, 19);
  const groups = display.match(/.{1,4}/g) || [];
  const BrandLogo = brand.Logo;

  return (
    <div className="w-full max-w-[380px] mx-auto perspective-1000">
      <div
        className={`relative w-full aspect-[1.586/1] transition-transform duration-700 transform-style-3d ${flipped ? "[transform:rotateY(180deg)]" : ""}`}
        style={{ transformStyle: "preserve-3d" }}
      >
        {/* FRENTE */}
        <div
          className={`absolute inset-0 rounded-2xl p-5 ${textColor} shadow-2xl bg-gradient-to-br ${gradient} backface-hidden flex flex-col justify-between overflow-hidden`}
          style={{ backfaceVisibility: "hidden" }}
        >
          <div className="absolute -top-12 -right-12 w-48 h-48 bg-white/10 rounded-full blur-2xl pointer-events-none" />
          <div className="absolute -bottom-16 -left-10 w-56 h-56 bg-black/30 rounded-full blur-3xl pointer-events-none" />

          <div className="flex items-start justify-between relative z-10">
            <div className="flex flex-col gap-1">
              <div className={`w-10 h-7 rounded-md bg-gradient-to-br ${chipGradient} shadow-inner border border-black/20`} />
              <Wifi className="h-4 w-4 rotate-90 opacity-80" />
            </div>
            <div className="flex flex-col items-end gap-1 max-w-[55%]">
              {BankLogoComp ? (
                <div className="flex items-center justify-end">
                  <BankLogoComp className="h-5 sm:h-6 max-w-[120px]" />
                </div>
              ) : rawBankWordmark ? (
                <span className="text-sm sm:text-base font-black tracking-tight uppercase text-right leading-none max-w-[140px] truncate drop-shadow">
                  {rawBankWordmark}
                </span>
              ) : null}
              {bankDisplayLabel && BankLogoComp && (
                <span className="text-[10px] font-bold tracking-widest opacity-90 drop-shadow uppercase text-right leading-tight max-w-[150px] truncate">
                  {bankDisplayLabel}
                </span>
              )}
            </div>
          </div>

          <div className="relative z-10 font-mono text-lg sm:text-xl tracking-[0.18em] drop-shadow-md flex gap-2">
            {groups.map((g, i) => (
              <span key={i}>{g}</span>
            ))}
          </div>

          <div className="flex items-end justify-between relative z-10 text-[10px] uppercase tracking-widest gap-3">
            <div className="min-w-0 flex-1">
              <div className="opacity-70">Titular</div>
              <div className="font-semibold text-sm tracking-wide truncate">{name || "SEU NOME AQUI"}</div>
            </div>
            <div className="text-right">
              <div className="opacity-70">Validade</div>
              <div className="font-semibold text-sm tracking-wide font-mono">{expiry || "MM/AA"}</div>
            </div>
            <div className="flex items-end">
              <BrandLogo className="h-7 w-auto drop-shadow" />
            </div>
          </div>
        </div>

        {/* VERSO */}
        <div
          className={`absolute inset-0 rounded-2xl ${textColor} shadow-2xl bg-gradient-to-br ${gradient} overflow-hidden`}
          style={{ backfaceVisibility: "hidden", transform: "rotateY(180deg)" }}
        >
          <div className="h-10 bg-black/80 mt-5" />
          <div className="px-5 mt-4">
            <div className="bg-white/95 text-black rounded-md h-9 flex items-center px-3 font-mono tracking-widest text-sm">
              <span className="flex-1 text-right opacity-50">••••••••</span>
              <span className="ml-3 font-bold">{cvv || "CVV"}</span>
            </div>
            <div className="flex items-center justify-between mt-3">
              <p className="text-[10px] opacity-70">Código de segurança</p>
              <BrandLogo className="h-5 w-auto opacity-90" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

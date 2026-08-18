/**
 * Controle central dos selos "Novo" no menu.
 * Cada recurso registra a data de lançamento (YYYY-MM-DD).
 * O selo aparece automaticamente por 30 dias e some sozinho depois disso.
 */
export const NEW_BADGE_DAYS = 30;

// Data de lançamento de cada item do menu. Ao lançar algo novo,
// basta adicionar/atualizar a data aqui — o selo expira sozinho em 30 dias.
export const FEATURE_RELEASE_DATES: Record<string, string> = {
  vendas_externas: "2025-11-01",
  colaboradores: "2025-09-15",
  central_ia: "2025-10-01",
  automacao: "2025-08-20",
  whatsapp_ia: "2025-08-20",
  indicacoes: "2025-07-10",
  indicacoes_plataforma: "2025-07-10",
  fidelidade: "2025-09-01",
  roleta: "2025-09-01",
};

export function isFeatureNew(key: string): boolean {
  const date = FEATURE_RELEASE_DATES[key];
  if (!date) return false;
  const released = new Date(`${date}T00:00:00Z`).getTime();
  if (Number.isNaN(released)) return false;
  const ageDays = (Date.now() - released) / (1000 * 60 * 60 * 24);
  return ageDays >= 0 && ageDays <= NEW_BADGE_DAYS;
}

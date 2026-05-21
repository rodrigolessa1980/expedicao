/** Macrorregiões oficiais do Brasil (IBGE). */
export const REGIOES_BRASIL = [
  "Norte",
  "Nordeste",
  "Centro-Oeste",
  "Sudeste",
  "Sul",
] as const;

export type RegiaoBrasil = (typeof REGIOES_BRASIL)[number];

export function isRegiaoBrasil(value: string): value is RegiaoBrasil {
  return (REGIOES_BRASIL as readonly string[]).includes(value);
}

export function pedidoSemRegiao(regiao?: string | null): boolean {
  return !String(regiao ?? "").trim();
}

export const REGIOES_BRASIL = ["Norte", "Nordeste", "Centro-Oeste", "Sudeste", "Sul"];

export function isRegiaoBrasil(value) {
  return REGIOES_BRASIL.includes(String(value ?? "").trim());
}

/** Mantém região já salva quando o update não envia valor novo (evita apagar no banco). */
export function resolveRegiaoOnUpdate(payload, currentRegiao) {
  if (!payload || !("regiao" in payload)) {
    return String(currentRegiao ?? "").trim() || "";
  }
  const informada = String(payload.regiao ?? "").trim();
  if (informada) return informada;
  return String(currentRegiao ?? "").trim() || "";
}

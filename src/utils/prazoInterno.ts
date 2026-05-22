import { dayjs } from "./date";
import type { Pedido, Status } from "../types";

/** Menor prazo interno (Sul) — usado como estimativa quando a região não está definida. */
export const PRAZO_INTERNO_MINIMO_DIAS = 8;

export const MSG_SELECIONE_REGIAO_PRAZO =
  "Selecione a região do pedido para contabilizar o prazo interno corretamente. Exibindo estimativa com o menor prazo (8 dias corridos — Sul).";

/** Dias corridos máximos a partir da data do pedido, por macrorregião. */
const DIAS_PRAZO_INTERNO: Record<string, number> = {
  Sul: 8,
  "Centro-Oeste": 10,
  Norte: 16,
  Nordeste: 16,
  Sudeste: 10,
};

export type DiasPrazoInterno = {
  dias: number;
  estimativaSemRegiao: boolean;
};

export type PrazoInternoInfo = {
  diasCorridos: number;
  dataPrazo: string;
  percentualNaEscala: number;
  ultrapassado: boolean;
  estimativaSemRegiao: boolean;
};

export function diasPrazoInternoPorRegiao(regiao: string): DiasPrazoInterno {
  const chave = String(regiao ?? "").trim();
  if (!chave || !(chave in DIAS_PRAZO_INTERNO)) {
    return { dias: PRAZO_INTERNO_MINIMO_DIAS, estimativaSemRegiao: true };
  }
  return { dias: DIAS_PRAZO_INTERNO[chave], estimativaSemRegiao: false };
}

/** Prazo interno = data do pedido + N dias corridos. */
export function dataPrazoInterno(dataPedido: string, diasCorridos: number): string | null {
  const inicio = dayjs(`${dataPedido}T00:00:00`);
  if (!inicio.isValid()) return null;
  return inicio.add(diasCorridos, "day").format("YYYY-MM-DD");
}

export function calcularPrazoInterno(
  regiao: string,
  dataPedido: string,
  totalDiasEscala: number,
): PrazoInternoInfo | null {
  const { dias, estimativaSemRegiao } = diasPrazoInternoPorRegiao(regiao);
  const dataPrazo = dataPrazoInterno(dataPedido, dias);
  if (!dataPrazo) return null;

  const escala = Math.max(1, totalDiasEscala);
  const percentualNaEscala = Math.max(0, Math.min(100, (dias / escala) * 100));
  const ultrapassado = dayjs().startOf("day").isAfter(dayjs(`${dataPrazo}T00:00:00`));

  return { diasCorridos: dias, dataPrazo, percentualNaEscala, ultrapassado, estimativaSemRegiao };
}

export type AvaliacaoPrazoInternoPedido = {
  dentro: boolean;
  dataPrazo: string;
  estimativaSemRegiao: boolean;
};

export type ResumoDentroPrazoInternoKpi = {
  total: number;
  dentro: number;
  fora: number;
  dentroPercentual: number;
  foraPercentual: number;
  comEstimativaRegiao: number;
  conic: string;
};

function pedidoConcluido(pedido: Pedido, status: Status[]): boolean {
  const statusItem = status.find((s) => s.id === pedido.statusAtual);
  return statusItem?.nome.toLowerCase().includes("finalizado") || !!pedido.dataEntrega?.trim();
}

function dataReferenciaAvaliacao(pedido: Pedido, concluido: boolean) {
  if (pedido.dataEntrega?.trim()) {
    return dayjs(`${pedido.dataEntrega}T00:00:00`).startOf("day");
  }
  if (concluido) {
    if (pedido.dataExpedicao?.trim()) return dayjs(`${pedido.dataExpedicao}T00:00:00`).startOf("day");
    if (pedido.dataFaturamento?.trim()) return dayjs(`${pedido.dataFaturamento}T00:00:00`).startOf("day");
  }
  return dayjs().startOf("day");
}

/** Avalia se o pedido está dentro do prazo interno da região (ou estimativa mínima). */
export function avaliarPrazoInternoPedido(pedido: Pedido, status: Status[]): AvaliacaoPrazoInternoPedido | null {
  const { dias, estimativaSemRegiao } = diasPrazoInternoPorRegiao(pedido.regiao);
  const dataPrazo = dataPrazoInterno(pedido.dataPedido, dias);
  if (!dataPrazo) return null;

  const limite = dayjs(`${dataPrazo}T00:00:00`).startOf("day");
  const referencia = dataReferenciaAvaliacao(pedido, pedidoConcluido(pedido, status));
  const dentro = referencia.isBefore(limite, "day") || referencia.isSame(limite, "day");

  return { dentro, dataPrazo, estimativaSemRegiao };
}

export function calcularResumoDentroPrazoInterno(pedidos: Pedido[], status: Status[]): ResumoDentroPrazoInternoKpi {
  let total = 0;
  let dentro = 0;
  let fora = 0;
  let comEstimativaRegiao = 0;

  for (const pedido of pedidos) {
    const avaliacao = avaliarPrazoInternoPedido(pedido, status);
    if (!avaliacao) continue;
    total += 1;
    if (avaliacao.estimativaSemRegiao) comEstimativaRegiao += 1;
    if (avaliacao.dentro) dentro += 1;
    else fora += 1;
  }

  const foraPercentual = total > 0 ? (fora / total) * 100 : 0;
  const dentroPercentual = total > 0 ? (dentro / total) * 100 : 0;
  const conic =
    total > 0
      ? `conic-gradient(#0f172a 0% ${foraPercentual.toFixed(2)}%, #16a34a ${foraPercentual.toFixed(2)}% 100%)`
      : "conic-gradient(#e5e7eb 0% 100%)";

  return { total, dentro, fora, dentroPercentual, foraPercentual, comEstimativaRegiao, conic };
}

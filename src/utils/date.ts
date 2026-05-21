import dayjs from "dayjs";
export { dayjs };

/** Prazo usado para atraso: agendamento, quando informado, substitui o prazo contratual. */
export function prazoEfetivoEntrega(prazoEntrega: string, dataAgendamento?: string): string {
  const agendamento = dataAgendamento?.trim();
  return agendamento || prazoEntrega;
}

export function diasParaPrazo(prazoEntrega: string, dataAgendamento?: string): number {
  const prazo = prazoEfetivoEntrega(prazoEntrega, dataAgendamento);
  return dayjs(prazo).startOf("day").diff(dayjs().startOf("day"), "day");
}

/** Dias excedentes do prazo efetivo (agendamento ou prazo de entrega). */
export function diasEmAtraso(prazoEntrega: string, dataAgendamento?: string): number {
  const dias = diasParaPrazo(prazoEntrega, dataAgendamento);
  return dias < 0 ? Math.abs(dias) : 0;
}

/** Alinhado ao trigger do backend (ATRASO_PEDIDO_DIAS_ATRASO, padrao 1). */
export const DIAS_ATRASO_MINIMOS = 1;

export function labelPrazo(prazoEntrega: string, dataAgendamento?: string): string {
  const dias = diasParaPrazo(prazoEntrega, dataAgendamento);
  if (dias < 0) return "ATRASADO";
  return `D-${dias}`;
}

export function isAtrasado(
  prazoEntrega: string,
  dataAgendamento?: string,
  minDiasAtraso: number = DIAS_ATRASO_MINIMOS,
): boolean {
  return diasEmAtraso(prazoEntrega, dataAgendamento) >= minDiasAtraso;
}

export function isPrazoProximo(prazoEntrega: string, dataAgendamento?: string): boolean {
  const dias = diasParaPrazo(prazoEntrega, dataAgendamento);
  return dias >= 0 && dias <= 2;
}

export function formatarData(data: string): string {
  return dayjs(data).format("DD/MM/YYYY");
}

export function infoFinalizado(
  prazoEntrega: string,
  dataEntrega: string,
  dataAgendamento?: string,
): { label: string; cor: "verde" | "vermelha" } {
  const prazo = dayjs(prazoEfetivoEntrega(prazoEntrega, dataAgendamento)).startOf("day");
  const entrega = dayjs(dataEntrega).startOf("day");
  const diff = prazo.diff(entrega, "day"); // positivo = antecipado, negativo = atrasado

  if (diff > 0) {
    return { label: `${diff} dia${diff !== 1 ? "s" : ""} de antecedência`, cor: "verde" };
  }
  if (diff < 0) {
    const atraso = Math.abs(diff);
    return { label: `Atraso ${atraso} dia${atraso !== 1 ? "s" : ""}`, cor: "vermelha" };
  }
  return { label: "no prazo", cor: "verde" };
}

type FaixaPrazo = "verde" | "amarela" | "vermelha";

export function faixaPrazoPorEtapa(dataFaturamento: string, prazoEntrega: string): FaixaPrazo {
  const hoje = dayjs().startOf("day");
  const inicio = dayjs(dataFaturamento).startOf("day");
  const fim = dayjs(prazoEntrega).startOf("day");

  const totalDias = Math.max(fim.diff(inicio, "day"), 1);
  const diasDecorridos = Math.max(0, hoje.diff(inicio, "day"));
  const progresso = diasDecorridos / totalDias;

  if (hoje.isAfter(fim, "day")) return "vermelha";
  if (progresso < 1 / 3) return "verde";
  if (progresso < 2 / 3) return "amarela";
  return "vermelha";
}

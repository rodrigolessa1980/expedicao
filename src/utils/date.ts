import dayjs from "dayjs";
export { dayjs };

export function diasParaPrazo(prazoEntrega: string): number {
  return dayjs(prazoEntrega).startOf("day").diff(dayjs().startOf("day"), "day");
}

export function labelPrazo(prazoEntrega: string): string {
  const dias = diasParaPrazo(prazoEntrega);
  if (dias < 0) return "ATRASADO";
  return `D-${dias}`;
}

export function isAtrasado(prazoEntrega: string): boolean {
  return diasParaPrazo(prazoEntrega) < 0;
}

export function isPrazoProximo(prazoEntrega: string): boolean {
  const dias = diasParaPrazo(prazoEntrega);
  return dias >= 0 && dias <= 2;
}

export function formatarData(data: string): string {
  return dayjs(data).format("DD/MM/YYYY");
}

export function infoFinalizado(
  prazoEntrega: string,
  dataEntrega: string,
): { label: string; cor: "verde" | "vermelha" } {
  const prazo = dayjs(prazoEntrega).startOf("day");
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

import { getAtrasoPedidoDiasAtraso } from "./atrasoPedidoConfig.js";

/** Normaliza DATE do MySQL (Date ou string) para YYYY-MM-DD. */
export function toDateOnlyString(value) {
  if (value == null || value === "") return "";
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return "";
    const y = value.getUTCFullYear();
    const m = String(value.getUTCMonth() + 1).padStart(2, "0");
    const d = String(value.getUTCDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }
  const raw = String(value).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) return raw.slice(0, 10);
  const parsed = new Date(raw);
  if (!Number.isNaN(parsed.getTime())) return toDateOnlyString(parsed);
  return "";
}

function startOfDay(value) {
  const iso = toDateOnlyString(value);
  if (!iso) return null;
  const [y, m, d] = iso.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  date.setHours(0, 0, 0, 0);
  return date;
}

export function prazoEfetivoEntrega(prazoEntrega, dataAgendamento) {
  const agendamento = toDateOnlyString(dataAgendamento);
  return agendamento || toDateOnlyString(prazoEntrega);
}

export function diasParaPrazo(prazoEntrega, dataAgendamento) {
  const prazo = prazoEfetivoEntrega(prazoEntrega, dataAgendamento);
  if (!prazo) return 0;
  const prazoDate = startOfDay(prazo);
  const hoje = startOfDay(new Date());
  if (!prazoDate || !hoje) return 0;
  return Math.round((prazoDate.getTime() - hoje.getTime()) / 86400000);
}

/** Dias excedentes do prazo efetivo (agendamento ou prazo de entrega). Zero se ainda no prazo. */
export function diasEmAtraso(prazoEntrega, dataAgendamento) {
  const dias = diasParaPrazo(prazoEntrega, dataAgendamento);
  return dias < 0 ? Math.abs(dias) : 0;
}

export function isPedidoAtrasado(pedido, minDiasAtraso = getAtrasoPedidoDiasAtraso()) {
  if (!pedido) return false;
  if (pedido.statusAtual === "finalizado") return false;
  if (String(pedido.dataEntrega ?? "").trim()) return false;
  const prazo = String(pedido.prazoEntrega ?? "").trim();
  if (!prazo) return false;
  return diasEmAtraso(prazo, pedido.dataAgendamento) >= minDiasAtraso;
}

export function formatarDataBr(value) {
  const raw = toDateOnlyString(value);
  if (!raw) return "-";
  const [ano, mes, dia] = raw.split("-");
  return `${dia}/${mes}/${ano}`;
}

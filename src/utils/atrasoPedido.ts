import type { Pedido, Status } from "../types";
import { DIAS_ATRASO_MINIMOS, diasEmAtraso } from "./date";

export function pedidoElegivelNotificacaoAtraso(pedido: Pedido, status: Status[]): boolean {
  const statusItem = status.find((s) => s.id === pedido.statusAtual);
  const concluido = statusItem?.nome.toLowerCase().includes("finalizado") || !!pedido.dataEntrega?.trim();
  if (concluido) return false;
  if (pedido.notificacaoAtrasoEnviada) return false;
  if (!pedido.prazoEntrega?.trim()) return false;
  return diasEmAtraso(pedido.prazoEntrega, pedido.dataAgendamento) >= DIAS_ATRASO_MINIMOS;
}

export function listarPedidosElegiveisAtraso(pedidos: Pedido[], status: Status[]): Pedido[] {
  return pedidos.filter((pedido) => pedidoElegivelNotificacaoAtraso(pedido, status));
}

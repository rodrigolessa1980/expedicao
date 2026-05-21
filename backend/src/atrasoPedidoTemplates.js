import { diasEmAtraso, formatarDataBr, prazoEfetivoEntrega } from "./atrasoPedidoUtils.js";

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

export function atrasoPedidoHtmlTemplate({ pedido, statusNome, statusCor }) {
  const prazoEfetivo = prazoEfetivoEntrega(pedido.prazoEntrega, pedido.dataAgendamento);
  const diasAtraso = diasEmAtraso(pedido.prazoEntrega, pedido.dataAgendamento);

  const rows = [
    ["Numero do pedido", pedido.numeroPedido],
    ["Cliente", pedido.cliente],
    ["Representante", pedido.representante || "-"],
    ["Numero NF", pedido.numeroNF],
    ["Status atual", statusNome || pedido.statusAtual],
    ["Data do pedido", formatarDataBr(pedido.dataPedido)],
    ["Data faturamento", formatarDataBr(pedido.dataFaturamento)],
    ["Data expedicao", formatarDataBr(pedido.dataExpedicao)],
    ["Prazo de entrega", formatarDataBr(pedido.prazoEntrega)],
    ["Agendamento de entrega", formatarDataBr(pedido.dataAgendamento) || "-"],
    ["Prazo efetivo (atraso)", formatarDataBr(prazoEfetivo)],
    ["Dias em atraso", String(diasAtraso)]
  ];

  const tabela = rows
    .map(
      ([label, value]) => `
        <tr>
          <td style="padding:8px 12px;border:1px solid #e2e8f0;background:#f8fafc;font-weight:600;width:38%;">${escapeHtml(label)}</td>
          <td style="padding:8px 12px;border:1px solid #e2e8f0;">${escapeHtml(value)}</td>
        </tr>`
    )
    .join("");

  return `
  <div style="font-family:Arial,sans-serif;color:#0f172a;max-width:720px;">
    <h2 style="margin:0 0 8px;color:#dc2626;">Pedido em atraso</h2>
    <p style="margin:0 0 16px;">O pedido abaixo ultrapassou o prazo de entrega e requer atencao.</p>
    <p style="margin:0 0 12px;">
      <span style="display:inline-block;padding:4px 10px;border-radius:999px;background:${escapeHtml(statusCor || "#dc2626")};color:#fff;font-size:12px;">
        ${escapeHtml(statusNome || pedido.statusAtual)}
      </span>
      <strong style="margin-left:8px;color:#dc2626;">${diasAtraso} dia(s) de atraso</strong>
    </p>
    <table style="width:100%;border-collapse:collapse;font-size:14px;">${tabela}</table>
    <p style="margin:16px 0 0;font-size:12px;color:#64748b;">Gerado automaticamente pelo sistema de expedicao.</p>
  </div>
  `.trim();
}

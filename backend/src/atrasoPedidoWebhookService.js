import { getAtrasoPedidoWebhookUrl, isAtrasoPedidoDispatchBlocked } from "./atrasoPedidoConfig.js";
import { atrasoPedidoHtmlTemplate } from "./atrasoPedidoTemplates.js";
import { diasEmAtraso, prazoEfetivoEntrega } from "./atrasoPedidoUtils.js";

export function buildAtrasoPedidoPayload({ pedido, statusNome, statusCor }) {
  const html = atrasoPedidoHtmlTemplate({ pedido, statusNome, statusCor });
  const prazoEfetivo = prazoEfetivoEntrega(pedido.prazoEntrega, pedido.dataAgendamento);
  const diasAtraso = diasEmAtraso(pedido.prazoEntrega, pedido.dataAgendamento);

  return {
    event: "atraso_pedido",
    numeroPedido: pedido.numeroPedido,
    diasAtraso,
    prazoEfetivo,
    html,
    representante: pedido.representante || "",
    numeroNF: pedido.numeroNF,
    cliente: pedido.cliente,
    dataPedido: pedido.dataPedido,
    dataFaturamento: pedido.dataFaturamento,
    dataExpedicao: pedido.dataExpedicao,
    prazoEntrega: pedido.prazoEntrega,
    dataAgendamento: pedido.dataAgendamento || "",
    dataEntrega: pedido.dataEntrega || "",
    statusAtual: pedido.statusAtual,
    statusNome: statusNome || pedido.statusAtual,
    statusCor: statusCor || "#dc2626",
  };
}

function formatWebhookError(status, detail, webhookUrl) {
  let message = detail;
  let hint = "";
  try {
    const parsed = JSON.parse(detail);
    message = parsed.message || detail;
    hint = parsed.hint || "";
  } catch {
    // mantem detail bruto
  }

  if (status === 404 && String(message).includes("not registered")) {
    return [
      "Webhook n8n nao registrado. Ative o workflow no n8n (toggle no canto superior direito)",
      "e confira se o node Webhook usa metodo POST e path \"atrasonopedido\".",
      hint ? `Dica n8n: ${hint}` : "",
      `URL chamada: ${webhookUrl}`,
    ]
      .filter(Boolean)
      .join(" ");
  }

  return [
    `Falha ao disparar webhook de atraso: ${status}`,
    message ? String(message) : "",
    hint ? `Dica n8n: ${hint}` : "",
    `URL: ${webhookUrl}`,
  ]
    .filter(Boolean)
    .join(" — ");
}

export async function sendAtrasoPedidoWebhook(payload, { manual = false } = {}) {
  if (isAtrasoPedidoDispatchBlocked() && !manual) {
    throw new Error("Webhook de atraso desabilitado em NODE_ENV=development.");
  }

  const webhookUrl = getAtrasoPedidoWebhookUrl();
  const response = await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(formatWebhookError(response.status, detail, webhookUrl));
  }
}

export async function notifyAtrasoPedido({ pedido, statusNome, statusCor, manual = false }) {
  const payload = buildAtrasoPedidoPayload({ pedido, statusNome, statusCor });
  await sendAtrasoPedidoWebhook(payload, { manual });
  return payload;
}

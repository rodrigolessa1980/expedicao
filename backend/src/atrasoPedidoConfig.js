/**
 * Valores padrao do fluxo de notificacao de pedido em atraso.
 * Usados quando as variaveis de ambiente nao estao definidas ou estao vazias.
 */
/** Webhook e job automatico nao rodam com NODE_ENV=development. */
export function isAtrasoPedidoDispatchBlocked() {
  return process.env.NODE_ENV === "development";
}

export const ATRASO_PEDIDO_DEFAULTS = {
  webhookUrl: "https://dadosbi.monkeybranch.com.br/webhook/atrasonopedido",
  /** Dias excedentes do agendamento/prazo antes de disparar o webhook. */
  diasAtraso: 1,
  jobEnabled: true,
  jobIntervalMs: 3_600_000,
  jobRunOnStart: true,
};

export function getAtrasoPedidoDiasAtraso() {
  const fromEnv = process.env.ATRASO_PEDIDO_DIAS_ATRASO?.trim();
  const parsed = fromEnv ? Number(fromEnv) : ATRASO_PEDIDO_DEFAULTS.diasAtraso;
  return Number.isFinite(parsed) && parsed >= 0 ? Math.floor(parsed) : ATRASO_PEDIDO_DEFAULTS.diasAtraso;
}

export function getAtrasoPedidoWebhookUrl() {
  const fromEnv = process.env.ATRASO_PEDIDO_WEBHOOK_URL?.trim();
  return fromEnv || ATRASO_PEDIDO_DEFAULTS.webhookUrl;
}

export function getAtrasoPedidoJobEnabled() {
  if (isAtrasoPedidoDispatchBlocked()) return false;
  const fromEnv = process.env.ATRASO_PEDIDO_JOB_ENABLED?.trim();
  if (!fromEnv) return ATRASO_PEDIDO_DEFAULTS.jobEnabled;
  return fromEnv.toLowerCase() !== "false";
}

export function getAtrasoPedidoJobIntervalMs() {
  const fromEnv = process.env.ATRASO_PEDIDO_JOB_INTERVAL_MS?.trim();
  const parsed = fromEnv ? Number(fromEnv) : ATRASO_PEDIDO_DEFAULTS.jobIntervalMs;
  return Math.max(60_000, Number.isFinite(parsed) ? parsed : ATRASO_PEDIDO_DEFAULTS.jobIntervalMs);
}

export function getAtrasoPedidoJobRunOnStart() {
  const fromEnv = process.env.ATRASO_PEDIDO_JOB_RUN_ON_START?.trim();
  if (!fromEnv) return ATRASO_PEDIDO_DEFAULTS.jobRunOnStart;
  return fromEnv.toLowerCase() !== "false";
}

import {
  getAtrasoPedidoDiasAtraso,
  getAtrasoPedidoJobEnabled,
  getAtrasoPedidoJobIntervalMs,
  getAtrasoPedidoJobRunOnStart,
  getAtrasoPedidoWebhookUrl,
  isAtrasoPedidoDispatchBlocked,
} from "./atrasoPedidoConfig.js";
import { listPedidosAtrasoPendentesNotificacao } from "./db.js";
import { notifyAtrasoPedido } from "./atrasoPedidoWebhookService.js";

let running = false;

export async function processarNotificacoesAtrasoPedido() {
  if (isAtrasoPedidoDispatchBlocked()) {
    return { skipped: true, processed: 0, errors: [], reason: "development" };
  }
  if (running) return { skipped: true, processed: 0, errors: [] };
  running = true;
  const errors = [];
  let processed = 0;

  try {
    const pendentes = await listPedidosAtrasoPendentesNotificacao();
    for (const item of pendentes) {
      try {
        await notifyAtrasoPedido({
          pedido: item.pedido,
          statusNome: item.statusNome,
          statusCor: item.statusCor
        });
        processed += 1;
        console.log(`[atraso-pedido] Webhook enviado: ${item.pedido.numeroPedido}`);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        errors.push({ numeroPedido: item.pedido.numeroPedido, message });
        console.error(`[atraso-pedido] Falha ${item.pedido.numeroPedido}: ${message}`);
      }
    }
    return { skipped: false, processed, errors };
  } finally {
    running = false;
  }
}

/** Disparo manual permitido somente em NODE_ENV=development (painel admin). */
export async function processarNotificacoesAtrasoPedidoManual() {
  if (!isAtrasoPedidoDispatchBlocked()) {
    return {
      skipped: true,
      processed: 0,
      errors: [],
      reason: "manual_apenas_em_development",
    };
  }
  if (running) return { skipped: true, processed: 0, errors: [], reason: "job_em_execucao" };
  running = true;
  const errors = [];
  let processed = 0;

  try {
    const pendentes = await listPedidosAtrasoPendentesNotificacao();
    for (const item of pendentes) {
      try {
        await notifyAtrasoPedido({
          pedido: item.pedido,
          statusNome: item.statusNome,
          statusCor: item.statusCor,
          manual: true,
        });
        processed += 1;
        console.log(`[atraso-pedido] Webhook manual (dev): ${item.pedido.numeroPedido}`);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        errors.push({ numeroPedido: item.pedido.numeroPedido, message });
      }
    }
    return { skipped: false, processed, errors, manual: true };
  } finally {
    running = false;
  }
}

export function startAtrasoPedidoJob() {
  if (isAtrasoPedidoDispatchBlocked()) {
    console.log("[atraso-pedido] Disparo automatico desabilitado em NODE_ENV=development.");
    return;
  }

  const enabled = getAtrasoPedidoJobEnabled();
  if (!enabled) {
    console.log("[atraso-pedido] Job desabilitado (ATRASO_PEDIDO_JOB_ENABLED=false).");
    return;
  }

  const intervalMs = getAtrasoPedidoJobIntervalMs();
  const runOnStart = getAtrasoPedidoJobRunOnStart();
  const webhookUrl = getAtrasoPedidoWebhookUrl();
  const minDiasAtraso = getAtrasoPedidoDiasAtraso();

  const tick = () => {
    processarNotificacoesAtrasoPedido().catch((error) => {
      console.error("[atraso-pedido] Erro no job:", error);
    });
  };

  if (runOnStart) tick();
  setInterval(tick, intervalMs);
  console.log(
    `[atraso-pedido] Job ativo a cada ${intervalMs}ms. Webhook: ${webhookUrl}. Disparo com >= ${minDiasAtraso} dia(s) de atraso.`,
  );
}

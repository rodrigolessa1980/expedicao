import test from "node:test";
import assert from "node:assert/strict";
import {
  ATRASO_PEDIDO_DEFAULTS,
  getAtrasoPedidoDiasAtraso,
  getAtrasoPedidoJobEnabled,
  getAtrasoPedidoWebhookUrl,
  isAtrasoPedidoDispatchBlocked,
} from "../src/atrasoPedidoConfig.js";
import {
  diasEmAtraso,
  diasParaPrazo,
  formatarDataBr,
  isPedidoAtrasado,
  toDateOnlyString,
} from "../src/atrasoPedidoUtils.js";
import { buildAtrasoPedidoPayload, sendAtrasoPedidoWebhook } from "../src/atrasoPedidoWebhookService.js";

test("development bloqueia job e disparo de webhook", async () => {
  const original = process.env.NODE_ENV;
  try {
    process.env.NODE_ENV = "development";
    assert.equal(isAtrasoPedidoDispatchBlocked(), true);
    assert.equal(getAtrasoPedidoJobEnabled(), false);
    await assert.rejects(() => sendAtrasoPedidoWebhook({ event: "atraso_pedido" }), /development/i);
    try {
      await sendAtrasoPedidoWebhook({ event: "atraso_pedido" }, { manual: true });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      assert.doesNotMatch(message, /desabilitado em NODE_ENV/i);
    }

    process.env.NODE_ENV = "production";
    assert.equal(isAtrasoPedidoDispatchBlocked(), false);
    assert.equal(getAtrasoPedidoJobEnabled(), true);
  } finally {
    if (original === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = original;
  }
});

test("getAtrasoPedidoWebhookUrl usa URL padrao quando env ausente ou vazia", () => {
  const original = process.env.ATRASO_PEDIDO_WEBHOOK_URL;
  try {
    delete process.env.ATRASO_PEDIDO_WEBHOOK_URL;
    assert.equal(getAtrasoPedidoWebhookUrl(), ATRASO_PEDIDO_DEFAULTS.webhookUrl);

    process.env.ATRASO_PEDIDO_WEBHOOK_URL = "   ";
    assert.equal(getAtrasoPedidoWebhookUrl(), ATRASO_PEDIDO_DEFAULTS.webhookUrl);

    process.env.ATRASO_PEDIDO_WEBHOOK_URL = "https://exemplo.test/webhook";
    assert.equal(getAtrasoPedidoWebhookUrl(), "https://exemplo.test/webhook");
  } finally {
    if (original === undefined) delete process.env.ATRASO_PEDIDO_WEBHOOK_URL;
    else process.env.ATRASO_PEDIDO_WEBHOOK_URL = original;
  }
});

test("getAtrasoPedidoDiasAtraso usa padrao 1 e respeita env", () => {
  const original = process.env.ATRASO_PEDIDO_DIAS_ATRASO;
  try {
    delete process.env.ATRASO_PEDIDO_DIAS_ATRASO;
    assert.equal(getAtrasoPedidoDiasAtraso(), 1);

    process.env.ATRASO_PEDIDO_DIAS_ATRASO = "5";
    assert.equal(getAtrasoPedidoDiasAtraso(), 5);
  } finally {
    if (original === undefined) delete process.env.ATRASO_PEDIDO_DIAS_ATRASO;
    else process.env.ATRASO_PEDIDO_DIAS_ATRASO = original;
  }
});

test("isPedidoAtrasado exige dias minimos e usa agendamento como prazo efetivo", () => {
  const hoje = new Date();
  const prazoHoje = new Date(Date.UTC(hoje.getUTCFullYear(), hoje.getUTCMonth(), hoje.getUTCDate()));

  const pedidoNoPrazo = {
    statusAtual: "em-transito",
    dataEntrega: "",
    prazoEntrega: prazoHoje,
    dataAgendamento: "",
  };
  assert.equal(diasEmAtraso(pedidoNoPrazo.prazoEntrega, pedidoNoPrazo.dataAgendamento), 0);
  assert.equal(isPedidoAtrasado(pedidoNoPrazo), false);

  const umDiaAtras = new Date(prazoHoje);
  umDiaAtras.setUTCDate(umDiaAtras.getUTCDate() - 1);
  const pedidoUmDia = {
    statusAtual: "em-transito",
    dataEntrega: "",
    prazoEntrega: umDiaAtras,
    dataAgendamento: "",
  };
  assert.equal(diasEmAtraso(pedidoUmDia.prazoEntrega, pedidoUmDia.dataAgendamento), 1);
  assert.equal(isPedidoAtrasado(pedidoUmDia), true);

  const pedido = {
    statusAtual: "em-transito",
    dataEntrega: "",
    prazoEntrega: "2099-01-01",
    dataAgendamento: "2020-01-01",
  };
  assert.equal(isPedidoAtrasado(pedido), true);
  assert.ok(diasParaPrazo(pedido.prazoEntrega, pedido.dataAgendamento) < 0);
  assert.ok(diasEmAtraso(pedido.prazoEntrega, pedido.dataAgendamento) >= ATRASO_PEDIDO_DEFAULTS.diasAtraso);
});

test("pedido finalizado nao e atrasado para notificacao", () => {
  const pedido = {
    statusAtual: "finalizado",
    dataEntrega: "2026-05-01",
    prazoEntrega: "2020-01-01",
    dataAgendamento: ""
  };
  assert.equal(isPedidoAtrasado(pedido), false);
});

test("datas vindas como Date do MySQL calculam dias de atraso corretamente", () => {
  const prazoEntrega = new Date(Date.UTC(2026, 4, 18));
  assert.equal(toDateOnlyString(prazoEntrega), "2026-05-18");
  assert.equal(formatarDataBr(prazoEntrega), "18/05/2026");

  const hoje = new Date();
  const prazoPassado = new Date(hoje);
  prazoPassado.setUTCDate(prazoPassado.getUTCDate() - 5);
  const dias = diasEmAtraso(prazoPassado, "");
  assert.ok(dias >= 4 && dias <= 6);
});

test("payload do webhook e plano (sem objeto pedido aninhado)", () => {
  const payload = buildAtrasoPedidoPayload({
    pedido: {
      numeroPedido: "PED-100",
      representante: "Joao",
      numeroNF: "NF-1",
      cliente: "Cliente X",
      dataPedido: new Date(Date.UTC(2026, 0, 10)),
      dataFaturamento: new Date(Date.UTC(2026, 0, 11)),
      dataExpedicao: new Date(Date.UTC(2026, 0, 12)),
      prazoEntrega: new Date(Date.UTC(2026, 0, 5)),
      dataAgendamento: "",
      dataEntrega: "",
      statusAtual: "em-transito",
    },
    statusNome: "Em transito",
    statusCor: "#2563eb"
  });

  assert.equal(payload.event, "atraso_pedido");
  assert.equal(payload.numeroPedido, "PED-100");
  assert.equal(payload.cliente, "Cliente X");
  assert.equal(payload.statusNome, "Em transito");
  assert.equal(payload.representante, "Joao");
  assert.equal(payload.pedido, undefined);
  assert.match(payload.html, /05\/01\/2026/);
  assert.ok(payload.diasAtraso > 0);
  assert.match(payload.html, /PED-100/);
  assert.match(payload.html, /Cliente X/);
  assert.match(payload.html, /Em transito/);
});

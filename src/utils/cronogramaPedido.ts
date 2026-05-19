import type { Pedido } from "../types";
import { prazoEfetivoEntrega } from "./date";

const MS_DIA = 24 * 60 * 60 * 1000;

export type CronogramaSegmentoId = "faturamento" | "expedicao" | "entrega";

export type CronogramaSegmento = {
  id: CronogramaSegmentoId;
  nome: string;
  cor: string;
  dias: number;
  percentual: number;
};

export type CronogramaPedido = {
  valido: boolean;
  segmentos: CronogramaSegmento[];
  naoUtilizadoDias: number;
  naoUtilizadoPercentual: number;
  prazoPercentual: number;
  atrasoDias: number;
  atrasoPercentual: number;
  atrasado: boolean;
  totalDiasEscala: number;
};

const META_SEGMENTOS: Array<Pick<CronogramaSegmento, "id" | "nome" | "cor">> = [
  { id: "faturamento", nome: "Data Faturamento", cor: "#eab308" },
  { id: "expedicao", nome: "Data Expedicao", cor: "#2563eb" },
  { id: "entrega", nome: "Data da Entrega", cor: "#16a34a" },
];

const vazio: CronogramaPedido = {
  valido: false,
  segmentos: [],
  naoUtilizadoDias: 0,
  naoUtilizadoPercentual: 0,
  prazoPercentual: 0,
  atrasoDias: 0,
  atrasoPercentual: 0,
  atrasado: false,
  totalDiasEscala: 0,
};

const parseData = (value: string) => {
  const parsed = new Date(`${value}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const diffDias = (inicio: Date, fim: Date) => Math.max(0, Math.round((fim.getTime() - inicio.getTime()) / MS_DIA));

export function calcularCronogramaPedido(pedido: Pedido): CronogramaPedido {
  const dataPedido = parseData(pedido.dataPedido);
  const prazoReferencia = parseData(prazoEfetivoEntrega(pedido.prazoEntrega, pedido.dataAgendamento));
  if (!dataPedido || !prazoReferencia || prazoReferencia.getTime() < dataPedido.getTime()) return vazio;
  const prazoEntrega = prazoReferencia;

  const dataFaturamento = parseData(pedido.dataFaturamento);
  const dataExpedicao = parseData(pedido.dataExpedicao);
  const dataEntrega = parseData(pedido.dataEntrega);

  const faturamentoInformado = !!dataFaturamento && dataFaturamento.getTime() >= dataPedido.getTime();
  const expedicaoInformada = !!dataExpedicao && dataExpedicao.getTime() >= dataPedido.getTime();
  const entregaInformada = !!dataEntrega && dataEntrega.getTime() >= dataPedido.getTime();

  const marcoFaturamento = faturamentoInformado ? dataFaturamento : dataPedido;
  const marcoExpedicao = expedicaoInformada
    ? new Date(Math.max(dataExpedicao!.getTime(), marcoFaturamento.getTime()))
    : marcoFaturamento;
  const marcoEntrega = entregaInformada ? new Date(Math.max(dataEntrega!.getTime(), marcoExpedicao.getTime())) : marcoExpedicao;

  const fimProjetado = entregaInformada ? marcoEntrega : marcoExpedicao;
  const dataFimEscala = new Date(Math.max(fimProjetado.getTime(), prazoEntrega.getTime()));
  const totalDiasEscala = Math.max(1, diffDias(dataPedido, dataFimEscala));
  const diasAtePrazo = diffDias(dataPedido, prazoEntrega);

  const marcoFaturamentoNoPrazo = new Date(Math.min(marcoFaturamento.getTime(), prazoEntrega.getTime()));
  const marcoExpedicaoNoPrazo = new Date(
    Math.min(Math.max(marcoExpedicao.getTime(), marcoFaturamentoNoPrazo.getTime()), prazoEntrega.getTime()),
  );
  const marcoEntregaNoPrazo = entregaInformada
    ? new Date(Math.min(Math.max(marcoEntrega.getTime(), marcoExpedicaoNoPrazo.getTime()), prazoEntrega.getTime()))
    : marcoExpedicaoNoPrazo;

  const d1 = diffDias(dataPedido, marcoFaturamentoNoPrazo);
  const d2 = diffDias(marcoFaturamentoNoPrazo, marcoExpedicaoNoPrazo);
  const d3 = entregaInformada ? diffDias(marcoExpedicaoNoPrazo, marcoEntregaNoPrazo) : 0;

  const atrasoDias = Math.max(0, diffDias(prazoEntrega, fimProjetado));
  const atrasoPercentual = Math.max(0, Math.min(100, (atrasoDias / totalDiasEscala) * 100));

  const fimExecutadoNoPrazo = new Date(Math.min(fimProjetado.getTime(), prazoEntrega.getTime()));
  const naoUtilizadoDias =
    fimExecutadoNoPrazo.getTime() < prazoEntrega.getTime() ? diffDias(fimExecutadoNoPrazo, prazoEntrega) : 0;
  const naoUtilizadoPercentual = Math.max(0, Math.min(100, (naoUtilizadoDias / totalDiasEscala) * 100));

  const diasPorId: Record<CronogramaSegmentoId, number> = { faturamento: d1, expedicao: d2, entrega: d3 };
  const segmentos = META_SEGMENTOS.map((meta) => ({
    ...meta,
    dias: diasPorId[meta.id],
    percentual: (diasPorId[meta.id] / totalDiasEscala) * 100,
  })).filter((segmento) => segmento.dias > 0);

  return {
    valido: true,
    segmentos,
    naoUtilizadoDias,
    naoUtilizadoPercentual,
    prazoPercentual: Math.max(0, Math.min(100, (diasAtePrazo / totalDiasEscala) * 100)),
    atrasoDias,
    atrasoPercentual,
    atrasado: atrasoDias > 0,
    totalDiasEscala,
  };
}


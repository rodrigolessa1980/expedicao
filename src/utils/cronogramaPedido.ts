import { dayjs } from "./date";
import type { Pedido } from "../types";
import { prazoEfetivoEntrega } from "./date";

const MS_DIA = 24 * 60 * 60 * 1000;

export type CronogramaSegmentoId =
  | "faturamento"
  | "expedicao"
  | "entrega"
  | "emAberto"
  | "aposPrazoInterno"
  | "atrasoPrazo";

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

export type OpcoesCronogramaPedido = {
  /** Data do prazo interno (YYYY-MM-DD) — alerta visual, não é o atraso oficial. */
  dataPrazoInterno?: string | null;
  concluido?: boolean;
};

const META_SEGMENTOS: Array<Pick<CronogramaSegmento, "id" | "nome" | "cor">> = [
  { id: "faturamento", nome: "Data Faturamento", cor: "#eab308" },
  { id: "expedicao", nome: "Data Expedicao", cor: "#2563eb" },
  { id: "entrega", nome: "Data da Entrega", cor: "#16a34a" },
  { id: "emAberto", nome: "Em andamento", cor: "#2563eb" },
  { id: "aposPrazoInterno", nome: "Apos prazo interno", cor: "#475569" },
  { id: "atrasoPrazo", nome: "Atraso oficial", cor: "#dc2626" },
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

const hojeDate = () => parseData(dayjs().format("YYYY-MM-DD"))!;

/** Trecho em aberto: azul até o prazo interno, cinza até o prazo oficial, vermelho só após o oficial. */
function preencherTrechoEmAberto(
  diasPorId: Partial<Record<CronogramaSegmentoId, number>>,
  inicio: Date,
  fim: Date,
  prazoInterno: Date,
  prazoEntrega: Date,
) {
  if (fim.getTime() <= inicio.getTime()) return;

  const fimEmAberto = new Date(Math.min(prazoInterno.getTime(), fim.getTime()));
  if (fimEmAberto.getTime() > inicio.getTime()) {
    diasPorId.emAberto = diffDias(inicio, fimEmAberto);
  }

  if (fim.getTime() <= prazoInterno.getTime()) return;

  const inicioAlerta = new Date(Math.max(prazoInterno.getTime(), inicio.getTime()));
  const fimAlerta = new Date(Math.min(prazoEntrega.getTime(), fim.getTime()));
  if (fimAlerta.getTime() > inicioAlerta.getTime()) {
    diasPorId.aposPrazoInterno = diffDias(inicioAlerta, fimAlerta);
  }

  if (fim.getTime() <= prazoEntrega.getTime()) return;

  const inicioAtraso = new Date(Math.max(prazoEntrega.getTime(), inicio.getTime()));
  diasPorId.atrasoPrazo = diffDias(inicioAtraso, fim);
}

export function calcularCronogramaPedido(pedido: Pedido, opcoes?: OpcoesCronogramaPedido): CronogramaPedido {
  const dataPedido = parseData(pedido.dataPedido);
  const prazoReferencia = parseData(prazoEfetivoEntrega(pedido.prazoEntrega, pedido.dataAgendamento));
  if (!dataPedido || !prazoReferencia || prazoReferencia.getTime() < dataPedido.getTime()) return vazio;

  const prazoEntrega = prazoReferencia;
  const hoje = hojeDate();
  const concluido = opcoes?.concluido ?? false;
  const prazoInterno = parseData(opcoes?.dataPrazoInterno ?? "");

  const dataFaturamento = parseData(pedido.dataFaturamento);
  const dataExpedicao = parseData(pedido.dataExpedicao);
  const dataEntrega = parseData(pedido.dataEntrega);

  const faturamentoInformado = !!dataFaturamento && dataFaturamento.getTime() >= dataPedido.getTime();
  const expedicaoInformada = !!dataExpedicao && dataExpedicao.getTime() >= dataPedido.getTime();
  const entregaInformada = !!dataEntrega && dataEntrega.getTime() >= dataPedido.getTime();

  const marcoFaturamento = faturamentoInformado ? dataFaturamento! : dataPedido;
  const marcoExpedicao = expedicaoInformada
    ? new Date(Math.max(dataExpedicao!.getTime(), marcoFaturamento.getTime()))
    : marcoFaturamento;

  const projetaAteHoje = !entregaInformada && !concluido;
  const fimProjetado = entregaInformada
    ? new Date(Math.max(dataEntrega!.getTime(), marcoExpedicao.getTime()))
    : projetaAteHoje
      ? new Date(Math.max(marcoExpedicao.getTime(), hoje.getTime()))
      : marcoExpedicao;

  const dataFimEscala = new Date(
    Math.max(
      fimProjetado.getTime(),
      prazoEntrega.getTime(),
      prazoInterno?.getTime() ?? 0,
      projetaAteHoje ? hoje.getTime() : 0,
    ),
  );
  const totalDiasEscala = Math.max(1, diffDias(dataPedido, dataFimEscala));
  const diasAtePrazo = diffDias(dataPedido, prazoEntrega);

  const diasPorId: Partial<Record<CronogramaSegmentoId, number>> = {};

  if (entregaInformada) {
    const marcoFaturamentoNoPrazo = new Date(Math.min(marcoFaturamento.getTime(), prazoEntrega.getTime()));
    const marcoExpedicaoNoPrazo = new Date(
      Math.min(Math.max(marcoExpedicao.getTime(), marcoFaturamentoNoPrazo.getTime()), prazoEntrega.getTime()),
    );
    const marcoEntregaNoPrazo = new Date(
      Math.min(Math.max(dataEntrega!.getTime(), marcoExpedicaoNoPrazo.getTime()), prazoEntrega.getTime()),
    );

    diasPorId.faturamento = diffDias(dataPedido, marcoFaturamentoNoPrazo);
    diasPorId.expedicao = diffDias(marcoFaturamentoNoPrazo, marcoExpedicaoNoPrazo);
    diasPorId.entrega = diffDias(marcoExpedicaoNoPrazo, marcoEntregaNoPrazo);
  } else {
    const marcoFaturamentoVis = new Date(Math.min(marcoFaturamento.getTime(), fimProjetado.getTime()));
    const marcoExpedicaoVis = expedicaoInformada
      ? new Date(Math.min(Math.max(marcoExpedicao.getTime(), marcoFaturamentoVis.getTime()), fimProjetado.getTime()))
      : marcoFaturamentoVis;

    diasPorId.faturamento = diffDias(dataPedido, marcoFaturamentoVis);
    if (expedicaoInformada && marcoExpedicaoVis.getTime() > marcoFaturamentoVis.getTime()) {
      diasPorId.expedicao = diffDias(marcoFaturamentoVis, marcoExpedicaoVis);
    }

    if (projetaAteHoje && fimProjetado.getTime() > marcoExpedicaoVis.getTime()) {
      if (prazoInterno) {
        preencherTrechoEmAberto(diasPorId, marcoExpedicaoVis, fimProjetado, prazoInterno, prazoEntrega);
      } else if (fimProjetado.getTime() > prazoEntrega.getTime()) {
        const fimEmAberto = new Date(Math.min(prazoEntrega.getTime(), fimProjetado.getTime()));
        if (fimEmAberto.getTime() > marcoExpedicaoVis.getTime()) {
          diasPorId.emAberto = diffDias(marcoExpedicaoVis, fimEmAberto);
        }
        diasPorId.atrasoPrazo = diffDias(prazoEntrega, fimProjetado);
      } else {
        diasPorId.emAberto = diffDias(marcoExpedicaoVis, fimProjetado);
      }
    }
  }

  /** Atraso oficial = somente após o prazo de entrega contratual/agendado. */
  const atrasoDias = Math.max(0, diffDias(prazoEntrega, fimProjetado));

  const fimExecutadoNoPrazo = new Date(Math.min(fimProjetado.getTime(), prazoEntrega.getTime()));
  const naoUtilizadoDias =
    entregaInformada && fimExecutadoNoPrazo.getTime() < prazoEntrega.getTime()
      ? diffDias(fimExecutadoNoPrazo, prazoEntrega)
      : 0;
  const naoUtilizadoPercentual = Math.max(0, Math.min(100, (naoUtilizadoDias / totalDiasEscala) * 100));
  const atrasoPercentual = Math.max(0, Math.min(100, (atrasoDias / totalDiasEscala) * 100));

  const segmentos = META_SEGMENTOS.map((meta) => ({
    ...meta,
    dias: diasPorId[meta.id] ?? 0,
    percentual: ((diasPorId[meta.id] ?? 0) / totalDiasEscala) * 100,
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

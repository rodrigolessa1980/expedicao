import { useMemo } from "react";
import { motion } from "framer-motion";
import type { Pedido } from "../types";
import { Card } from "../components/ui/card";
import { useExportStore } from "../store/useExportStore";
import { calcularCronogramaPedido } from "../utils/cronogramaPedido";

type FunilPageProps = {
  pedidos: Pedido[];
};

export function FunilPage({ pedidos }: FunilPageProps) {
  const status = useExportStore((state) => state.status);
  const pedidosComNF = useMemo(
    () => pedidos.filter((pedido) => pedido.numeroNF?.trim().length > 0),
    [pedidos],
  );

  const etapas = useMemo(() => {
    const total = Math.max(pedidosComNF.length, 1);
    return status
      .map((item) => {
        const quantidade = pedidosComNF.filter((pedido) => pedido.statusAtual === item.id).length;
        const percentual = Math.round((quantidade / total) * 100);
        return { ...item, quantidade, percentual };
      })
      .filter((item) => item.quantidade > 0)
      .sort((a, b) => b.quantidade - a.quantidade);
  }, [pedidosComNF, status]);

  const maxQtd = Math.max(...etapas.map((item) => item.quantidade), 1);
  const etapasTempo = useMemo(
    () => [
      { id: "faturamento", nome: "Pedido -> Faturamento", cor: "#eab308" },
      { id: "expedicao", nome: "Faturamento -> Expedicao", cor: "#2563eb" },
      { id: "entrega", nome: "Expedicao -> Entrega", cor: "#16a34a" },
    ],
    [],
  );

  const timelinePedidos = useMemo(() => {
    return pedidos
      .map((pedido) => {
        const cronograma = calcularCronogramaPedido(pedido);
        if (!cronograma.valido) return null;
        return {
          pedido,
          totalDias: cronograma.totalDiasEscala,
          atrasoDias: cronograma.atrasoDias,
          atrasado: cronograma.atrasado,
          prazoPercentual: cronograma.prazoPercentual,
          segmentos: etapasTempo.map((etapa) => {
            const segmentoBase = cronograma.segmentos.find((segmento) => segmento.id === etapa.id);
            return {
              ...etapa,
              dias: segmentoBase?.dias ?? 0,
              percentual: segmentoBase?.percentual ?? 0,
            };
          }),
        };
      })
      .filter((item): item is NonNullable<typeof item> => item !== null)
      .sort((a, b) => b.totalDias - a.totalDias)
      .slice(0, 10);
  }, [pedidos, etapasTempo]);

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-slate-900">Funil de status</h2>
        <p className="text-xs text-slate-500">Distribuicao dos pedidos por etapa.</p>
      </div>

      <Card className="border-slate-300 p-3 shadow-md ring-2 ring-blue-100 md:p-4">
        <div className="space-y-2">
          {etapas.map((etapa, idx) => {
            const largura = 45 + (etapa.quantidade / maxQtd) * 55;
            return (
              <motion.div
                key={etapa.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.04 }}
                className="relative overflow-hidden rounded-xl border border-slate-200 bg-white p-2.5"
              >
                <div className="h-12 rounded-lg opacity-85" style={{ width: `${largura}%`, backgroundColor: etapa.cor }} />
                <div className="absolute inset-0 grid grid-cols-[1fr_auto] items-center gap-2 px-3 sm:px-4">
                  <p className="truncate text-xs font-semibold text-slate-900 sm:text-sm">{etapa.nome}</p>
                  <p className="text-xs font-semibold text-slate-900 sm:text-sm">
                    {etapa.quantidade} ({etapa.percentual}%)
                  </p>
                </div>
              </motion.div>
            );
          })}
        </div>
      </Card>

      <Card className="border-slate-300 p-3 shadow-md ring-2 ring-blue-100 md:p-4">
        <div className="mb-3 flex items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-slate-900">Termometro por pedido (pedido -&gt; entrega)</h3>
          <p className="text-xs text-slate-500">Top 10 maiores ciclos</p>
        </div>
        <div className="space-y-3">
          {timelinePedidos.map((item) => (
            <div key={item.pedido.numeroPedido} className="rounded-xl border border-slate-200 bg-white p-3">
              <div className="mb-3">
                <div className="relative h-6 w-full overflow-hidden rounded-lg border border-slate-200 bg-slate-100">
                  <div className="flex h-full w-full">
                    {item.segmentos.map((segmento) => (
                      <div
                        key={segmento.id}
                        className="h-full"
                        style={{ width: `${segmento.percentual.toFixed(2)}%`, backgroundColor: segmento.cor }}
                        title={`${segmento.nome}: ${segmento.dias} dias (${segmento.percentual.toFixed(1)}%)`}
                      />
                    ))}
                  </div>
                  {item.atrasado ? (
                    <div
                      className="absolute inset-y-0 bg-red-600/90"
                      style={{ left: `${item.prazoPercentual.toFixed(2)}%`, width: `${(100 - item.prazoPercentual).toFixed(2)}%` }}
                      title={`Atraso: ${item.atrasoDias} dia(s)`}
                    />
                  ) : null}
                  <div
                    className="absolute bottom-0 top-0 w-0.5 bg-slate-900"
                    style={{ left: `${item.prazoPercentual.toFixed(2)}%` }}
                    title="Prazo de entrega"
                  />
                </div>
              </div>

              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-xs text-slate-500">{item.pedido.numeroPedido}</p>
                  <p className="text-sm font-semibold text-slate-900">{item.pedido.cliente}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-slate-500">Ciclo total</p>
                  <p className="text-sm font-semibold text-slate-900">{item.totalDias} dias</p>
                </div>
              </div>

              <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                {item.segmentos.map((segmento) => (
                  <span
                    key={`${item.pedido.numeroPedido}-${segmento.id}`}
                    className="rounded-full border border-slate-200 bg-slate-50 px-2 py-1 text-slate-700"
                  >
                    {segmento.nome}: {segmento.dias}d ({segmento.percentual.toFixed(1)}%)
                  </span>
                ))}
                {item.atrasado ? (
                  <span className="rounded-full border border-red-200 bg-red-50 px-2 py-1 font-semibold text-red-700">
                    Atrasado: {item.atrasoDias} dia(s)
                  </span>
                ) : (
                  <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-1 font-semibold text-emerald-700">
                    Entrega no prazo
                  </span>
                )}
              </div>
            </div>
          ))}
          {timelinePedidos.length === 0 ? (
            <p className="text-sm text-slate-500">Sem pedidos com Data do Pedido e Prazo para montar o termometro.</p>
          ) : null}
        </div>
      </Card>

    </section>
  );
}

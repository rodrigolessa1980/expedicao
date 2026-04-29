import { useMemo } from "react";
import { motion } from "framer-motion";
import type { Pedido } from "../types";
import { Card } from "../components/ui/card";
import { useExportStore } from "../store/useExportStore";

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
    </section>
  );
}

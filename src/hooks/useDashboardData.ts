import { useMemo } from "react";
import { useExportStore } from "../store/useExportStore";
import { diasParaPrazo } from "../utils/date";
import { calcularCronogramaPedido } from "../utils/cronogramaPedido";

export function useDashboardData() {
  const pedidos = useExportStore((state) => state.pedidos);

  const kpis = useMemo(() => {
    const total = pedidos.length;
    const atrasados = pedidos.filter((p) => calcularCronogramaPedido(p).atrasado).length;
    const emTransito = pedidos.filter((p) => p.statusAtual === "em-transito").length;
    const noPrazo = total - atrasados;

    return { total, atrasados, noPrazo, emTransito };
  }, [pedidos]);

  const proximosPrazos = useMemo(
    () =>
      [...pedidos]
        .sort(
          (a, b) =>
            diasParaPrazo(a.prazoEntrega, a.dataAgendamento) - diasParaPrazo(b.prazoEntrega, b.dataAgendamento),
        )
        .slice(0, 5),
    [pedidos],
  );

  return { pedidos, kpis, proximosPrazos };
}

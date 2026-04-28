import { useMemo } from "react";
import { useExportStore } from "../store/useExportStore";
import { diasParaPrazo, isAtrasado } from "../utils/date";

export function useDashboardData() {
  const pedidos = useExportStore((state) => state.pedidos);

  const kpis = useMemo(() => {
    const total = pedidos.length;
    const atrasados = pedidos.filter((p) => isAtrasado(p.prazoEntrega)).length;
    const emTransito = pedidos.filter((p) => p.statusAtual === "em-transito").length;
    const noPrazo = total - atrasados;

    return { total, atrasados, noPrazo, emTransito };
  }, [pedidos]);

  const proximosPrazos = useMemo(
    () =>
      [...pedidos]
        .sort((a, b) => diasParaPrazo(a.prazoEntrega) - diasParaPrazo(b.prazoEntrega))
        .slice(0, 5),
    [pedidos],
  );

  return { pedidos, kpis, proximosPrazos };
}

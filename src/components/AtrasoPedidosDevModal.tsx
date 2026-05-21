import { useEffect, useMemo, useState } from "react";
import type { Pedido } from "../types";
import { apiRequest } from "../services/api";
import { useAuthStore } from "../store/useAuthStore";
import { useExportStore } from "../store/useExportStore";
import { listarPedidosElegiveisAtraso } from "../utils/atrasoPedido";
import { DIAS_ATRASO_MINIMOS, diasEmAtraso } from "../utils/date";
import { Button } from "./ui/button";
import { Dialog, DialogContent } from "./ui/dialog";

type AtrasoPedidosDevModalProps = {
  pedidos: Pedido[];
  canManage: boolean;
};

type DisparoManualResult = {
  ok: boolean;
  processed: number;
  errors: Array<{ numeroPedido: string; message: string }>;
  minDiasAtraso: number;
  webhookUrl: string;
  skipped?: boolean;
};

export function AtrasoPedidosDevModal({ pedidos, canManage }: AtrasoPedidosDevModalProps) {
  const token = useAuthStore((state) => state.token);
  const status = useExportStore((state) => state.status);
  const loadPedidos = useExportStore((state) => state.loadPedidos);
  const [aberto, setAberto] = useState(false);
  const [disparando, setDisparando] = useState(false);
  const [mensagem, setMensagem] = useState("");
  const [erro, setErro] = useState("");

  const elegiveis = useMemo(() => listarPedidosElegiveisAtraso(pedidos, status), [pedidos, status]);

  useEffect(() => {
    if (import.meta.env.DEV && canManage && elegiveis.length > 0) {
      setAberto(true);
    }
  }, [canManage, elegiveis.length]);

  if (!import.meta.env.DEV || !canManage) return null;

  async function dispararManualmente() {
    if (!token || elegiveis.length === 0) return;
    setDisparando(true);
    setErro("");
    setMensagem("");
    try {
      const result = await apiRequest<DisparoManualResult>("/api/dev/atraso-pedido/disparar-manual", {
        method: "POST",
        token,
      });
      const falhas = result.errors?.length ?? 0;
      setMensagem(
        result.skipped
          ? "Nenhum disparo realizado (fila ocupada ou indisponivel)."
          : `${result.processed} webhook(s) enviado(s)${falhas ? `, ${falhas} falha(s).` : "."}`,
      );
      await loadPedidos();
    } catch (error) {
      setErro(error instanceof Error ? error.message : "Falha ao disparar manualmente.");
    } finally {
      setDisparando(false);
    }
  }

  if (elegiveis.length === 0) return null;

  return (
    <Dialog open={aberto} onOpenChange={setAberto}>
      <DialogContent className="max-w-lg space-y-4">
        <div>
          <h3 className="text-base font-semibold text-amber-900">Atencao</h3>
          <p className="mt-2 text-sm text-slate-700">
            Os pedidos abaixo apresentam atraso (minimo de {DIAS_ATRASO_MINIMOS} dias excedentes do prazo/agendamento
            e notificacao ainda nao confirmada).
          </p>
          <p className="mt-2 text-xs text-slate-500">
            Estamos em ambiente de <strong>development</strong>: o disparo automatico esta desligado. Caso necessario,
            acione manualmente.
          </p>
        </div>

        <ul className="max-h-56 space-y-2 overflow-y-auto rounded-lg border border-amber-200 bg-amber-50/50 p-3 text-sm">
          {elegiveis.map((pedido) => (
            <li
              key={pedido.numeroPedido}
              className="flex items-start justify-between gap-2 border-b border-amber-100 pb-2 last:border-0 last:pb-0"
            >
              <div className="min-w-0">
                <p className="font-semibold text-slate-900">{pedido.numeroPedido}</p>
                <p className="truncate text-slate-600">{pedido.cliente}</p>
              </div>
              <span className="shrink-0 text-xs font-medium text-red-700">
                {diasEmAtraso(pedido.prazoEntrega, pedido.dataAgendamento)} dia(s)
              </span>
            </li>
          ))}
        </ul>

        <Button type="button" className="w-full" disabled={disparando} onClick={() => void dispararManualmente()}>
          {disparando ? "Disparando..." : "Disparar manualmente"}
        </Button>

        {mensagem ? <p className="text-xs text-green-700">{mensagem}</p> : null}
        {erro ? <p className="text-xs text-red-600">{erro}</p> : null}
      </DialogContent>
    </Dialog>
  );
}

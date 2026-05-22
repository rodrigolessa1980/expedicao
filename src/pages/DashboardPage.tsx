import { useEffect, useState } from "react";
import type { Pedido } from "../types";
import { PedidosTable } from "../components/PedidosTable";
import { AtrasoPedidosDevModal } from "../components/AtrasoPedidosDevModal";
import { PedidoFormDialog } from "../components/PedidoFormDialog";
import { DashboardSkeleton } from "../components/DashboardSkeleton";
import { Card } from "../components/ui/card";

type DashboardPageProps = {
  pedidos: Pedido[];
  canManage: boolean;
  canCreate: boolean;
  mostrarPrazoInterno?: boolean;
};

export function DashboardPage({ pedidos, canManage, canCreate, mostrarPrazoInterno = true }: DashboardPageProps) {
  const [loading, setLoading] = useState(true);
  const [pedidoSelecionado, setPedidoSelecionado] = useState<Pedido | null>(null);
  const [dialogEdicaoAberto, setDialogEdicaoAberto] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setLoading(false), 700);
    return () => clearTimeout(timer);
  }, []);

  if (loading) return <DashboardSkeleton />;

  return (
    <section className="space-y-4">
      <AtrasoPedidosDevModal pedidos={pedidos} canManage={canManage} />
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h2 className="text-lg font-semibold text-slate-900">Painel de pedidos</h2>
          <p className="text-xs text-slate-500">Atualizacao em tempo real de prazos e status</p>
        </div>
        {canCreate ? <PedidoFormDialog /> : null}
      </div>

      <Card className="border-slate-300 p-3 shadow-md ring-2 ring-blue-100 md:p-4">
        <div className="mb-3 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm font-semibold text-slate-900">Pedidos e notas fiscais</p>
          <p className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">{pedidos.length} pedidos</p>
        </div>
        <PedidosTable
          dados={pedidos}
          canManage={canManage}
          mostrarPrazoInterno={mostrarPrazoInterno}
          onPedidoClick={(pedido) => {
            if (!canManage) return;
            setPedidoSelecionado(pedido);
            setDialogEdicaoAberto(true);
          }}
        />
      </Card>

      {canManage ? (
        <PedidoFormDialog
          mode="edit"
          initialPedido={pedidoSelecionado}
          open={dialogEdicaoAberto}
          onOpenChange={setDialogEdicaoAberto}
          onSaved={() => {
            setDialogEdicaoAberto(false);
            setPedidoSelecionado(null);
          }}
        />
      ) : null}
    </section>
  );
}

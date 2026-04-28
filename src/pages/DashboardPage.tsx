import { useEffect, useState } from "react";
import type { Pedido } from "../types";
import { PedidosTable } from "../components/PedidosTable";
import { PedidoFormDialog } from "../components/PedidoFormDialog";
import { DashboardSkeleton } from "../components/DashboardSkeleton";
import { Card } from "../components/ui/card";

type DashboardPageProps = {
  pedidos: Pedido[];
  canManage: boolean;
};

export function DashboardPage({ pedidos, canManage }: DashboardPageProps) {
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setLoading(false), 700);
    return () => clearTimeout(timer);
  }, []);

  if (loading) return <DashboardSkeleton />;

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Painel de pedidos</h2>
          <p className="text-xs text-slate-500">Atualizacao em tempo real de prazos e status</p>
        </div>
        {canManage ? <PedidoFormDialog /> : null}
      </div>

      <Card className="border-slate-300 p-3 shadow-md ring-2 ring-blue-100 md:p-4">
        <div className="mb-3 flex items-center justify-between">
          <p className="text-sm font-semibold text-slate-900">Pedidos e notas fiscais</p>
          <p className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">{pedidos.length} pedidos</p>
        </div>
        <PedidosTable dados={pedidos} canManage={canManage} />
      </Card>
    </section>
  );
}

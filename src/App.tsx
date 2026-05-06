import { useEffect, useMemo, useState } from "react";
import { ChartNoAxesColumn, Settings2, Users } from "lucide-react";
import { DashboardPage } from "./pages/DashboardPage";
import { FunilPage } from "./pages/FunilPage";
import { StatusManagementPage } from "./pages/StatusManagementPage";
import { UsersPage } from "./pages/UsersPage";
import { LoginPage } from "./pages/LoginPage";
import { Button } from "./components/ui/button";
import { Dialog, DialogContent } from "./components/ui/dialog";
import { useExportStore } from "./store/useExportStore";
import { useAuthStore } from "./store/useAuthStore";
import { formatarData, labelPrazo } from "./utils/date";
import { calcularCronogramaPedido } from "./utils/cronogramaPedido";

type View = "dashboard" | "funil" | "status" | "usuarios";

export default function App() {
  const [view, setView] = useState<View>("dashboard");
  const [openAtrasados, setOpenAtrasados] = useState(false);
  const pedidos = useExportStore((state) => state.pedidos);
  const status = useExportStore((state) => state.status);
  const loadingDados = useExportStore((state) => state.loading);
  const loadData = useExportStore((state) => state.loadData);
  const loadPedidos = useExportStore((state) => state.loadPedidos);
  const loadStatus = useExportStore((state) => state.loadStatus);
  const clearData = useExportStore((state) => state.clearData);
  const usuarioAtual = useAuthStore((state) => state.usuarioAtual);
  const logout = useAuthStore((state) => state.logout);

  useEffect(() => {
    if (!usuarioAtual) {
      clearData();
      return;
    }
    void loadData();
  }, [usuarioAtual, loadData, clearData]);

  useEffect(() => {
    if (!usuarioAtual) return;
    const interval = window.setInterval(() => {
      if (document.hidden) return;
      void Promise.all([loadPedidos(), loadStatus()]);
    }, 15000);
    return () => window.clearInterval(interval);
  }, [usuarioAtual, loadPedidos, loadStatus]);

  const isAdmin = usuarioAtual?.tipo === "administrador";
  const canManage = isAdmin;
  const canCreate = isAdmin || usuarioAtual?.tipo === "representante";
  const canSeeCadastros = isAdmin;
  const pedidosVisiveis =
    usuarioAtual?.tipo === "representante"
      ? pedidos.filter((pedido) => pedido.representante === usuarioAtual.nome)
      : pedidos;

  const pedidosFiltrados = useMemo(() => pedidosVisiveis, [pedidosVisiveis]);

  const kpis = useMemo(() => {
    const total = pedidosFiltrados.length;
    const atrasados = pedidosFiltrados.filter((pedido) => calcularCronogramaPedido(pedido).atrasado).length;
    const noPrazo = total - atrasados;
    const emTransito = pedidosFiltrados.filter((pedido) => pedido.statusAtual === "em-transito").length;
    return { total, atrasados, noPrazo, emTransito };
  }, [pedidosFiltrados]);

  const pedidosAtrasados = useMemo(
    () => pedidosFiltrados.filter((pedido) => calcularCronogramaPedido(pedido).atrasado),
    [pedidosFiltrados],
  );

  const notasPorEstado = useMemo(() => {
    const base = pedidosFiltrados.filter((pedido) => pedido.numeroNF?.trim().length > 0);
    const total = base.length;
    const itens = status
      .map((item) => ({
        id: item.id,
        nome: item.nome,
        cor: item.cor,
        quantidade: base.filter((pedido) => pedido.statusAtual === item.id).length,
      }))
      .filter((item) => item.quantidade > 0);

    let acumulado = 0;
    const segmentos = itens.map((item) => {
      const percentual = total > 0 ? (item.quantidade / total) * 100 : 0;
      const inicio = acumulado;
      acumulado += percentual;
      const fim = acumulado;
      return { ...item, percentual, inicio, fim };
    });

    const conic = segmentos.length
      ? `conic-gradient(${segmentos
          .map((seg) => `${seg.cor} ${seg.inicio.toFixed(2)}% ${seg.fim.toFixed(2)}%`)
          .join(", ")})`
      : "conic-gradient(#e5e7eb 0% 100%)";

    return { total, segmentos, conic };
  }, [pedidosFiltrados, status]);

  const notasPorRepresentante = useMemo(() => {
    const base = pedidosFiltrados.filter((pedido) => pedido.numeroNF?.trim().length > 0);
    const total = base.length;
    const palette = ["#2563eb", "#f97316", "#16a34a", "#8b5cf6", "#06b6d4", "#e11d48", "#f59e0b"];

    const agrupado = [...new Set(base.map((pedido) => pedido.representante))]
      .filter((nome) => nome?.trim().length > 0)
      .map((nome, idx) => ({
        id: nome,
        nome,
        cor: palette[idx % palette.length],
        quantidade: base.filter((pedido) => pedido.representante === nome).length,
      }))
      .filter((item) => item.quantidade > 0)
      .sort((a, b) => b.quantidade - a.quantidade);

    let acumulado = 0;
    const segmentos = agrupado.map((item) => {
      const percentual = total > 0 ? (item.quantidade / total) * 100 : 0;
      const inicio = acumulado;
      acumulado += percentual;
      const fim = acumulado;
      return { ...item, percentual, inicio, fim };
    });

    const conic = segmentos.length
      ? `conic-gradient(${segmentos
          .map((seg) => `${seg.cor} ${seg.inicio.toFixed(2)}% ${seg.fim.toFixed(2)}%`)
          .join(", ")})`
      : "conic-gradient(#e5e7eb 0% 100%)";

    return { total, segmentos, conic };
  }, [pedidosFiltrados]);

  const mediaEtapasTempo = useMemo(() => {
    const etapas = [
      { id: "pedido-faturamento", nome: "Pedido -> Faturamento", cor: "#eab308" },
      { id: "faturamento-expedicao", nome: "Faturamento -> Expedicao", cor: "#2563eb" },
      { id: "expedicao-entrega", nome: "Expedicao -> Entrega", cor: "#16a34a" },
    ];

    let baseValidos = 0;
    let soma1 = 0;
    let soma2 = 0;
    let soma3 = 0;

    pedidosFiltrados.forEach((pedido) => {
      const cronograma = calcularCronogramaPedido(pedido);
      if (!cronograma.valido) return;

      baseValidos += 1;
      soma1 += cronograma.segmentos.find((segmento) => segmento.id === "faturamento")?.dias ?? 0;
      soma2 += cronograma.segmentos.find((segmento) => segmento.id === "expedicao")?.dias ?? 0;
      soma3 += cronograma.segmentos.find((segmento) => segmento.id === "entrega")?.dias ?? 0;
    });

    const somaTotalDias = soma1 + soma2 + soma3;
    const itens = [
      { ...etapas[0], somaDias: soma1 },
      { ...etapas[1], somaDias: soma2 },
      { ...etapas[2], somaDias: soma3 },
    ].map((item) => ({
      ...item,
      mediaDias: baseValidos > 0 ? item.somaDias / baseValidos : 0,
      percentual: somaTotalDias > 0 ? (item.somaDias / somaTotalDias) * 100 : 0,
    }));

    let acumulado = 0;
    const segmentos = itens.map((item) => {
      const inicio = acumulado;
      acumulado += item.percentual;
      const fim = acumulado;
      return { ...item, inicio, fim };
    });

    const conic = segmentos.length
      ? `conic-gradient(${segmentos
          .map((seg) => `${seg.cor} ${seg.inicio.toFixed(2)}% ${seg.fim.toFixed(2)}%`)
          .join(", ")})`
      : "conic-gradient(#e5e7eb 0% 100%)";

    return { base: baseValidos, segmentos, conic };
  }, [pedidosFiltrados]);

  const entregaNoPrazo = useMemo(() => {
    const base = pedidosFiltrados
      .map((pedido) => calcularCronogramaPedido(pedido))
      .filter((cronograma) => cronograma.valido);
    const total = base.length;
    const atrasados = base.filter((cronograma) => cronograma.atrasado).length;
    const noPrazo = total - atrasados;
    const atrasoPercentual = total > 0 ? (atrasados / total) * 100 : 0;
    const emDiaPercentual = 100 - atrasoPercentual;
    const conic = `conic-gradient(#dc2626 0% ${atrasoPercentual.toFixed(2)}%, #16a34a ${atrasoPercentual.toFixed(
      2,
    )}% ${(atrasoPercentual + emDiaPercentual).toFixed(2)}%)`;
    return { total, atrasados, noPrazo, atrasoPercentual, emDiaPercentual, conic };
  }, [pedidosFiltrados]);

  if (!usuarioAtual) return <LoginPage />;
  if (loadingDados && pedidos.length === 0) return <main className="p-6 text-sm text-slate-600">Carregando dados do backend...</main>;

  return (
    <main className="min-h-dvh w-full overflow-x-clip bg-gray-50">
      <header className="sticky top-0 z-50 hidden border-b border-slate-200 bg-white/95 px-2 py-1.5 backdrop-blur sm:px-3 md:block">
        <div className="mx-auto grid w-full max-w-[1800px] items-center gap-1.5 xl:grid-cols-[auto_minmax(380px,1fr)_minmax(300px,500px)_auto]">
          <div className="flex min-w-0 items-center gap-2">
            {canSeeCadastros ? (
              <Button variant={view === "status" ? "default" : "outline"} onClick={() => setView("status")} size="sm">
                <Settings2 className="h-3.5 w-3.5 shrink-0" />
                Gestao de Status
              </Button>
            ) : null}
            {canSeeCadastros ? (
              <Button variant={view === "usuarios" ? "default" : "outline"} onClick={() => setView("usuarios")} size="sm">
                <Users className="h-3.5 w-3.5 shrink-0" />
                Usuarios
              </Button>
            ) : null}
          </div>
          {view === "dashboard" ? (
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-1.5">
              <p className="mb-1 text-[10px] font-medium text-slate-500">Informacoes</p>
              <div className="grid grid-cols-4 gap-1.5">
                <div className="rounded-md border border-slate-200 bg-white px-2 py-1">
                  <p className="text-[9px] text-slate-500">Total</p>
                  <p className="text-xs font-semibold text-slate-900">{kpis.total}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setOpenAtrasados(true)}
                  className="rounded-md border border-red-200 bg-red-50 px-2 py-1 text-left"
                >
                  <p className="text-[9px] text-slate-500">Atraso</p>
                  <p className="text-xs font-semibold text-red-700">{kpis.atrasados}</p>
                </button>
                <div className="rounded-md border border-slate-200 bg-white px-2 py-1">
                  <p className="text-[9px] text-slate-500">No prazo</p>
                  <p className="text-xs font-semibold text-slate-900">{kpis.noPrazo}</p>
                </div>
                <div className="rounded-md border border-slate-200 bg-white px-2 py-1">
                  <p className="text-[9px] text-slate-500">Transito</p>
                  <p className="text-xs font-semibold text-slate-900">{kpis.emTransito}</p>
                </div>
              </div>
            </div>
          ) : (
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-1.5">
              <p className="mb-1 text-[10px] font-medium text-slate-500">Informacoes</p>
              <div className="rounded-md border border-slate-200 bg-white px-2 py-1.5">
                <p className="text-xs text-slate-600">Funil considera o mesmo periodo selecionado no filtro.</p>
              </div>
            </div>
          )}

          <div className="min-w-0 rounded-lg border border-slate-200 bg-slate-50 p-1.5">
            <p className="mb-1 text-[10px] font-medium text-slate-500">Visualizacoes</p>
            <div className="grid grid-cols-2 gap-2">
              <Button variant={view === "dashboard" ? "default" : "outline"} onClick={() => setView("dashboard")} size="sm" className="h-8 w-full min-w-0 text-xs">
                Dashboard
              </Button>
              <Button variant={view === "funil" ? "default" : "outline"} onClick={() => setView("funil")} size="sm" className="h-8 w-full min-w-0 text-xs">
                <ChartNoAxesColumn className="h-3.5 w-3.5" />
                Funil
              </Button>
            </div>
          </div>

          <Button onClick={logout} size="sm" className="h-8 bg-red-600 px-2.5 text-xs text-white hover:bg-red-700">
            Sair
          </Button>
        </div>
      </header>

      <div className="mx-auto w-full max-w-[1800px] min-w-0 space-y-4 px-3 pb-20 pt-3 sm:px-4 md:space-y-5 md:px-6 md:pb-6 md:pt-4 xl:px-8">
        <header className="rounded-2xl bg-white p-4 shadow-sm md:p-5">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4 xl:items-center">
            <div className="min-w-0 rounded-xl border border-slate-200 bg-slate-50 p-2.5">
              <p className="mb-1 text-[11px] font-medium text-slate-500">Notas por estado</p>
              <div className="flex min-w-0 items-center gap-3">
                <div
                  className="relative h-20 w-20 shrink-0 rounded-full"
                  style={{ background: notasPorEstado.conic }}
                >
                  <div className="absolute inset-3 rounded-full bg-white" />
                  <div className="absolute inset-0 flex items-center justify-center text-xs font-semibold text-slate-700">
                    {notasPorEstado.total}
                  </div>
                </div>
                <div className="min-w-0 space-y-1">
                  {notasPorEstado.segmentos.slice(0, 3).map((item) => (
                    <div key={item.id} className="flex items-center gap-1.5 text-[11px] text-slate-600">
                      <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: item.cor }} />
                      <span className="max-w-[130px] truncate">{item.nome}</span>
                      <span className="font-medium text-slate-700">{item.quantidade}</span>
                    </div>
                  ))}
                  {notasPorEstado.segmentos.length === 0 ? (
                    <p className="text-[11px] text-slate-500">Sem notas no periodo.</p>
                  ) : null}
                </div>
              </div>
            </div>

            <div className="min-w-0 rounded-xl border border-slate-200 bg-slate-50 p-2.5">
              <p className="mb-1 text-[11px] font-medium text-slate-500">Notas por representante</p>
              <div className="flex min-w-0 items-center gap-3">
                <div
                  className="relative h-20 w-20 shrink-0 rounded-full"
                  style={{ background: notasPorRepresentante.conic }}
                >
                  <div className="absolute inset-3 rounded-full bg-white" />
                  <div className="absolute inset-0 flex items-center justify-center text-xs font-semibold text-slate-700">
                    {notasPorRepresentante.total}
                  </div>
                </div>
                <div className="min-w-0 space-y-1">
                  {notasPorRepresentante.segmentos.slice(0, 3).map((item) => (
                    <div key={item.id} className="flex items-center gap-1.5 text-[11px] text-slate-600">
                      <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: item.cor }} />
                      <span className="max-w-[130px] truncate">{item.nome}</span>
                      <span className="font-medium text-slate-700">{item.quantidade}</span>
                    </div>
                  ))}
                  {notasPorRepresentante.segmentos.length === 0 ? (
                    <p className="text-[11px] text-slate-500">Sem notas no periodo.</p>
                  ) : null}
                </div>
              </div>
            </div>

            <div className="min-w-0 rounded-xl border border-slate-200 bg-slate-50 p-2.5">
              <p className="mb-1 text-[11px] font-medium text-slate-500">Media de etapas</p>
              <div className="flex min-w-0 items-center gap-3">
                <div className="relative h-20 w-20 shrink-0 rounded-full" style={{ background: mediaEtapasTempo.conic }}>
                  <div className="absolute inset-3 rounded-full bg-white" />
                  <div className="absolute inset-0 flex items-center justify-center text-xs font-semibold text-slate-700">
                    {mediaEtapasTempo.base}
                  </div>
                </div>
                <div className="min-w-0 space-y-1">
                  {mediaEtapasTempo.segmentos.map((item) => (
                    <div key={item.id} className="flex items-center gap-1.5 text-[11px] text-slate-600">
                      <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: item.cor }} />
                      <span className="max-w-[130px] truncate">{item.nome}</span>
                      <span className="font-medium text-slate-700">{item.mediaDias.toFixed(1)}d</span>
                    </div>
                  ))}
                  {mediaEtapasTempo.base === 0 ? <p className="text-[11px] text-slate-500">Sem dados completos.</p> : null}
                </div>
              </div>
            </div>

            <div className="min-w-0 rounded-xl border border-slate-200 bg-slate-50 p-2.5">
              <p className="mb-1 text-[11px] font-medium text-slate-500">Entrega no prazo</p>
              <div className="flex min-w-0 items-center gap-3">
                <div
                  className="relative h-20 w-20 shrink-0 rounded-full"
                  style={{ background: entregaNoPrazo.conic }}
                >
                  <div className="absolute inset-3 rounded-full bg-white" />
                  <div className="absolute inset-0 flex items-center justify-center text-xs font-semibold text-slate-700">
                    {entregaNoPrazo.total}
                  </div>
                </div>
                <div className="min-w-0 space-y-1">
                  <div className="flex items-center gap-1.5 text-[11px] text-slate-600">
                    <span className="h-2.5 w-2.5 rounded-full bg-red-600" />
                    <span className="max-w-[130px] truncate">Atrasados</span>
                    <span className="font-medium text-slate-700">
                      {entregaNoPrazo.atrasados} ({entregaNoPrazo.atrasoPercentual.toFixed(1)}%)
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 text-[11px] text-slate-600">
                    <span className="h-2.5 w-2.5 rounded-full bg-emerald-600" />
                    <span className="max-w-[130px] truncate">No prazo</span>
                    <span className="font-medium text-slate-700">
                      {entregaNoPrazo.noPrazo} ({entregaNoPrazo.emDiaPercentual.toFixed(1)}%)
                    </span>
                  </div>
                  {entregaNoPrazo.total === 0 ? <p className="text-[11px] text-slate-500">Sem entregas fechadas.</p> : null}
                </div>
              </div>
            </div>
          </div>
        </header>

        {view === "dashboard" ? (
          <DashboardPage pedidos={pedidosFiltrados} canManage={canManage} canCreate={canCreate} />
        ) : view === "funil" ? (
          <FunilPage pedidos={pedidosFiltrados} />
        ) : view === "usuarios" && canSeeCadastros ? (
          <UsersPage />
        ) : canSeeCadastros ? (
          <StatusManagementPage />
        ) : (
          <DashboardPage pedidos={pedidosFiltrados} canManage={canManage} canCreate={canCreate} />
        )}
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 px-2 py-2 backdrop-blur md:hidden">
        <div className="mx-auto grid max-w-xl grid-cols-5 gap-1">
          <Button variant={view === "dashboard" ? "default" : "outline"} onClick={() => setView("dashboard")} size="sm" className="h-8 w-full px-1 text-[11px]">
            Dash
          </Button>
          <Button variant={view === "funil" ? "default" : "outline"} onClick={() => setView("funil")} size="sm" className="h-8 w-full px-1 text-[11px]">
            Funil
          </Button>
          <Button
            variant={view === "status" ? "default" : "outline"}
            onClick={() => (canSeeCadastros ? setView("status") : undefined)}
            size="sm"
            className="h-8 w-full px-1 text-[11px]"
            disabled={!canSeeCadastros}
          >
            Status
          </Button>
          <Button
            variant={view === "usuarios" ? "default" : "outline"}
            onClick={() => (canSeeCadastros ? setView("usuarios") : undefined)}
            size="sm"
            className="h-8 w-full px-1 text-[11px]"
            disabled={!canSeeCadastros}
          >
            Users
          </Button>
          <Button variant="outline" onClick={logout} size="sm" className="h-8 w-full px-1 text-[11px]">
            Sair
          </Button>
        </div>
      </nav>

      <Dialog open={openAtrasados} onOpenChange={setOpenAtrasados}>
        <DialogContent className="max-w-3xl">
          <h2 className="text-lg font-semibold text-slate-900">Pedidos atrasados</h2>
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            {pedidosAtrasados.map((pedido) => (
              <div key={pedido.numeroPedido} className="rounded-xl border border-red-200 bg-red-50/60 p-3">
                <p className="text-xs text-slate-500">{pedido.numeroPedido}</p>
                <p className="text-sm font-semibold text-slate-900">{pedido.cliente}</p>
                <p className="text-xs text-slate-500">{formatarData(pedido.prazoEntrega)}</p>
                <p className="mt-1 text-xs font-semibold text-red-700">{labelPrazo(pedido.prazoEntrega)}</p>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </main>
  );
}

import { useMemo, useState } from "react";
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
import { formatarData, isAtrasado, labelPrazo } from "./utils/date";

type View = "dashboard" | "funil" | "status" | "usuarios";

export default function App() {
  const [view, setView] = useState<View>("dashboard");
  const [openAtrasados, setOpenAtrasados] = useState(false);
  const pedidos = useExportStore((state) => state.pedidos);
  const status = useExportStore((state) => state.status);
  const usuarioAtual = useAuthStore((state) => state.usuarioAtual);
  const logout = useAuthStore((state) => state.logout);

  const isAdmin = usuarioAtual?.tipo === "administrador";
  const canManage = isAdmin;
  const canSeeCadastros = isAdmin;
  const pedidosVisiveis =
    usuarioAtual?.tipo === "representante"
      ? pedidos.filter((pedido) => pedido.representante === usuarioAtual.nome)
      : pedidos;

  const pedidosFiltrados = useMemo(() => pedidosVisiveis, [pedidosVisiveis]);

  const kpis = useMemo(() => {
    const total = pedidosFiltrados.length;
    const atrasados = pedidosFiltrados.filter((pedido) => isAtrasado(pedido.prazoEntrega)).length;
    const noPrazo = total - atrasados;
    const emTransito = pedidosFiltrados.filter((pedido) => pedido.statusAtual === "em-transito").length;
    return { total, atrasados, noPrazo, emTransito };
  }, [pedidosFiltrados]);

  const pedidosAtrasados = useMemo(
    () => pedidosFiltrados.filter((pedido) => isAtrasado(pedido.prazoEntrega)),
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

  if (!usuarioAtual) return <LoginPage />;

  return (
    <main className="min-h-dvh w-full bg-gray-50">
      <aside className="group fixed left-0 top-1/2 z-50 hidden -translate-y-1/2 items-center md:flex">
        <div className="h-24 w-1.5 rounded-r-full bg-slate-300/80 transition-colors group-hover:bg-blue-500" />
        <nav className="-ml-1 -translate-x-[calc(100%-6px)] rounded-r-2xl border border-slate-200 bg-white/95 p-2 shadow-lg backdrop-blur transition-transform duration-300 group-hover:translate-x-0">
          <div className="mb-2 border-b border-slate-200 px-2 pb-2">
            <p className="text-[11px] font-medium text-slate-500">Navegacao</p>
          </div>
          <div className="flex min-w-44 flex-col gap-1.5">
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
            <Button variant="outline" onClick={logout} size="sm">
              Sair
            </Button>
          </div>
        </nav>
      </aside>

      <div className="w-full space-y-4 px-3 pb-20 pt-3 sm:px-4 md:space-y-5 md:px-6 md:pb-6 md:pt-4">
        <header className="rounded-2xl bg-white p-4 shadow-sm md:p-5">
          <div className="grid gap-3 lg:grid-cols-[1fr_270px_270px_1.2fr] lg:items-center">
            <div>
              <p className="text-xs font-medium text-blue-600">Painel Executivo</p>
              <h1 className="text-xl font-semibold text-gray-900 md:text-2xl">Acompanhamento de Expedicoes</h1>
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50 p-2.5">
              <p className="mb-1 text-[11px] font-medium text-slate-500">Notas por estado</p>
              <div className="flex items-center gap-3">
                <div
                  className="relative h-20 w-20 shrink-0 rounded-full"
                  style={{ background: notasPorEstado.conic }}
                >
                  <div className="absolute inset-3 rounded-full bg-white" />
                  <div className="absolute inset-0 flex items-center justify-center text-xs font-semibold text-slate-700">
                    {notasPorEstado.total}
                  </div>
                </div>
                <div className="space-y-1">
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

            <div className="rounded-xl border border-slate-200 bg-slate-50 p-2.5">
              <p className="mb-1 text-[11px] font-medium text-slate-500">Notas por representante</p>
              <div className="flex items-center gap-3">
                <div
                  className="relative h-20 w-20 shrink-0 rounded-full"
                  style={{ background: notasPorRepresentante.conic }}
                >
                  <div className="absolute inset-3 rounded-full bg-white" />
                  <div className="absolute inset-0 flex items-center justify-center text-xs font-semibold text-slate-700">
                    {notasPorRepresentante.total}
                  </div>
                </div>
                <div className="space-y-1">
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
            <div className="grid gap-2">
              {(view === "dashboard" || view === "funil") && (
                <div className="grid gap-2 xl:grid-cols-[460px_1fr]">
                  {view === "dashboard" ? (
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-2">
                      <p className="mb-1 text-[11px] font-medium text-slate-500">Informacoes</p>
                      <div className="grid grid-cols-4 gap-2">
                        <div className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5">
                          <p className="text-[10px] text-slate-500">Total</p>
                          <p className="text-sm font-semibold text-slate-900">{kpis.total}</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => setOpenAtrasados(true)}
                          className="rounded-lg border border-red-200 bg-red-50 px-2.5 py-1.5 text-left"
                        >
                          <p className="text-[10px] text-slate-500">Atraso</p>
                          <p className="text-sm font-semibold text-red-700">{kpis.atrasados}</p>
                        </button>
                        <div className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5">
                          <p className="text-[10px] text-slate-500">No prazo</p>
                          <p className="text-sm font-semibold text-slate-900">{kpis.noPrazo}</p>
                        </div>
                        <div className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5">
                          <p className="text-[10px] text-slate-500">Transito</p>
                          <p className="text-sm font-semibold text-slate-900">{kpis.emTransito}</p>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-2">
                      <p className="mb-1 text-[11px] font-medium text-slate-500">Informacoes</p>
                      <div className="rounded-lg border border-slate-200 bg-white px-2.5 py-2">
                        <p className="text-xs text-slate-600">Funil considera o mesmo periodo selecionado no filtro.</p>
                      </div>
                    </div>
                  )}

                  <div className="justify-self-end rounded-xl border border-slate-200 bg-slate-50 p-2">
                    <p className="mb-1 text-[11px] font-medium text-slate-500">Visualizacoes</p>
                    <div className="grid grid-cols-2 gap-2">
                      <Button variant={view === "dashboard" ? "default" : "outline"} onClick={() => setView("dashboard")} size="sm">
                        Dashboard
                      </Button>
                      <Button variant={view === "funil" ? "default" : "outline"} onClick={() => setView("funil")} size="sm">
                        <ChartNoAxesColumn className="h-3.5 w-3.5" />
                        Funil
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        {view === "dashboard" ? (
          <DashboardPage pedidos={pedidosFiltrados} canManage={canManage} />
        ) : view === "funil" ? (
          <FunilPage pedidos={pedidosFiltrados} />
        ) : view === "usuarios" && canSeeCadastros ? (
          <UsersPage />
        ) : canSeeCadastros ? (
          <StatusManagementPage />
        ) : (
          <DashboardPage pedidos={pedidosFiltrados} canManage={canManage} />
        )}
      </div>

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

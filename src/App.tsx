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
import { formatarData, labelPrazo, prazoEfetivoEntrega } from "./utils/date";
import { ConicKpiCard } from "./components/ConicKpiCard";
import { calcularCronogramaPedido } from "./utils/cronogramaPedido";
import { calcularResumoDentroPrazoInterno } from "./utils/prazoInterno";

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
  const isDiretoria = usuarioAtual?.tipo === "diretoria";
  const isRepresentante = usuarioAtual?.tipo === "representante";
  const canManage = isAdmin;
  const canCreate = isAdmin || isRepresentante;
  const canSeeCadastros = isAdmin;
  const canSeePrazoInternoKpi = isAdmin || isDiretoria;
  const mostrarPrazoInterno = !isRepresentante;
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

    return { total, segmentos };
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

    return { total, segmentos };
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

    return { base: baseValidos, segmentos };
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
    const segmentos = [
      {
        id: "atrasados",
        nome: "Atrasados",
        cor: "#dc2626",
        valor: `${atrasados} (${atrasoPercentual.toFixed(1)}%)`,
        inicio: 0,
        fim: atrasoPercentual,
      },
      {
        id: "no-prazo",
        nome: "No prazo",
        cor: "#16a34a",
        valor: `${noPrazo} (${emDiaPercentual.toFixed(1)}%)`,
        inicio: atrasoPercentual,
        fim: 100,
      },
    ];
    return { total, atrasados, noPrazo, atrasoPercentual, emDiaPercentual, segmentos };
  }, [pedidosFiltrados]);

  const dentroPrazoInterno = useMemo(() => {
    if (!canSeePrazoInternoKpi) return null;
    return calcularResumoDentroPrazoInterno(pedidosFiltrados, status);
  }, [pedidosFiltrados, status, canSeePrazoInternoKpi]);

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
          <div
            className={`grid gap-3 md:grid-cols-2 xl:items-center ${canSeePrazoInternoKpi ? "xl:grid-cols-5" : "xl:grid-cols-4"}`}
          >
            <ConicKpiCard
              titulo="Notas por estado"
              total={notasPorEstado.total}
              segmentos={notasPorEstado.segmentos.map((item) => ({
                id: item.id,
                nome: item.nome,
                cor: item.cor,
                valor: String(item.quantidade),
                inicio: item.inicio,
                fim: item.fim,
              }))}
              vazio="Sem notas no periodo."
            />

            <ConicKpiCard
              titulo="Notas por representante"
              total={notasPorRepresentante.total}
              segmentos={notasPorRepresentante.segmentos.map((item) => ({
                id: item.id,
                nome: item.nome,
                cor: item.cor,
                valor: String(item.quantidade),
                inicio: item.inicio,
                fim: item.fim,
              }))}
              vazio="Sem notas no periodo."
            />

            <ConicKpiCard
              titulo="Media de etapas"
              total={mediaEtapasTempo.base}
              segmentos={mediaEtapasTempo.segmentos.map((item) => ({
                id: item.id,
                nome: item.nome,
                cor: item.cor,
                valor: `${item.mediaDias.toFixed(1)}d`,
                inicio: item.inicio,
                fim: item.fim,
              }))}
              vazio="Sem dados completos."
            />

            <ConicKpiCard
              titulo="Entrega no prazo"
              total={entregaNoPrazo.total}
              segmentos={entregaNoPrazo.segmentos}
              vazio="Sem entregas fechadas."
            />

            {canSeePrazoInternoKpi && dentroPrazoInterno ? (
              <ConicKpiCard
                titulo="Dentro do prazo interno"
                total={dentroPrazoInterno.total}
                segmentos={[
                  {
                    id: "fora",
                    nome: "Fora do prazo",
                    cor: "#0f172a",
                    valor: `${dentroPrazoInterno.fora} (${dentroPrazoInterno.foraPercentual.toFixed(1)}%)`,
                    inicio: 0,
                    fim: dentroPrazoInterno.foraPercentual,
                  },
                  {
                    id: "dentro",
                    nome: "Dentro do prazo",
                    cor: "#16a34a",
                    valor: `${dentroPrazoInterno.dentro} (${dentroPrazoInterno.dentroPercentual.toFixed(1)}%)`,
                    inicio: dentroPrazoInterno.foraPercentual,
                    fim: 100,
                  },
                ]}
                vazio="Sem pedidos avaliáveis."
                rodape={
                  dentroPrazoInterno.comEstimativaRegiao > 0 ? (
                    <p className="text-[10px] text-amber-700">
                      {dentroPrazoInterno.comEstimativaRegiao} pedido(s) sem região (estimativa 8d Sul)
                    </p>
                  ) : null
                }
              />
            ) : null}
          </div>
        </header>

        {view === "dashboard" ? (
          <DashboardPage pedidos={pedidosFiltrados} canManage={canManage} canCreate={canCreate} mostrarPrazoInterno={mostrarPrazoInterno} />
        ) : view === "funil" ? (
          <FunilPage pedidos={pedidosFiltrados} />
        ) : view === "usuarios" && canSeeCadastros ? (
          <UsersPage />
        ) : canSeeCadastros ? (
          <StatusManagementPage />
        ) : (
          <DashboardPage pedidos={pedidosFiltrados} canManage={canManage} canCreate={canCreate} mostrarPrazoInterno={mostrarPrazoInterno} />
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
                <p className="text-xs text-slate-500">{formatarData(prazoEfetivoEntrega(pedido.prazoEntrega, pedido.dataAgendamento))}</p>
                <p className="mt-1 text-xs font-semibold text-red-700">{labelPrazo(pedido.prazoEntrega, pedido.dataAgendamento)}</p>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </main>
  );
}

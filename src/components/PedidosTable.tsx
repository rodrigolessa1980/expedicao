import { useMemo, useState } from "react";
import { dayjs } from "../utils/date";
import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
} from "@tanstack/react-table";
import { motion } from "framer-motion";
import type { Pedido } from "../types";
import { diasParaPrazo, formatarData, infoFinalizado, isAtrasado, isPrazoProximo } from "../utils/date";
import { calcularCronogramaPedido } from "../utils/cronogramaPedido";
import {
  calcularPrazoInterno,
  dataPrazoInterno,
  diasPrazoInternoPorRegiao,
  MSG_SELECIONE_REGIAO_PRAZO,
} from "../utils/prazoInterno";
import { useExportStore } from "../store/useExportStore";
import { Input } from "./ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";

type PedidosTableProps = {
  dados: Pedido[];
  canManage: boolean;
  onPedidoClick?: (pedido: Pedido) => void;
};
type PeriodoRapido = "todos" | "7d" | "30d" | "90d" | "mes";
type AbaPedidos = "todos" | "ativos" | "atrasados" | "concluidos";

/** Template do grid (inline — Tailwind não aceita grid-cols arbitrário montado em runtime). */
const GRID_TEMPLATE_COLUNAS =
  "minmax(120px,1.5fr) minmax(100px,1.1fr) minmax(56px,0.6fr) minmax(120px,1.2fr) minmax(88px,0.85fr) repeat(3,minmax(104px,1fr)) minmax(96px,0.9fr) repeat(3,minmax(104px,1fr)) minmax(150px,max-content)";
const COLUNAS_ALINHADAS_ESQUERDA = new Set(["representante", "cliente"]);
const ROTULO_COLUNA_CENTRO =
  "w-full shrink-0 cursor-pointer select-none text-center text-[9px] font-bold uppercase tracking-wider text-slate-500 transition-colors hover:text-slate-800";
const ROTULO_COLUNA_ESQUERDA =
  "w-full shrink-0 cursor-pointer select-none text-left text-[9px] font-bold uppercase tracking-wider text-slate-500 transition-colors hover:text-slate-800";
const CABECALHO_COLUNA =
  "flex min-h-[36px] min-w-0 flex-col items-center justify-center border-r-2 border-slate-200 px-3 py-2";
const CABECALHO_COLUNA_ESQUERDA =
  "flex min-h-[36px] min-w-0 flex-col items-start justify-center border-r-2 border-slate-200 px-3 py-2";
const CABECALHO_COLUNA_STATUS = `${CABECALHO_COLUNA} max-w-[200px] border-r-0`;
const CELULA_COLUNA =
  "flex min-w-0 flex-col items-center justify-center gap-1.5 border-r-2 border-slate-200 px-3 py-3 text-center";
const CELULA_COLUNA_ESQUERDA =
  "flex min-w-0 flex-col items-start justify-center gap-1.5 border-r-2 border-slate-200 px-3 py-3 text-left";
const CELULA_COLUNA_STATUS = `${CELULA_COLUNA} max-w-[200px] border-r-0`;
const VALOR_COLUNA_CENTRO = "flex w-full min-w-0 items-center justify-center truncate text-xs leading-snug";
const VALOR_COLUNA_ESQUERDA = "flex w-full min-w-0 items-center justify-start truncate text-xs leading-snug";

function pedidoEmAtraso(pedido: Pedido, status: { id: string; nome: string }[]): boolean {
  const statusItem = status.find((s) => s.id === pedido.statusAtual);
  const concluido = statusItem?.nome.toLowerCase().includes("finalizado") || !!pedido.dataEntrega;
  return !concluido && isAtrasado(pedido.prazoEntrega, pedido.dataAgendamento);
}

function posicaoPercentualEscala(percentual: number) {
  return percentual >= 100 ? "calc(100% - 1px)" : `${percentual.toFixed(2)}%`;
}

function MarcadorPrazoInternoTermometro({
  prazoInterno,
}: {
  prazoInterno: NonNullable<ReturnType<typeof calcularPrazoInterno>>;
}) {
  const left = posicaoPercentualEscala(prazoInterno.percentualNaEscala);
  const titulo = prazoInterno.estimativaSemRegiao
    ? MSG_SELECIONE_REGIAO_PRAZO
    : `Prazo interno (${prazoInterno.diasCorridos} dias): ${formatarData(prazoInterno.dataPrazo)}`;

  const pct = prazoInterno.percentualNaEscala;

  return (
    <>
      <div
        className="pointer-events-none absolute inset-y-0 z-[6] bg-slate-500/35"
        style={pct >= 100 ? { left: 0, right: 0 } : { left, right: 0 }}
        title="Período após o prazo interno"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute -top-0.5 bottom-0 z-[18] w-3 -translate-x-1/2 rounded-sm border border-slate-900/80 bg-slate-900/45 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.25)]"
        style={{ left }}
        title={titulo}
        aria-hidden
      />
    </>
  );
}

function ConteudoPrazoInterno({ regiao, dataPedido }: { regiao: string; dataPedido: string }) {
  const prazo = calcularPrazoInterno(regiao, dataPedido, 1);
  if (!prazo) return <span className="text-xs text-slate-400">—</span>;

  const titulo = prazo.estimativaSemRegiao
    ? MSG_SELECIONE_REGIAO_PRAZO
    : `${prazo.diasCorridos} dias corridos (${regiao})`;

  return (
    <div className="flex min-w-0 flex-col items-center gap-0.5" title={titulo}>
      <span className={`text-xs font-semibold ${prazo.ultrapassado ? "text-slate-900 underline decoration-slate-400" : "text-slate-800"}`}>
        {formatarData(prazo.dataPrazo)}
        {prazo.estimativaSemRegiao ? "*" : ""}
      </span>
      {prazo.estimativaSemRegiao ? (
        <span className="max-w-[88px] text-center text-[8px] font-medium leading-tight text-amber-700">
          Selecione a região
        </span>
      ) : null}
    </div>
  );
}

export function PedidosTable({ dados, canManage, onPedidoClick }: PedidosTableProps) {
  const gridTemplateColumns = GRID_TEMPLATE_COLUNAS;
  const status = useExportStore((state) => state.status);
  const updatePedidoStatus = useExportStore((state) => state.updatePedidoStatus);
  const [erroAtualizacao, setErroAtualizacao] = useState("");
  const [periodoRapido, setPeriodoRapido] = useState<PeriodoRapido>("todos");
  const [dataInicio, setDataInicio] = useState("");
  const [dataFim, setDataFim] = useState("");
  const [filtroCliente, setFiltroCliente] = useState("");
  const [filtroRepresentante, setFiltroRepresentante] = useState("todos");
  const [filtroStatus, setFiltroStatus] = useState("todos");
  const [abaAtiva, setAbaAtiva] = useState<AbaPedidos>("ativos");

  const representantes = useMemo(
    () =>
      [...new Set(dados.map((pedido) => pedido.representante))]
        .filter((item) => item && item.trim().length > 0)
        .sort((a, b) => a.localeCompare(b)),
    [dados],
  );

  const dadosComFiltroPeriodo = useMemo(() => {
    if (dataInicio || dataFim) {
      return dados.filter((pedido) => {
        const data = new Date(`${pedido.dataPedido}T00:00:00`).getTime();
        const inicio = dataInicio ? new Date(`${dataInicio}T00:00:00`).getTime() : Number.NEGATIVE_INFINITY;
        const fim = dataFim ? new Date(`${dataFim}T23:59:59`).getTime() : Number.POSITIVE_INFINITY;
        return data >= inicio && data <= fim;
      });
    }

    if (periodoRapido === "todos") return dados;

    const hoje = new Date();
    if (periodoRapido === "mes") {
      const inicioMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1).getTime();
      const fimMes = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0, 23, 59, 59).getTime();
      return dados.filter((pedido) => {
        const data = new Date(`${pedido.dataPedido}T00:00:00`).getTime();
        return data >= inicioMes && data <= fimMes;
      });
    }

    const dias = periodoRapido === "7d" ? 7 : periodoRapido === "30d" ? 30 : 90;
    const inicio = new Date(hoje);
    inicio.setDate(inicio.getDate() - dias);
    const inicioTs = new Date(inicio.getFullYear(), inicio.getMonth(), inicio.getDate()).getTime();
    return dados.filter((pedido) => new Date(`${pedido.dataPedido}T00:00:00`).getTime() >= inicioTs);
  }, [dados, periodoRapido, dataInicio, dataFim]);

  const filtradosBase = useMemo(
    () =>
      dadosComFiltroPeriodo.filter((pedido) => {
        const matchCliente = pedido.cliente.toLowerCase().includes(filtroCliente.toLowerCase());
        const matchRepresentante = filtroRepresentante === "todos" || pedido.representante === filtroRepresentante;
        const matchStatus = filtroStatus === "todos" || pedido.statusAtual === filtroStatus;
        return matchCliente && matchRepresentante && matchStatus;
      }),
    [dadosComFiltroPeriodo, filtroCliente, filtroRepresentante, filtroStatus],
  );

  const counts = useMemo(() => {
    const ativos = filtradosBase.filter((p) => {
      const s = status.find((i) => i.id === p.statusAtual);
      return !(s?.nome.toLowerCase().includes("finalizado") || !!p.dataEntrega);
    }).length;
    const atrasados = filtradosBase.filter((p) => pedidoEmAtraso(p, status)).length;
    const concluidos = filtradosBase.length - ativos;
    return { todos: filtradosBase.length, ativos, atrasados, concluidos };
  }, [filtradosBase, status]);

  const filtrados = useMemo(
    () =>
      filtradosBase.filter((pedido) => {
        const statusItem = status.find((s) => s.id === pedido.statusAtual);
        const isConcluido = statusItem?.nome.toLowerCase().includes("finalizado") || !!pedido.dataEntrega;
        
        if (abaAtiva === "ativos" && isConcluido) return false;
        if (abaAtiva === "concluidos" && !isConcluido) return false;
        if (abaAtiva === "atrasados" && !pedidoEmAtraso(pedido, status)) return false;
        return true;
      }),
    [filtradosBase, abaAtiva, status],
  );

  const columns = useMemo<ColumnDef<Pedido>[]>(
    () => [
      { accessorKey: "numeroPedido", header: "Pedido" },
      { accessorKey: "representante", header: "Representante" },
      { accessorKey: "numeroNF", header: "NF" },
      { accessorKey: "cliente", header: "Cliente" },
      {
        accessorKey: "regiao",
        header: "Regiao",
        cell: ({ row }) =>
          row.original.regiao ? (
            <span>{row.original.regiao}</span>
          ) : (
            <span
              className="inline-flex rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800"
              title={MSG_SELECIONE_REGIAO_PRAZO}
            >
              Sem região
            </span>
          ),
      },
      {
        accessorKey: "dataPedido",
        header: "Data do Pedido",
        cell: ({ row }) => formatarData(row.original.dataPedido),
      },
      {
        accessorKey: "dataFaturamento",
        header: "Data Faturamento",
        cell: ({ row }) => formatarData(row.original.dataFaturamento),
      },
      {
        accessorKey: "dataExpedicao",
        header: "Data Expedicao",
        cell: ({ row }) => formatarData(row.original.dataExpedicao),
      },
      {
        id: "prazoInterno",
        header: "Prazo interno",
        cell: ({ row }) => (
          <ConteudoPrazoInterno regiao={row.original.regiao} dataPedido={row.original.dataPedido} />
        ),
      },
      {
        accessorKey: "prazoEntrega",
        header: "Prazo",
        cell: ({ row }) => {
          const pedido = row.original;
          const statusAtual = status.find((s) => s.id === pedido.statusAtual);
          const concluido = statusAtual?.nome.toLowerCase().includes("finalizado") || !!pedido.dataEntrega;

          if (concluido && pedido.dataEntrega) {
            const info = infoFinalizado(pedido.prazoEntrega, pedido.dataEntrega, pedido.dataAgendamento);
            return (
              <span className={info.cor === "verde" ? "font-semibold text-green-600" : "font-semibold text-red-600"}>
                {info.label}
              </span>
            );
          }

          const atrasado = !concluido && isAtrasado(pedido.prazoEntrega, pedido.dataAgendamento);
          const proximo = !concluido && isPrazoProximo(pedido.prazoEntrega, pedido.dataAgendamento);
          const dias = diasParaPrazo(pedido.prazoEntrega, pedido.dataAgendamento);

          return (
            <span className={atrasado ? "font-semibold text-red-600" : proximo ? "font-semibold text-amber-600" : "text-slate-700"}>
              {dias} dias
            </span>
          );
        },
      },
      {
        accessorKey: "dataAgendamento",
        header: "Agendamento",
        cell: ({ row }) => {
          const dataAgendamento = row.original.dataAgendamento;
          return dataAgendamento ? formatarData(dataAgendamento) : "-";
        },
      },
      {
        accessorKey: "dataEntrega",
        header: "Data de Entrega",
        cell: ({ row }) => {
          const dataEntrega = row.original.dataEntrega;
          return dataEntrega ? formatarData(dataEntrega) : "-";
        },
      },
      {
        accessorKey: "statusAtual",
        header: "Status",
        cell: ({ row }) => {
          const pedido = row.original;
          const statusAtual = status.find((s) => s.id === pedido.statusAtual);
          if (!canManage) {
            return (
              <span
                className="inline-flex h-8 items-center justify-center rounded-lg px-2.5 text-center text-xs font-semibold text-white"
                style={{ backgroundColor: statusAtual?.cor ?? "#64748b" }}
              >
                {statusAtual?.nome ?? "Sem status"}
              </span>
            );
          }
          return (
            <Select
              value={pedido.statusAtual}
              onValueChange={async (value) => {
                const result = await updatePedidoStatus(pedido.numeroPedido, value);
                if (!result.ok) setErroAtualizacao(result.erro ?? "Erro ao atualizar status.");
              }}
            >
              <SelectTrigger
                onClick={(event) => event.stopPropagation()}
                className="mx-auto h-8 w-full min-w-0 max-w-[180px] border-transparent px-2.5 text-center text-xs font-semibold text-white"
                style={{ backgroundColor: statusAtual?.cor ?? "#64748b" }}
              >
                <SelectValue placeholder="Atualizar status" />
              </SelectTrigger>
              <SelectContent>
                {status.map((item) => (
                  <SelectItem key={item.id} value={item.id}>
                    {item.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          );
        },
      },
    ],
    [status, updatePedidoStatus, canManage],
  );

  const table = useReactTable({
    data: filtrados,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  return (
    <div className="space-y-3 md:space-y-4">
      <div className="rounded-lg border border-slate-200 bg-slate-50 p-2 md:rounded-xl md:p-3">
        <p className="mb-1.5 text-[11px] font-medium text-slate-600 md:mb-2 md:text-xs">Filtros</p>
        <div className="grid grid-cols-2 gap-1.5 md:grid-cols-3 md:gap-2">
          <Select
            value={periodoRapido}
            onValueChange={(value) => {
              setPeriodoRapido(value as PeriodoRapido);
              setDataInicio("");
              setDataFim("");
            }}
          >
            <SelectTrigger className="col-span-2 h-8 text-[11px] md:col-span-1 md:h-10 md:text-sm">
              <SelectValue placeholder="Periodo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Periodo: Todos</SelectItem>
              <SelectItem value="7d">Ultimos 7 dias</SelectItem>
              <SelectItem value="30d">Ultimos 30 dias</SelectItem>
              <SelectItem value="90d">Ultimos 90 dias</SelectItem>
              <SelectItem value="mes">Mes atual</SelectItem>
            </SelectContent>
          </Select>
          <Input type="date" value={dataInicio} onChange={(e) => setDataInicio(e.target.value)} className="h-8 text-[11px] md:h-10 md:text-sm" />
          <Input type="date" value={dataFim} onChange={(e) => setDataFim(e.target.value)} className="h-8 text-[11px] md:h-10 md:text-sm" />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-1.5 rounded-lg border border-slate-200 bg-white p-2 md:grid-cols-3 md:gap-2 md:rounded-xl md:p-3">
        <Input
          value={filtroCliente}
          onChange={(e) => setFiltroCliente(e.target.value)}
          placeholder="Cliente"
          className="col-span-2 h-8 text-[11px] placeholder:text-[11px] md:col-span-1 md:h-10 md:text-sm md:placeholder:text-sm"
        />
        <Select value={filtroRepresentante} onValueChange={setFiltroRepresentante}>
          <SelectTrigger className="h-8 text-[11px] md:h-10 md:text-sm">
            <SelectValue placeholder="Representante" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os representantes</SelectItem>
            {representantes.map((item) => (
              <SelectItem key={item} value={item}>
                {item}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filtroStatus} onValueChange={setFiltroStatus}>
          <SelectTrigger className="h-8 text-[11px] md:h-10 md:text-sm">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os status</SelectItem>
            {status.map((item) => (
              <SelectItem key={item.id} value={item.id}>
                {item.nome}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex items-center gap-1 overflow-x-auto border-b border-slate-200 pb-1">
        <button
          type="button"
          onClick={() => setAbaAtiva("ativos")}
          className={`flex shrink-0 items-center gap-2 px-4 py-2 text-sm font-semibold transition-all ${
            abaAtiva === "ativos"
              ? "border-b-2 border-blue-600 text-blue-600"
              : "text-slate-500 hover:text-slate-700"
          }`}
        >
          Abertos
          <span className={`rounded-full px-1.5 py-0.5 text-[10px] ${abaAtiva === "ativos" ? "bg-blue-100 text-blue-700" : "bg-slate-100 text-slate-500"}`}>
            {counts.ativos}
          </span>
        </button>
        <button
          type="button"
          onClick={() => setAbaAtiva("atrasados")}
          className={`flex shrink-0 items-center gap-2 px-4 py-2 text-sm font-semibold transition-all ${
            abaAtiva === "atrasados"
              ? "border-b-2 border-red-600 text-red-600"
              : "text-slate-500 hover:text-slate-700"
          }`}
        >
          Atrasados
          <span
            className={`rounded-full px-1.5 py-0.5 text-[10px] ${
              abaAtiva === "atrasados" ? "bg-red-100 text-red-700" : "bg-slate-100 text-slate-500"
            }`}
          >
            {counts.atrasados}
          </span>
        </button>
        <button
          type="button"
          onClick={() => setAbaAtiva("concluidos")}
          className={`flex shrink-0 items-center gap-2 px-4 py-2 text-sm font-semibold transition-all ${
            abaAtiva === "concluidos"
              ? "border-b-2 border-blue-600 text-blue-600"
              : "text-slate-500 hover:text-slate-700"
          }`}
        >
          Concluídos
          <span className={`rounded-full px-1.5 py-0.5 text-[10px] ${abaAtiva === "concluidos" ? "bg-blue-100 text-blue-700" : "bg-slate-100 text-slate-500"}`}>
            {counts.concluidos}
          </span>
        </button>
        <button
          type="button"
          onClick={() => setAbaAtiva("todos")}
          className={`flex shrink-0 items-center gap-2 px-4 py-2 text-sm font-semibold transition-all ${
            abaAtiva === "todos"
              ? "border-b-2 border-blue-600 text-blue-600"
              : "text-slate-500 hover:text-slate-700"
          }`}
        >
          Todos
          <span className={`rounded-full px-1.5 py-0.5 text-[10px] ${abaAtiva === "todos" ? "bg-blue-100 text-blue-700" : "bg-slate-100 text-slate-500"}`}>
            {counts.todos}
          </span>
        </button>
      </div>

      <div className="space-y-2 lg:hidden">
        {filtrados.map((pedido) => {
          const statusAtual = status.find((s) => s.id === pedido.statusAtual);
          const concluido = statusAtual?.nome.toLowerCase().includes("finalizado") || !!pedido.dataEntrega;
          const atrasado = !concluido && isAtrasado(pedido.prazoEntrega, pedido.dataAgendamento);
          const proximo = !concluido && isPrazoProximo(pedido.prazoEntrega, pedido.dataAgendamento);
          const prazoInternoMobile = calcularPrazoInterno(pedido.regiao, pedido.dataPedido, 1);

          return (
            <div key={pedido.numeroPedido} className="space-y-2 rounded-xl border-2 border-slate-300 bg-white p-3 shadow-sm">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-xs font-medium text-slate-500">Pedido {pedido.numeroPedido}</p>
                  <p className="truncate text-sm font-semibold text-slate-900">{pedido.cliente}</p>
                  <p className="text-xs text-slate-500">
                    {pedido.regiao || "Sem regiao"} | {pedido.representante}
                  </p>
                </div>
                <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-700">
                  NF {pedido.numeroNF}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs text-slate-600">
                <p>
                  <span className="font-medium text-slate-700">Pedido:</span> {formatarData(pedido.dataPedido)}
                </p>
                <p>
                  <span className="font-medium text-slate-700">Faturamento:</span> {formatarData(pedido.dataFaturamento)}
                </p>
                <p>
                  <span className="font-medium text-slate-700">Expedicao:</span> {formatarData(pedido.dataExpedicao)}
                </p>
                {prazoInternoMobile ? (
                  <p
                    className={prazoInternoMobile.ultrapassado ? "font-semibold text-slate-900" : "font-semibold text-slate-800"}
                    title={prazoInternoMobile.estimativaSemRegiao ? MSG_SELECIONE_REGIAO_PRAZO : undefined}
                  >
                    <span className="font-medium text-slate-700">Prazo interno:</span> {formatarData(prazoInternoMobile.dataPrazo)}
                    {prazoInternoMobile.estimativaSemRegiao ? "*" : ""}
                    {prazoInternoMobile.estimativaSemRegiao ? (
                      <span className="ml-1 text-[10px] font-medium text-amber-700">(selecione a região)</span>
                    ) : null}
                  </p>
                ) : null}
                {concluido && pedido.dataEntrega ? (() => {
                  const info = infoFinalizado(pedido.prazoEntrega, pedido.dataEntrega, pedido.dataAgendamento);
                  return (
                    <p className={info.cor === "verde" ? "font-semibold text-green-600" : "font-semibold text-red-600"}>
                      <span className="font-medium text-slate-700">Prazo:</span> {info.label}
                    </p>
                  );
                })() : (
                  <p className={atrasado ? "font-semibold text-red-600" : proximo ? "font-semibold text-amber-600" : "text-slate-700"}>
                    <span className="font-medium text-slate-700">Prazo:</span> {diasParaPrazo(pedido.prazoEntrega, pedido.dataAgendamento)} dias
                  </p>
                )}
                <p>
                  <span className="font-medium text-slate-700">Entrega:</span> {pedido.dataEntrega ? formatarData(pedido.dataEntrega) : "-"}
                </p>
              </div>

              {canManage ? (
                <Select
                  value={pedido.statusAtual}
                  onValueChange={async (value) => {
                    const result = await updatePedidoStatus(pedido.numeroPedido, value);
                    if (!result.ok) setErroAtualizacao(result.erro ?? "Erro ao atualizar status.");
                  }}
                >
                  <SelectTrigger
                    onClick={(event) => event.stopPropagation()}
                    className="h-9 border-transparent px-2.5 text-xs font-semibold text-white"
                    style={{ backgroundColor: statusAtual?.cor ?? "#64748b" }}
                  >
                    <SelectValue placeholder="Atualizar status" />
                  </SelectTrigger>
                  <SelectContent>
                    {status.map((item) => (
                      <SelectItem key={item.id} value={item.id}>
                        {item.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <span
                  className="inline-flex h-8 items-center rounded-lg px-2.5 text-xs font-semibold text-white"
                  style={{ backgroundColor: statusAtual?.cor ?? "#64748b" }}
                >
                  {statusAtual?.nome ?? "Sem status"}
                </span>
              )}
              {canManage && onPedidoClick ? (
                <button
                  type="button"
                  className="text-xs font-semibold text-blue-600 hover:text-blue-700"
                  onClick={() => onPedidoClick(pedido)}
                >
                  Ver e editar pedido
                </button>
              ) : null}
            </div>
          );
        })}
      </div>

      <div className="hidden lg:block w-full">
        <div
          className="sticky top-0 z-40 mb-3 grid w-full items-stretch gap-x-1 rounded-xl border-2 border-slate-300 bg-white shadow-sm"
          style={{ gridTemplateColumns }}
          role="row"
        >
          {table.getHeaderGroups()[0]?.headers.map((header, index, headers) => {
            const isStatus = index === headers.length - 1;
            const alinharEsquerda = COLUNAS_ALINHADAS_ESQUERDA.has(header.column.id);
            const sorted = header.column.getIsSorted();
            return (
              <div
                key={header.id}
                className={isStatus ? CABECALHO_COLUNA_STATUS : alinharEsquerda ? CABECALHO_COLUNA_ESQUERDA : CABECALHO_COLUNA}
              >
                <span
                  role="button"
                  tabIndex={0}
                  className={alinharEsquerda ? ROTULO_COLUNA_ESQUERDA : ROTULO_COLUNA_CENTRO}
                  onClick={header.column.getToggleSortingHandler()}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      header.column.getToggleSortingHandler()?.(event);
                    }
                  }}
                >
                  {flexRender(header.column.columnDef.header, header.getContext())}
                  {sorted === "asc" ? " ↑" : sorted === "desc" ? " ↓" : null}
                </span>
              </div>
            );
          })}
        </div>

        <div className="w-full space-y-5">
          {table.getRowModel().rows.map((row) => {
            const statusAtual = status.find((s) => s.id === row.original.statusAtual);
            const concluido = statusAtual?.nome.toLowerCase().includes("finalizado") || !!row.original.dataEntrega;
            const atrasado = !concluido && isAtrasado(row.original.prazoEntrega, row.original.dataAgendamento);
            const proximo = !concluido && isPrazoProximo(row.original.prazoEntrega, row.original.dataAgendamento);
            const { dias: diasInterno } = diasPrazoInternoPorRegiao(row.original.regiao);
            const dataPrazoInternoPedido = dataPrazoInterno(row.original.dataPedido, diasInterno);
            const termometro = calcularCronogramaPedido(row.original, {
              concluido,
              dataPrazoInterno: dataPrazoInternoPedido,
            });
            const totalEscalaVisivel = termometro.totalDiasEscala;
            const prazoInterno = termometro.valido
              ? calcularPrazoInterno(row.original.regiao, row.original.dataPedido, totalEscalaVisivel)
              : null;
            const prazoPercentualVisivel = termometro.prazoPercentual;
            const temEmAberto = termometro.segmentos.some((s) => s.id === "emAberto");
            const temAposPrazoInterno = termometro.segmentos.some((s) => s.id === "aposPrazoInterno");
            const temAtrasoOficial = termometro.segmentos.some((s) => s.id === "atrasoPrazo");
            const indiceDiaPrazoInterno =
              prazoInterno != null
                ? dayjs(`${prazoInterno.dataPrazo}T00:00:00`).diff(dayjs(`${row.original.dataPedido}T00:00:00`), "day")
                : null;

            return (
              <motion.div
                key={row.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                onClick={() => {
                  if (canManage && onPedidoClick) onPedidoClick(row.original);
                }}
                className={`group rounded-2xl border-2 border-slate-300 bg-white shadow-sm transition-all hover:border-blue-400 hover:shadow-md ${
                  canManage && onPedidoClick ? "cursor-pointer" : ""
                } ${atrasado ? "bg-red-50/30" : proximo ? "bg-amber-50/20" : ""}`}
              >
                <div className="relative px-6 pb-2 pt-14">
                  {termometro.valido ? (
                    <div className="relative h-3 w-full">
                      {/* Marcacoes de Datas Superiores */}
                      <div className="absolute -top-7 left-0 h-7 w-full pointer-events-none">
                        {Array.from({ length: totalEscalaVisivel + 1 }).map((_, i) => {
                          const dataInicio = dayjs(`${row.original.dataPedido}T00:00:00`);
                          const dataTick = dataInicio.add(i, "day");
                          const showLabel = totalEscalaVisivel <= 15 || i % Math.ceil(totalEscalaVisivel / 15) === 0;
                          const ehDiaPrazoInterno = indiceDiaPrazoInterno === i;
                          const mostraRotulo = showLabel || ehDiaPrazoInterno;

                          return (
                            <div
                              key={i}
                              className="absolute flex flex-col items-center"
                              style={{ left: `${(i / totalEscalaVisivel * 100).toFixed(2)}%`, transform: "translateX(-50%)" }}
                            >
                              {mostraRotulo ? (
                                ehDiaPrazoInterno ? (
                                  <div className="flex flex-col items-center">
                                    <span
                                      className="whitespace-nowrap rounded-full bg-red-600 px-1.5 py-0.5 text-[7px] font-bold leading-none text-white shadow-sm ring-1 ring-red-700/40"
                                      title={
                                        prazoInterno?.estimativaSemRegiao
                                          ? MSG_SELECIONE_REGIAO_PRAZO
                                          : `Prazo interno: ${formatarData(prazoInterno!.dataPrazo)}`
                                      }
                                    >
                                      {dataTick.format("DD/MM")}
                                      {prazoInterno?.estimativaSemRegiao ? "*" : ""}
                                    </span>
                                    <span
                                      className="mt-0.5 block h-0 w-0 border-x-[3px] border-t-[4px] border-x-transparent border-t-red-600"
                                      aria-hidden
                                    />
                                  </div>
                                ) : (
                                  <span className="text-[7px] font-bold text-slate-300 transition-colors group-hover:text-slate-400">
                                    {dataTick.format("DD/MM")}
                                  </span>
                                )
                              ) : null}
                              <div className={`h-2 w-0.5 ${ehDiaPrazoInterno ? "bg-red-500/80" : "bg-slate-300"}`} />
                            </div>
                          );
                        })}
                      </div>

                      {/* Seta do Dia Atual */}
                      {(() => {
                        const hoje = dayjs().startOf("day");
                        const dataInicio = dayjs(`${row.original.dataPedido}T00:00:00`);
                        const diasDecorridos = Math.max(0, hoje.diff(dataInicio, "day", true));
                        const percentualHoje = Math.min(100, (diasDecorridos / totalEscalaVisivel) * 100);

                        return (
                          <div
                            className="absolute -top-3 z-10 flex flex-col items-center"
                            style={{ left: `${percentualHoje.toFixed(2)}%`, transform: "translateX(-50%)" }}
                          >
                            <div className="h-0 w-0 border-l-[4px] border-r-[4px] border-t-[6px] border-l-transparent border-r-transparent border-t-amber-500" />
                          </div>
                        );
                      })()}

                      <div className="relative h-full w-full overflow-hidden rounded-full border-2 border-slate-300 bg-slate-50">
                        {/* Marcadores de Dias */}
                        <div className="absolute inset-0 h-full w-full pointer-events-none">
                          {Array.from({ length: totalEscalaVisivel + 1 }).map((_, i) => (
                            <div
                              key={i}
                              className="absolute h-full w-0.5 bg-slate-400/60"
                              style={{ left: `${(i / totalEscalaVisivel * 100).toFixed(2)}%` }}
                            />
                          ))}
                        </div>

                        <div className="flex h-full w-full">
                          {termometro.segmentos.map((segmento) => (
                            <div
                              key={segmento.id}
                              className="h-full"
                              style={{ width: `${segmento.percentual.toFixed(2)}%`, backgroundColor: segmento.cor }}
                              title={`${segmento.nome}: ${segmento.dias} dia(s)`}
                            />
                          ))}
                          {termometro.naoUtilizadoPercentual > 0 ? (
                            <div
                              className="h-full bg-slate-200/50"
                              style={{ width: `${termometro.naoUtilizadoPercentual.toFixed(2)}%` }}
                              title="Periodo nao utilizado ate o prazo"
                            />
                          ) : null}
                        </div>
                        <div
                          className="absolute bottom-0 top-0 z-[12] w-1 bg-slate-900"
                          style={{ left: posicaoPercentualEscala(prazoPercentualVisivel) }}
                          title="Marco do prazo de entrega"
                        />
                        {prazoInterno ? <MarcadorPrazoInternoTermometro prazoInterno={prazoInterno} /> : null}
                      </div>
                    </div>
                  ) : (
                    <div className="rounded-lg bg-slate-50 px-2 py-1 text-[10px] text-slate-400">
                      Cronograma indisponivel.
                    </div>
                  )}
                </div>

                <div
                  className="grid w-full items-stretch gap-x-1 gap-y-0 overflow-hidden border-t-2 border-slate-200 bg-slate-50/30 text-xs text-slate-800"
                  style={{ gridTemplateColumns }}
                >
                  {row.getVisibleCells().map((cell, index, cells) => {
                    const isStatus = index === cells.length - 1;
                    const alinharEsquerda = COLUNAS_ALINHADAS_ESQUERDA.has(cell.column.id);
                    return (
                      <div
                        key={cell.id}
                        className={
                          isStatus ? CELULA_COLUNA_STATUS : alinharEsquerda ? CELULA_COLUNA_ESQUERDA : CELULA_COLUNA
                        }
                        onClick={isStatus ? (event) => event.stopPropagation() : undefined}
                      >
                        <div className={alinharEsquerda ? VALOR_COLUNA_ESQUERDA : VALOR_COLUNA_CENTRO}>
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {termometro.valido && (
                  <div className="flex flex-wrap gap-x-4 gap-y-1 border-t border-slate-100 px-6 py-2.5 text-[9px] font-medium text-slate-400">
                    <span className="flex items-center gap-1">
                      <span className="h-1.5 w-1.5 rounded-full bg-amber-500" /> Faturamento
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="h-1.5 w-1.5 rounded-full bg-blue-600" /> Expedicao
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-600" /> Entrega
                    </span>
                    {temEmAberto ? (
                      <span className="flex items-center gap-1">
                        <span className="h-1.5 w-1.5 rounded-full bg-blue-600" /> Em andamento
                      </span>
                    ) : null}
                    {temAposPrazoInterno ? (
                      <span className="flex items-center gap-1 text-slate-600">
                        <span className="h-1.5 w-1.5 rounded-full bg-slate-600" /> Após prazo interno
                      </span>
                    ) : null}
                    {temAtrasoOficial && !concluido ? (
                      <span className="flex items-center gap-1 text-red-500">
                        <span className="h-1.5 w-1.5 rounded-full bg-red-600" /> Atraso oficial
                      </span>
                    ) : null}
                    <span className="flex items-center gap-1 text-slate-700">
                      <span className="rounded-full bg-red-600 px-1 text-[7px] font-bold text-white">PI</span>
                      Prazo interno
                      <span className="text-slate-400">(balão vermelho + faixa preta)</span>
                    </span>
                  </div>
                )}
              </motion.div>
            );
          })}
        </div>
      </div>
      {erroAtualizacao ? <p className="text-sm text-red-600">{erroAtualizacao}</p> : null}
    </div>
  );
}

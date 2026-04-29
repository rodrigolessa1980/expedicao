import { useMemo, useState } from "react";
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
import { diasParaPrazo, faixaPrazoPorEtapa, formatarData, isAtrasado, isPrazoProximo } from "../utils/date";
import { useExportStore } from "../store/useExportStore";
import { Input } from "./ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";

type PedidosTableProps = {
  dados: Pedido[];
  canManage: boolean;
  onPedidoClick?: (pedido: Pedido) => void;
};
type PeriodoRapido = "todos" | "7d" | "30d" | "90d" | "mes";

export function PedidosTable({ dados, canManage, onPedidoClick }: PedidosTableProps) {
  const status = useExportStore((state) => state.status);
  const updatePedidoStatus = useExportStore((state) => state.updatePedidoStatus);
  const [erroAtualizacao, setErroAtualizacao] = useState("");
  const [periodoRapido, setPeriodoRapido] = useState<PeriodoRapido>("todos");
  const [dataInicio, setDataInicio] = useState("");
  const [dataFim, setDataFim] = useState("");
  const [filtroCliente, setFiltroCliente] = useState("");
  const [filtroRepresentante, setFiltroRepresentante] = useState("todos");
  const [filtroStatus, setFiltroStatus] = useState("todos");
  const [apenasAtrasados, setApenasAtrasados] = useState("todos");

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
        const data = new Date(`${pedido.dataFaturamento}T00:00:00`).getTime();
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
        const data = new Date(`${pedido.dataFaturamento}T00:00:00`).getTime();
        return data >= inicioMes && data <= fimMes;
      });
    }

    const dias = periodoRapido === "7d" ? 7 : periodoRapido === "30d" ? 30 : 90;
    const inicio = new Date(hoje);
    inicio.setDate(inicio.getDate() - dias);
    const inicioTs = new Date(inicio.getFullYear(), inicio.getMonth(), inicio.getDate()).getTime();
    return dados.filter((pedido) => new Date(`${pedido.dataFaturamento}T00:00:00`).getTime() >= inicioTs);
  }, [dados, periodoRapido, dataInicio, dataFim]);

  const filtrados = useMemo(
    () =>
      dadosComFiltroPeriodo.filter((pedido) => {
        const matchCliente = pedido.cliente.toLowerCase().includes(filtroCliente.toLowerCase());
        const matchRepresentante = filtroRepresentante === "todos" || pedido.representante === filtroRepresentante;
        const matchStatus = filtroStatus === "todos" || pedido.statusAtual === filtroStatus;
        const matchAtrasado = apenasAtrasados === "todos" || (apenasAtrasados === "sim" && isAtrasado(pedido.prazoEntrega));
        return matchCliente && matchRepresentante && matchStatus && matchAtrasado;
      }),
    [dadosComFiltroPeriodo, filtroCliente, filtroRepresentante, filtroStatus, apenasAtrasados],
  );

  const columns = useMemo<ColumnDef<Pedido>[]>(
    () => [
      { accessorKey: "representante", header: "Representante" },
      { accessorKey: "numeroNF", header: "NF" },
      { accessorKey: "cliente", header: "Cliente" },
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
        accessorKey: "prazoEntrega",
        header: "Prazo",
        cell: ({ row }) => {
          const pedido = row.original;
          const atrasado = isAtrasado(pedido.prazoEntrega);
          const proximo = isPrazoProximo(pedido.prazoEntrega);
          const dias = diasParaPrazo(pedido.prazoEntrega);
          return (
            <span className={atrasado ? "font-semibold text-red-600" : proximo ? "font-semibold text-amber-600" : "text-slate-700"}>
              {dias} dias
            </span>
          );
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
                className="inline-flex h-8 items-center rounded-lg px-2.5 text-xs font-semibold text-white"
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
                className="h-8 w-full min-w-0 max-w-[180px] border-transparent px-2.5 text-xs font-semibold text-white"
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

      <div className="grid grid-cols-2 gap-1.5 rounded-lg border border-slate-200 bg-white p-2 md:grid-cols-4 md:gap-2 md:rounded-xl md:p-3">
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
        <Select value={apenasAtrasados} onValueChange={setApenasAtrasados}>
          <SelectTrigger className="col-span-2 h-8 text-[11px] md:col-span-1 md:h-10 md:text-sm">
            <SelectValue placeholder="Atraso" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os pedidos</SelectItem>
            <SelectItem value="sim">Somente atrasados</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2 lg:hidden">
        {filtrados.map((pedido) => {
          const atrasado = isAtrasado(pedido.prazoEntrega);
          const proximo = isPrazoProximo(pedido.prazoEntrega);
          const statusAtual = status.find((s) => s.id === pedido.statusAtual);
          return (
            <div key={pedido.numeroPedido} className="space-y-2 rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-slate-900">{pedido.cliente}</p>
                  <p className="text-xs text-slate-500">{pedido.representante}</p>
                </div>
                <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-700">
                  NF {pedido.numeroNF}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs text-slate-600">
                <p>
                  <span className="font-medium text-slate-700">Faturamento:</span> {formatarData(pedido.dataFaturamento)}
                </p>
                <p>
                  <span className="font-medium text-slate-700">Expedicao:</span> {formatarData(pedido.dataExpedicao)}
                </p>
                <p className={atrasado ? "font-semibold text-red-600" : proximo ? "font-semibold text-amber-600" : "text-slate-700"}>
                  <span className="font-medium text-slate-700">Prazo:</span> {diasParaPrazo(pedido.prazoEntrega)} dias
                </p>
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

      <div className="hidden overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm lg:block">
        <table className="w-full table-fixed border-collapse text-sm">
          <thead className="bg-slate-100 text-slate-700">
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                    <th
                    key={header.id}
                      className="cursor-pointer px-3 py-2 text-left font-medium break-words"
                    onClick={header.column.getToggleSortingHandler()}
                  >
                    {flexRender(header.column.columnDef.header, header.getContext())}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.map((row) => {
              const atrasado = isAtrasado(row.original.prazoEntrega);
              const proximo = isPrazoProximo(row.original.prazoEntrega);
              const faixaPrazo = faixaPrazoPorEtapa(row.original.dataFaturamento, row.original.prazoEntrega);
              const corSublinhado =
                faixaPrazo === "verde"
                  ? "border-b-2 border-emerald-500"
                  : faixaPrazo === "amarela"
                    ? "border-b-2 border-amber-500"
                    : "border-b-2 border-red-500";
              return (
                <motion.tr
                  key={row.id}
                  layout
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  onClick={() => {
                    if (canManage && onPedidoClick) onPedidoClick(row.original);
                  }}
                  className={
                    `${corSublinhado} ${
                      atrasado
                        ? "bg-red-50/70"
                        : proximo
                          ? "bg-amber-50/60"
                          : "border-t border-slate-100"
                    } ${canManage && onPedidoClick ? "cursor-pointer hover:bg-blue-50/50" : ""}`
                  }
                >
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id} className="max-w-0 px-3 py-3 align-top break-words text-slate-700">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </motion.tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {erroAtualizacao ? <p className="text-sm text-red-600">{erroAtualizacao}</p> : null}
    </div>
  );
}

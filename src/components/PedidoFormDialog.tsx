import { useEffect, useMemo, useState, type ReactNode } from "react";
import { PlusCircle } from "lucide-react";
import { Dialog, DialogContent, DialogTrigger } from "./ui/dialog";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { useExportStore } from "../store/useExportStore";
import { useAuthStore } from "../store/useAuthStore";
import type { Pedido, PedidoChangeLog, PedidoField } from "../types";

const initialValues = {
  numeroPedido: "",
  representante: "",
  numeroNF: "",
  cliente: "",
  dataFaturamento: "",
  dataExpedicao: "",
  prazoEntrega: "",
  dataEntrega: "",
  statusAtual: "",
};
const SEM_REPRESENTANTE_VALUE = "__sem_representante__";
const FIELD_LABELS: Record<PedidoField, string> = {
  numeroPedido: "Numero do Pedido",
  representante: "Representante (opcional)",
  numeroNF: "Numero NF",
  cliente: "Cliente",
  dataFaturamento: "Data Faturamento",
  dataExpedicao: "Data Expedicao",
  prazoEntrega: "Prazo de Entrega",
  dataEntrega: "Data da Entrega",
  statusAtual: "Status inicial",
};

function formatDateTime(value?: string) {
  if (!value) return "-";
  return new Date(value).toLocaleString("pt-BR");
}

function formatFieldValue(value?: string) {
  return value && value.trim().length > 0 ? value : "(vazio)";
}

function countFieldChanges(logs: PedidoChangeLog[]) {
  return logs.reduce<Record<PedidoField, number>>((acc, log) => {
    acc[log.field] = (acc[log.field] ?? 0) + 1;
    return acc;
  }, {} as Record<PedidoField, number>);
}

type PedidoFormDialogProps = {
  mode?: "create" | "edit";
  initialPedido?: Pedido | null;
  trigger?: ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  onSaved?: () => void;
};

export function PedidoFormDialog({
  mode = "create",
  initialPedido = null,
  trigger,
  open: openProp,
  onOpenChange,
  onSaved,
}: PedidoFormDialogProps) {
  const status = useExportStore((state) => state.status);
  const addPedido = useExportStore((state) => state.addPedido);
  const updatePedido = useExportStore((state) => state.updatePedido);
  const pedidoLogs = useExportStore((state) => state.pedidoLogs);
  const loadPedidoLogs = useExportStore((state) => state.loadPedidoLogs);
  const usuarios = useAuthStore((state) => state.usuarios);
  const loadUsuarios = useAuthStore((state) => state.loadUsuarios);
  const usuarioAtual = useAuthStore((state) => state.usuarioAtual);
  const [openInterno, setOpenInterno] = useState(false);
  const [erro, setErro] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [form, setForm] = useState(initialValues);
  const [logsOpen, setLogsOpen] = useState(false);

  const aberto = openProp ?? openInterno;
  const setAberto = onOpenChange ?? setOpenInterno;
  const numeroPedidoOriginal = useMemo(() => initialPedido?.numeroPedido ?? "", [initialPedido]);
  const titulo = mode === "edit" ? "Editar pedido" : "Cadastro de Pedido";
  const textoBotaoSalvar = mode === "edit" ? "Salvar alteracoes" : "Salvar pedido";
  const pedidoNumeroAtual = mode === "edit" ? form.numeroPedido || numeroPedidoOriginal : "";
  const logsDoPedido = useMemo(() => pedidoLogs[pedidoNumeroAtual] ?? [], [pedidoLogs, pedidoNumeroAtual]);
  const logsOrdenados = useMemo(
    () => [...logsDoPedido].sort((a, b) => new Date(b.changedAt).getTime() - new Date(a.changedAt).getTime()),
    [logsDoPedido],
  );
  const alteracoesPorCampo = useMemo(() => countFieldChanges(logsDoPedido), [logsDoPedido]);
  const dataCriacaoLog = initialPedido?.createdAt || (logsDoPedido.length > 0 ? logsDoPedido[0].changedAt : undefined);
  const dataUltimaEdicao =
    initialPedido?.updatedAt || (logsDoPedido.length > 0 ? logsDoPedido[logsDoPedido.length - 1].changedAt : undefined);

  const renderFieldLabel = (field: PedidoField) => {
    if (mode !== "edit") {
      return <Label>{FIELD_LABELS[field]}</Label>;
    }
    const total = alteracoesPorCampo[field] ?? 0;
    return (
      <div className="flex items-center justify-between gap-3">
        <Label>{FIELD_LABELS[field]}</Label>
        <span className="text-xs text-slate-500">{total} modificacoes</span>
      </div>
    );
  };

  useEffect(() => {
    if (aberto && usuarioAtual?.tipo === "administrador") {
      loadUsuarios().catch(() => undefined);
    }
  }, [aberto, usuarioAtual?.tipo, loadUsuarios]);

  useEffect(() => {
    if (!aberto) return;
    setErro("");
    if (mode === "edit" && initialPedido) {
      setForm({
        numeroPedido: initialPedido.numeroPedido,
        representante: initialPedido.representante,
        numeroNF: initialPedido.numeroNF,
        cliente: initialPedido.cliente,
        dataFaturamento: initialPedido.dataFaturamento,
        dataExpedicao: initialPedido.dataExpedicao,
        prazoEntrega: initialPedido.prazoEntrega,
        dataEntrega: initialPedido.dataEntrega,
        statusAtual: initialPedido.statusAtual,
      });
      setLogsOpen(false);
      return;
    }
    setForm(initialValues);
    setLogsOpen(false);
  }, [aberto, initialPedido, mode]);

  useEffect(() => {
    if (!aberto || mode !== "edit" || !numeroPedidoOriginal) return;
    loadPedidoLogs(numeroPedidoOriginal).catch(() => undefined);
  }, [aberto, mode, numeroPedidoOriginal, loadPedidoLogs]);

  const representantes = useMemo(() => {
    const ativos = usuarios.filter((u) => u.tipo === "representante" && u.ativo !== false).map((u) => u.nome);
    if (form.representante && !ativos.includes(form.representante)) {
      return [form.representante, ...ativos];
    }
    return ativos;
  }, [usuarios, form.representante]);

  const onSubmit = async () => {
    if (mode === "edit" && !numeroPedidoOriginal) {
      setErro("Pedido invalido para edicao.");
      return;
    }
    setSalvando(true);
    const result = mode === "edit" ? await updatePedido(numeroPedidoOriginal, form) : await addPedido(form);
    setSalvando(false);
    if (!result.ok) {
      setErro(result.erro ?? (mode === "edit" ? "Erro ao editar pedido." : "Erro ao cadastrar pedido."));
      return;
    }
    setAberto(false);
    setErro("");
    setForm(initialValues);
    onSaved?.();
  };

  return (
    <Dialog open={aberto} onOpenChange={setAberto}>
      {trigger ? (
        <DialogTrigger asChild>{trigger}</DialogTrigger>
      ) : mode === "create" ? (
        <DialogTrigger asChild>
          <Button className="w-full gap-2 sm:w-auto">
            <PlusCircle className="h-4 w-4" />
            Novo pedido
          </Button>
        </DialogTrigger>
      ) : null}
      <DialogContent className="max-w-3xl">
        <h2 className="text-xl font-semibold text-slate-900">{titulo}</h2>
        {mode === "edit" ? (
          <p className="mt-1 text-xs text-slate-500">
            Data da criacao: {formatDateTime(dataCriacaoLog)} | Data da ultima edicao: {formatDateTime(dataUltimaEdicao)}
          </p>
        ) : null}

        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <div className="space-y-1">
            {renderFieldLabel("numeroPedido")}
            <Input value={form.numeroPedido} onChange={(e) => setForm((f) => ({ ...f, numeroPedido: e.target.value }))} />
          </div>
          <div className="space-y-1">
            {renderFieldLabel("representante")}
            <Select
              value={form.representante || SEM_REPRESENTANTE_VALUE}
              onValueChange={(value) =>
                setForm((f) => ({ ...f, representante: value === SEM_REPRESENTANTE_VALUE ? "" : value }))
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione um representante" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={SEM_REPRESENTANTE_VALUE}>Vincular depois</SelectItem>
                {representantes.map((item) => (
                  <SelectItem key={item} value={item}>
                    {item}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            {renderFieldLabel("numeroNF")}
            <Input value={form.numeroNF} onChange={(e) => setForm((f) => ({ ...f, numeroNF: e.target.value }))} />
          </div>
          <div className="space-y-1">
            {renderFieldLabel("cliente")}
            <Input value={form.cliente} onChange={(e) => setForm((f) => ({ ...f, cliente: e.target.value }))} />
          </div>
          <div className="space-y-1">
            {renderFieldLabel("dataFaturamento")}
            <Input type="date" value={form.dataFaturamento} onChange={(e) => setForm((f) => ({ ...f, dataFaturamento: e.target.value }))} />
          </div>
          <div className="space-y-1">
            {renderFieldLabel("dataExpedicao")}
            <Input type="date" value={form.dataExpedicao} onChange={(e) => setForm((f) => ({ ...f, dataExpedicao: e.target.value }))} />
          </div>
          <div className="space-y-1">
            {renderFieldLabel("prazoEntrega")}
            <Input type="date" value={form.prazoEntrega} onChange={(e) => setForm((f) => ({ ...f, prazoEntrega: e.target.value }))} />
          </div>
          <div className="space-y-1">
            {renderFieldLabel("dataEntrega")}
            <Input
              type="date"
              value={form.dataEntrega}
              disabled
              onChange={(e) => setForm((f) => ({ ...f, dataEntrega: e.target.value }))}
            />
          </div>
          <div className="space-y-1 md:col-span-2">
            {renderFieldLabel("statusAtual")}
            <Select value={form.statusAtual} onValueChange={(value) => setForm((f) => ({ ...f, statusAtual: value }))}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione um status" />
              </SelectTrigger>
              <SelectContent>
                {status.map((item) => (
                  <SelectItem key={item.id} value={item.id}>
                    {item.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {erro ? <p className="mt-3 text-sm text-red-600">{erro}</p> : null}

        <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:justify-end">
          {mode === "edit" ? (
            <Dialog open={logsOpen} onOpenChange={setLogsOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" className="w-full sm:w-auto" disabled={salvando}>
                  Logs
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <h3 className="text-lg font-semibold text-slate-900">Historico de alteracoes</h3>
                <div className="mt-3 max-h-[60vh] space-y-2 overflow-y-auto pr-1">
                  {logsOrdenados.length === 0 ? (
                    <p className="text-sm text-slate-500">Ainda nao ha alteracoes salvas para este pedido.</p>
                  ) : (
                    logsOrdenados.map((log) => (
                      <div key={log.id} className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm">
                        <p className="font-medium text-slate-800">{log.fieldLabel}</p>
                        <p className="text-slate-600">
                          {formatFieldValue(log.from)} {"->"} {formatFieldValue(log.to)}
                        </p>
                        <p className="mt-1 text-xs text-slate-500">
                          {formatDateTime(log.changedAt)} | {log.changedBy}
                        </p>
                      </div>
                    ))
                  )}
                </div>
              </DialogContent>
            </Dialog>
          ) : null}
          <Button variant="outline" className="w-full sm:w-auto" onClick={() => setAberto(false)} disabled={salvando}>
            Cancelar
          </Button>
          <Button className="w-full sm:w-auto" onClick={onSubmit} disabled={salvando}>
            {salvando ? "Salvando..." : textoBotaoSalvar}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

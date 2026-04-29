import { useEffect, useMemo, useState, type ReactNode } from "react";
import { PlusCircle } from "lucide-react";
import { Dialog, DialogContent, DialogTrigger } from "./ui/dialog";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { useExportStore } from "../store/useExportStore";
import { useAuthStore } from "../store/useAuthStore";
import type { Pedido } from "../types";

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
  const usuarios = useAuthStore((state) => state.usuarios);
  const representantes = usuarios.filter((u) => u.tipo === "representante");
  const [openInterno, setOpenInterno] = useState(false);
  const [erro, setErro] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [form, setForm] = useState(initialValues);

  const aberto = openProp ?? openInterno;
  const setAberto = onOpenChange ?? setOpenInterno;
  const numeroPedidoOriginal = useMemo(() => initialPedido?.numeroPedido ?? "", [initialPedido]);
  const titulo = mode === "edit" ? "Editar pedido" : "Cadastro de Pedido";
  const textoBotaoSalvar = mode === "edit" ? "Salvar alteracoes" : "Salvar pedido";

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
      return;
    }
    setForm(initialValues);
  }, [aberto, initialPedido, mode]);

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

        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <div className="space-y-1">
            <Label>Numero do Pedido *</Label>
            <Input value={form.numeroPedido} onChange={(e) => setForm((f) => ({ ...f, numeroPedido: e.target.value }))} />
          </div>
          <div className="space-y-1">
            <Label>Representante *</Label>
            <Select value={form.representante} onValueChange={(value) => setForm((f) => ({ ...f, representante: value }))}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione um representante" />
              </SelectTrigger>
              <SelectContent>
                {representantes.map((item) => (
                  <SelectItem key={item.id} value={item.nome}>
                    {item.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Numero NF *</Label>
            <Input value={form.numeroNF} onChange={(e) => setForm((f) => ({ ...f, numeroNF: e.target.value }))} />
          </div>
          <div className="space-y-1">
            <Label>Cliente *</Label>
            <Input value={form.cliente} onChange={(e) => setForm((f) => ({ ...f, cliente: e.target.value }))} />
          </div>
          <div className="space-y-1">
            <Label>Data Faturamento *</Label>
            <Input type="date" value={form.dataFaturamento} onChange={(e) => setForm((f) => ({ ...f, dataFaturamento: e.target.value }))} />
          </div>
          <div className="space-y-1">
            <Label>Data Expedicao *</Label>
            <Input type="date" value={form.dataExpedicao} onChange={(e) => setForm((f) => ({ ...f, dataExpedicao: e.target.value }))} />
          </div>
          <div className="space-y-1">
            <Label>Prazo de Entrega *</Label>
            <Input type="date" value={form.prazoEntrega} onChange={(e) => setForm((f) => ({ ...f, prazoEntrega: e.target.value }))} />
          </div>
          <div className="space-y-1">
            <Label>Data da Entrega</Label>
            <Input
              type="date"
              value={form.dataEntrega}
              disabled
              onChange={(e) => setForm((f) => ({ ...f, dataEntrega: e.target.value }))}
            />
          </div>
          <div className="space-y-1 md:col-span-2">
            <Label>Status inicial *</Label>
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

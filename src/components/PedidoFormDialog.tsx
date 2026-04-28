import { useState } from "react";
import { PlusCircle } from "lucide-react";
import { Dialog, DialogContent, DialogTrigger } from "./ui/dialog";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { useExportStore } from "../store/useExportStore";
import { useAuthStore } from "../store/useAuthStore";

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

export function PedidoFormDialog() {
  const status = useExportStore((state) => state.status);
  const addPedido = useExportStore((state) => state.addPedido);
  const usuarios = useAuthStore((state) => state.usuarios);
  const representantes = usuarios.filter((u) => u.tipo === "representante");
  const [open, setOpen] = useState(false);
  const [erro, setErro] = useState("");
  const [form, setForm] = useState(initialValues);

  const onSubmit = () => {
    const result = addPedido(form);
    if (!result.ok) {
      setErro(result.erro ?? "Erro ao cadastrar pedido.");
      return;
    }
    setOpen(false);
    setErro("");
    setForm(initialValues);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gap-2">
          <PlusCircle className="h-4 w-4" />
          Novo pedido
        </Button>
      </DialogTrigger>
      <DialogContent>
        <h2 className="text-xl font-semibold text-slate-900">Cadastro de Pedido</h2>

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

        <div className="mt-4 flex justify-end gap-2">
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancelar
          </Button>
          <Button onClick={onSubmit}>Salvar pedido</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

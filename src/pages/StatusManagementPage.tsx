import { useState } from "react";
import { Card } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Button } from "../components/ui/button";
import { useExportStore } from "../store/useExportStore";
import { Badge } from "../components/ui/badge";

type EditState = Record<string, { nome: string; cor: string }>;

export function StatusManagementPage() {
  const status = useExportStore((state) => state.status);
  const addStatus = useExportStore((state) => state.addStatus);
  const updateStatus = useExportStore((state) => state.updateStatus);
  const [novoNome, setNovoNome] = useState("");
  const [novaCor, setNovaCor] = useState("#64748b");
  const [erro, setErro] = useState("");
  const [edicoes, setEdicoes] = useState<EditState>({});

  const salvarNovo = () => {
    const result = addStatus({ nome: novoNome, cor: novaCor });
    if (!result.ok) {
      setErro(result.erro ?? "Erro ao criar status.");
      return;
    }
    setNovoNome("");
    setNovaCor("#64748b");
    setErro("");
  };

  return (
    <section className="space-y-6">
      <Card className="p-5">
        <h2 className="text-lg font-semibold text-slate-900">Criar novo status</h2>
        <div className="mt-3 grid gap-3 md:grid-cols-3">
          <div className="space-y-1 md:col-span-2">
            <Label>Nome do status</Label>
            <Input value={novoNome} onChange={(e) => setNovoNome(e.target.value)} placeholder="Ex.: Em conferencia" />
          </div>
          <div className="space-y-1">
            <Label>Cor</Label>
            <Input type="color" value={novaCor} onChange={(e) => setNovaCor(e.target.value)} />
          </div>
        </div>
        {erro ? <p className="mt-2 text-sm text-red-600">{erro}</p> : null}
        <Button className="mt-3" onClick={salvarNovo}>
          Criar status
        </Button>
      </Card>

      <Card className="p-5">
        <h2 className="text-lg font-semibold text-slate-900">Editar status existentes</h2>
        <div className="mt-4 space-y-3">
          {status.map((item) => {
            const draft = edicoes[item.id] ?? { nome: item.nome, cor: item.cor };
            return (
              <div key={item.id} className="grid gap-3 rounded-xl border border-slate-200 p-3 md:grid-cols-[1.5fr_140px_auto_auto] md:items-end">
                <div className="space-y-1">
                  <Label>Nome</Label>
                  <Input
                    value={draft.nome}
                    onChange={(e) =>
                      setEdicoes((state) => ({
                        ...state,
                        [item.id]: { ...draft, nome: e.target.value },
                      }))
                    }
                  />
                </div>
                <div className="space-y-1">
                  <Label>Cor</Label>
                  <Input
                    type="color"
                    value={draft.cor}
                    onChange={(e) =>
                      setEdicoes((state) => ({
                        ...state,
                        [item.id]: { ...draft, cor: e.target.value },
                      }))
                    }
                  />
                </div>
                <Badge label={draft.nome} color={draft.cor} />
                <Button size="sm" onClick={() => updateStatus(item.id, { nome: draft.nome, cor: draft.cor })}>
                  Salvar
                </Button>
              </div>
            );
          })}
        </div>
      </Card>
    </section>
  );
}

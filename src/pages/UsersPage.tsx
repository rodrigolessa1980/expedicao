import { useState } from "react";
import { Input } from "../components/ui/input";
import { Button } from "../components/ui/button";
import { Card } from "../components/ui/card";
import { Label } from "../components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { useAuthStore } from "../store/useAuthStore";
import type { TipoUsuario } from "../types";

export function UsersPage() {
  const usuarios = useAuthStore((state) => state.usuarios);
  const addUsuario = useAuthStore((state) => state.addUsuario);
  const [nome, setNome] = useState("");
  const [login, setLogin] = useState("");
  const [senha, setSenha] = useState("");
  const [tipo, setTipo] = useState<TipoUsuario>("representante");
  const [erro, setErro] = useState("");

  const salvar = () => {
    const result = addUsuario({ nome, login, senha, tipo });
    if (!result.ok) {
      setErro(result.erro ?? "Erro ao cadastrar usuario.");
      return;
    }
    setNome("");
    setLogin("");
    setSenha("");
    setTipo("representante");
    setErro("");
  };

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-slate-900">Usuarios</h2>
        <p className="text-xs text-slate-500">Gerenciamento de acessos e perfis do sistema.</p>
      </div>

      <Card className="border-slate-300 p-4 shadow-sm">
        <div className="grid gap-2 md:grid-cols-4">
          <div className="space-y-1">
            <Label>Nome</Label>
            <Input value={nome} onChange={(e) => setNome(e.target.value)} className="h-9 text-sm" />
          </div>
          <div className="space-y-1">
            <Label>Login</Label>
            <Input value={login} onChange={(e) => setLogin(e.target.value)} className="h-9 text-sm" />
          </div>
          <div className="space-y-1">
            <Label>Senha</Label>
            <Input type="password" value={senha} onChange={(e) => setSenha(e.target.value)} className="h-9 text-sm" />
          </div>
          <div className="space-y-1">
            <Label>Perfil</Label>
            <Select value={tipo} onValueChange={(v) => setTipo(v as TipoUsuario)}>
              <SelectTrigger className="h-9 text-sm">
                <SelectValue placeholder="Perfil" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="administrador">Administrador</SelectItem>
                <SelectItem value="diretoria">Diretoria</SelectItem>
                <SelectItem value="representante">Representante</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        {erro ? <p className="mt-2 text-sm text-red-600">{erro}</p> : null}
        <Button size="sm" className="mt-3" onClick={salvar}>
          Cadastrar usuario
        </Button>
      </Card>

      <Card className="border-slate-200 p-4">
        <div className="space-y-2">
          {usuarios.map((usuario) => (
            <div key={usuario.id} className="rounded-lg border border-slate-200 px-3 py-2">
              <p className="text-sm font-medium text-slate-900">{usuario.nome}</p>
              <p className="text-xs text-slate-500">
                {usuario.login} - {usuario.tipo}
              </p>
            </div>
          ))}
        </div>
      </Card>
    </section>
  );
}

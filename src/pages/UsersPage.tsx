import { useEffect, useState } from "react";
import { Input } from "../components/ui/input";
import { Button } from "../components/ui/button";
import { Card } from "../components/ui/card";
import { Label } from "../components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { useAuthStore } from "../store/useAuthStore";
import { apiRequest } from "../services/api";
import type { TipoUsuario } from "../types";

export function UsersPage() {
  const usuarios = useAuthStore((state) => state.usuarios);
  const addUsuario = useAuthStore((state) => state.addUsuario);
  const loadUsuarios = useAuthStore((state) => state.loadUsuarios);
  const token = useAuthStore((state) => state.token);
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [login, setLogin] = useState("");
  const [senha, setSenha] = useState("");
  const [tipo, setTipo] = useState<TipoUsuario>("representante");
  const [erro, setErro] = useState("");

  useEffect(() => {
    loadUsuarios().catch(() => undefined);
  }, [loadUsuarios]);

  const salvar = async () => {
    const result = await addUsuario({ nome, email, login, senha, tipo });
    if (!result.ok) {
      setErro(result.erro ?? "Erro ao cadastrar usuario.");
      return;
    }
    setNome("");
    setEmail("");
    setLogin("");
    setSenha("");
    setTipo("representante");
    setErro("");
  };

  const alternarAtivo = async (id: string, ativoAtual: boolean) => {
    try {
      await apiRequest("/api/users/" + id + "/active", {
        method: "PATCH",
        token,
        body: { ativo: !ativoAtual }
      });
      await loadUsuarios();
    } catch (error) {
      setErro(error instanceof Error ? error.message : "Erro ao atualizar status.");
    }
  };

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-slate-900">Usuarios</h2>
        <p className="text-xs text-slate-500">Administra usuarios registrados, ativos e confirmados.</p>
      </div>

      <Card className="border-slate-300 p-4 shadow-sm">
        <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-5">
          <div className="space-y-1">
            <Label>Nome</Label>
            <Input value={nome} onChange={(e) => setNome(e.target.value)} className="h-9 text-sm" />
          </div>
          <div className="space-y-1">
            <Label>E-mail</Label>
            <Input value={email} onChange={(e) => setEmail(e.target.value)} className="h-9 text-sm" />
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
        <Button size="sm" className="mt-3 w-full sm:w-auto" onClick={salvar}>
          Cadastrar usuario
        </Button>
      </Card>

      <Card className="border-slate-200 p-4">
        <div className="space-y-2">
          {usuarios.map((usuario) => (
            <div key={usuario.id} className="flex flex-col gap-2 rounded-lg border border-slate-200 px-3 py-2 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-slate-900">{usuario.nome}</p>
                <p className="break-words text-xs text-slate-500">
                  {usuario.login} - {usuario.email ?? "sem email"} - {usuario.tipo}
                </p>
                <p className="text-xs text-slate-500">
                  {usuario.ativo ? "Ativo" : "Inativo"} | {usuario.confirmadoEm ? "Confirmado" : "Nao confirmado"}
                </p>
              </div>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="w-full sm:w-auto"
                onClick={() => alternarAtivo(usuario.id, Boolean(usuario.ativo))}
              >
                {usuario.ativo ? "Desativar" : "Ativar"}
              </Button>
            </div>
          ))}
        </div>
      </Card>
    </section>
  );
}

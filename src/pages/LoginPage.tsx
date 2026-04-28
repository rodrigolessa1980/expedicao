import { useState } from "react";
import { Card } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Button } from "../components/ui/button";
import { useAuthStore } from "../store/useAuthStore";
import type { TipoUsuario } from "../types";

export function LoginPage() {
  const [loginValue, setLoginValue] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState("");
  const login = useAuthStore((state) => state.login);
  const usuarios = useAuthStore((state) => state.usuarios);

  const acessoRapido = (tipo: TipoUsuario) => {
    const usuario = usuarios.find((item) => item.tipo === tipo);
    if (!usuario) {
      setErro(`Usuario do tipo ${tipo} nao encontrado.`);
      return;
    }
    const result = login(usuario.login, usuario.senha);
    if (!result.ok) {
      setErro(result.erro ?? "Falha no login rapido.");
      return;
    }
    setErro("");
  };

  const onSubmit = () => {
    const result = login(loginValue, senha);
    if (!result.ok) {
      setErro(result.erro ?? "Falha no login.");
      return;
    }
    setErro("");
  };

  return (
    <main className="flex min-h-dvh items-center justify-center bg-gray-50 p-4">
      <Card className="w-full max-w-md p-5">
        <p className="text-xs font-medium text-blue-600">Acesso ao sistema</p>
        <h1 className="text-xl font-semibold text-slate-900">Login</h1>
        <div className="mt-4 space-y-3">
          <div className="space-y-1">
            <Label>Login</Label>
            <Input value={loginValue} onChange={(e) => setLoginValue(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Senha</Label>
            <Input type="password" value={senha} onChange={(e) => setSenha(e.target.value)} />
          </div>
        </div>
        {erro ? <p className="mt-3 text-sm text-red-600">{erro}</p> : null}
        <Button className="mt-4 w-full" onClick={onSubmit}>
          Entrar
        </Button>

        <div className="mt-4 space-y-2 border-t border-slate-200 pt-3">
          <p className="text-xs font-medium text-slate-500">Acesso rapido</p>
          <div className="grid grid-cols-3 gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => acessoRapido("administrador")}>
              Admin
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={() => acessoRapido("representante")}>
              Representante
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={() => acessoRapido("diretoria")}>
              Diretoria
            </Button>
          </div>
        </div>
      </Card>
    </main>
  );
}

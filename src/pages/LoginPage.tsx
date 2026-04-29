import { useMemo, useState } from "react";
import { Card } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Button } from "../components/ui/button";
import { useAuthStore } from "../store/useAuthStore";

type Modo = "login" | "criar" | "esqueci" | "redefinir" | "confirmar";

export function LoginPage() {
  const initialPath = window.location.pathname;
  const initialToken = new URLSearchParams(window.location.search).get("token") ?? "";
  const initialModo: Modo =
    initialPath.includes("confirmar-conta")
      ? "confirmar"
      : initialPath.includes("redefinir-senha")
        ? "redefinir"
        : "login";

  const [modo, setModo] = useState<Modo>(initialModo);
  const [loginValue, setLoginValue] = useState("");
  const [senha, setSenha] = useState("");
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [token, setToken] = useState(initialToken);
  const [novaSenha, setNovaSenha] = useState("");
  const [erro, setErro] = useState("");
  const [sucesso, setSucesso] = useState("");
  const isDevExplicit = import.meta.env.DEV;

  const login = useAuthStore((state) => state.login);
  const registrarRepresentante = useAuthStore((state) => state.registrarRepresentante);
  const confirmarConta = useAuthStore((state) => state.confirmarConta);
  const esqueciSenha = useAuthStore((state) => state.esqueciSenha);
  const redefinirSenha = useAuthStore((state) => state.redefinirSenha);

  const titulo = useMemo(() => {
    if (modo === "criar") return "Criar conta de representante";
    if (modo === "esqueci") return "Esqueci minha senha";
    if (modo === "redefinir") return "Redefinir senha";
    if (modo === "confirmar") return "Confirmar conta";
    return "Login";
  }, [modo]);

  const limparMensagens = () => {
    setErro("");
    setSucesso("");
  };

  const onLogin = async () => {
    limparMensagens();
    const result = await login(loginValue, senha);
    if (!result.ok) setErro(result.erro ?? "Falha no login.");
  };

  const loginFacilitado = async (usuario: "admin" | "diretoria" | "ana") => {
    limparMensagens();
    const credenciais =
      usuario === "admin"
        ? { login: "admin", senha: "admin123" }
        : usuario === "diretoria"
          ? { login: "diretoria", senha: "diretoria123" }
          : { login: "ana", senha: "ana123" };
    const result = await login(credenciais.login, credenciais.senha);
    if (!result.ok) setErro(result.erro ?? "Falha no login rapido.");
  };

  const onCriarConta = async () => {
    limparMensagens();
    const result = await registrarRepresentante({ nome, email, senha });
    if (!result.ok) {
      setErro(result.erro ?? "Falha ao criar conta.");
      return;
    }
    setSucesso("Conta criada. Verifique o e-mail para confirmar.");
    setModo("confirmar");
  };

  const onConfirmar = async () => {
    limparMensagens();
    const result = await confirmarConta(token);
    if (!result.ok) {
      setErro(result.erro ?? "Falha ao confirmar conta.");
      return;
    }
    setSucesso("Conta confirmada. Agora voce pode acessar.");
    setModo("login");
  };

  const onEsqueci = async () => {
    limparMensagens();
    const result = await esqueciSenha(loginValue);
    if (!result.ok) {
      setErro(result.erro ?? "Falha ao solicitar redefinicao.");
      return;
    }
    setSucesso("Se o usuario existir, o e-mail de redefinicao foi enviado.");
    setModo("redefinir");
  };

  const onRedefinir = async () => {
    limparMensagens();
    const result = await redefinirSenha(token, novaSenha);
    if (!result.ok) {
      setErro(result.erro ?? "Falha ao redefinir senha.");
      return;
    }
    setSucesso("Senha atualizada com sucesso.");
    setModo("login");
  };

  return (
    <main className="flex min-h-dvh items-center justify-center bg-gray-50 p-3 sm:p-4">
      <Card className="w-full max-w-md space-y-3 p-4 sm:p-5">
        <p className="text-xs font-medium text-blue-600">Acesso ao sistema</p>
        <h1 className="text-lg font-semibold text-slate-900 sm:text-xl">{titulo}</h1>

        {(modo === "login" || modo === "esqueci") && (
          <div className="space-y-1">
            <Label>E-mail</Label>
            <Input type="email" value={loginValue} onChange={(e) => setLoginValue(e.target.value)} />
          </div>
        )}

        {modo === "criar" && (
          <>
            <div className="space-y-1">
              <Label>Nome</Label>
              <Input value={nome} onChange={(e) => setNome(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>E-mail</Label>
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
          </>
        )}

        {(modo === "login" || modo === "criar") && (
          <div className="space-y-1">
            <Label>Senha</Label>
            <Input type="password" value={senha} onChange={(e) => setSenha(e.target.value)} />
          </div>
        )}

        {(modo === "confirmar" || modo === "redefinir") && (
          <div className="space-y-1">
            <Label>Token</Label>
            <Input value={token} onChange={(e) => setToken(e.target.value)} placeholder="Cole o token recebido por e-mail" />
          </div>
        )}

        {modo === "redefinir" && (
          <div className="space-y-1">
            <Label>Nova senha</Label>
            <Input type="password" value={novaSenha} onChange={(e) => setNovaSenha(e.target.value)} />
          </div>
        )}

        {erro ? <p className="text-sm text-red-600">{erro}</p> : null}
        {sucesso ? <p className="text-sm text-emerald-700">{sucesso}</p> : null}

        {modo === "login" ? (
          <Button className="w-full" onClick={onLogin}>
            Entrar
          </Button>
        ) : modo === "criar" ? (
          <Button className="w-full" onClick={onCriarConta}>
            Criar conta
          </Button>
        ) : modo === "esqueci" ? (
          <Button className="w-full" onClick={onEsqueci}>
            Enviar link
          </Button>
        ) : modo === "confirmar" ? (
          <Button className="w-full" onClick={onConfirmar}>
            Confirmar conta
          </Button>
        ) : (
          <Button className="w-full" onClick={onRedefinir}>
            Redefinir senha
          </Button>
        )}

        <div className="grid grid-cols-1 gap-2 border-t border-slate-200 pt-3 sm:grid-cols-2">
          <Button type="button" variant="outline" size="sm" className="w-full" onClick={() => { limparMensagens(); setModo("login"); }}>
            Login
          </Button>
          <Button type="button" variant="outline" size="sm" className="w-full" onClick={() => { limparMensagens(); setModo("criar"); }}>
            Criar conta
          </Button>
          <Button type="button" variant="outline" size="sm" className="w-full" onClick={() => { limparMensagens(); setModo("esqueci"); }}>
            Esqueci senha
          </Button>
          <Button type="button" variant="outline" size="sm" className="w-full" onClick={() => { limparMensagens(); setModo("confirmar"); }}>
            Confirmar conta
          </Button>
        </div>

        {isDevExplicit ? (
          <div className="space-y-2 border-t border-dashed border-slate-200 pt-3">
            <p className="text-xs font-medium text-slate-500">Acesso rapido (somente development)</p>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              <Button type="button" variant="outline" size="sm" className="w-full" onClick={() => loginFacilitado("admin")}>
                Admin
              </Button>
              <Button type="button" variant="outline" size="sm" className="w-full" onClick={() => loginFacilitado("diretoria")}>
                Diretoria
              </Button>
              <Button type="button" variant="outline" size="sm" className="w-full" onClick={() => loginFacilitado("ana")}>
                Representante
              </Button>
            </div>
          </div>
        ) : null}
      </Card>
    </main>
  );
}

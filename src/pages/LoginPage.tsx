import { useEffect, useMemo, useRef, useState } from "react";
import { Card } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Button } from "../components/ui/button";
import { useAuthStore } from "../store/useAuthStore";

type Modo = "login" | "criar" | "esqueci" | "redefinir" | "confirmar";

const confirmacaoPorToken = new Map<string, Promise<{ ok: boolean; erro?: string }>>();

export function LoginPage() {
  const initialPath = window.location.pathname;
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
  const [emailConfirmacao, setEmailConfirmacao] = useState("");
  const [novaSenha, setNovaSenha] = useState("");
  const [erro, setErro] = useState("");
  const [sucesso, setSucesso] = useState("");
  const [confirmandoLink, setConfirmandoLink] = useState(() => {
    if (initialModo !== "confirmar") return false;
    const t = new URLSearchParams(window.location.search).get("token")?.trim() ?? "";
    return Boolean(t);
  });
  const confirmacaoGen = useRef(0);
  const isDevExplicit = import.meta.env.DEV;

  const login = useAuthStore((state) => state.login);
  const registrarRepresentante = useAuthStore((state) => state.registrarRepresentante);
  const confirmarConta = useAuthStore((state) => state.confirmarConta);
  const reenviarConfirmacaoEmail = useAuthStore((state) => state.reenviarConfirmacaoEmail);
  const esqueciSenha = useAuthStore((state) => state.esqueciSenha);
  const redefinirSenha = useAuthStore((state) => state.redefinirSenha);

  useEffect(() => {
    if (modo !== "confirmar") {
      setConfirmandoLink(false);
      return;
    }
    const t = new URLSearchParams(window.location.search).get("token")?.trim() ?? "";
    if (!t) {
      setConfirmandoLink(false);
      return;
    }

    const gen = ++confirmacaoGen.current;
    setConfirmandoLink(true);
    setErro("");
    setSucesso("");

    let p = confirmacaoPorToken.get(t);
    if (!p) {
      p = confirmarConta(t).finally(() => {
        confirmacaoPorToken.delete(t);
      });
      confirmacaoPorToken.set(t, p);
    }

    void p.then((result) => {
      if (gen !== confirmacaoGen.current) return;
      setConfirmandoLink(false);
      if (result.ok) {
        const path = window.location.pathname.replace(/\/?confirmar-conta\/?$/i, "/") || "/";
        history.replaceState({}, "", path);
        setSucesso("Conta confirmada. Agora voce pode acessar.");
        setModo("login");
        return;
      }
      setErro(result.erro ?? "Falha ao confirmar pelo link.");
    });

    return () => {
      confirmacaoGen.current += 1;
    };
  }, [modo, confirmarConta]);

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
    setEmailConfirmacao(email.trim());
    setModo("confirmar");
  };

  const onReenviarConfirmacao = async () => {
    limparMensagens();
    const dest = emailConfirmacao.trim();
    if (!dest) {
      setErro("Informe o e-mail cadastrado.");
      return;
    }
    const result = await reenviarConfirmacaoEmail(dest);
    if (!result.ok) {
      setErro(result.erro ?? "Falha ao reenviar e-mail.");
      return;
    }
    setSucesso("Se existir conta nao confirmada com esse e-mail, enviamos um novo link.");
  };

  const onEsqueci = async () => {
    limparMensagens();
    const result = await esqueciSenha(loginValue);
    if (!result.ok) {
      setErro(result.erro ?? "Falha ao solicitar redefinicao.");
      return;
    }
    setSucesso("Se o usuario existir, enviamos o link para redefinir a senha. Abra o e-mail e use o link.");
    setModo("login");
  };

  const onRedefinir = async () => {
    limparMensagens();
    const resetToken = new URLSearchParams(window.location.search).get("token")?.trim() ?? "";
    if (!resetToken) {
      setErro("Link invalido ou incompleto. Solicite novamente em Esqueci minha senha.");
      return;
    }
    if (!novaSenha.trim()) {
      setErro("Informe a nova senha.");
      return;
    }
    const result = await redefinirSenha(resetToken, novaSenha);
    if (!result.ok) {
      setErro(result.erro ?? "Falha ao redefinir senha.");
      return;
    }
    const path = window.location.pathname.replace(/\/?redefinir-senha\/?$/i, "/") || "/";
    history.replaceState({}, "", path);
    setNovaSenha("");
    setSucesso("Senha atualizada. Voce ja pode entrar com a nova senha.");
    setModo("login");
  };

  const tokenRedefinicaoNaUrl = new URLSearchParams(window.location.search).get("token")?.trim() ?? "";

  return (
    <main className="flex min-h-dvh items-center justify-center bg-gray-50 p-3 sm:p-4">
      <Card className="w-full max-w-md space-y-3 p-4 sm:p-5">
        <p className="text-xs font-medium text-blue-600">Acesso ao sistema</p>
        <h1 className="text-lg font-semibold text-slate-900 sm:text-xl">{titulo}</h1>

        {modo === "login" ? (
          <form
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              void onLogin();
            }}
          >
            <div className="space-y-1">
              <Label>E-mail</Label>
              <Input type="email" value={loginValue} onChange={(e) => setLoginValue(e.target.value)} autoComplete="username" />
            </div>
            <div className="space-y-1">
              <Label>Senha</Label>
              <Input type="password" value={senha} onChange={(e) => setSenha(e.target.value)} autoComplete="current-password" />
            </div>
            {erro ? <p className="text-sm text-red-600">{erro}</p> : null}
            {sucesso ? <p className="text-sm text-emerald-700">{sucesso}</p> : null}
            <Button type="submit" className="w-full">
              Entrar
            </Button>
          </form>
        ) : null}

        {modo === "esqueci" ? (
          <form
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              void onEsqueci();
            }}
          >
            <div className="space-y-1">
              <Label>E-mail</Label>
              <Input type="email" value={loginValue} onChange={(e) => setLoginValue(e.target.value)} autoComplete="email" />
            </div>
            {erro ? <p className="text-sm text-red-600">{erro}</p> : null}
            {sucesso ? <p className="text-sm text-emerald-700">{sucesso}</p> : null}
            <Button type="submit" className="w-full">
              Enviar link
            </Button>
          </form>
        ) : null}

        {modo === "criar" ? (
          <form
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              void onCriarConta();
            }}
          >
            <div className="space-y-1">
              <Label>Nome</Label>
              <Input value={nome} onChange={(e) => setNome(e.target.value)} autoComplete="name" />
            </div>
            <div className="space-y-1">
              <Label>E-mail</Label>
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
            </div>
            <div className="space-y-1">
              <Label>Senha</Label>
              <Input type="password" value={senha} onChange={(e) => setSenha(e.target.value)} autoComplete="new-password" />
            </div>
            {erro ? <p className="text-sm text-red-600">{erro}</p> : null}
            {sucesso ? <p className="text-sm text-emerald-700">{sucesso}</p> : null}
            <Button type="submit" className="w-full">
              Criar conta
            </Button>
          </form>
        ) : null}

        {modo === "confirmar" ? (
          confirmandoLink ? (
            <div className="space-y-2">
              <p className="text-sm text-slate-600">
                Abra o link enviado ao seu e-mail para confirmar automaticamente. Se nao recebeu ou o link expirou, informe o
                e-mail cadastrado abaixo.
              </p>
              <p className="text-sm font-medium text-slate-700">Confirmando sua conta pelo link...</p>
            </div>
          ) : (
            <form
              className="space-y-3"
              onSubmit={(e) => {
                e.preventDefault();
                void onReenviarConfirmacao();
              }}
            >
              <p className="text-sm text-slate-600">
                Abra o link enviado ao seu e-mail para confirmar automaticamente. Se nao recebeu ou o link expirou, informe o
                e-mail cadastrado abaixo.
              </p>
              <div className="space-y-1">
                <Label>E-mail</Label>
                <Input
                  type="email"
                  value={emailConfirmacao}
                  onChange={(e) => setEmailConfirmacao(e.target.value)}
                  placeholder="E-mail usado no cadastro"
                  autoComplete="email"
                />
              </div>
              {erro ? <p className="text-sm text-red-600">{erro}</p> : null}
              {sucesso ? <p className="text-sm text-emerald-700">{sucesso}</p> : null}
              <Button type="submit" className="w-full">
                Reenviar e-mail de confirmacao
              </Button>
            </form>
          )
        ) : null}

        {modo === "redefinir" && !tokenRedefinicaoNaUrl ? (
          <div className="space-y-3">
            <p className="text-sm text-slate-600">
              Para redefinir a senha e necessario abrir o link enviado ao seu e-mail apos usar Esqueci minha senha.
            </p>
            <Button
              type="button"
              className="w-full"
              variant="outline"
              onClick={() => {
                limparMensagens();
                setModo("esqueci");
              }}
            >
              Solicitar link por e-mail
            </Button>
          </div>
        ) : null}

        {modo === "redefinir" && tokenRedefinicaoNaUrl ? (
          <form
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              void onRedefinir();
            }}
          >
            <p className="text-sm text-slate-600">
              Defina sua nova senha. O acesso foi validado pelo link enviado ao seu e-mail.
            </p>
            <div className="space-y-1">
              <Label>Nova senha</Label>
              <Input type="password" value={novaSenha} onChange={(e) => setNovaSenha(e.target.value)} autoComplete="new-password" />
            </div>
            {erro ? <p className="text-sm text-red-600">{erro}</p> : null}
            {sucesso ? <p className="text-sm text-emerald-700">{sucesso}</p> : null}
            <Button type="submit" className="w-full">
              Redefinir senha
            </Button>
          </form>
        ) : null}

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

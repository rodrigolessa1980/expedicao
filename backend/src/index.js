import "dotenv/config";
import express from "express";
import cors from "cors";
import jwt from "jsonwebtoken";
import {
  ensureDb,
  findUserByLoginOrEmail,
  listUsers,
  createUser,
  updateUserPassword,
  updateUserActive,
  markUserConfirmed,
  createUserToken,
  consumeValidToken,
  listStatus,
  createStatus,
  updateStatusById,
  listOrdersByRole,
  createOrder,
  updateOrder,
  updateOrderStatus,
  listOrderChangesByRole
} from "./db.js";
import { sha256 } from "./security.js";
import { requireAuth, requireAdmin } from "./middleware/auth.js";
import { sendEmail } from "./emailService.js";
import { confirmationEmailTemplate, forgotPasswordEmailTemplate } from "./emailTemplates.js";

const app = express();
const port = Number(process.env.PORT || 3001);
const jwtExpiresIn = process.env.JWT_EXPIRES_IN || "12h";
const corsOrigins = (process.env.CORS_ORIGIN || "")
  .split(",")
  .map((item) => item.trim())
  .filter(Boolean);

/** Base URL for links in e-mails (confirmacao, reset). CORS_ORIGIN allows comma-separated values; FRONTEND_URL is sometimes copied with the same shape — that would produce an invalid href. Prefer the first non-localhost origin when multiple are listed. */
function publicFrontendBaseUrl() {
  const raw = process.env.FRONTEND_URL || "http://localhost:5173";
  const origins = raw
    .split(",")
    .map((item) => item.trim().replace(/\/$/, ""))
    .filter(Boolean);
  if (origins.length === 0) return "http://localhost:5173";
  const isLocal = (url) => /^https?:\/\/(localhost|127\.0\.0\.1)(:|\/|$)/i.test(url);
  return origins.find((u) => !isLocal(u)) ?? origins[0];
}

if (!process.env.JWT_SECRET) {
  process.env.JWT_SECRET = "change-me-in-production";
}

app.use(
  cors({
    origin: corsOrigins.length === 0 ? true : corsOrigins
  })
);
app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({ ok: true, service: "expedicao-backend" });
});

app.post("/api/auth/register", async (req, res) => {
  const { nome, email, senha } = req.body ?? {};
  if (!nome || !email || !senha) {
    return res.status(400).json({ message: "Informe nome, email e senha." });
  }

  try {
    const user = await createUser({
      nome,
      email,
      login: email,
      senha,
      tipo: "representante",
      ativo: true,
      confirmado: false
    });
    const tokenInfo = await createUserToken({ userId: user.id, tipo: "confirmacao", ttlMinutes: 60 * 24 });
    const confirmUrl = `${publicFrontendBaseUrl()}/confirmar-conta?token=${tokenInfo.token}`;
    await sendEmail({
      to: email,
      subject: "Confirme sua conta na plataforma",
      html: confirmationEmailTemplate({ nome, confirmUrl })
    });

    return res.status(201).json({ ok: true, message: "Conta criada. Verifique seu e-mail para confirmar." });
  } catch (error) {
    if (String(error?.code) === "ER_DUP_ENTRY") {
      return res.status(409).json({ message: "E-mail ja cadastrado." });
    }
    throw error;
  }
});

app.post("/api/auth/confirm-account", async (req, res) => {
  const { token } = req.body ?? {};
  if (!token) return res.status(400).json({ message: "Token obrigatorio." });

  const tokenData = await consumeValidToken({ token, tipo: "confirmacao" });
  if (!tokenData) return res.status(400).json({ message: "Token invalido ou expirado." });

  await markUserConfirmed(tokenData.userId);
  return res.json({ ok: true, message: "Conta confirmada com sucesso." });
});

app.post("/api/auth/resend-confirmation", async (req, res) => {
  const { email } = req.body ?? {};
  const loginOuEmail = String(email ?? "").trim();
  if (!loginOuEmail) {
    return res.status(400).json({ message: "Informe o e-mail." });
  }

  const user = await findUserByLoginOrEmail(loginOuEmail);
  if (user?.email && !user.confirmadoEm && user.ativo) {
    const tokenInfo = await createUserToken({ userId: user.id, tipo: "confirmacao", ttlMinutes: 60 * 24 });
    const confirmUrl = `${publicFrontendBaseUrl()}/confirmar-conta?token=${tokenInfo.token}`;
    await sendEmail({
      to: user.email,
      subject: "Confirme sua conta na plataforma",
      html: confirmationEmailTemplate({ nome: user.nome, confirmUrl })
    });
  }

  return res.json({
    ok: true,
    message: "Se existir conta nao confirmada com esse e-mail, enviamos um novo link."
  });
});

app.post("/api/auth/forgot-password", async (req, res) => {
  const { loginOuEmail } = req.body ?? {};
  if (!loginOuEmail) return res.status(400).json({ message: "Informe login ou e-mail." });

  const user = await findUserByLoginOrEmail(loginOuEmail);
  if (user?.email) {
    const tokenInfo = await createUserToken({ userId: user.id, tipo: "reset", ttlMinutes: 30 });
    const resetUrl = `${publicFrontendBaseUrl()}/redefinir-senha?token=${tokenInfo.token}`;
    await sendEmail({
      to: user.email,
      subject: "Redefinicao de senha",
      html: forgotPasswordEmailTemplate({ nome: user.nome, resetUrl })
    });
  }

  return res.json({ ok: true, message: "Se o usuario existir, enviaremos instrucoes no e-mail." });
});

app.post("/api/auth/reset-password", async (req, res) => {
  const { token, senha } = req.body ?? {};
  if (!token || !senha) return res.status(400).json({ message: "Informe token e nova senha." });

  const tokenData = await consumeValidToken({ token, tipo: "reset" });
  if (!tokenData) return res.status(400).json({ message: "Token invalido ou expirado." });

  await updateUserPassword(tokenData.userId, senha);
  return res.json({ ok: true, message: "Senha atualizada com sucesso." });
});

app.post("/api/auth/login", async (req, res) => {
  const { email, login, senha } = req.body ?? {};
  const emailOrLogin = String(email || login || "").trim();
  if (!emailOrLogin || !senha) {
    return res.status(400).json({ message: "Informe e-mail e senha." });
  }

  const user = await findUserByLoginOrEmail(emailOrLogin);
  if (!user || user.passwordHash !== sha256(senha)) {
    return res.status(401).json({ message: "E-mail ou senha invalidos." });
  }
  if (!user.ativo) return res.status(403).json({ message: "Usuario inativo. Contate o administrador." });
  if (!user.confirmadoEm) return res.status(403).json({ message: "Conta ainda nao confirmada por e-mail." });

  const token = jwt.sign(
    { tipo: user.tipo, nome: user.nome, login: user.login },
    process.env.JWT_SECRET,
    { subject: user.id, expiresIn: jwtExpiresIn }
  );

  return res.json({
    token,
    usuario: {
      id: user.id,
      nome: user.nome,
      login: user.login,
      email: user.email,
      ativo: user.ativo,
      confirmadoEm: user.confirmadoEm,
      tipo: user.tipo
    }
  });
});

app.get("/api/auth/me", requireAuth, (req, res) => {
  res.json({ usuario: req.user });
});

app.get("/api/users", requireAuth, requireAdmin, async (_req, res) => {
  const users = await listUsers();
  res.json(users);
});

app.post("/api/users", requireAuth, requireAdmin, async (req, res) => {
  const { nome, email, senha, tipo } = req.body ?? {};
  if (!nome || !email || !senha || !tipo) {
    return res.status(400).json({ message: "Informe nome, e-mail, senha e tipo." });
  }
  if (!["administrador", "diretoria", "representante"].includes(tipo)) {
    return res.status(400).json({ message: "Tipo de usuario invalido." });
  }

  try {
    const novo = await createUser({ nome, email, login: email, tipo, senha, confirmado: true, ativo: true });
    return res.status(201).json(novo);
  } catch (error) {
    if (String(error?.code) === "ER_DUP_ENTRY") {
      return res.status(409).json({ message: "E-mail ja existe." });
    }
    throw error;
  }
});

app.patch("/api/users/:id/active", requireAuth, requireAdmin, async (req, res) => {
  const { ativo } = req.body ?? {};
  if (typeof ativo !== "boolean") return res.status(400).json({ message: "Informe ativo true/false." });
  const ok = await updateUserActive(req.params.id, ativo);
  if (!ok) return res.status(404).json({ message: "Usuario nao encontrado." });
  return res.json({ ok: true });
});

app.patch("/api/users/:id/password", requireAuth, requireAdmin, async (req, res) => {
  const { senha } = req.body ?? {};
  if (!senha) return res.status(400).json({ message: "Informe a nova senha." });

  const ok = await updateUserPassword(req.params.id, senha);
  if (!ok) return res.status(404).json({ message: "Usuario nao encontrado." });
  return res.json({ ok: true });
});

app.get("/api/status", requireAuth, async (_req, res) => {
  const status = await listStatus();
  res.json(status);
});

app.post("/api/status", requireAuth, requireAdmin, async (req, res) => {
  const { nome, cor } = req.body ?? {};
  if (!nome || !cor) return res.status(400).json({ message: "Informe nome e cor." });

  try {
    const novo = await createStatus({ nome, cor });
    return res.status(201).json(novo);
  } catch (error) {
    if (String(error?.code) === "ER_DUP_ENTRY") {
      return res.status(409).json({ message: "Status ja existe." });
    }
    throw error;
  }
});

app.put("/api/status/:id", requireAuth, requireAdmin, async (req, res) => {
  const { nome, cor } = req.body ?? {};
  if (!nome || !cor) return res.status(400).json({ message: "Informe nome e cor." });

  const status = await updateStatusById(req.params.id, { nome, cor });
  if (!status) return res.status(404).json({ message: "Status nao encontrado." });
  return res.json(status);
});

app.get("/api/orders", requireAuth, async (req, res) => {
  const orders = await listOrdersByRole(req.user);
  return res.json(orders);
});

app.get("/api/orders/changes", requireAuth, async (req, res) => {
  const since = String(req.query.since || "").trim();
  const limit = req.query.limit;
  if (!since) {
    return res.status(400).json({ message: "Informe o parametro since em formato ISO." });
  }

  const parsedSince = new Date(since);
  if (Number.isNaN(parsedSince.getTime())) {
    return res.status(400).json({ message: "Parametro since invalido." });
  }

  const { changes, nextSince } = await listOrderChangesByRole(req.user, { since: parsedSince, limit });
  return res.json({
    since,
    nextSince: new Date(nextSince).toISOString(),
    changes
  });
});

app.post("/api/orders", requireAuth, requireAdmin, async (req, res) => {
  const payload = req.body ?? {};
  const required = [
    "numeroPedido",
    "numeroNF",
    "cliente",
    "dataFaturamento",
    "dataExpedicao",
    "prazoEntrega",
    "statusAtual"
  ];

  const missing = required.find((key) => !payload[key]);
  if (missing) return res.status(400).json({ message: `Campo obrigatorio: ${missing}` });

  try {
    const novoPedido = await createOrder(payload);
    return res.status(201).json(novoPedido);
  } catch (error) {
    if (String(error?.code) === "ER_DUP_ENTRY") {
      return res.status(409).json({ message: "Numero de pedido ja cadastrado." });
    }
    if (String(error?.code) === "ER_NO_REFERENCED_ROW_2") {
      return res.status(400).json({ message: "Status informado nao existe." });
    }
    throw error;
  }
});

app.put("/api/orders/:numeroPedido", requireAuth, requireAdmin, async (req, res) => {
  const payload = req.body ?? {};
  const required = [
    "numeroPedido",
    "numeroNF",
    "cliente",
    "dataFaturamento",
    "dataExpedicao",
    "prazoEntrega",
    "statusAtual"
  ];
  const missing = required.find((key) => !payload[key]);
  if (missing) return res.status(400).json({ message: `Campo obrigatorio: ${missing}` });

  try {
    const atualizado = await updateOrder(req.params.numeroPedido, payload);
    if (!atualizado) return res.status(404).json({ message: "Pedido nao encontrado." });
    return res.json(atualizado);
  } catch (error) {
    if (String(error?.code) === "ER_DUP_ENTRY") {
      return res.status(409).json({ message: "Numero de pedido ja cadastrado." });
    }
    if (String(error?.code) === "ER_NO_REFERENCED_ROW_2") {
      return res.status(400).json({ message: "Status informado nao existe." });
    }
    throw error;
  }
});

app.patch("/api/orders/:numeroPedido/status", requireAuth, requireAdmin, async (req, res) => {
  const { statusId } = req.body ?? {};
  if (!statusId) return res.status(400).json({ message: "Informe statusId." });

  const pedido = await updateOrderStatus(req.params.numeroPedido, statusId);
  if (!pedido) return res.status(404).json({ message: "Pedido nao encontrado." });
  return res.json(pedido);
});

await ensureDb();
app.listen(port, () => {
  console.log(`Backend rodando na porta ${port}`);
});

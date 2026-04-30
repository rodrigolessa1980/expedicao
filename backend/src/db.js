import { randomUUID } from "node:crypto";
import mysql from "mysql2/promise";
import { sha256, slugify } from "./security.js";

const defaultStatus = [
  { id: "aguardando-carregamento", nome: "Aguardando carregamento", cor: "#6b7280" },
  { id: "em-transito", nome: "Em transito", cor: "#2563eb" },
  { id: "no-porto", nome: "No porto", cor: "#f97316" },
  { id: "finalizado", nome: "Finalizado", cor: "#16a34a" }
];

let pool;

function getPool() {
  if (pool) return pool;
  pool = mysql.createPool({
    host: process.env.DB_HOST || "127.0.0.1",
    port: Number(process.env.DB_PORT || 3306),
    database: process.env.DB_NAME || "controle_epi_main",
    user: process.env.DB_USER || "root",
    password: process.env.DB_PASSWORD || "",
    waitForConnections: true,
    connectionLimit: 10
  });
  return pool;
}

async function ensureColumn(table, columnDef) {
  const conn = getPool();
  try {
    await conn.query(`ALTER TABLE ${table} ADD COLUMN ${columnDef}`);
  } catch (error) {
    if (String(error?.code) !== "ER_DUP_FIELDNAME") throw error;
  }
}

function mapUser(row) {
  return {
    id: row.id,
    nome: row.nome,
    login: row.login,
    email: row.email,
    tipo: row.tipo,
    ativo: Boolean(row.ativo),
    confirmadoEm: row.confirmado_em,
    passwordHash: row.password_hash,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function mapPedido(row) {
  return {
    numeroPedido: row.numero_pedido,
    representante: row.representante || "",
    numeroNF: row.numero_nf,
    cliente: row.cliente,
    dataFaturamento: row.data_faturamento,
    dataExpedicao: row.data_expedicao,
    prazoEntrega: row.prazo_entrega,
    dataEntrega: row.data_entrega || "",
    statusAtual: row.status_atual
  };
}

export async function ensureDb() {
  const conn = getPool();
  await conn.query(`
    CREATE TABLE IF NOT EXISTS users (
      id VARCHAR(64) PRIMARY KEY,
      nome VARCHAR(120) NOT NULL,
      login VARCHAR(80) NOT NULL UNIQUE,
      tipo ENUM('administrador', 'diretoria', 'representante') NOT NULL,
      password_hash VARCHAR(64) NOT NULL,
      created_at DATETIME NOT NULL,
      updated_at DATETIME NOT NULL
    )
  `);

  await ensureColumn("users", "email VARCHAR(180) NULL");
  await ensureColumn("users", "ativo TINYINT(1) NOT NULL DEFAULT 1");
  await ensureColumn("users", "confirmado_em DATETIME NULL");
  try {
    await conn.query("CREATE UNIQUE INDEX idx_users_email_unique ON users (email)");
  } catch (error) {
    if (!["ER_DUP_KEYNAME", "ER_TOO_LONG_KEY"].includes(String(error?.code))) throw error;
  }

  await conn.query(`
    CREATE TABLE IF NOT EXISTS user_tokens (
      token VARCHAR(128) PRIMARY KEY,
      user_id VARCHAR(64) NOT NULL,
      tipo ENUM('confirmacao', 'reset') NOT NULL,
      expires_at DATETIME NOT NULL,
      used_at DATETIME NULL,
      created_at DATETIME NOT NULL,
      CONSTRAINT fk_user_tokens_user FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `);

  await conn.query(`
    CREATE TABLE IF NOT EXISTS status (
      id VARCHAR(80) PRIMARY KEY,
      nome VARCHAR(120) NOT NULL,
      cor VARCHAR(20) NOT NULL,
      updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
    )
  `);
  await conn.query(`
    CREATE TABLE IF NOT EXISTS pedidos (
      numero_pedido VARCHAR(60) PRIMARY KEY,
      representante VARCHAR(120) NULL,
      numero_nf VARCHAR(60) NOT NULL,
      cliente VARCHAR(160) NOT NULL,
      data_faturamento DATE NOT NULL,
      data_expedicao DATE NOT NULL,
      prazo_entrega DATE NOT NULL,
      data_entrega DATE NULL,
      status_atual VARCHAR(80) NOT NULL,
      updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      CONSTRAINT fk_pedidos_status FOREIGN KEY (status_atual) REFERENCES status(id)
    )
  `);
  await ensureColumn("status", "updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)");
  await ensureColumn("pedidos", "updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)");
  await conn.query("ALTER TABLE pedidos MODIFY COLUMN representante VARCHAR(120) NULL");
  try {
    await conn.query("CREATE INDEX idx_pedidos_updated_at_numero ON pedidos (updated_at, numero_pedido)");
  } catch (error) {
    if (String(error?.code) !== "ER_DUP_KEYNAME") throw error;
  }

  const [users] = await conn.query("SELECT id FROM users WHERE tipo = 'administrador' LIMIT 1");
  if (users.length === 0) {
    const now = new Date();
    await conn.query(
      `INSERT INTO users
        (id, nome, login, email, tipo, ativo, confirmado_em, password_hash, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [randomUUID(), "Administrador", "admin", "admin@sistema.local", "administrador", 1, now, sha256("admin123"), now, now]
    );
  }

  for (const item of defaultStatus) {
    await conn.query(
      `INSERT INTO status (id, nome, cor, updated_at)
       VALUES (?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE nome = VALUES(nome), cor = VALUES(cor), updated_at = VALUES(updated_at)`,
      [item.id, item.nome, item.cor, new Date()]
    );
  }
}

export async function findUserByLogin(login) {
  const conn = getPool();
  const [rows] = await conn.query("SELECT * FROM users WHERE login = ? LIMIT 1", [login]);
  return rows[0] ? mapUser(rows[0]) : null;
}

export async function findUserById(id) {
  const conn = getPool();
  const [rows] = await conn.query("SELECT * FROM users WHERE id = ? LIMIT 1", [id]);
  return rows[0] ? mapUser(rows[0]) : null;
}

export async function findUserByLoginOrEmail(value) {
  const conn = getPool();
  const [rows] = await conn.query("SELECT * FROM users WHERE login = ? OR email = ? LIMIT 1", [value, value]);
  return rows[0] ? mapUser(rows[0]) : null;
}

export async function listUsers() {
  const conn = getPool();
  const [rows] = await conn.query(
    "SELECT id, nome, login, email, tipo, ativo, confirmado_em, created_at, updated_at FROM users ORDER BY nome"
  );
  return rows.map((row) => ({
    id: row.id,
    nome: row.nome,
    login: row.login,
    email: row.email,
    tipo: row.tipo,
    ativo: Boolean(row.ativo),
    confirmadoEm: row.confirmado_em,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }));
}

export async function createUser({ nome, login, email, tipo, senha, ativo = true, confirmado = false }) {
  const conn = getPool();
  const id = randomUUID();
  const now = new Date();
  const confirmadoEm = confirmado ? now : null;
  await conn.query(
    `INSERT INTO users
      (id, nome, login, email, tipo, ativo, confirmado_em, password_hash, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, nome, login, email || null, tipo, ativo ? 1 : 0, confirmadoEm, sha256(senha), now, now]
  );
  return { id, nome, login, email: email || null, tipo, ativo, confirmadoEm, createdAt: now, updatedAt: now };
}

export async function updateUserPassword(id, senha) {
  const conn = getPool();
  const now = new Date();
  const [result] = await conn.query("UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?", [sha256(senha), now, id]);
  return result.affectedRows > 0;
}

export async function updateUserActive(id, ativo) {
  const conn = getPool();
  const [result] = await conn.query("UPDATE users SET ativo = ?, updated_at = ? WHERE id = ?", [ativo ? 1 : 0, new Date(), id]);
  return result.affectedRows > 0;
}

export async function markUserConfirmed(id) {
  const conn = getPool();
  const now = new Date();
  const [result] = await conn.query("UPDATE users SET confirmado_em = ?, updated_at = ? WHERE id = ?", [now, now, id]);
  return result.affectedRows > 0;
}

export async function createUserToken({ userId, tipo, ttlMinutes }) {
  const conn = getPool();
  const token = randomUUID().replaceAll("-", "") + randomUUID().replaceAll("-", "");
  const now = new Date();
  const expiresAt = new Date(now.getTime() + ttlMinutes * 60 * 1000);
  await conn.query(
    "INSERT INTO user_tokens (token, user_id, tipo, expires_at, used_at, created_at) VALUES (?, ?, ?, ?, NULL, ?)",
    [token, userId, tipo, expiresAt, now]
  );
  return { token, expiresAt };
}

export async function consumeValidToken({ token, tipo }) {
  const conn = getPool();
  const [rows] = await conn.query(
    `SELECT t.token, t.user_id, u.login
     FROM user_tokens t
     JOIN users u ON u.id = t.user_id
     WHERE t.token = ? AND t.tipo = ? AND t.used_at IS NULL AND t.expires_at >= NOW()
     LIMIT 1`,
    [token, tipo]
  );
  if (rows.length === 0) return null;

  await conn.query("UPDATE user_tokens SET used_at = NOW() WHERE token = ?", [token]);
  return { token: rows[0].token, userId: rows[0].user_id, login: rows[0].login };
}

export async function listStatus() {
  const conn = getPool();
  const [rows] = await conn.query("SELECT id, nome, cor FROM status ORDER BY nome");
  return rows.map((row) => ({ id: row.id, nome: row.nome, cor: row.cor }));
}

export async function createStatus({ nome, cor }) {
  const conn = getPool();
  const id = slugify(nome);
  await conn.query("INSERT INTO status (id, nome, cor, updated_at) VALUES (?, ?, ?, ?)", [id, nome, cor, new Date()]);
  return { id, nome, cor };
}

export async function updateStatusById(id, { nome, cor }) {
  const conn = getPool();
  const [result] = await conn.query("UPDATE status SET nome = ?, cor = ?, updated_at = ? WHERE id = ?", [
    nome,
    cor,
    new Date(),
    id
  ]);
  if (result.affectedRows === 0) return null;
  return { id, nome, cor };
}

export async function listOrdersByRole(user) {
  const conn = getPool();
  const query =
    user.tipo === "representante"
      ? "SELECT * FROM pedidos WHERE representante = ? ORDER BY data_faturamento DESC"
      : "SELECT * FROM pedidos ORDER BY data_faturamento DESC";
  const [rows] = user.tipo === "representante" ? await conn.query(query, [user.nome]) : await conn.query(query);
  return rows.map(mapPedido);
}

export async function createOrder(payload) {
  const conn = getPool();
  const dataEntrega = payload.statusAtual === "finalizado" ? new Date().toISOString().slice(0, 10) : null;
  const now = new Date();
  await conn.query(
    `INSERT INTO pedidos
      (numero_pedido, representante, numero_nf, cliente, data_faturamento, data_expedicao, prazo_entrega, data_entrega, status_atual, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      payload.numeroPedido,
      payload.representante || null,
      payload.numeroNF,
      payload.cliente,
      payload.dataFaturamento,
      payload.dataExpedicao,
      payload.prazoEntrega,
      dataEntrega,
      payload.statusAtual,
      now
    ]
  );
  return {
    numeroPedido: payload.numeroPedido,
    representante: payload.representante || "",
    numeroNF: payload.numeroNF,
    cliente: payload.cliente,
    dataFaturamento: payload.dataFaturamento,
    dataExpedicao: payload.dataExpedicao,
    prazoEntrega: payload.prazoEntrega,
    dataEntrega: dataEntrega || "",
    statusAtual: payload.statusAtual
  };
}

export async function updateOrder(numeroPedidoOriginal, payload) {
  const conn = getPool();
  const [rows] = await conn.query("SELECT * FROM pedidos WHERE numero_pedido = ? LIMIT 1", [numeroPedidoOriginal]);
  if (rows.length === 0) return null;
  const current = rows[0];
  const dataEntrega =
    payload.statusAtual === "finalizado"
      ? payload.dataEntrega || current.data_entrega || new Date().toISOString().slice(0, 10)
      : payload.dataEntrega || null;

  await conn.query(
    `UPDATE pedidos
      SET numero_pedido = ?, representante = ?, numero_nf = ?, cliente = ?, data_faturamento = ?, data_expedicao = ?,
          prazo_entrega = ?, data_entrega = ?, status_atual = ?, updated_at = ?
     WHERE numero_pedido = ?`,
    [
      payload.numeroPedido,
      payload.representante || null,
      payload.numeroNF,
      payload.cliente,
      payload.dataFaturamento,
      payload.dataExpedicao,
      payload.prazoEntrega,
      dataEntrega,
      payload.statusAtual,
      new Date(),
      numeroPedidoOriginal
    ]
  );

  return {
    numeroPedido: payload.numeroPedido,
    representante: payload.representante || "",
    numeroNF: payload.numeroNF,
    cliente: payload.cliente,
    dataFaturamento: payload.dataFaturamento,
    dataExpedicao: payload.dataExpedicao,
    prazoEntrega: payload.prazoEntrega,
    dataEntrega: dataEntrega || "",
    statusAtual: payload.statusAtual
  };
}

export async function updateOrderStatus(numeroPedido, statusId) {
  const conn = getPool();
  const [rows] = await conn.query("SELECT * FROM pedidos WHERE numero_pedido = ? LIMIT 1", [numeroPedido]);
  if (rows.length === 0) return null;
  const current = rows[0];
  const dataEntrega =
    statusId === "finalizado" && !current.data_entrega ? new Date().toISOString().slice(0, 10) : current.data_entrega;
  await conn.query("UPDATE pedidos SET status_atual = ?, data_entrega = ?, updated_at = ? WHERE numero_pedido = ?", [
    statusId,
    dataEntrega,
    new Date(),
    numeroPedido
  ]);
  return {
    numeroPedido: current.numero_pedido,
    representante: current.representante || "",
    numeroNF: current.numero_nf,
    cliente: current.cliente,
    dataFaturamento: current.data_faturamento,
    dataExpedicao: current.data_expedicao,
    prazoEntrega: current.prazo_entrega,
    dataEntrega: dataEntrega || "",
    statusAtual: statusId
  };
}

export async function listOrderChangesByRole(user, { since, limit = 500 }) {
  const conn = getPool();
  const parsedLimit = Math.max(1, Math.min(Number(limit) || 500, 1000));
  const roleFilter = user.tipo === "representante" ? "AND representante = ?" : "";
  const params = user.tipo === "representante" ? [since, user.nome, parsedLimit] : [since, parsedLimit];
  const [rows] = await conn.query(
    `
      SELECT
        numero_pedido,
        representante,
        numero_nf,
        cliente,
        data_faturamento,
        data_expedicao,
        prazo_entrega,
        data_entrega,
        status_atual,
        updated_at
      FROM pedidos
      WHERE updated_at > ?
      ${roleFilter}
      ORDER BY updated_at ASC, numero_pedido ASC
      LIMIT ?
    `,
    params
  );

  const changes = rows.map((row) => ({
    ...mapPedido(row),
    updatedAt: row.updated_at
  }));
  const nextSince = rows.length > 0 ? rows[rows.length - 1].updated_at : since;
  return { changes, nextSince };
}

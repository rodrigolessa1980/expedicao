import { randomUUID } from "node:crypto";
import mysql from "mysql2/promise";
import { sha256, slugify } from "./security.js";

const defaultStatus = [
  { id: "pedido-adicionado", nome: "Pedido Adicionado", cor: "#dc2626" },
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
    dataPedido: row.data_pedido || row.data_faturamento,
    dataFaturamento: row.data_faturamento,
    dataExpedicao: row.data_expedicao,
    prazoEntrega: row.prazo_entrega,
    dataEntrega: row.data_entrega || "",
    statusAtual: row.status_atual,
    createdAt: row.created_at || null,
    updatedAt: row.updated_at || null
  };
}

function mapPedidoChangeLog(row) {
  return {
    id: row.id,
    pedidoNumero: row.pedido_numero,
    field: row.field_name,
    fieldLabel: row.field_label,
    from: row.from_value || "",
    to: row.to_value || "",
    changedAt: row.changed_at,
    changedBy: row.changed_by
  };
}

function mapPedidoAttachment(row) {
  return {
    id: row.id,
    pedidoNumero: row.pedido_numero,
    nomeOriginal: row.nome_original,
    nomeStorage: row.nome_storage,
    caminhoStorage: row.caminho_storage,
    mimeType: row.mime_type,
    tamanhoBytes: Number(row.tamanho_bytes || 0),
    criadoPor: row.criado_por,
    criadoEm: row.criado_em
  };
}

function normalizeFieldValue(value) {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value);
}

const trackedPedidoFields = [
  { field: "numeroPedido", column: "numero_pedido", label: "Numero do Pedido" },
  { field: "representante", column: "representante", label: "Representante (opcional)" },
  { field: "numeroNF", column: "numero_nf", label: "Numero NF" },
  { field: "cliente", column: "cliente", label: "Cliente" },
  { field: "dataPedido", column: "data_pedido", label: "Data do pedido" },
  { field: "dataFaturamento", column: "data_faturamento", label: "Data Faturamento" },
  { field: "dataExpedicao", column: "data_expedicao", label: "Data Expedicao" },
  { field: "prazoEntrega", column: "prazo_entrega", label: "Prazo de Entrega" },
  { field: "dataEntrega", column: "data_entrega", label: "Data da Entrega" },
  { field: "statusAtual", column: "status_atual", label: "Status" }
];

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
      data_pedido DATE NOT NULL,
      data_faturamento DATE NOT NULL,
      data_expedicao DATE NOT NULL,
      prazo_entrega DATE NOT NULL,
      data_entrega DATE NULL,
      status_atual VARCHAR(80) NOT NULL,
      created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      CONSTRAINT fk_pedidos_status FOREIGN KEY (status_atual) REFERENCES status(id)
    )
  `);
  await ensureColumn("status", "updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)");
  await ensureColumn("pedidos", "updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)");
  await ensureColumn("pedidos", "created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)");
  await ensureColumn("pedidos", "data_pedido DATE NULL");
  await conn.query("UPDATE pedidos SET data_pedido = data_faturamento WHERE data_pedido IS NULL");
  await conn.query("ALTER TABLE pedidos MODIFY COLUMN representante VARCHAR(120) NULL");
  await conn.query(`
    CREATE TABLE IF NOT EXISTS pedido_change_logs (
      id VARCHAR(64) PRIMARY KEY,
      pedido_numero VARCHAR(60) NOT NULL,
      field_name VARCHAR(60) NOT NULL,
      field_label VARCHAR(120) NOT NULL,
      from_value TEXT NULL,
      to_value TEXT NULL,
      changed_by VARCHAR(120) NOT NULL,
      changed_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      CONSTRAINT fk_pedido_logs_pedido FOREIGN KEY (pedido_numero) REFERENCES pedidos(numero_pedido)
    )
  `);
  await conn.query(`
    CREATE TABLE IF NOT EXISTS pedido_attachments (
      id VARCHAR(64) PRIMARY KEY,
      pedido_numero VARCHAR(60) NOT NULL,
      nome_original VARCHAR(255) NOT NULL,
      nome_storage VARCHAR(255) NOT NULL,
      caminho_storage VARCHAR(500) NOT NULL,
      mime_type VARCHAR(120) NOT NULL,
      tamanho_bytes BIGINT NOT NULL,
      criado_por VARCHAR(120) NOT NULL,
      criado_em DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      CONSTRAINT fk_pedido_attachments_pedido FOREIGN KEY (pedido_numero) REFERENCES pedidos(numero_pedido)
    )
  `);
  try {
    await conn.query("CREATE INDEX idx_pedido_attachments_pedido_criado_em ON pedido_attachments (pedido_numero, criado_em)");
  } catch (error) {
    if (String(error?.code) !== "ER_DUP_KEYNAME") throw error;
  }
  try {
    await conn.query("CREATE INDEX idx_pedido_change_logs_pedido_changed_at ON pedido_change_logs (pedido_numero, changed_at)");
  } catch (error) {
    if (String(error?.code) !== "ER_DUP_KEYNAME") throw error;
  }
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
      (numero_pedido, representante, numero_nf, cliente, data_pedido, data_faturamento, data_expedicao, prazo_entrega, data_entrega, status_atual, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      payload.numeroPedido,
      payload.representante || null,
      payload.numeroNF,
      payload.cliente,
      payload.dataPedido,
      payload.dataFaturamento,
      payload.dataExpedicao,
      payload.prazoEntrega,
      dataEntrega,
      payload.statusAtual,
      now,
      now
    ]
  );
  return {
    numeroPedido: payload.numeroPedido,
    representante: payload.representante || "",
    numeroNF: payload.numeroNF,
    cliente: payload.cliente,
    dataPedido: payload.dataPedido,
    dataFaturamento: payload.dataFaturamento,
    dataExpedicao: payload.dataExpedicao,
    prazoEntrega: payload.prazoEntrega,
    dataEntrega: dataEntrega || "",
    statusAtual: payload.statusAtual,
    createdAt: now,
    updatedAt: now
  };
}

export async function updateOrder(numeroPedidoOriginal, payload, changedBy) {
  const conn = getPool();
  const trx = await conn.getConnection();
  try {
    await trx.beginTransaction();
    const [rows] = await trx.query("SELECT * FROM pedidos WHERE numero_pedido = ? LIMIT 1 FOR UPDATE", [numeroPedidoOriginal]);
    if (rows.length === 0) {
      await trx.rollback();
      return null;
    }
    const current = rows[0];
    const numeroPedido = String(payload.numeroPedido ?? "").trim() || current.numero_pedido;
    const representante = String(payload.representante ?? "").trim() || current.representante || "";
    const numeroNF = String(payload.numeroNF ?? "").trim() || current.numero_nf;
    const cliente = String(payload.cliente ?? "").trim() || current.cliente;
    const dataPedido = String(payload.dataPedido ?? "").trim() || current.data_pedido;
    const dataFaturamento = String(payload.dataFaturamento ?? "").trim() || current.data_faturamento || dataPedido;
    const dataExpedicao = String(payload.dataExpedicao ?? "").trim() || current.data_expedicao || dataFaturamento;
    const prazoEntrega = String(payload.prazoEntrega ?? "").trim() || current.prazo_entrega || dataExpedicao;
    const statusAtual = String(payload.statusAtual ?? "").trim() || current.status_atual;
    const dataEntrega =
      statusAtual === "finalizado"
        ? payload.dataEntrega || current.data_entrega || new Date().toISOString().slice(0, 10)
        : payload.dataEntrega || null;
    const now = new Date();

    await trx.query(
      `UPDATE pedidos
        SET numero_pedido = ?, representante = ?, numero_nf = ?, cliente = ?, data_pedido = ?, data_faturamento = ?, data_expedicao = ?,
            prazo_entrega = ?, data_entrega = ?, status_atual = ?, updated_at = ?
      WHERE numero_pedido = ?`,
      [
        numeroPedido,
        representante || null,
        numeroNF,
        cliente,
        dataPedido,
        dataFaturamento,
        dataExpedicao,
        prazoEntrega,
        dataEntrega,
        statusAtual,
        now,
        numeroPedidoOriginal
      ]
    );

    const updatedSnapshot = {
      numeroPedido,
      representante,
      numeroNF,
      cliente,
      dataPedido,
      dataFaturamento,
      dataExpedicao,
      prazoEntrega,
      dataEntrega: dataEntrega || "",
      statusAtual
    };
    const logRows = trackedPedidoFields
      .map((entry) => {
        const from = normalizeFieldValue(current[entry.column]);
        const to = normalizeFieldValue(updatedSnapshot[entry.field]);
        if (from === to) return null;
        return [randomUUID(), numeroPedido, entry.field, entry.label, from || null, to || null, changedBy || "Sistema", now];
      })
      .filter(Boolean);
    for (const row of logRows) {
      await trx.query(
        `INSERT INTO pedido_change_logs
          (id, pedido_numero, field_name, field_label, from_value, to_value, changed_by, changed_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        row
      );
    }
    await trx.commit();

    return {
      ...updatedSnapshot,
      createdAt: current.created_at || null,
      updatedAt: now
    };
  } catch (error) {
    await trx.rollback();
    throw error;
  } finally {
    trx.release();
  }
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
    dataPedido: current.data_pedido || current.data_faturamento,
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
        data_pedido,
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

export async function listOrderLogsByRole(user, numeroPedido) {
  const conn = getPool();
  if (user.tipo === "representante") {
    const [allowed] = await conn.query("SELECT 1 FROM pedidos WHERE numero_pedido = ? AND representante = ? LIMIT 1", [
      numeroPedido,
      user.nome
    ]);
    if (allowed.length === 0) return null;
  }
  const [rows] = await conn.query(
    `SELECT id, pedido_numero, field_name, field_label, from_value, to_value, changed_by, changed_at
      FROM pedido_change_logs
      WHERE pedido_numero = ?
      ORDER BY changed_at DESC, id DESC`,
    [numeroPedido]
  );
  return rows.map(mapPedidoChangeLog);
}

export async function listOrderAttachmentsByRole(user, numeroPedido) {
  const conn = getPool();
  if (user.tipo === "representante") {
    const [allowed] = await conn.query("SELECT 1 FROM pedidos WHERE numero_pedido = ? AND representante = ? LIMIT 1", [
      numeroPedido,
      user.nome
    ]);
    if (allowed.length === 0) return null;
  }
  const [rows] = await conn.query(
    `SELECT id, pedido_numero, nome_original, nome_storage, caminho_storage, mime_type, tamanho_bytes, criado_por, criado_em
      FROM pedido_attachments
      WHERE pedido_numero = ?
      ORDER BY criado_em DESC, id DESC`,
    [numeroPedido]
  );
  return rows.map(mapPedidoAttachment);
}

export async function createOrderAttachment({ pedidoNumero, nomeOriginal, nomeStorage, caminhoStorage, mimeType, tamanhoBytes, criadoPor }) {
  const conn = getPool();
  const id = randomUUID();
  const criadoEm = new Date();
  await conn.query(
    `INSERT INTO pedido_attachments
      (id, pedido_numero, nome_original, nome_storage, caminho_storage, mime_type, tamanho_bytes, criado_por, criado_em)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, pedidoNumero, nomeOriginal, nomeStorage, caminhoStorage, mimeType, tamanhoBytes, criadoPor, criadoEm]
  );
  return { id, pedidoNumero, nomeOriginal, nomeStorage, caminhoStorage, mimeType, tamanhoBytes, criadoPor, criadoEm };
}

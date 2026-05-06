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
);

SET @idx_exists = (
  SELECT COUNT(*)
  FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'pedido_attachments'
    AND INDEX_NAME = 'idx_pedido_attachments_pedido_criado_em'
);
SET @idx_ddl = IF(@idx_exists = 0, 'CREATE INDEX idx_pedido_attachments_pedido_criado_em ON pedido_attachments (pedido_numero, criado_em)', 'SELECT 1');
PREPARE stmt_idx FROM @idx_ddl;
EXECUTE stmt_idx;
DEALLOCATE PREPARE stmt_idx;

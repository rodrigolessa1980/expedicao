SET @col_exists = (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'pedidos'
    AND COLUMN_NAME = 'data_pedido'
);
SET @ddl = IF(@col_exists = 0, 'ALTER TABLE pedidos ADD COLUMN data_pedido DATE NULL', 'SELECT 1');
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

UPDATE pedidos
SET data_pedido = data_faturamento
WHERE data_pedido IS NULL;

ALTER TABLE pedidos
  MODIFY COLUMN data_pedido DATE NOT NULL;

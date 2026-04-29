INSERT INTO status (id, nome, cor, updated_at)
VALUES
  ('aguardando-carregamento', 'Aguardando carregamento', '#6b7280', CURRENT_TIMESTAMP(3)),
  ('em-transito', 'Em transito', '#2563eb', CURRENT_TIMESTAMP(3)),
  ('no-porto', 'No porto', '#f97316', CURRENT_TIMESTAMP(3)),
  ('finalizado', 'Finalizado', '#16a34a', CURRENT_TIMESTAMP(3))
ON DUPLICATE KEY UPDATE
  nome = VALUES(nome),
  cor = VALUES(cor),
  updated_at = CURRENT_TIMESTAMP(3);

DELETE FROM status
WHERE id NOT IN ('aguardando-carregamento', 'em-transito', 'no-porto', 'finalizado')
  AND id NOT IN (SELECT DISTINCT status_atual FROM pedidos);

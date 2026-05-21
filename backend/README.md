# Backend Expedicao

Backend Node.js simples para cobrir as funcionalidades basicas do frontend, usando MySQL:

- login com `login + senha` (senha em SHA-256)
- recuperacao de senha por token e e-mail (webhook)
- cadastro de usuarios por administrador
- troca de senha feita apenas por administrador
- gestao de status
- cadastro e atualizacao de pedidos
- notificacao de pedidos em atraso via webhook (fluxo externo de e-mail)

## Rodando local

1. Copie `.env.example` para `.env`.
2. Instale dependencias:
   - `npm ci`
3. Rode:
   - `npm run dev`

Servidor padrao: `http://localhost:2515`

## Variaveis de ambiente

Use no `.env`:

- `PORT=2515`
- `JWT_SECRET=troque-este-segredo`
- `JWT_EXPIRES_IN=12h`
- `CORS_ORIGIN=http://localhost:5772`
- `FRONTEND_URL=http://localhost:5772`
- `EMAIL_WEBHOOK_URL=https://dadosbi.monkeybranch.com.br/webhook/emailMessage`
- `ATRASO_PEDIDO_WEBHOOK_URL` (opcional; padrao em `src/atrasoPedidoConfig.js`)
- `ATRASO_PEDIDO_DIAS_ATRASO=1` (dias excedentes do agendamento/prazo para disparar o webhook; padrao 1)
- `ATRASO_PEDIDO_WEBHOOK_SECRET=segredo-compartilhado-com-n8n`
- `ATRASO_PEDIDO_JOB_ENABLED=true`
- `ATRASO_PEDIDO_JOB_INTERVAL_MS=3600000`
- `DB_HOST=143.198.155.216`
- `DB_PORT=3306`
- `DB_NAME=controle_epi_main`
- `DB_USER=quality_`
- `DB_PASSWORD=7629@Qu4lity`
- `DATABASE_URL=mysql://user:senha@host:3306/database`

## Prisma

Schema Prisma em `prisma/schema.prisma`, mapeado para as tabelas atuais:

- `users`
- `user_tokens`
- `status`
- `pedidos`

Comandos:

- `npm run prisma:generate`
- `npm run prisma:push`
- `npm run prisma:studio`

## Docker

No raiz do projeto:

- `docker compose up --build`

## Auth

- `POST /api/auth/login`
- `POST /api/auth/register` (representante)
- `POST /api/auth/confirm-account`
- `POST /api/auth/forgot-password`
- `POST /api/auth/reset-password`
  - body: `{ "login": "admin", "senha": "admin123" }`
  - retorna `token` JWT e usuario autenticado
- `GET /api/auth/me` (Bearer token)

Usuario seed inicial:

- login: `admin`
- senha: `admin123`
- tipo: `administrador`

No primeiro start, o backend cria automaticamente as tabelas `users`, `status` e `pedidos` se nao existirem.

## Endpoints principais

- `GET /health`
- `GET /api/users` (admin)
- `POST /api/users` (admin)
- `PATCH /api/users/:id/password` (admin)
- `PATCH /api/users/:id/active` (admin)
- `GET /api/status` (auth)
- `POST /api/status` (admin)
- `PUT /api/status/:id` (admin)
- `GET /api/orders` (auth; representante so ve os proprios)
- `POST /api/orders` (admin)
- `PATCH /api/orders/:numeroPedido/status` (admin)

## Webhook de pedido em atraso

Um job no backend verifica pedidos com pelo menos `ATRASO_PEDIDO_DIAS_ATRASO` dias excedentes do prazo efetivo (`data_agendamento` quando informada, senao `prazo_entrega`), ainda nao finalizados e com `notificacao_atraso_enviada = 0`. Para cada um, dispara:

- `POST` na URL do webhook (padrao fixo em `src/atrasoPedidoConfig.js`: `https://dadosbi.monkeybranch.com.br/webhook/atrasonopedido`)
- Body JSON plano: `event`, `numeroPedido`, `diasAtraso`, `prazoEfetivo`, `html`, `cliente`, `representante`, `numeroNF`, datas, `statusAtual`, `statusNome`, `statusCor` (sem objeto `pedido` aninhado)

#### Erro 404 "webhook is not registered" (n8n)

A API da expedicao esta correta; o n8n recusou porque o fluxo de producao nao esta ativo ou o path nao bate.

1. Abra o workflow no n8n que deve receber `atraso_pedido`.
2. **Ative** o workflow (toggle no canto superior direito — tem que ficar verde/ativo).
3. No node **Webhook**, confira: metodo **POST**, path **`atrasonopedido`** (a URL de producao fica `.../webhook/atrasonopedido`).
4. Salve e publique de novo se o n8n pedir.
5. Para testar localmente sem ativar producao, copie a **Test URL** do node Webhook no `.env`: `ATRASO_PEDIDO_WEBHOOK_URL=<url-de-teste-do-n8n>`.

Apos o fluxo externo (n8n, etc.) enviar e-mail e demais acoes, marque o pedido como notificado:

- `POST /api/webhooks/atraso-pedido/confirmar`
- Header `x-webhook-secret: <ATRASO_PEDIDO_WEBHOOK_SECRET>`
- Body: `{ "numeroPedido": "12345" }`

Isso grava `notificacao_atraso_enviada = 1` e evita novo disparo para o mesmo pedido.

### Development (`NODE_ENV=development`)

O job automatico e o POST para o webhook do n8n **nao disparam** em development (evita e-mails acidentais). O log mostra: `Disparo automatico desabilitado em NODE_ENV=development.`

No painel (frontend dev + admin), um modal lista pedidos elegiveis e permite **Disparar manualmente** via `POST /api/dev/atraso-pedido/disparar-manual` (somente `NODE_ENV=development` no backend).

## CI/CD

Workflow: `.github/workflows/backend-ci-cd.yml`

- CI: instala dependencias e executa testes do backend
- CD: em `push` na `main`, builda e publica imagem Docker em `ghcr.io/<owner>/expedicao-backend:latest`

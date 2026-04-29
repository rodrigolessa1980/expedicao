# Backend Expedicao

Backend Node.js simples para cobrir as funcionalidades basicas do frontend, usando MySQL:

- login com `login + senha` (senha em SHA-256)
- recuperacao de senha por token e e-mail (webhook)
- cadastro de usuarios por administrador
- troca de senha feita apenas por administrador
- gestao de status
- cadastro e atualizacao de pedidos

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

## CI/CD

Workflow: `.github/workflows/backend-ci-cd.yml`

- CI: instala dependencias e executa testes do backend
- CD: em `push` na `main`, builda e publica imagem Docker em `ghcr.io/<owner>/expedicao-backend:latest`

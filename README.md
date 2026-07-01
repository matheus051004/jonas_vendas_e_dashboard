# Painel + IA de Vendas

Painel administrativo e agente de IA (texto e áudio) para vender planos de internet via WhatsApp/chat, conectado por webhook.

## Stack

- Node.js / TypeScript / Next.js (App Router) + Material UI
- PostgreSQL (Prisma) + Redis (BullMQ)
- OpenAI via Langchain (modelo, tokens e prompt configuráveis pelo painel)
- Monorepo pnpm workspaces

## Estrutura

```
apps/
  web/      # painel (Next.js) + API routes (CRUDs, webhook de entrada)
  worker/   # processa mensagens da IA e follow-ups (BullMQ)
packages/
  db/       # schema Prisma + client
  shared/   # tipos, filas, settings, agente Langchain (tools, prompt, memória, transcrição)
```

`apps/web` recebe o webhook de entrada, valida e enfileira. `apps/worker` consome a fila, roda o agente e responde via webhook de saída. Os dois compartilham lógica via `packages/shared`.

## Setup

Pré-requisitos: Node 20+, pnpm (via `corepack enable`), Docker.

```bash
cp .env.example .env
# edite ADMIN_USER, ADMIN_PASSWORD, NEXTAUTH_SECRET, INBOUND_WEBHOOK_TOKEN

# symlinks para o Next.js e o worker lerem o .env da raiz
ln -sf ../../.env apps/web/.env
ln -sf ../../.env apps/worker/.env

pnpm install
docker compose up -d        # postgres + redis
pnpm db:migrate              # aplica as migrations
pnpm db:seed                 # 1 origem, 1 cep, 1 plano, Settings default
```

## Rodando em dev

```bash
pnpm dev:web      # http://localhost:3000
pnpm dev:worker   # consome as filas messages/followups
```

Depois do login (usuário/senha do `.env`), configure a **OpenAI API key** e os webhooks de saída/contrato em `/configuracoes`.

## Testando o webhook de entrada

```bash
curl -X POST http://localhost:3000/api/webhooks/inbound \
  -H "Content-Type: application/json" \
  -H "x-webhook-token: SEU_INBOUND_WEBHOOK_TOKEN" \
  -d '{"phone":"5511999999999","type":"text","text":"oi, quero saber sobre planos"}'
```

Payload de áudio: `{"phone": "...", "type": "audio", "audioBase64": "...", "mimeType": "audio/ogg"}`.

## Variáveis de ambiente

Ver `.env.example`. `DATABASE_URL` e `REDIS_URL` apontam pro docker-compose local por padrão. `OPENAI_API_KEY` no `.env` é só fallback de dev — em produção a key fica em `Settings` (tabela editável pelo painel).

## Scripts úteis

- `pnpm build` — build de todos os packages/apps
- `pnpm db:generate` — regenera o Prisma Client após mudar o schema
- `pnpm db:migrate` — cria/aplica uma nova migration

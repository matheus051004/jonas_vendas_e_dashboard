# Painel de Vendas + ponte de IA

Painel administrativo e ponte de webhooks para vender planos de internet via WhatsApp/chat. A **IA roda em um sistema externo**; este projeto recebe mensagens, notifica a IA, expõe tools REST e encaminha respostas ao chat.

## Stack

- Node.js / TypeScript / Next.js (App Router) + Material UI
- PostgreSQL (Prisma) + Redis (BullMQ)
- Monorepo pnpm workspaces

## Estrutura

```
apps/
  web/      # painel (Next.js) + API routes + webhooks + /api/agent/*
  worker/   # persiste mensagens, notifica IA, follow-ups (BullMQ)
packages/
  db/       # schema Prisma + client
  shared/   # tipos, filas, settings, serviços de tools/webhooks
```

`apps/web` recebe o webhook de entrada, valida e enfileira. `apps/worker` salva a mensagem e faz POST em `agentWebhookUrl`. A IA externa usa `/api/agent/*` e `POST /api/webhooks/agent/reply`. Os dois apps compartilham lógica via `packages/shared`.

## Setup

Pré-requisitos: Node 20+, pnpm (via `corepack enable`), Postgres e Redis.

```bash
cp .env.example .env
# edite DATABASE_URL, REDIS_URL
# e ADMIN_USER, ADMIN_PASSWORD, NEXTAUTH_SECRET, INBOUND_WEBHOOK_TOKEN, AGENT_API_TOKEN

ln -sf ../../.env apps/web/.env
ln -sf ../../.env apps/worker/.env

pnpm install
pnpm db:migrate
pnpm db:seed
```

## Rodando em dev

```bash
pnpm dev:web      # http://localhost:3000
pnpm dev:worker   # consome as filas messages/followups
```

Depois do login, em `/configuracoes` configure:
- **Prompt da IA** — instruções do sistema e regras para o agente (acessível via `GET /api/agent/prompt`)
- **agentWebhookUrl** — URL do seu sistema de IA (recebe `message.inbound` / `followup.due`)
- **outboundWebhookUrl** — URL do app de chat (entrega a resposta ao lead)
- **contractWebhookUrl** — notificação de venda fechada

Documentação completa dos endpoints: `/documentacao` no painel.

## Testando o webhook de entrada

```bash
curl -X POST http://localhost:3000/api/webhooks/inbound \
  -H "Content-Type: application/json" \
  -H "x-webhook-token: SEU_INBOUND_WEBHOOK_TOKEN" \
  -d '{"phone":"5511999999999","type":"text","text":"oi, quero saber sobre planos"}'
```

Resposta da IA:

```bash
curl -X POST http://localhost:3000/api/webhooks/agent/reply \
  -H "Content-Type: application/json" \
  -H "x-webhook-token: SEU_AGENT_API_TOKEN" \
  -d '{"phone":"5511999999999","text":"Olá! Como posso ajudar?"}'
```

## Variáveis de ambiente

Ver `.env.example`. Tokens: `INBOUND_WEBHOOK_TOKEN` (chat), `AGENT_API_TOKEN` (IA externa; se vazio, reutiliza o inbound).

## Scripts úteis

- `pnpm build` — build de todos os packages/apps
- `pnpm db:generate` — regenera o Prisma Client após mudar o schema
- `pnpm db:migrate` — cria/aplica uma nova migration

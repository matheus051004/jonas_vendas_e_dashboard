# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## O que é

Painel administrativo + ponte de webhooks para venda de planos de internet via WhatsApp/chat. A **IA roda em um sistema externo**: este monorepo recebe mensagens do chat, notifica a IA, expõe tools REST e encaminha respostas de volta ao chat. Monorepo pnpm.

## Comandos

Setup inicial:
```bash
cp .env.example .env   # DATABASE_URL, REDIS_URL, ADMIN_*, NEXTAUTH_SECRET, INBOUND_WEBHOOK_TOKEN, AGENT_API_TOKEN
ln -sf ../../.env apps/web/.env
ln -sf ../../.env apps/worker/.env
pnpm install
pnpm db:migrate
pnpm db:seed
```

Dev (dois processos, rodar em paralelo):
```bash
pnpm dev:web      # Next.js em http://localhost:3000
pnpm dev:worker   # consome as filas messages/followups (tsx watch)
```

Build: `pnpm build` (builda db → shared → web → worker, nessa ordem — `shared` depende de `db`, `web`/`worker` dependem de ambos).

Banco:
- `pnpm db:generate` — regenera Prisma Client após mudar `packages/db/prisma/schema.prisma`
- `pnpm db:migrate` — cria/aplica migration (`prisma migrate dev`)
- `pnpm db:seed` — popula 1 origem, 1 área, 1 plano, Settings default

Não há suíte de testes nem lint configurados no momento além do `next lint` padrão em `apps/web`.

Testar webhook de entrada:
```bash
curl -X POST http://localhost:3000/api/webhooks/inbound \
  -H "Content-Type: application/json" \
  -H "x-webhook-token: SEU_INBOUND_WEBHOOK_TOKEN" \
  -d '{"phone":"5511999999999","type":"text","text":"oi, quero saber sobre planos","metadata":{"conversationId":"abc"}}'
```

Payload de áudio: `{"phone": "...", "type": "audio", "audioBase64": "...", "mimeType": "audio/ogg", "transcription": "texto...", "metadata": {...}}` — aceita `transcription` (ou `text`) para salvar e exibir a transcrição no painel e repassar à IA externa. O áudio original fica salvo e disponível no player do painel.

Resposta da IA:
```bash
curl -X POST http://localhost:3000/api/webhooks/agent/reply \
  -H "Content-Type: application/json" \
  -H "x-webhook-token: SEU_AGENT_API_TOKEN" \
  -d '{"phone":"5511999999999","text":"Olá! Como posso ajudar?"}'
```

## Arquitetura

```
apps/
  web/      # Next.js App Router: painel + API routes + webhooks + /api/agent/*
  worker/   # BullMQ: persiste inbound, notifica IA, agenda follow-ups
packages/
  db/       # schema Prisma + client (@jonas/db)
  shared/   # tipos, filas, settings, serviços de tools/webhooks (@jonas/shared)
```

`apps/web` e `apps/worker` só se falam via Redis (BullMQ) e banco. Lógica compartilhada vive em `packages/shared`.

### Fluxo de uma mensagem

1. Chat externo: `POST /api/webhooks/inbound` com `x-webhook-token` = `INBOUND_WEBHOOK_TOKEN` (público no middleware).
2. Valida `InboundWebhookSchema` e enfileira na fila `messages`.
3. Worker: upsert `Client` por telefone, salva `Message` user (áudio: content `"[áudio]"` + bytes), cancela follow-up pendente, `POST agentWebhookUrl` com `event: "message.inbound"` (client, history, text/áudio, metadata).
4. IA externa chama `/api/agent/*` (tools) e `POST /api/webhooks/agent/reply` com a resposta.
5. Reply: salva `Message` assistant e `POST outboundWebhookUrl` (chat), com HMAC se houver secret.
6. Follow-ups (1h/2h/3h): job na fila `followups` envia `event: "followup.due"` ao agentWebhookUrl (sem texto fixo). Na 3ª tentativa sem inbound, `stage = DESISTIU`. Job id `followup:<phone>` (reagendar substitui).

### API do agente (`/api/agent/*`)

Auth: `x-webhook-token` = `AGENT_API_TOKEN` (fallback `INBOUND_WEBHOOK_TOKEN`). Rotas:

| Método | Path | Função |
|--------|------|--------|
| GET | `/api/agent/prompt` | getAiPrompt (aceita `?type=voice` ou `?type=text`; padrão retorna todos os prompts) |
| GET | `/api/agent/prompt/voice` | getVoiceAiPrompt (prompt da IA de voz para prospecção) |
| GET | `/api/agent/prompt/text` | getTextAiPrompt (prompt da IA de texto para prospecção/fallback) |
| GET | `/api/agent/clients/:phone` | contexto do lead |
| GET | `/api/agent/clients/:phone/messages` | histórico |
| PATCH | `/api/agent/clients/:phone` | updateClient |
| POST | `/api/agent/clients/:phone/stage` | setStage |
| POST | `/api/agent/clients/:phone/contract` | registerContract PF (gera contrato no Hubsoft e dispara webhook; NÃO marca FECHOU_VENDA) |
| POST | `/api/agent/clients/:phone/contract-pj` | registerContract PJ (gera contrato no Hubsoft e dispara webhook; NÃO marca FECHOU_VENDA) |
| POST | `/api/agent/clients/:phone/contract-signed` | confirmContractSigned (chamar quando o lead assinar o contrato -> marca FECHOU_VENDA) |
| GET | `/api/agent/origins` | listOrigins |
| GET | `/api/agent/due-dates` | listDueDates (dias de vencimento 1-31 e seus IDs no Hubsoft) |
| GET | `/api/agent/areas` | listAreas |
| GET | `/api/agent/areas/:areaId/plans` | listPlansByArea |
| GET | `/api/agent/plans/:planId` | getPlanDetails (detalhes completos do plano + imageUrl) |
| POST | `/api/agent/clients/:phone/pause-followup` | pauseFollowUp (pausa follow-up do lead até que ele mande nova mensagem) |

Serviços em `packages/shared/src/agent-services.ts`.

### Módulo de Prospecção Ativa (Voz e Texto)

- **Importação de Planilha**: Leitura de `.xlsx` (ex: `ceilandia.xlsx`) onde coluna K (11) = telefone principal normalizado com DDI 55, coluna A = Razão Social com extração de CNPJ para `rawDocument`, e colunas C a J = endereço. Duplicados são ignorados no upload.
- **Fila BullMQ (`prospecting`)**: Concorrência 1 (`concurrency: 1`) e `lockDuration: 180s`.
- **Criação Prévia do Cliente**: Antes de disparar a chamada, o lead é registrado/atualizado na tabela `Client` (estágio `NOVO_LEAD`), permitindo que a IA consuma ferramentas de venda e registre contrato durante a conversa.
- **Ciclo de Ligação e Fallback**:
  1. Worker assina o canal Redis Pub/Sub `prospect:call-result:<phone>` e envia POST para `prospectingWebhookUrl` com `action: "VOICE"`.
  2. Provedor de telefonia notifica o resultado em `POST /api/webhooks/prospeccao/callback` (`{ phone: "55...", answered: true/false }`).
  3. Se `answered == true`: marca `status = ATENDEU` e conclui.
  4. Se `answered == false` ou timeout de 120s: marca `status = NAO_ATENDEU`, envia POST para `prospectingWebhookUrl` com `action: "TEXT"` (*fire-and-forget*), atualiza para `TEXTO_ENVIADO` e libera o próximo lead imediatamente.
- **Endpoints de Controle**:
  - `GET /api/prospeccao` (listagem paginada + métricas)
  - `POST /api/prospeccao` (criação manual de lead)
  - `DELETE /api/prospeccao` (exclusão em lote `{ ids: [...] }`)
  - `POST /api/prospeccao/import` (upload de arquivo XLSX)
  - `POST /api/prospeccao/start` (iniciar campanha para todos os pendentes ou seleção)
  - `POST /api/prospeccao/pause` (pausar campanha)

### Settings

Linha única `Settings` (`id = "default"`): branding + `aiPrompt` + `agentWebhookUrl`, `outboundWebhookUrl`, `contractWebhookUrl`, `outboundWebhookSecret` + `followUpStartTime`/`followUpEndTime` (janela de follow-up em horário de SP). Cache 30s em `packages/shared/src/settings.ts`.

### Autenticação do painel

`ADMIN_USER`/`ADMIN_PASSWORD`, JWT em cookie (`middleware.ts`). Paths sem sessão: `/login`, `/api/branding`, `/api/webhooks/*`, `/api/agent/*`.

### Stack por pacote

- `apps/web`: Next.js 15 + MUI v6 + DataGrid + dnd + zod
- `apps/worker`: Node standalone (`tsx` / `tsc`)
- `packages/db`: Prisma
- `packages/shared`: bullmq, ioredis, zod (sem Langchain/OpenAI)

Import: `@jonas/db` e `@jonas/shared` (workspace). Preferir dados via `shared` quando já expostos.



## Post-change review

After completing any relevant code changes and before reporting the task as finished, delegate a subagent to review the resulting diff using the `ponytail-review` skill. Review for security implications, correctness, best practices, unnecessary duplication, and modularity. Resolve verified findings before finalizing.
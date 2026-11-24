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
pnpm dev          # sobe web e worker em paralelo
pnpm dev:web      # Next.js em http://localhost:3000
pnpm dev:worker   # consome as filas messages, followups e prospecting (tsx watch)
```

Build: `pnpm build` (builda db → shared → web → worker, nessa ordem — `shared` depende de `db`, `web`/`worker` dependem de ambos).

Banco (`scripts/db.sh` carrega `.env` da raiz e cria symlink em `packages/db/.env` se necessário):
- `pnpm db:generate` — regenera Prisma Client após mudar `packages/db/prisma/schema.prisma`
- `pnpm db:migrate` — cria/aplica migration (`prisma migrate dev`)
- `pnpm db:push` — sincroniza schema sem migration (`prisma db push`)
- `pnpm db:seed` — popula 1 origem, 1 área, 1 plano, Settings default

Não há suíte de testes configurada; lint disponível via `pnpm --filter web lint` (`next lint`).

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
3. Worker: upsert `Client` por telefone, salva `Message` user (áudio: transcrição ou `"[áudio]"` + bytes), cancela follow-up pendente, zera `followUpCount`/`followUpPaused` (e move `PAROU_DE_RESPONDER` → `INTERESSADO`), faz `POST agentWebhookUrl` com `event: "message.inbound"` (`client`, `history`, `text`/áudio, `metadata`) e agenda a 1ª tentativa de follow-up (se não estiver em `FECHOU_VENDA`, `DESISTIU` ou `ACHOU_CARO`).
4. IA externa chama `/api/agent/*` (tools) e `POST /api/webhooks/agent/reply` com a resposta.
5. Reply: salva `Message` assistant e `POST outboundWebhookUrl` (chat), com HMAC se houver secret.
6. Follow-ups (intervalos configuráveis em `Settings.followUpIntervals`, padrão `[60, 120, 180]` min): job na fila `followups` envia `event: "followup.due"` ao `agentWebhookUrl` (sem texto fixo) dentro da janela de horário de SP. Ignorado se `followUpPaused` ou estágio `FECHOU_VENDA`/`DESISTIU`/`ACHOU_CARO`. Na última tentativa sem inbound, mantém `stage = PAROU_DE_RESPONDER`. Job id `followup-<phone>` (reagendar substitui).

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
| POST | `/api/agent/clients/:phone/contract` | registerContract PF (alias: `/contract-pf`; gera contrato no Hubsoft e dispara webhook; NÃO marca FECHOU_VENDA) |
| POST | `/api/agent/clients/:phone/contract-pj` | registerContract PJ (gera contrato no Hubsoft e dispara webhook; NÃO marca FECHOU_VENDA) |
| POST | `/api/agent/clients/:phone/contract-signed` | confirmContractSigned (alias: `/confirm-signature`; chamar quando o lead assinar o contrato -> marca FECHOU_VENDA) |
| GET | `/api/agent/origins` | listOrigins |
| GET | `/api/agent/due-dates` | listDueDates (alias: `/api/agent/vencimentos`; dias de vencimento 1-31 e seus IDs no Hubsoft) |
| GET | `/api/agent/areas` | listAreas |
| GET | `/api/agent/areas/:areaId/plans` | listPlansByArea |
| GET | `/api/agent/plans/:planId` | getPlanDetails (detalhes completos do plano + imageUrl) |
| POST | `/api/agent/clients/:phone/pause-followup` | pauseFollowUp (pausa follow-up do lead até que ele mande nova mensagem) |

Serviços em `packages/shared/src/agent-services.ts`.

### Módulo de Prospecção Ativa (ElevenLabs SIP Trunk + Fallback de Texto)

- **Importação de Planilha**: Leitura de `.xlsx` (ex: `ceilandia.xlsx`) onde coluna K (11) = telefone principal normalizado com DDI 55, coluna A = Razão Social com extração de CNPJ para `rawDocument`, e colunas C a J = endereço. Duplicados são ignorados no upload.
- **Fila BullMQ (`prospecting`)**: Concorrência 1 (`concurrency: 1`) e `lockDuration: 300s`.
- **Criação Prévia do Cliente**: Antes de disparar a chamada, o lead é registrado/atualizado na tabela `Client` (estágio `NOVO_LEAD`), permitindo que a IA consuma ferramentas `/api/agent/*` e registre contrato durante a conversa.
- **Ciclo de Ligação (ElevenLabs Agents SIP Trunk) e Fallback**:
  1. Worker assina o canal Redis Pub/Sub `prospect:call-result:<leadId>` e chama `POST https://api.elevenlabs.io/v1/convai/sip-trunk/outbound-call` com `dynamic_variables` do lead e `conversation_config_override` (`voiceAiPrompt`, `voiceFirstMessage`).
  2. ElevenLabs envia o resultado assinado (`ElevenLabs-Signature` HMAC-SHA256) para `POST /api/webhooks/elevenlabs`.
  3. Se `post_call_transcription` com atendimento: salva a transcrição na tabela `Message` do cliente, grava duração/resumo no `ProspectLead` e marca `status = ATENDEU`.
  4. Se `call_initiation_failure`, chamada sem atendimento ou timeout (15 min): marca `status = NAO_ATENDEU` e, caso `prospectingTextWebhookUrl` esteja configurada, envia POST com `action: "TEXT"` (*fire-and-forget*), atualizando para `TEXTO_ENVIADO` antes de liberar o próximo lead.
- **Endpoints de Controle**:
  - `GET /api/prospeccao` (listagem paginada + métricas)
  - `POST /api/prospeccao` (criação manual de lead)
  - `DELETE /api/prospeccao` (exclusão em lote `{ ids: [...] }`)
  - `GET / PATCH / DELETE /api/prospeccao/:id` (consulta, edição e exclusão individual de lead)
  - `POST /api/prospeccao/import` (upload de arquivo XLSX)
  - `POST /api/prospeccao/start` (iniciar campanha para todos os pendentes ou seleção)
  - `POST /api/prospeccao/pause` (pausar campanha)

### Settings

Linha única `Settings` (`id = "default"`): branding + prompts (`aiPrompt`, `voiceAiPrompt`, `voiceFirstMessage`, `textAiPrompt`) + ElevenLabs (`elevenLabsApiKey`, `elevenLabsAgentId`, `elevenLabsPhoneNumberId`, `elevenLabsWebhookSecret`) + webhooks (`agentWebhookUrl`, `outboundWebhookUrl`, `contractWebhookUrl`, `prospectingTextWebhookUrl`, `outboundWebhookSecret`) + follow-up (`followUpStartTime`, `followUpEndTime` em horário de SP, `followUpIntervals`) + padrões Hubsoft (`hubsoftBaseUrl`, `hubsoftVendedorId`, `hubsoftMotivoContratacaoId`, `hubsoftGruposClienteIds`, `hubsoftGruposServicoIds`, `hubsoftServicoStatusId`) + `isProspectingActive`. Cache 30s em `packages/shared/src/settings.ts`.

### Autenticação do painel

`ADMIN_USER`/`ADMIN_PASSWORD`, JWT em cookie (`middleware.ts`). Paths sem sessão: `/login`, `/api/branding`, `/api/webhooks/*`, `/api/agent/*`, e `GET /api/uploads/*`.

### Stack por pacote

- `apps/web`: Next.js 15 (React 19) + MUI v6 + DataGrid v7 + `@hello-pangea/dnd` + `zod` + `jose`
- `apps/worker`: Node standalone (`tsx` / `tsc`) + `bullmq`
- `packages/db`: Prisma v6
- `packages/shared`: `bullmq`, `ioredis`, `zod`, `xlsx` (sem Langchain/OpenAI)

Import: `@jonas/db` e `@jonas/shared` (workspace). Preferir dados via `shared` quando já expostos.



## Post-change review

After completing any relevant code changes and before reporting the task as finished, delegate a subagent to review the resulting diff using the `ponytail-review` skill. Review for security implications, correctness, best practices, unnecessary duplication, and modularity. Resolve verified findings before finalizing.
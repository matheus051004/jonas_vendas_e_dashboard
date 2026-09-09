"use client";

import * as React from "react";
import {
  Alert,
  Box,
  Chip,
  Divider,
  IconButton,
  Paper,
  Snackbar,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tooltip,
  Typography,
} from "@mui/material";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import LockOutlinedIcon from "@mui/icons-material/LockOutlined";
import PublicIcon from "@mui/icons-material/Public";
import CallReceivedIcon from "@mui/icons-material/CallReceived";
import CallMadeIcon from "@mui/icons-material/CallMade";
import DescriptionOutlinedIcon from "@mui/icons-material/DescriptionOutlined";
import SmartToyOutlinedIcon from "@mui/icons-material/SmartToyOutlined";

function MethodChip({ method }: { method: string }) {
  const color =
    method === "GET"
      ? "info"
      : method === "POST"
        ? "success"
        : method === "PATCH"
          ? "warning"
          : method === "DELETE"
            ? "error"
            : "default";
  return (
    <Chip
      size="small"
      label={method}
      color={color}
      variant="filled"
      sx={{ fontWeight: 700, fontFamily: "monospace", minWidth: 64 }}
    />
  );
}

function AuthChip({ kind }: { kind: "public" | "token" | "session" }) {
  if (kind === "public") return <Chip size="small" icon={<PublicIcon />} label="Público" variant="outlined" />;
  if (kind === "token")
    return <Chip size="small" icon={<LockOutlinedIcon />} label="x-webhook-token" color="warning" variant="outlined" />;
  return <Chip size="small" icon={<LockOutlinedIcon />} label="Sessão (cookie)" color="primary" variant="outlined" />;
}

function CodeBlock({ code, language = "json" }: { code: string; language?: string }) {
  const [copied, setCopied] = React.useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
    } catch {
      /* ignore */
    }
  }

  return (
    <Box sx={{ position: "relative" }}>
      <Box
        component="pre"
        sx={{
          m: 0,
          p: 2,
          pr: 6,
          borderRadius: 1,
          bgcolor: "grey.900",
          color: "grey.100",
          overflow: "auto",
          fontSize: 13,
          lineHeight: 1.55,
          fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace',
        }}
      >
        <Box component="code" sx={{ whiteSpace: "pre" }}>
          {code}
        </Box>
      </Box>
      <Tooltip title={copied ? "Copiado" : `Copiar ${language}`}>
        <IconButton
          size="small"
          onClick={() => void copy()}
          aria-label="Copiar código"
          sx={{
            position: "absolute",
            top: 8,
            right: 8,
            color: "grey.300",
            bgcolor: "rgba(255,255,255,0.06)",
            "&:hover": { bgcolor: "rgba(255,255,255,0.12)" },
          }}
        >
          <ContentCopyIcon fontSize="small" />
        </IconButton>
      </Tooltip>
      <Snackbar open={copied} autoHideDuration={1500} onClose={() => setCopied(false)} message="Copiado" />
    </Box>
  );
}

function Section({
  id,
  icon,
  title,
  description,
  children,
}: {
  id: string;
  icon: React.ReactNode;
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <Paper id={id} variant="outlined" sx={{ p: { xs: 2.5, sm: 3 }, scrollMarginTop: 88 }}>
      <Stack spacing={2.5}>
        <Box>
          <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.5 }}>
            <Box sx={{ color: "primary.main", display: "flex" }}>{icon}</Box>
            <Typography variant="h6" component="h2">
              {title}
            </Typography>
          </Stack>
          {description ? (
            <Typography variant="body2" color="text.secondary">
              {description}
            </Typography>
          ) : null}
        </Box>
        {children}
      </Stack>
    </Paper>
  );
}

function FieldTable({
  rows,
}: {
  rows: { name: string; type: string; required: string; description: string }[];
}) {
  return (
    <TableContainer>
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell>Campo</TableCell>
            <TableCell>Tipo</TableCell>
            <TableCell>Obrigatório</TableCell>
            <TableCell>Descrição</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.name}>
              <TableCell sx={{ fontFamily: "monospace", whiteSpace: "nowrap" }}>{row.name}</TableCell>
              <TableCell sx={{ fontFamily: "monospace", color: "text.secondary" }}>{row.type}</TableCell>
              <TableCell>{row.required}</TableCell>
              <TableCell>{row.description}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
}

function EndpointHeader({
  method,
  path,
  auth,
}: {
  method: string;
  path: string;
  auth: "public" | "token" | "session";
}) {
  return (
    <Stack
      direction={{ xs: "column", sm: "row" }}
      spacing={1.5}
      alignItems={{ sm: "center" }}
      justifyContent="space-between"
      sx={{
        p: 1.5,
        borderRadius: 1,
        bgcolor: "action.hover",
        border: "1px solid",
        borderColor: "divider",
      }}
    >
      <Stack direction="row" spacing={1.5} alignItems="center" flexWrap="wrap" useFlexGap>
        <MethodChip method={method} />
        <Typography component="code" sx={{ fontFamily: "monospace", fontSize: 14, fontWeight: 600 }}>
          {path}
        </Typography>
      </Stack>
      <AuthChip kind={auth} />
    </Stack>
  );
}

function ToolDetailCard({
  title,
  method,
  path,
  description,
  fields,
  curlCode,
  responseCode,
}: {
  title: string;
  method: string;
  path: string;
  description: string;
  fields?: { name: string; type: string; required: string; description: string }[];
  curlCode: string;
  responseCode: string;
}) {
  return (
    <Paper
      variant="outlined"
      sx={{
        p: { xs: 2, sm: 2.5 },
        bgcolor: "background.paper",
        borderRadius: 2,
        border: "1px solid",
        borderColor: "divider",
      }}
    >
      <Stack spacing={2}>
        <Box>
          <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 0.5 }}>
            {title}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {description}
          </Typography>
        </Box>

        <EndpointHeader method={method} path={path} auth="token" />

        {fields && fields.length > 0 && (
          <Box>
            <Typography
              variant="caption"
              fontWeight={700}
              color="text.secondary"
              sx={{ textTransform: "uppercase", letterSpacing: 0.5, display: "block", mb: 1 }}
            >
              Parâmetros & Body
            </Typography>
            <FieldTable rows={fields} />
          </Box>
        )}

        <Box>
          <Typography
            variant="caption"
            fontWeight={700}
            color="text.secondary"
            sx={{ textTransform: "uppercase", letterSpacing: 0.5, display: "block", mb: 1 }}
          >
            Exemplo de Requisição (cURL)
          </Typography>
          <CodeBlock language="bash" code={curlCode} />
        </Box>

        <Box>
          <Typography
            variant="caption"
            fontWeight={700}
            color="text.secondary"
            sx={{ textTransform: "uppercase", letterSpacing: 0.5, display: "block", mb: 1 }}
          >
            Exemplo de Resposta (200 OK)
          </Typography>
          <CodeBlock language="json" code={responseCode} />
        </Box>
      </Stack>
    </Paper>
  );
}

const TOC = [
  { id: "fluxo", label: "Fluxo geral" },
  { id: "auth", label: "Autenticação" },
  { id: "inbound", label: "Webhook de entrada (chat)" },
  { id: "agent-events", label: "Eventos → IA externa" },
  { id: "agent-reply", label: "Resposta da IA" },
  { id: "agent-api", label: "API / tools do agente" },
  { id: "outbound", label: "Webhook de saída (chat)" },
  { id: "contract", label: "Webhook de contrato" },
  { id: "hmac", label: "Assinatura HMAC" },
  { id: "api", label: "API do painel" },
];

export default function DocumentacaoPage() {
  const [origin, setOrigin] = React.useState("https://seu-dominio.com");

  React.useEffect(() => {
    if (typeof window !== "undefined") setOrigin(window.location.origin);
  }, []);

  const inboundUrl = `${origin}/api/webhooks/inbound`;
  const agentReplyUrl = `${origin}/api/webhooks/agent/reply`;

  return (
    <Stack spacing={3} sx={{ maxWidth: 960, mx: "auto" }}>
      <Box>
        <Typography variant="h4" component="h1" gutterBottom>
          Documentação
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Integração com o app de chat e com o sistema de IA externo (webhooks + tools REST).
        </Typography>
      </Box>

      <Paper variant="outlined" sx={{ p: 2 }}>
        <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1.5 }}>
          Nesta página
        </Typography>
        <Stack direction="row" flexWrap="wrap" useFlexGap spacing={1}>
          {TOC.map((item) => (
            <Chip
              key={item.id}
              label={item.label}
              component="a"
              href={`#${item.id}`}
              clickable
              variant="outlined"
              size="small"
            />
          ))}
        </Stack>
      </Paper>

      <Section
        id="fluxo"
        icon={<DescriptionOutlinedIcon />}
        title="Fluxo geral"
        description="Este sistema não roda a IA localmente — notifica o sistema externo e expõe tools/reply."
      >
        <Alert severity="info" variant="outlined">
          O chat envia mensagens para o webhook de <strong>entrada</strong>. O worker salva o lead/mensagem e faz POST
          em <strong>agentWebhookUrl</strong>. A IA externa usa a <strong>API do agente</strong> (tools) e responde via{" "}
          <strong>/api/webhooks/agent/reply</strong>, que grava a mensagem e envia ao <strong>outboundWebhookUrl</strong>{" "}
          (chat).
        </Alert>
        <CodeBlock
          language="text"
          code={`App de chat
    │  POST /api/webhooks/inbound  (INBOUND_WEBHOOK_TOKEN)
    ▼
Painel → fila Redis "messages"
    ▼
Worker  → salva Message (user)
        → POST agentWebhookUrl  { event: "message.inbound", client, history, ... }
              │
              ▼
        Sistema de IA externo
              ├─ GET/PATCH /api/agent/*  (tools)
              └─ POST /api/webhooks/agent/reply  { phone, text }
                    │
                    ▼
              salva Message (assistant) → POST outboundWebhookUrl (chat)

Follow-ups (1h/2h/3h): POST agentWebhookUrl { event: "followup.due", attempt }
Contrato: POST contractWebhookUrl ao registrar via API do agente`}
        />
      </Section>

      <Section
        id="auth"
        icon={<LockOutlinedIcon />}
        title="Autenticação"
        description="Token de webhook/agente vs sessão do painel."
      >
        <Stack spacing={2}>
          <Box>
            <Typography variant="subtitle1" gutterBottom>
              Chat → este sistema (inbound)
            </Typography>
            <Typography variant="body2" color="text.secondary" paragraph>
              Header <code>x-webhook-token</code> = <code>INBOUND_WEBHOOK_TOKEN</code> no .env.
            </Typography>
          </Box>
          <Divider />
          <Box>
            <Typography variant="subtitle1" gutterBottom>
              IA externa → este sistema (tools + reply)
            </Typography>
            <Typography variant="body2" color="text.secondary" paragraph>
              Header <code>x-webhook-token</code> = <code>AGENT_API_TOKEN</code>. Se vazio, usa{" "}
              <code>INBOUND_WEBHOOK_TOKEN</code> como fallback.
            </Typography>
          </Box>
          <Divider />
          <Box>
            <Typography variant="subtitle1" gutterBottom>
              Este sistema → IA / chat / contrato
            </Typography>
            <Typography variant="body2" color="text.secondary" paragraph>
              URLs em Configurações. Se houver secret, envia <code>x-webhook-signature</code> (HMAC-SHA256).
            </Typography>
          </Box>
          <Divider />
          <Box>
            <Typography variant="subtitle1" gutterBottom>
              API do painel
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Sessão JWT (cookie) após login com <code>ADMIN_USER</code> / <code>ADMIN_PASSWORD</code>.
            </Typography>
          </Box>
        </Stack>
      </Section>

      <Section
        id="inbound"
        icon={<CallReceivedIcon />}
        title="Webhook de entrada (chat)"
        description="O app de chat chama este endpoint quando o lead envia texto ou áudio."
      >
        <EndpointHeader method="POST" path="/api/webhooks/inbound" auth="token" />

        <Stack spacing={1}>
          <Typography variant="subtitle2">URL completa (ambiente atual)</Typography>
          <CodeBlock language="text" code={inboundUrl} />
        </Stack>

        <Box>
          <Typography variant="subtitle2" gutterBottom>
            Headers
          </Typography>
          <FieldTable
            rows={[
              {
                name: "Content-Type",
                type: "string",
                required: "Sim",
                description: "application/json",
              },
              {
                name: "x-webhook-token",
                type: "string",
                required: "Sim",
                description: "Igual a INBOUND_WEBHOOK_TOKEN",
              },
            ]}
          />
        </Box>

        <Box>
          <Typography variant="subtitle2" gutterBottom>
            Body (JSON)
          </Typography>
          <FieldTable
            rows={[
              {
                name: "phone",
                type: "string",
                required: "Sim",
                description: "Telefone do lead (chave do cliente)",
              },
              {
                name: "type",
                type: '"text" | "audio"',
                required: "Sim",
                description: "Tipo da mensagem",
              },
              {
                name: "text",
                type: "string",
                required: "Se type=text (opcional com type=audio)",
                description: "Conteúdo em texto ou transcrição",
              },
              {
                name: "transcription",
                type: "string",
                required: "Não",
                description: "Texto transcrito do áudio (exibido abaixo do player e repassado à IA)",
              },
              {
                name: "audioBase64",
                type: "string",
                required: "Se type=audio (ou informe transcription/text)",
                description: "Áudio em Base64 — salvo para reprodução no painel e repassado à IA",
              },
              {
                name: "mimeType",
                type: "string",
                required: "Não",
                description: 'MIME do áudio, ex. "audio/ogg"',
              },
              {
                name: "metadata",
                type: "object",
                required: "Não",
                description: "Metadados opacos (conversationId etc.), ecoados nos webhooks",
              },
            ]}
          />
        </Box>

        <CodeBlock
          language="bash"
          code={`# Exemplo 1: Mensagem de Texto
curl -X POST ${inboundUrl} \\
  -H "Content-Type: application/json" \\
  -H "x-webhook-token: SEU_INBOUND_WEBHOOK_TOKEN" \\
  -d '{
    "phone": "5511999999999",
    "type": "text",
    "text": "oi, quero saber sobre planos",
    "metadata": { "conversationId": "abc-123" }
  }'

# Exemplo 2: Mensagem de Áudio com Transcrição
curl -X POST ${inboundUrl} \\
  -H "Content-Type: application/json" \\
  -H "x-webhook-token: SEU_INBOUND_WEBHOOK_TOKEN" \\
  -d '{
    "phone": "5511999999999",
    "type": "audio",
    "audioBase64": "GkXfo59ChoEBQveBAULygQ8taz44AA...",
    "mimeType": "audio/ogg",
    "transcription": "Olá, queria saber sobre os planos de internet",
    "metadata": { "conversationId": "abc-123" }
  }'`}
        />

        <Alert severity="warning" variant="outlined">
          Resposta 200 só confirma enfileiramento. A IA externa recebe o evento de forma assíncrona.
        </Alert>
      </Section>

      <Section
        id="agent-events"
        icon={<CallMadeIcon />}
        title="Eventos → sistema de IA (agentWebhookUrl)"
        description="O worker faz POST na URL configurada em Configurações."
      >
        <EndpointHeader method="POST" path="{agentWebhookUrl}" auth="public" />

        <Typography variant="body2" color="text.secondary">
          Se a URL estiver vazia, o job falha (retry BullMQ) para o operador perceber a config faltando. Opcionalmente
          assina com o mesmo secret dos outros webhooks de saída.
        </Typography>

        <Typography variant="subtitle2">event: message.inbound</Typography>
        <CodeBlock
          language="json"
          code={`{
  "event": "message.inbound",
  "phone": "5511999999999",
  "clientId": "clx...",
  "type": "text",
  "text": "oi, quero saber sobre planos",
  "metadata": { "conversationId": "abc-123" },
  "client": { "id": "...", "phone": "...", "name": null, "stage": "NOVO_LEAD", "...": "..." },
  "history": [
    { "role": "user", "content": "oi", "kind": "text", "createdAt": "2026-07-16T12:00:00.000Z" }
  ]
}`}
        />

        <Typography variant="subtitle2">event: followup.due</Typography>
        <CodeBlock
          language="json"
          code={`{
  "event": "followup.due",
  "phone": "5511999999999",
  "clientId": "clx...",
  "attempt": 1,
  "metadata": { "conversationId": "abc-123" },
  "client": { "id": "...", "stage": "INTERESSADO", "followUpCount": 1 }
}`}
        />
        <Typography variant="body2" color="text.secondary">
          Ao disparar o follow-up, o worker marca <code>stage = PAROU_DE_RESPONDER</code> automaticamente. Se o lead
          responder a qualquer momento, o sistema o reativa para <code>INTERESSADO</code>. A IA deve chamar agent/reply
          se quiser enviar um nudge ao lead.
        </Typography>
      </Section>

      <Section
        id="agent-reply"
        icon={<SmartToyOutlinedIcon />}
        title="Resposta da IA → lead"
        description="A IA externa envia o texto que o lead deve receber."
      >
        <EndpointHeader method="POST" path="/api/webhooks/agent/reply" auth="token" />
        <CodeBlock language="text" code={agentReplyUrl} />

        <FieldTable
          rows={[
            { name: "phone", type: "string", required: "Sim", description: "Telefone do lead" },
            { name: "text", type: "string", required: "Sim", description: "Mensagem ao lead" },
            {
              name: "metadata",
              type: "object",
              required: "Não",
              description: "Se omitido, usa o metadata salvo no client",
            },
          ]}
        />

        <CodeBlock
          language="bash"
          code={`curl -X POST ${agentReplyUrl} \\
  -H "Content-Type: application/json" \\
  -H "x-webhook-token: SEU_AGENT_API_TOKEN" \\
  -d '{ "phone": "5511999999999", "text": "Oi! Posso te ajudar com os planos." }'`}
        />
      </Section>

      <Section
        id="agent-api"
        icon={<SmartToyOutlinedIcon />}
        title="API / tools do agente"
        description="Endpoints REST que a IA externa consome como ferramentas (tools) durante o atendimento. Todas as requisições exigem o header x-webhook-token (AGENT_API_TOKEN ou INBOUND_WEBHOOK_TOKEN)."
      >
        <Typography variant="subtitle2" gutterBottom>
          Tabela Resumo das Tools
        </Typography>
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Método</TableCell>
                <TableCell>Rota</TableCell>
                <TableCell>Função / Descrição</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {[
                { m: "GET", p: "/api/agent/prompt", d: "Prompt do sistema / persona e instruções de atendimento" },
                { m: "GET", p: "/api/agent/origins", d: "Lista canais de origem ativos (Instagram, Google, etc.)" },
                { m: "GET", p: "/api/agent/areas", d: "Lista áreas de cobertura ativas e observações de taxa" },
                { m: "GET", p: "/api/agent/areas/:areaId/plans", d: "Lista planos de internet disponíveis na área" },
                { m: "GET", p: "/api/agent/clients/:phone", d: "Consulta cadastro completo e contexto do lead" },
                { m: "GET", p: "/api/agent/clients/:phone/messages?limit=30", d: "Consulta histórico recente de mensagens" },
                { m: "PATCH", p: "/api/agent/clients/:phone", d: "Atualiza dados do lead (nome, área, operadora, valor...)" },
                { m: "POST", p: "/api/agent/clients/:phone/stage", d: "Altera a etapa do funil (ex: INTERESSADO, FECHOU_VENDA)" },
                { m: "POST", p: "/api/agent/clients/:phone/contract", d: "Registra contrato no Hubsoft (PF) e dispara webhook" },
                { m: "POST", p: "/api/agent/clients/:phone/contract-pj", d: "Registra contrato no Hubsoft (PJ) e dispara webhook" },
                { m: "POST", p: "/api/agent/clients/:phone/contract-signed", d: "Confirma assinatura do contrato e avança para FECHOU_VENDA" },
              ].map((row) => (
                <TableRow key={`${row.m}-${row.p}`}>
                  <TableCell>
                    <MethodChip method={row.m} />
                  </TableCell>
                  <TableCell sx={{ fontFamily: "monospace", fontSize: 13 }}>{row.p}</TableCell>
                  <TableCell>{row.d}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>

        <Divider sx={{ my: 1 }} />

        <Typography variant="h6" component="h3" sx={{ mt: 1 }}>
          Detalhamento & Exemplos de Cada Ferramenta
        </Typography>

        <Stack spacing={3}>
          {/* 1. Prompt */}
          <ToolDetailCard
            title="1. Obter Prompt da IA (getAiPrompt)"
            method="GET"
            path="/api/agent/prompt"
            description="Retorna as instruções de sistema, persona, tom de voz e regras de negócio configuradas no painel. O agente deve chamar este endpoint para carregar o seu prompt base."
            curlCode={`curl -X GET ${origin}/api/agent/prompt \\
  -H "x-webhook-token: SEU_AGENT_API_TOKEN"`}
            responseCode={`{
  "ok": true,
  "prompt": "Você é o assistente virtual de vendas da empresa. Atenda cordialmente os clientes, tire dúvidas sobre cobertura e planos de internet fibra óptica e colete os dados necessários para fechar a contratação."
}`}
          />

          {/* 2. Origens */}
          <ToolDetailCard
            title="2. Listar Origens Ativas (listOrigins)"
            method="GET"
            path="/api/agent/origins"
            description="Retorna a lista de fontes/canais de aquisição de leads ativas no painel. Útil para identificar por onde o cliente conheceu a empresa (Instagram, Google Ads, Indicação, etc.) e vincular ao lead."
            curlCode={`curl -X GET ${origin}/api/agent/origins \\
  -H "x-webhook-token: SEU_AGENT_API_TOKEN"`}
            responseCode={`{
  "ok": true,
  "origins": [
    {
      "id": "cm7a1bcde0001",
      "name": "Instagram"
    },
    {
      "id": "cm7a2fghi0002",
      "name": "Google Ads"
    },
    {
      "id": "cm7a3jklm0003",
      "name": "Indicação de Amigo"
    },
    {
      "id": "cm7a4nopq0004",
      "name": "Folheto"
    }
  ]
}`}
          />

          {/* 3. Áreas */}
          <ToolDetailCard
            title="3. Listar Áreas de Cobertura (listAreas)"
            method="GET"
            path="/api/agent/areas"
            description="Retorna todas as regiões/bairros/cidades com cobertura ativa e notas informativas de infraestrutura (ex.: isenção de taxa de instalação, prazo de ligação). Permite que o agente valide se o lead está em área atendida."
            curlCode={`curl -X GET ${origin}/api/agent/areas \\
  -H "x-webhook-token: SEU_AGENT_API_TOKEN"`}
            responseCode={`{
  "ok": true,
  "areas": [
    {
      "id": "cm7b1area0001",
      "name": "Palmeiras e Piraputanga",
      "observation": "Taxa de instalação: ISENTO. Fibra subterrânea."
    },
    {
      "id": "cm7b2area0002",
      "name": "Centro e Bairro Alto",
      "observation": "Instalação padrão em até 24 horas úteis."
    }
  ]
}`}
          />

          {/* 4. Planos por Área */}
          <ToolDetailCard
            title="4. Listar Planos por Área (listPlansByArea)"
            method="GET"
            path="/api/agent/areas/:areaId/plans"
            description="Retorna os planos de internet ativos e disponíveis para a área específica identificada para o cliente, contendo nome, valor mensal, meses de fidelidade, descrição das vantagens e o array de pacotes adicionais aceitos por cada plano."
            fields={[
              {
                name: ":areaId",
                type: "string (path)",
                required: "Sim",
                description: "ID da área obtido via GET /api/agent/areas (ex.: cm7b1area0001)",
              },
            ]}
            curlCode={`curl -X GET ${origin}/api/agent/areas/cm7b1area0001/plans \\
  -H "x-webhook-token: SEU_AGENT_API_TOKEN"`}
            responseCode={`{
  "ok": true,
  "areaId": "cm7b1area0001",
  "areaName": "Palmeiras e Piraputanga",
  "observation": "Taxa de instalação: ISENTO",
  "plans": [
    {
      "id": "seed-plan-300",
      "name": "Internet 300 Mega",
      "price": "89.90",
      "priceWithLoyalty": "69.90",
      "loyaltyMonths": 12,
      "description": "300 Mega de download, Wi-Fi 6 incluso, instalação grátis.",
      "packages": [
        {
          "id": "pkg-fixo-ilimitado",
          "name": "Telefone Fixo Ilimitado",
          "price": "19.90",
          "description": "Ligações ilimitadas para fixo e móvel."
        }
      ]
    },
    {
      "id": "seed-plan-600",
      "name": "Internet 600 Mega",
      "price": "119.90",
      "priceWithLoyalty": "99.90",
      "loyaltyMonths": 12,
      "description": "600 Mega ultrarrápido, 2 pontos de Wi-Fi mesh inclusos.",
      "packages": []
    }
  ]
}`}
          />

          {/* 5. Contexto do Lead */}
          <ToolDetailCard
            title="5. Consultar Contexto do Lead (getClientContext)"
            method="GET"
            path="/api/agent/clients/:phone"
            description="Recupera o cadastro completo do lead: etapa do funil, área, origem, provedor atual, valor pago, nota sobre má experiência, metadados e contrato vinculado (se houver)."
            fields={[
              {
                name: ":phone",
                type: "string (path)",
                required: "Sim",
                description: "Telefone do lead no formato internacional/nacional (ex: 5511999999999)",
              },
            ]}
            curlCode={`curl -X GET ${origin}/api/agent/clients/5511999999999 \\
  -H "x-webhook-token: SEU_AGENT_API_TOKEN"`}
            responseCode={`{
  "ok": true,
  "client": {
    "id": "cm7client001",
    "phone": "5511999999999",
    "name": "Carlos Eduardo",
    "stage": "INTERESSADO",
    "areaId": "cm7b1area0001",
    "originId": "cm7a1bcde0001",
    "currentProvider": "Claro",
    "currentPrice": 129.9,
    "hadBadExperience": true,
    "badExperienceNote": "Internet caía muito nos finais de semana",
    "followUpCount": 1,
    "lastInboundAt": "2026-08-30T20:15:00.000Z",
    "metadata": { "conversationId": "whatsapp-conv-123" },
    "createdAt": "2026-08-30T18:00:00.000Z",
    "updatedAt": "2026-08-30T20:15:00.000Z",
    "area": {
      "id": "cm7b1area0001",
      "name": "Palmeiras e Piraputanga",
      "observation": "Taxa de instalação: ISENTO"
    },
    "origin": {
      "id": "cm7a1bcde0001",
      "name": "Instagram"
    },
    "contract": null
  }
}`}
          />

          {/* 6. Histórico de Mensagens */}
          <ToolDetailCard
            title="6. Histórico de Mensagens (listMessages)"
            method="GET"
            path="/api/agent/clients/:phone/messages"
            description="Recupera o histórico cronológico de mensagens trocadas com o cliente. Suporta parâmetro de paginação/limite."
            fields={[
              {
                name: ":phone",
                type: "string (path)",
                required: "Sim",
                description: "Telefone do lead (ex: 5511999999999)",
              },
              {
                name: "limit",
                type: "number (query)",
                required: "Não",
                description: "Quantidade de mensagens a retornar (padrão: 30, ex: ?limit=10)",
              },
            ]}
            curlCode={`curl -X GET "${origin}/api/agent/clients/5511999999999/messages?limit=10" \\
  -H "x-webhook-token: SEU_AGENT_API_TOKEN"`}
            responseCode={`{
  "ok": true,
  "clientId": "cm7client001",
  "messages": [
    {
      "id": "msg_001",
      "role": "user",
      "content": "Olá, quanto custa o plano de 300 mega?",
      "kind": "text",
      "createdAt": "2026-08-30T20:10:00.000Z"
    },
    {
      "id": "msg_002",
      "role": "assistant",
      "content": "Olá Carlos! O plano de 300 Mega sai por R$ 89,90/mês com Wi-Fi 6 e instalação grátis.",
      "kind": "text",
      "createdAt": "2026-08-30T20:10:15.000Z"
    }
  ]
}`}
          />

          {/* 7. Atualizar Lead */}
          <ToolDetailCard
            title="7. Atualizar Dados do Lead (updateClient)"
            method="PATCH"
            path="/api/agent/clients/:phone"
            description="Atualiza gradualmente os dados do lead conforme descobertos no diálogo (nome, área, operadora atual, insatisfação...). Apenas os campos informados no JSON serão atualizados (campos omitidos não são apagados)."
            fields={[
              {
                name: ":phone",
                type: "string (path)",
                required: "Sim",
                description: "Telefone do lead",
              },
              {
                name: "name",
                type: "string (body)",
                required: "Não",
                description: "Nome do lead",
              },
              {
                name: "areaId",
                type: "string (body)",
                required: "Não",
                description: "ID da área identificada na conversa",
              },
              {
                name: "originId",
                type: "string (body)",
                required: "Não",
                description: "ID da origem de captação do lead",
              },
              {
                name: "currentProvider",
                type: "string (body)",
                required: "Não",
                description: "Operadora atual do cliente (ex.: Vivo, Claro, Oi...)",
              },
              {
                name: "currentPrice",
                type: "number (body)",
                required: "Não",
                description: "Valor mensal que o cliente paga atualmente",
              },
              {
                name: "hadBadExperience",
                type: "boolean (body)",
                required: "Não",
                description: "Se teve problemas ou insatisfação com a operadora anterior",
              },
              {
                name: "badExperienceNote",
                type: "string (body)",
                required: "Não",
                description: "Detalhes do problema/reclamação com a operadora anterior",
              },
            ]}
            curlCode={`curl -X PATCH ${origin}/api/agent/clients/5511999999999 \\
  -H "Content-Type: application/json" \\
  -H "x-webhook-token: SEU_AGENT_API_TOKEN" \\
  -d '{
    "name": "Carlos Eduardo",
    "areaId": "cm7b1area0001",
    "currentProvider": "Claro",
    "currentPrice": 129.90,
    "hadBadExperience": true,
    "badExperienceNote": "Internet caía muito nos finais de semana"
  }'`}
            responseCode={`{
  "ok": true,
  "client": {
    "id": "cm7client001",
    "phone": "5511999999999",
    "name": "Carlos Eduardo",
    "stage": "INTERESSADO",
    "areaId": "cm7b1area0001",
    "originId": "cm7a1bcde0001",
    "currentProvider": "Claro",
    "currentPrice": 129.9,
    "hadBadExperience": true,
    "badExperienceNote": "Internet caía muito nos finais de semana",
    "followUpCount": 1,
    "lastInboundAt": "2026-08-30T20:15:00.000Z",
    "metadata": { "conversationId": "whatsapp-conv-123" },
    "createdAt": "2026-08-30T18:00:00.000Z",
    "updatedAt": "2026-08-30T20:16:00.000Z"
  }
}`}
          />

          {/* 8. Alterar Stage */}
          <ToolDetailCard
            title="8. Alterar Etapa do Funil (setStage)"
            method="POST"
            path="/api/agent/clients/:phone/stage"
            description="Move o lead de etapa no Kanban do painel conforme o progresso da negociação."
            fields={[
              {
                name: ":phone",
                type: "string (path)",
                required: "Sim",
                description: "Telefone do lead",
              },
              {
                name: "stage",
                type: "enum (body)",
                required: "Sim",
                description: '"NOVO_LEAD" | "INTERESSADO" | "PAROU_DE_RESPONDER" | "ACHOU_CARO" | "FECHOU_VENDA" | "DESISTIU"',
              },
            ]}
            curlCode={`curl -X POST ${origin}/api/agent/clients/5511999999999/stage \\
  -H "Content-Type: application/json" \\
  -H "x-webhook-token: SEU_AGENT_API_TOKEN" \\
  -d '{
    "stage": "INTERESSADO"
  }'`}
            responseCode={`{
  "ok": true,
  "client": {
    "id": "cm7client001",
    "phone": "5511999999999",
    "stage": "INTERESSADO",
    "updatedAt": "2026-08-30T20:20:00.000Z"
  }
}`}
          />

          {/* 9. Registrar Contrato PF */}
          <ToolDetailCard
            title="9. Registrar Contrato Pessoa Física / CPF (registerContract / registerContractPF)"
            method="POST"
            path="/api/agent/clients/:phone/contract"
            description="Registra os dados completos de Pessoa Física (titular, endereço e plano), cria o contrato diretamente no sistema Hubsoft via API oficial com tipo_pessoa='pf' e dispara o webhook contractWebhookUrl. Nota: o contrato é gerado no Hubsoft, mas o lead NÃO é movido automaticamente para FECHOU_VENDA; após o lead confirmar a assinatura, o agente deve chamar confirmContractSigned."
            fields={[
              {
                name: ":phone",
                type: "string (path)",
                required: "Sim",
                description: "Telefone do lead",
              },
              {
                name: "hubsoftToken",
                type: "string (body)",
                required: "Sim",
                description: "Bearer token de autenticação da API do Hubsoft",
              },
              {
                name: "fullName",
                type: "string (body)",
                required: "Sim",
                description: "Nome completo do titular do contrato",
              },
              {
                name: "cpf",
                type: "string (body)",
                required: "Sim",
                description: "CPF do titular (apenas números ou formatado)",
              },
              {
                name: "phonePrimary",
                type: "string (body)",
                required: "Sim",
                description: "Telefone principal para contato/WhatsApp (apenas números com DDD)",
              },
              {
                name: "phoneSecondary",
                type: "string (body)",
                required: "Não",
                description: "Telefone secundário ou para recados (se omitido, usa o primário)",
              },
              {
                name: "email",
                type: "string (body)",
                required: "Sim",
                description: "E-mail do titular para envio do contrato e faturas",
              },
              {
                name: "gender",
                type: "string (body)",
                required: "Sim",
                description: 'Gênero do titular ("masculino", "feminino", "M" ou "F")',
              },
              {
                name: "rg",
                type: "string (body)",
                required: "Sim",
                description: "Número do RG do titular",
              },
              {
                name: "rgEmissor",
                type: "string (body)",
                required: "Sim",
                description: "Órgão emissor e UF do RG (ex.: SSP/SC, SSP/SP, SSP/MS)",
              },
              {
                name: "birthDate",
                type: "string (body)",
                required: "Sim",
                description: "Data de nascimento no formato YYYY-MM-DD",
              },
              {
                name: "motherName",
                type: "string (body)",
                required: "Sim",
                description: "Nome completo da mãe",
              },
              {
                name: "fatherName",
                type: "string (body)",
                required: "Não",
                description: "Nome do pai (se houver; opcional)",
              },
              {
                name: "maritalStatus",
                type: "string (body)",
                required: "Sim",
                description: "Estado civil (ex.: solteiro, casado, divorciado, viuvo, uniao_estavel)",
              },
              {
                name: "profession",
                type: "string (body)",
                required: "Sim",
                description: "Profissão do titular (ex.: Analista, Autônomo, Comerciante)",
              },
              {
                name: "cep",
                type: "string (body)",
                required: "Sim",
                description: "CEP do endereço de instalação (ex: 72110035)",
              },
              {
                name: "street",
                type: "string (body)",
                required: "Sim",
                description: "Rua / Avenida / Logradouro de instalação",
              },
              {
                name: "number",
                type: "string (body)",
                required: "Sim",
                description: "Número do imóvel",
              },
              {
                name: "neighborhood",
                type: "string (body)",
                required: "Sim",
                description: "Bairro do imóvel",
              },
              {
                name: "complement",
                type: "string (body)",
                required: "Não",
                description: "Complemento (apto, bloco, sala, etc.; opcional)",
              },
              {
                name: "reference",
                type: "string (body)",
                required: "Não",
                description: "Ponto de referência de instalação (ex.: próximo ao posto; opcional)",
              },
              {
                name: "planId",
                type: "string (body)",
                required: "Não",
                description: "ID do plano contratado no painel (ex.: seed-plan-300)",
              },
              {
                name: "observation",
                type: "string (body)",
                required: "Não",
                description: "Observações da contratação ou preferências de instalação",
              },
              {
                name: "packageIds",
                type: "array de strings (body)",
                required: "Não",
                description: "Lista de IDs ou nomes de pacotes adicionais contratados. Não repita IDs e certifique-se de que o plano contratado aceita os pacotes. Enviado ao Hubsoft como ids_pacotes: [{ id_pacote, valor }] (com valor numérico).",
              },
            ]}
            curlCode={`curl -X POST ${origin}/api/agent/clients/5511999999999/contract \\
  -H "Content-Type: application/json" \\
  -H "x-webhook-token: SEU_AGENT_API_TOKEN" \\
  -d '{
    "hubsoftToken": "eyJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiJ9...",
    "planId": "seed-plan-300",
    "packageIds": ["pkg-fixo-ilimitado"],
    "fullName": "Carlos Eduardo da Silva",
    "cpf": "54668653381",
    "phonePrimary": "6792236563",
    "phoneSecondary": "4833330000",
    "email": "carlos.silva@email.com",
    "gender": "masculino",
    "rg": "1234567",
    "rgEmissor": "SSP/SC",
    "birthDate": "1990-05-20",
    "motherName": "Maria da Silva",
    "fatherName": "José da Silva",
    "maritalStatus": "solteiro",
    "profession": "Analista",
    "cep": "72110035",
    "street": "qnp 22 conjunto k",
    "number": "100",
    "neighborhood": "CENTRO",
    "complement": "Sala 2",
    "reference": "Proximo a praca",
    "observation": "Instalação preferencial no sábado pela manhã"
  }'`}
            responseCode={`{
  "ok": true,
  "message": "Contrato gerado com sucesso! Ele será enviado ao cliente em poucos instantes."
}`}
          />

          {/* 10. Registrar Contrato PJ */}
          <ToolDetailCard
            title="10. Registrar Contrato Pessoa Jurídica / CNPJ (registerContractPJ)"
            method="POST"
            path="/api/agent/clients/:phone/contract-pj"
            description="Registra os dados da Pessoa Jurídica (empresa, CNPJ, responsável, endereço e plano), cria o cliente/serviço diretamente no Hubsoft com tipo_pessoa='pj' e dispara o webhook contractWebhookUrl. Nota: o contrato é gerado no Hubsoft, mas o lead NÃO é movido automaticamente para FECHOU_VENDA; após o lead confirmar a assinatura, o agente deve chamar confirmContractSigned."
            fields={[
              {
                name: ":phone",
                type: "string (path)",
                required: "Sim",
                description: "Telefone do lead",
              },
              {
                name: "hubsoftToken",
                type: "string (body)",
                required: "Sim",
                description: "Bearer token de autenticação da API do Hubsoft",
              },
              {
                name: "companyName",
                type: "string (body)",
                required: "Sim",
                description: "Razão Social da empresa",
              },
              {
                name: "tradeName",
                type: "string (body)",
                required: "Não",
                description: "Nome Fantasia da empresa (se omitido, usa a Razão Social)",
              },
              {
                name: "cnpj",
                type: "string (body)",
                required: "Sim",
                description: "CNPJ da empresa (apenas números ou formatado)",
              },
              {
                name: "stateRegistration",
                type: "string (body)",
                required: "Não",
                description: 'Inscrição Estadual da empresa (ou "ISENTO")',
              },
              {
                name: "contactName",
                type: "string (body)",
                required: "Sim",
                description: "Nome completo do responsável ou contato da empresa",
              },
              {
                name: "phonePrimary",
                type: "string (body)",
                required: "Sim",
                description: "Telefone principal da empresa ou responsável (com DDD)",
              },
              {
                name: "phoneSecondary",
                type: "string (body)",
                required: "Não",
                description: "Telefone secundário ou ramal (se omitido, usa o primário)",
              },
              {
                name: "email",
                type: "string (body)",
                required: "Sim",
                description: "E-mail corporativo / financeiro para faturas e contrato",
              },
              {
                name: "cep",
                type: "string (body)",
                required: "Sim",
                description: "CEP do endereço comercial da instalação",
              },
              {
                name: "street",
                type: "string (body)",
                required: "Sim",
                description: "Rua / Avenida da sede ou estabelecimento",
              },
              {
                name: "number",
                type: "string (body)",
                required: "Sim",
                description: "Número do imóvel comercial",
              },
              {
                name: "neighborhood",
                type: "string (body)",
                required: "Sim",
                description: "Bairro do imóvel",
              },
              {
                name: "complement",
                type: "string (body)",
                required: "Não",
                description: "Complemento (sala, andar, galpão, bloco; opcional)",
              },
              {
                name: "reference",
                type: "string (body)",
                required: "Não",
                description: "Ponto de referência comercial (opcional)",
              },
              {
                name: "planId",
                type: "string (body)",
                required: "Não",
                description: "ID do plano contratado no painel",
              },
              {
                name: "observation",
                type: "string (body)",
                required: "Não",
                description: "Observações comerciais ou restrições de instalação",
              },
              {
                name: "packageIds",
                type: "array de strings (body)",
                required: "Não",
                description: "Lista de IDs ou nomes de pacotes adicionais contratados. Não repita IDs e certifique-se de que o plano contratado aceita os pacotes. Enviado ao Hubsoft como ids_pacotes: [{ id_pacote, valor }] (com valor numérico).",
              },
            ]}
            curlCode={`curl -X POST ${origin}/api/agent/clients/5511999999999/contract-pj \\
  -H "Content-Type: application/json" \\
  -H "x-webhook-token: SEU_AGENT_API_TOKEN" \\
  -d '{
    "hubsoftToken": "eyJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiJ9...",
    "planId": "seed-plan-300",
    "packageIds": ["pkg-fixo-ilimitado"],
    "companyName": "Tech Solucoes Empresariais Ltda",
    "tradeName": "Tech Solucoes",
    "cnpj": "12345678000190",
    "stateRegistration": "ISENTO",
    "contactName": "Carlos Eduardo da Silva",
    "phonePrimary": "6792236563",
    "phoneSecondary": "4833330000",
    "email": "financeiro@techsolucoes.com.br",
    "cep": "72110035",
    "street": "qnp 22 conjunto k",
    "number": "100",
    "neighborhood": "CENTRO",
    "complement": "Sala 2",
    "reference": "Proximo a praca",
    "observation": "Instalação no escritório comercial"
  }'`}
            responseCode={`{
  "ok": true,
  "message": "Contrato gerado com sucesso! Ele será enviado ao cliente em poucos instantes."
}`}
          />

          {/* 11. Confirmar Assinatura do Contrato */}
          <ToolDetailCard
            title="11. Confirmar Assinatura do Contrato (confirmContractSigned)"
            method="POST"
            path="/api/agent/clients/:phone/contract-signed"
            description="Deve ser chamada pelo agente quando o lead confirmar que assinou o contrato enviado por e-mail ou WhatsApp. Esta ferramenta marca oficialmente o cliente na etapa FECHOU_VENDA, finalizando com sucesso o processo de venda."
            fields={[
              {
                name: ":phone",
                type: "string (path)",
                required: "Sim",
                description: "Telefone do lead no formato internacional/nacional (ex: 5511999999999)",
              },
              {
                name: "observation",
                type: "string (body)",
                required: "Não",
                description: "Observação opcional sobre a confirmação da assinatura",
              },
            ]}
            curlCode={`curl -X POST \${origin}/api/agent/clients/5511999999999/contract-signed \\
  -H "x-webhook-token: SEU_AGENT_API_TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{ "observation": "Cliente confirmou assinatura digital" }'`}
            responseCode={`{
  "ok": true,
  "message": "Assinatura do contrato confirmada com sucesso! O lead foi avançado para FECHOU_VENDA.",
  "client": {
    "id": "cm7client001",
    "phone": "5511999999999",
    "name": "Carlos Eduardo",
    "stage": "FECHOU_VENDA"
  }
}`}
          />
        </Stack>
      </Section>

      <Section
        id="outbound"
        icon={<CallMadeIcon />}
        title="Webhook de saída (chat)"
        description="POST em outboundWebhookUrl após agent/reply — o chat entrega a mensagem ao lead."
      >
        <EndpointHeader method="POST" path="{outboundWebhookUrl}" auth="public" />
        <CodeBlock
          language="json"
          code={`{
  "phone": "5511999999999",
  "text": "Oi! Posso te ajudar a escolher o plano ideal.",
  "metadata": { "conversationId": "abc-123" }
}`}
        />
      </Section>

      <Section
        id="contract"
        icon={<CallMadeIcon />}
        title="Webhook de contrato"
        description="POST em contractWebhookUrl quando a API do agente registra a venda."
      >
        <EndpointHeader method="POST" path="{contractWebhookUrl}" auth="public" />
        <CodeBlock
          language="json"
          code={`{
  "phone": "5511999999999",
  "fullName": "Maria Silva",
  "cpf": "00000000000",
  "phonePrimary": "11999999999",
  "phoneSecondary": "11988888888",
  "email": "maria@email.com",
  "gender": "F",
  "planId": "clx...",
  "packages": [
    {
      "id": "pkg-fixo-ilimitado",
      "name": "Telefone Fixo Ilimitado",
      "price": 19.9,
      "hubsoftPackageId": 12
    }
  ]
}`}
        />
      </Section>

      <Section
        id="hmac"
        icon={<LockOutlinedIcon />}
        title="Assinatura HMAC"
        description="Validar POSTs de saída (agent, chat, contrato)."
      >
        <CodeBlock language="text" code={`x-webhook-signature = hex( HMAC_SHA256(secret, rawBody) )`} />
        <CodeBlock
          language="javascript"
          code={`import { createHmac, timingSafeEqual } from "node:crypto";

function verifySignature(rawBody, secret, headerValue) {
  const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(headerValue || "", "utf8");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}`}
        />
      </Section>

      <Section
        id="api"
        icon={<DescriptionOutlinedIcon />}
        title="API do painel"
        description="Rotas da interface (sessão), além das rotas de agente documentadas acima."
      >
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Método</TableCell>
                <TableCell>Rota</TableCell>
                <TableCell>Descrição</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {[
                { m: "GET", p: "/api/dashboard", d: "Totais de leads e contratos" },
                { m: "GET", p: "/api/clientes", d: "Lista leads" },
                { m: "GET/PATCH/DELETE", p: "/api/clientes/:id", d: "Detalhe / edita / remove lead" },
                { m: "CRUD", p: "/api/planos, /api/pacotes, /api/areas, /api/origens", d: "Cadastros do painel" },
                { m: "GET/PATCH", p: "/api/configuracoes", d: "Branding + prompt da IA + webhooks" },
                { m: "GET", p: "/api/branding", d: "Público — login e tema" },
              ].map((row) => (
                <TableRow key={`${row.m}-${row.p}`}>
                  <TableCell sx={{ fontFamily: "monospace", fontSize: 13 }}>{row.m}</TableCell>
                  <TableCell sx={{ fontFamily: "monospace", fontSize: 13 }}>{row.p}</TableCell>
                  <TableCell>{row.d}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>

        <Typography variant="subtitle2" sx={{ pt: 1 }}>
          Etapas do funil (<code>SaleStage</code>)
        </Typography>
        <Stack direction="row" flexWrap="wrap" useFlexGap spacing={1}>
          {["NOVO_LEAD", "INTERESSADO", "PAROU_DE_RESPONDER", "ACHOU_CARO", "FECHOU_VENDA", "DESISTIU"].map((s) => (
            <Chip key={s} label={s} size="small" variant="outlined" sx={{ fontFamily: "monospace" }} />
          ))}
        </Stack>
      </Section>

      <Typography variant="caption" color="text.secondary" sx={{ pb: 2 }}>
        Tokens: <code>INBOUND_WEBHOOK_TOKEN</code>, <code>AGENT_API_TOKEN</code>. URLs de saída em Configurações.
      </Typography>
    </Stack>
  );
}

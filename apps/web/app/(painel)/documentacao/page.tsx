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
  Tab,
  Tabs,
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
import PhoneInTalkIcon from "@mui/icons-material/PhoneInTalk";
import SettingsEthernetIcon from "@mui/icons-material/SettingsEthernet";
import TerminalIcon from "@mui/icons-material/Terminal";

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
    <Paper id={id} variant="outlined" sx={{ p: { xs: 2.5, sm: 3 }, scrollMarginTop: 88, borderRadius: 2 }}>
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

        {fields && fields.length > 0 ? (
          <Box>
            <Typography variant="caption" fontWeight={700} color="text.secondary" sx={{ textTransform: "uppercase", letterSpacing: 0.5, display: "block", mb: 1 }}>
              Parâmetros / Campos
            </Typography>
            <FieldTable rows={fields} />
          </Box>
        ) : null}

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

export default function DocumentacaoPage() {
  const [activeTab, setActiveTab] = React.useState(0);
  const [origin, setOrigin] = React.useState("https://seu-dominio.com");

  React.useEffect(() => {
    if (typeof window !== "undefined") setOrigin(window.location.origin);
  }, []);

  const inboundUrl = `${origin}/api/webhooks/inbound`;
  const agentReplyUrl = `${origin}/api/webhooks/agent/reply`;
  const prospectingCallbackUrl = `${origin}/api/webhooks/prospeccao/callback`;

  return (
    <Stack spacing={3} sx={{ maxWidth: 980, mx: "auto" }}>
      <Box>
        <Typography variant="h4" component="h1" gutterBottom sx={{ fontWeight: 700 }}>
          Documentação do Sistema
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Manual técnico de integração: fluxos de atendimento receptivo, prospecção ativa (voz/texto), webhooks e API de tools para sistemas externos de IA.
        </Typography>
      </Box>

      {/* Navegação por Abas Principais */}
      <Paper variant="outlined" sx={{ borderRadius: 2 }}>
        <Tabs
          value={activeTab}
          onChange={(_, val) => setActiveTab(val)}
          variant="scrollable"
          scrollButtons="auto"
          sx={{
            px: 2,
            borderBottom: 1,
            borderColor: "divider",
            "& .MuiTab-root": { minHeight: 56, textTransform: "none", fontSize: 14, fontWeight: 600 },
          }}
        >
          <Tab icon={<DescriptionOutlinedIcon />} iconPosition="start" label="Visão Geral & Arquitetura" />
          <Tab icon={<PhoneInTalkIcon />} iconPosition="start" label="Módulo de Prospecção (Voz e Texto)" />
          <Tab icon={<SmartToyOutlinedIcon />} iconPosition="start" label="Tools da IA (/api/agent/*)" />
          <Tab icon={<CallReceivedIcon />} iconPosition="start" label="Webhooks de Atendimento & Chat" />
          <Tab icon={<TerminalIcon />} iconPosition="start" label="APIs Administrativas" />
        </Tabs>
      </Paper>

      {/* ========================================== */}
      {/* ABA 0: VISÃO GERAL & ARQUITETURA           */}
      {/* ========================================== */}
      {activeTab === 0 && (
        <Stack spacing={3}>
          <Section
            id="fluxo"
            icon={<DescriptionOutlinedIcon />}
            title="Fluxo Geral do Sistema"
            description="Este sistema gerencia o CRM e a ponte de mensageria. A IA roda em um sistema externo desacoplado."
          >
            <Alert severity="info" variant="outlined">
              O sistema conta com dois grandes motores assíncronos via BullMQ (Redis):
              <br />
              1. <strong>Atendimento Receptivo (Chat/WhatsApp):</strong> Recebe mensagens em <code>/api/webhooks/inbound</code>, notifica a IA externa via <code>agentWebhookUrl</code> e expõe tools REST para a IA fechar contratos e responder pelo <code>/api/webhooks/agent/reply</code>.
              <br />
              2. <strong>Prospecção Ativa (Voz e Texto):</strong> Percorre leads de planilhas com <strong>concorrência 1</strong>, dispara chamadas de voz via webhook, sincroniza o resultado via callback de telefonia e realiza fallback de texto automático se a ligação falhar.
            </Alert>
            <CodeBlock
              language="text"
              code={`ATENDIMENTO RECEPTIVO:
App de chat
    │  POST /api/webhooks/inbound (x-webhook-token: INBOUND_WEBHOOK_TOKEN)
    ▼
Fila Redis "messages"
    ▼
Worker  → Salva Message (user)
        → POST agentWebhookUrl { event: "message.inbound", client, history, ... }
              │
              ▼
        Sistema de IA externo
              ├─ GET/PATCH /api/agent/* (tools REST para contratos, planos, etc.)
              └─ POST /api/webhooks/agent/reply { phone, text }
                    │
                    ▼
              Salva Message (assistant) → POST outboundWebhookUrl (app de chat)

PROSPECÇÃO ATIVA (VOZ E TEXTO):
Planilha XLSX (/prospeccao) → Fila BullMQ "prospecting" (concurrency: 1)
    │
    ▼
Worker  → Garante registro do Lead como Client (NOVO_LEAD)
        → POST prospectingWebhookUrl { action: "VOICE", phone, name, ... }
        → Aguarda Redis Pub/Sub (timeout 120s)
              │
              ├─ Telefonia atendeu → POST /api/webhooks/prospeccao/callback { phone, answered: true }
              │  └─ Marca lead ATENDEU → Avança para o próximo lead
              │
              └─ Não atendeu / Timeout → POST /api/webhooks/prospeccao/callback { phone, answered: false }
                 └─ POST prospectingWebhookUrl { action: "TEXT", ... }
                 └─ Marca lead TEXTO_ENVIADO → Avança imediatamente para o próximo lead`}
            />
          </Section>

          <Section
            id="auth"
            icon={<LockOutlinedIcon />}
            title="Autenticação e Segurança"
            description="Diferenciação entre tokens de API/Webhook e sessão do painel administrativo."
          >
            <Stack spacing={2}>
              <Box>
                <Typography variant="subtitle1" fontWeight={600} gutterBottom>
                  1. Webhooks de Entrada e Ferramentas da IA
                </Typography>
                <Typography variant="body2" color="text.secondary" paragraph>
                  Header HTTP obrigatório: <code>x-webhook-token</code> com o valor de <code>AGENT_API_TOKEN</code> (ou <code>INBOUND_WEBHOOK_TOKEN</code> como fallback).
                  Utilizado em todas as rotas <code>/api/agent/*</code>, <code>/api/webhooks/inbound</code>, <code>/api/webhooks/agent/reply</code> e <code>/api/webhooks/prospeccao/callback</code>.
                </Typography>
              </Box>
              <Divider />
              <Box>
                <Typography variant="subtitle1" fontWeight={600} gutterBottom>
                  2. Webhooks de Saída (Deste sistema para Telefonia/Chat/IA)
                </Typography>
                <Typography variant="body2" color="text.secondary" paragraph>
                  Configurados na tela de Configurações. Se o campo <code>outboundWebhookSecret</code> estiver preenchido, todas as requisições de saída incluirão o header <code>x-webhook-signature</code> contendo a assinatura HMAC-SHA256 do corpo JSON.
                </Typography>
              </Box>
              <Divider />
              <Box>
                <Typography variant="subtitle1" fontWeight={600} gutterBottom>
                  3. Painel Administrativo Web
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Protegido por cookie de sessão JWT gerado após o login com <code>ADMIN_USER</code> e <code>ADMIN_PASSWORD</code>.
                </Typography>
              </Box>
            </Stack>
          </Section>

          <Section
            id="hmac"
            icon={<LockOutlinedIcon />}
            title="Validação de Assinatura HMAC-SHA256"
            description="Como verificar a autenticidade dos webhooks disparados por este painel."
          >
            <Typography variant="body2" color="text.secondary">
              Fórmula de cálculo:
            </Typography>
            <CodeBlock language="text" code={`x-webhook-signature = hex( HMAC_SHA256(outboundWebhookSecret, rawRequestBody) )`} />
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
              Exemplo de validação em Node.js com tempo constante para evitar timing attacks:
            </Typography>
            <CodeBlock
              language="javascript"
              code={`import { createHmac, timingSafeEqual } from "node:crypto";

function verifySignature(rawBody, secret, signatureHeader) {
  if (!signatureHeader || !secret) return false;
  const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(signatureHeader, "utf8");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}`}
            />
          </Section>
        </Stack>
      )}

      {/* ========================================== */}
      {/* ABA 1: MÓDULO DE PROSPECÇÃO (VOZ E TEXTO)   */}
      {/* ========================================== */}
      {activeTab === 1 && (
        <Stack spacing={3}>
          <Section
            id="prospeccao-visao-geral"
            icon={<PhoneInTalkIcon />}
            title="Visão Geral da Prospecção Ativa"
            description="Processamento de listas frias de contatos com alternância inteligente entre ligação de voz e mensagem de texto."
          >
            <Alert severity="success" variant="outlined">
              <strong>Regra de Ouro da Fila:</strong> Apenas <strong>1 ligação telefônica em paralelo</strong> ocorre por vez (BullMQ com <code>concurrency: 1</code>).
              O worker aguarda a finalização da ligação pelo webhook de retorno ou timeout (120s). Se a ligação falhar ou não atender, o sistema dispara imediatamente uma mensagem de texto e já puxa o próximo lead da fila.
            </Alert>

            <Typography variant="subtitle2" sx={{ mt: 1 }}>
              Estados do Lead de Prospecção (<code>ProspectStatus</code>):
            </Typography>
            <Stack direction="row" flexWrap="wrap" useFlexGap spacing={1}>
              <Chip label="PENDENTE" color="warning" size="small" />
              <Chip label="EM_CHAMADA" color="info" size="small" />
              <Chip label="ATENDEU" color="success" size="small" />
              <Chip label="NAO_ATENDEU" color="error" size="small" />
              <Chip label="TEXTO_ENVIADO" color="secondary" size="small" />
              <Chip label="ERRO" color="error" size="small" />
            </Stack>
          </Section>

          {/* Webhook Outbound de Prospecção */}
          <Section
            id="prospeccao-outbound"
            icon={<CallMadeIcon />}
            title="Webhook de Disparo da Prospecção (prospectingWebhookUrl)"
            description="Disparado pelo worker para o seu provedor de telefonia ou discador para solicitar a chamada ou mensagem."
          >
            <EndpointHeader method="POST" path="{prospectingWebhookUrl}" auth="token" />

            <Typography variant="subtitle2" sx={{ mt: 1 }}>
              Payload para Ligação de Voz (action: "VOICE"):
            </Typography>
            <CodeBlock
              language="json"
              code={`{
  "leadId": "clx_lead_123",
  "clientId": "clx_client_456",
  "phone": "5561991640073",
  "name": "CARLOS ROBERTO LOPES",
  "action": "VOICE",
  "metadata": {
    "rawDocument": "10.666.669",
    "street": "QUADRA QNM 19 CONJUNTO B LOTE",
    "number": "3",
    "complement": "LOJA 02",
    "neighborhood": "CEILANDIA",
    "city": "BRASILIA",
    "state": "DF",
    "cep": "72.215-192",
    "email": "carloslopes2014rose@gmail.com",
    "secondaryPhone": null
  }
}`}
            />

            <Typography variant="subtitle2" sx={{ mt: 2 }}>
              Payload para Mensagem de Texto / Fallback (action: "TEXT"):
            </Typography>
            <CodeBlock
              language="json"
              code={`{
  "leadId": "clx_lead_123",
  "clientId": "clx_client_456",
  "phone": "5561991640073",
  "name": "CARLOS ROBERTO LOPES",
  "action": "TEXT",
  "metadata": {
    "reason": "Não atendeu / falha na chamada",
    "neighborhood": "CEILANDIA",
    "city": "BRASILIA"
  }
}`}
            />
          </Section>

          {/* Webhook de Callback */}
          <Section
            id="prospeccao-callback"
            icon={<CallReceivedIcon />}
            title="Webhook de Retorno da Telefonia (Callback)"
            description="Endpoint chamado pelo seu provedor de telefonia assim que a ligação terminar para liberar a próxima chamada."
          >
            <EndpointHeader method="POST" path="/api/webhooks/prospeccao/callback" auth="token" />

            <Typography variant="subtitle2">URL Completa:</Typography>
            <CodeBlock language="text" code={prospectingCallbackUrl} />

            <Typography variant="subtitle2" sx={{ mt: 1 }}>
              Headers Obrigatórios:
            </Typography>
            <FieldTable
              rows={[
                { name: "Content-Type", type: "string", required: "Sim", description: "application/json" },
                { name: "x-webhook-token", type: "string", required: "Sim", description: "AGENT_API_TOKEN ou INBOUND_WEBHOOK_TOKEN" },
              ]}
            />

            <Typography variant="subtitle2" sx={{ mt: 2 }}>
              Body JSON:
            </Typography>
            <FieldTable
              rows={[
                { name: "phone", type: "string", required: "Sim", description: "Telefone do lead chamado (aceita com ou sem DDI 55)" },
                { name: "answered", type: "boolean", required: "Sim", description: "true se o lead atendeu a ligação; false se ocupado, desligou ou não atendeu" },
              ]}
            />

            <Typography variant="subtitle2" sx={{ mt: 1 }}>Exemplo cURL (Sucesso / Atendeu):</Typography>
            <CodeBlock
              language="bash"
              code={`curl -X POST ${prospectingCallbackUrl} \\
  -H "Content-Type: application/json" \\
  -H "x-webhook-token: SEU_AGENT_API_TOKEN" \\
  -d '{
    "phone": "5561991640073",
    "answered": true
  }'`}
            />

            <Typography variant="subtitle2" sx={{ mt: 1 }}>Exemplo cURL (Falha / Não Atendeu):</Typography>
            <CodeBlock
              language="bash"
              code={`curl -X POST ${prospectingCallbackUrl} \\
  -H "Content-Type: application/json" \\
  -H "x-webhook-token: SEU_AGENT_API_TOKEN" \\
  -d '{
    "phone": "5561991640073",
    "answered": false
  }'`}
            />
          </Section>

          {/* Formato da Planilha XLSX */}
          <Section
            id="prospeccao-planilha"
            icon={<DescriptionOutlinedIcon />}
            title="Formato da Planilha de Importação (.xlsx)"
            description="Estrutura de colunas mapeadas a partir do modelo padrão (ex: ceilandia.xlsx)."
          >
            <FieldTable
              rows={[
                { name: "Coluna K (11)", type: "string / number", required: "Sim", description: "Telefone principal do lead (normalizado com DDI 55, ex: 5561991640073)" },
                { name: "Coluna A (1)", type: "string", required: "Sim", description: "Razão Social / Nome completo (extrai CNPJ/documento para rawDocument e limpa o nome)" },
                { name: "Coluna C (3)", type: "string", required: "Não", description: "Tipo de logradouro (QUADRA, CONJUNTO, RUA, etc.)" },
                { name: "Coluna D (4)", type: "string", required: "Não", description: "Nome do logradouro / endereço" },
                { name: "Coluna E (5)", type: "string / number", required: "Não", description: "Número do imóvel" },
                { name: "Coluna F (6)", type: "string", required: "Não", description: "Complemento (CASA, APTO, LOTE, etc.)" },
                { name: "Coluna G (7)", type: "string", required: "Não", description: "Bairro (ex: CEILANDIA NORTE)" },
                { name: "Coluna H (8)", type: "string", required: "Não", description: "Cidade / Município (ex: BRASILIA)" },
                { name: "Coluna I (9)", type: "string", required: "Não", description: "UF (ex: DF)" },
                { name: "Coluna J (10)", type: "string", required: "Não", description: "CEP (ex: 72.215-192)" },
                { name: "Coluna L (12)", type: "string / number", required: "Não", description: "Telefone secundário / alternativo" },
                { name: "Coluna M (13)", type: "string", required: "Não", description: "E-mail de contato" },
              ]}
            />
            <Alert severity="info" variant="outlined" sx={{ mt: 2 }}>
              <strong>Desduplicação Inteligente:</strong> Telefones repetidos dentro da mesma planilha ou já cadastrados no banco de dados são identificados e ignorados automaticamente durante o upload.
            </Alert>
          </Section>

          {/* Endpoints de Controle de Prospecção */}
          <Section
            id="prospeccao-apis"
            icon={<SettingsEthernetIcon />}
            title="APIs Administrativas de Prospecção"
            description="Endpoints para iniciar, pausar e gerenciar campanhas programaticamente."
          >
            <Stack spacing={2}>
              <Box>
                <EndpointHeader method="POST" path="/api/prospeccao/start" auth="session" />
                <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                  Inicia o processamento da fila de chamadas. Se <code>leadIds</code> for enviado, processa apenas os selecionados; caso contrário, enfileira todos os leads com status <code>PENDENTE</code>.
                </Typography>
                <CodeBlock language="json" code={`// Iniciar todos os pendentes:\nPOST /api/prospeccao/start {}\n\n// Iniciar seleção específica:\nPOST /api/prospeccao/start { "leadIds": ["clx_1", "clx_2"] }`} />
              </Box>
              <Divider />
              <Box>
                <EndpointHeader method="POST" path="/api/prospeccao/pause" auth="session" />
                <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                  Pausa imediatamente a fila de chamadas e impede novos disparos.
                </Typography>
              </Box>
              <Divider />
              <Box>
                <EndpointHeader method="POST" path="/api/prospeccao/import" auth="session" />
                <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                  Recebe <code>multipart/form-data</code> com o arquivo Excel (.xlsx) no campo <code>file</code> (até 20 MB).
                </Typography>
              </Box>
            </Stack>
          </Section>
        </Stack>
      )}

      {/* ========================================== */}
      {/* ABA 2: TOOLS DA IA (/api/agent/*)           */}
      {/* ========================================== */}
      {activeTab === 2 && (
        <Stack spacing={3}>
          <Section
            id="agent-api-summary"
            icon={<SmartToyOutlinedIcon />}
            title="Ferramentas REST da IA Externa (Tools)"
            description="Endpoints consumidos pela IA para consultar contexto, planos, registrar contratos e obter prompts. Todas exigem x-webhook-token."
          >
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
                    { m: "GET", p: "/api/agent/prompt", d: "Prompt do sistema / IA de Vendas (aceita ?type=voice ou ?type=text)" },
                    { m: "GET", p: "/api/agent/prompt/voice", d: "Prompt específico da IA de Voz para chamadas ativas" },
                    { m: "GET", p: "/api/agent/prompt/text", d: "Prompt específico da IA de Texto para prospecção/fallback" },
                    { m: "GET", p: "/api/agent/origins", d: "Lista canais de origem ativos (Instagram, Google, etc.)" },
                    { m: "GET", p: "/api/agent/areas", d: "Lista áreas de cobertura ativas e observações de taxa" },
                    { m: "GET", p: "/api/agent/due-dates", d: "Lista dias de vencimento disponíveis (1 a 31) e seus IDs no Hubsoft" },
                    { m: "GET", p: "/api/agent/areas/:areaId/plans", d: "Lista planos de internet disponíveis na área" },
                    { m: "GET", p: "/api/agent/plans/:planId", d: "Consulta detalhes completos de um plano específico" },
                    { m: "GET", p: "/api/agent/clients/:phone", d: "Consulta cadastro completo e contexto do lead" },
                    { m: "GET", p: "/api/agent/clients/:phone/messages?limit=30", d: "Consulta histórico recente de mensagens" },
                    { m: "PATCH", p: "/api/agent/clients/:phone", d: "Atualiza dados do lead (nome, área, operadora, valor...)" },
                    { m: "POST", p: "/api/agent/clients/:phone/stage", d: "Altera a etapa do funil (ex: INTERESSADO, FECHOU_VENDA)" },
                    { m: "POST", p: "/api/agent/clients/:phone/contract", d: "Registra contrato no Hubsoft (PF) e dispara webhook" },
                    { m: "POST", p: "/api/agent/clients/:phone/contract-pj", d: "Registra contrato no Hubsoft (PJ) e dispara webhook" },
                    { m: "POST", p: "/api/agent/clients/:phone/contract-signed", d: "Confirma assinatura do contrato e avança para FECHOU_VENDA" },
                    { m: "POST", p: "/api/agent/clients/:phone/pause-followup", d: "Pausa follow-up do lead" },
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
          </Section>

          {/* Detalhamento de Prompts */}
          <ToolDetailCard
            title="1. Obter Prompts da IA (getAiPrompt, Voice e Text)"
            method="GET"
            path="/api/agent/prompt"
            description="Retorna as instruções de sistema configuradas no painel. Suporta parâmetros de filtro (?type=voice ou ?type=text) e possui rotas filhas dedicadas."
            curlCode={`# Todos os prompts:\ncurl -X GET ${origin}/api/agent/prompt -H "x-webhook-token: SEU_AGENT_API_TOKEN"\n\n# Apenas prompt de Voz:\ncurl -X GET ${origin}/api/agent/prompt/voice -H "x-webhook-token: SEU_AGENT_API_TOKEN"\n\n# Apenas prompt de Texto:\ncurl -X GET ${origin}/api/agent/prompt/text -H "x-webhook-token: SEU_AGENT_API_TOKEN"`}
            responseCode={`{\n  "ok": true,\n  "prompt": "Você é o assistente virtual de vendas...",\n  "salesPrompt": "Você é o assistente virtual de vendas...",\n  "voicePrompt": "Você é o consultor de prospecção por voz da Ligtop Fibra...",\n  "textPrompt": "Olá! Tentamos contato por telefone sobre ofertas de fibra..."\n}`}
          />

          {/* 2. Origens */}
          <ToolDetailCard
            title="2. Listar Origens Ativas (listOrigins)"
            method="GET"
            path="/api/agent/origins"
            description="Retorna a lista de canais de aquisição de leads ativos (Instagram, Google Ads, Indicação, etc.)."
            curlCode={`curl -X GET ${origin}/api/agent/origins -H "x-webhook-token: SEU_AGENT_API_TOKEN"`}
            responseCode={`{\n  "ok": true,\n  "origins": [\n    { "id": "cm7a1", "name": "Instagram" },\n    { "id": "cm7a2", "name": "Google Ads" }\n  ]\n}`}
          />

          {/* 3. Vencimentos */}
          <ToolDetailCard
            title="3. Listar Dias de Vencimento (listDueDates)"
            method="GET"
            path="/api/agent/due-dates"
            description="Retorna os dias de vencimento disponíveis (1 a 31) e seus respectivos IDs no Hubsoft para inclusão no contrato."
            curlCode={`curl -X GET ${origin}/api/agent/due-dates -H "x-webhook-token: SEU_AGENT_API_TOKEN"`}
            responseCode={`{\n  "ok": true,\n  "dueDates": [\n    { "id": "venc1", "day": 5, "hubsoftId": 8, "formatted": "Dia 05" },\n    { "id": "venc2", "day": 10, "hubsoftId": 9, "formatted": "Dia 10" }\n  ]\n}`}
          />

          {/* 4. Áreas */}
          <ToolDetailCard
            title="4. Listar Áreas de Cobertura (listAreas)"
            method="GET"
            path="/api/agent/areas"
            description="Retorna as regiões atendidas e regras especiais de cada área (ex.: isenção de taxa de instalação)."
            curlCode={`curl -X GET ${origin}/api/agent/areas -H "x-webhook-token: SEU_AGENT_API_TOKEN"`}
            responseCode={`{\n  "ok": true,\n  "areas": [\n    { "id": "area1", "name": "Ceilândia Centro", "observation": "Taxa de instalação: ISENTO" },\n    { "id": "area2", "name": "Ceilândia Norte", "observation": "Taxa normal R$ 100,00" }\n  ]\n}`}
          />

          {/* 5. Planos por Área */}
          <ToolDetailCard
            title="5. Listar Planos por Área (listPlansByArea)"
            method="GET"
            path="/api/agent/areas/:areaId/plans"
            description="Lista os planos de internet comercializados na área especificada, com preços sem e com fidelidade."
            curlCode={`curl -X GET ${origin}/api/agent/areas/area1/plans -H "x-webhook-token: SEU_AGENT_API_TOKEN"`}
            responseCode={`{\n  "ok": true,\n  "area": { "id": "area1", "name": "Ceilândia Centro" },\n  "plans": [\n    {\n      "id": "plan1",\n      "name": "Fibra 500 Mega",\n      "price": 119.9,\n      "priceWithLoyalty": 89.9,\n      "loyaltyMonths": 12,\n      "description": "500 Mega download / 250 Mega upload com Wi-Fi 6 incluso."\n    }\n  ]\n}`}
          />

          {/* 6. Contexto do Lead */}
          <ToolDetailCard
            title="6. Consultar Contexto do Lead (getClientContext)"
            method="GET"
            path="/api/agent/clients/:phone"
            description="Retorna o perfil completo do lead, operadora atual, valor que paga hoje, área vinculada e dados de contrato."
            curlCode={`curl -X GET ${origin}/api/agent/clients/5561991640073 -H "x-webhook-token: SEU_AGENT_API_TOKEN"`}
            responseCode={`{\n  "ok": true,\n  "client": {\n    "id": "client123",\n    "phone": "5561991640073",\n    "name": "CARLOS ROBERTO LOPES",\n    "stage": "NOVO_LEAD",\n    "currentProvider": "Claro",\n    "currentPrice": 120,\n    "area": { "id": "area1", "name": "Ceilândia" }\n  }\n}`}
          />

          {/* 7. Alterar Estágio */}
          <ToolDetailCard
            title="7. Alterar Etapa do Funil (setStage)"
            method="POST"
            path="/api/agent/clients/:phone/stage"
            description="Atualiza a etapa do lead no funil de vendas (NOVO_LEAD, INTERESSADO, PAROU_DE_RESPONDER, ACHOU_CARO, FECHOU_VENDA, DESISTIU)."
            curlCode={`curl -X POST ${origin}/api/agent/clients/5561991640073/stage \\\n  -H "Content-Type: application/json" \\\n  -H "x-webhook-token: SEU_AGENT_API_TOKEN" \\\n  -d '{ "stage": "INTERESSADO" }'`}
            responseCode={`{\n  "ok": true,\n  "client": { "id": "client123", "phone": "5561991640073", "stage": "INTERESSADO" }\n}`}
          />

          {/* 8. Registrar Contrato */}
          <ToolDetailCard
            title="8. Registrar Contrato Hubsoft PF (registerContract)"
            method="POST"
            path="/api/agent/clients/:phone/contract"
            description="Cadastra o cliente e gera a proposta/contrato diretamente no Hubsoft. Não marca FECHOU_VENDA até que a assinatura seja confirmada."
            curlCode={`curl -X POST ${origin}/api/agent/clients/5561991640073/contract \\\n  -H "Content-Type: application/json" \\\n  -H "x-webhook-token: SEU_AGENT_API_TOKEN" \\\n  -d '{\n    "hubsoftToken": "TOKEN_HUBSOFT",\n    "planId": "plan1",\n    "fullName": "Carlos Roberto Lopes",\n    "cpf": "12345678900",\n    "phonePrimary": "61991640073",\n    "email": "carlos@gmail.com",\n    "gender": "M",\n    "cep": "72215192",\n    "street": "QNM 19 Conjunto B",\n    "number": "3",\n    "neighborhood": "Ceilândia",\n    "dueDateId": "venc1"\n  }'`}
            responseCode={`{\n  "ok": true,\n  "message": "Contrato registrado no Hubsoft com sucesso",\n  "contractId": "contract123",\n  "hubsoftProtocol": "20261015-001"\n}`}
          />
        </Stack>
      )}

      {/* ========================================== */}
      {/* ABA 3: WEBHOOKS DE CHAT & ATENDIMENTO       */}
      {/* ========================================== */}
      {activeTab === 3 && (
        <Stack spacing={3}>
          <Section
            id="inbound"
            icon={<CallReceivedIcon />}
            title="Webhook de Entrada do Chat (POST /api/webhooks/inbound)"
            description="O app de chat externo (WhatsApp, Telegram, etc.) dispara este webhook quando o lead envia texto ou áudio."
          >
            <EndpointHeader method="POST" path="/api/webhooks/inbound" auth="token" />
            <Typography variant="subtitle2">URL Completa:</Typography>
            <CodeBlock language="text" code={inboundUrl} />

            <Typography variant="subtitle2" sx={{ mt: 1 }}>Exemplo 1: Mensagem de Texto</Typography>
            <CodeBlock
              language="bash"
              code={`curl -X POST ${inboundUrl} \\
  -H "Content-Type: application/json" \\
  -H "x-webhook-token: SEU_INBOUND_WEBHOOK_TOKEN" \\
  -d '{
    "phone": "5511999999999",
    "type": "text",
    "text": "Olá! Gostaria de consultar os planos de fibra",
    "metadata": { "conversationId": "chat-987" }
  }'`}
            />

            <Typography variant="subtitle2" sx={{ mt: 2 }}>Exemplo 2: Mensagem de Áudio com Transcrição</Typography>
            <CodeBlock
              language="bash"
              code={`curl -X POST ${inboundUrl} \\
  -H "Content-Type: application/json" \\
  -H "x-webhook-token: SEU_INBOUND_WEBHOOK_TOKEN" \\
  -d '{
    "phone": "5511999999999",
    "type": "audio",
    "audioBase64": "GkXfo59ChoEBQveBAULygQ8taz44AA...",
    "mimeType": "audio/ogg",
    "transcription": "Olá, queria saber se tem cobertura aqui em Ceilândia",
    "metadata": { "conversationId": "chat-987" }
  }'`}
            />
          </Section>

          <Section
            id="agent-reply"
            icon={<SmartToyOutlinedIcon />}
            title="Resposta da IA → Lead (POST /api/webhooks/agent/reply)"
            description="A IA externa envia a resposta gerada para ser entregue de volta ao chat do cliente."
          >
            <EndpointHeader method="POST" path="/api/webhooks/agent/reply" auth="token" />
            <Typography variant="subtitle2">URL Completa:</Typography>
            <CodeBlock language="text" code={agentReplyUrl} />

            <CodeBlock
              language="bash"
              code={`curl -X POST ${agentReplyUrl} \\
  -H "Content-Type: application/json" \\
  -H "x-webhook-token: SEU_AGENT_API_TOKEN" \\
  -d '{
    "phone": "5511999999999",
    "text": "Olá! Temos cobertura completa em Ceilândia sim. Nossos planos começam a partir de R$ 89,90 com 500 Mega. Qual o seu bairro exato?",
    "metadata": { "conversationId": "chat-987" }
  }'`}
            />
          </Section>

          <Section
            id="agent-events"
            icon={<CallMadeIcon />}
            title="Notificação para a IA Externa (agentWebhookUrl)"
            description="Eventos que o worker do painel despacha para a URL da IA externa cadastrada nas Configurações."
          >
            <Typography variant="subtitle2">1. event: message.inbound (Nova Mensagem)</Typography>
            <CodeBlock
              language="json"
              code={`{
  "event": "message.inbound",
  "phone": "5511999999999",
  "clientId": "clx_client_1",
  "type": "text",
  "text": "Olá, gostaria de saber os planos",
  "client": { "id": "clx_client_1", "phone": "5511999999999", "stage": "NOVO_LEAD" },
  "history": [
    { "role": "user", "content": "Olá, gostaria de saber os planos", "kind": "text", "createdAt": "2026-10-15T12:00:00Z" }
  ]
}`}
            />

            <Typography variant="subtitle2" sx={{ mt: 2 }}>2. event: followup.due (Disparo de Follow-up)</Typography>
            <CodeBlock
              language="json"
              code={`{
  "event": "followup.due",
  "phone": "5511999999999",
  "clientId": "clx_client_1",
  "attempt": 1,
  "client": { "id": "clx_client_1", "stage": "PAROU_DE_RESPONDER", "followUpCount": 1 }
}`}
            />
          </Section>
        </Stack>
      )}

      {/* ========================================== */}
      {/* ABA 4: APIS ADMINISTRATIVAS                 */}
      {/* ========================================== */}
      {activeTab === 4 && (
        <Stack spacing={3}>
          <Section
            id="admin-apis"
            icon={<TerminalIcon />}
            title="APIs do Painel Administrativo"
            description="Rotas autenticadas por cookie de sessão para consumo do frontend e integrações administrativas."
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
                    { m: "GET", p: "/api/dashboard", d: "Métricas consolidadas de vendas, funil e conversão" },
                    { m: "GET", p: "/api/prospeccao", d: "Lista leads de prospecção com paginação, filtros e contadores" },
                    { m: "POST", p: "/api/prospeccao", d: "Cadastra lead manual na prospecção" },
                    { m: "PATCH/DELETE", p: "/api/prospeccao/:id", d: "Edita ou exclui lead de prospecção" },
                    { m: "DELETE", p: "/api/prospeccao", d: "Exclusão em lote ({ ids: [...] })" },
                    { m: "POST", p: "/api/prospeccao/start", d: "Inicia a fila de chamadas de prospecção" },
                    { m: "POST", p: "/api/prospeccao/pause", d: "Pausa a fila de prospecção" },
                    { m: "POST", p: "/api/prospeccao/import", d: "Upload e parsing de planilha XLSX" },
                    { m: "GET", p: "/api/clientes", d: "Lista clientes do CRM" },
                    { m: "GET/PATCH/DELETE", p: "/api/clientes/:id", d: "Detalha, edita ou remove cliente" },
                    { m: "CRUD", p: "/api/planos, /api/pacotes, /api/areas, /api/origens", d: "Cadastros de suporte a vendas" },
                    { m: "GET/PATCH", p: "/api/configuracoes", d: "Consulta ou atualiza branding, prompts e webhooks" },
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
          </Section>
        </Stack>
      )}

      <Typography variant="caption" color="text.secondary" sx={{ pb: 3, display: "block" }}>
        Painel de Vendas & Prospecção Automática. Desenvolvido para máxima estabilidade e concorrência garantida via BullMQ + Redis.
      </Typography>
    </Stack>
  );
}

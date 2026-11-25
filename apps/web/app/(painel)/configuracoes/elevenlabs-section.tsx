"use client";

import * as React from "react";
import {
  Alert,
  Box,
  Button,
  Checkbox,
  Chip,
  CircularProgress,
  Divider,
  FormControl,
  FormControlLabel,
  FormHelperText,
  IconButton,
  InputAdornment,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import Grid from "@mui/material/Grid2";
import AutoFixHighIcon from "@mui/icons-material/AutoFixHigh";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import PhoneInTalkIcon from "@mui/icons-material/PhoneInTalk";
import RefreshIcon from "@mui/icons-material/Refresh";
import VisibilityIcon from "@mui/icons-material/Visibility";
import VisibilityOffIcon from "@mui/icons-material/VisibilityOff";
import type { FieldErrors } from "@/lib/form-errors";

export interface ElevenLabsFormFields {
  brandName: string;
  elevenLabsApiKey: string;
  elevenLabsAgentId: string;
  elevenLabsPhoneNumberId: string;
  elevenLabsWebhookId: string;
  elevenLabsWebhookSecret: string;
  elevenLabsResourcePrefix: string;
}

interface PhoneNumberItem {
  phoneNumberId: string;
  phoneNumber: string;
  label: string;
  provider: string;
  supportsInbound: boolean;
  supportsOutbound: boolean;
  assignedAgentId: string | null;
  assignedAgentName: string | null;
}

interface VoiceItem {
  voiceId: string;
  name: string;
  category: string | null;
  labels: Record<string, string>;
}

interface AgentSummary {
  agentId: string;
  name: string;
  voiceId: string | null;
  tags: string[];
}

interface AccountResources {
  phoneNumbers: PhoneNumberItem[];
  sipPhoneNumbers: PhoneNumberItem[];
  voices: VoiceItem[];
  agents: AgentSummary[];
  prefixedToolsCount: number;
  prefixedToolNames: string[];
  activeAgentWebhookId: string | null;
  activeAgentWebhookEvents: string[];
  activeWorkspaceWebhookId: string | null;
  currentPrefix: string;
  configuredAgentId: string;
  configuredPhoneNumberId: string;
  configuredWebhookId: string;
  hasWebhookSecret: boolean;
}

interface ProvisionResult {
  prefix: string;
  publicBaseUrl: string;
  secret: { secretId: string; name: string; action: "created" | "updated" };
  tools: { total: number; created: number; updated: number; names: string[]; ids: string[] };
  agent: { agentId: string; name: string; action: "created" | "updated"; voiceId: string | null };
  webhook: {
    webhookId: string;
    name: string;
    url: string;
    action: "created" | "reused";
    secretRotated: boolean;
    scope: "agent";
  };
  phoneNumber: { phoneNumberId: string; assigned: boolean } | null;
  warnings: string[];
}

interface Props {
  form: ElevenLabsFormFields;
  fieldErrors: FieldErrors;
  onFieldChange: (patch: Partial<ElevenLabsFormFields>) => void;
  onSettingsSynced: (updated: Partial<ElevenLabsFormFields>) => void;
  onSaveManual: () => Promise<void>;
  onCopyUrl: (url: string) => void;
  onNotify: (message: string) => void;
}

const MASKED = "••••••••";

function previewSlugPrefix(raw: string): string {
  const cleaned = raw
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 24);
  return cleaned.length >= 2 ? cleaned : "painel_vendas";
}

function isLocalOrigin(urlStr: string): boolean {
  try {
    const u = new URL(urlStr);
    if (u.protocol !== "https:") return true;
    const h = u.hostname.toLowerCase().replace(/^\[|\]$/g, "");
    if (
      !h ||
      h === "localhost" ||
      h === "0.0.0.0" ||
      h === "::1" ||
      h === "::" ||
      h.endsWith(".local") ||
      h.endsWith(".localhost") ||
      h.endsWith(".internal")
    ) {
      return true;
    }
    if (!h.includes(".") && !h.includes(":")) return true;
    if (h.includes(":")) {
      return h.startsWith("::ffff:") || /^(fc|fd|fe8|fe9|fea|feb)/i.test(h);
    }
    const ipv4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(h);
    if (ipv4) {
      const a = Number(ipv4[1]);
      const b = Number(ipv4[2]);
      return (
        a === 0 ||
        a === 10 ||
        a === 127 ||
        (a === 100 && b >= 64 && b <= 127) ||
        (a === 169 && b === 254) ||
        (a === 172 && b >= 16 && b <= 31) ||
        (a === 192 && b === 168)
      );
    }
    return false;
  } catch {
    return true;
  }
}

function extractApiError(data: unknown, fallback: string): string {
  if (!data || typeof data !== "object") return fallback;
  const obj = data as Record<string, unknown>;
  if (typeof obj.error === "string" && obj.error.trim()) return obj.error;
  if (obj.error && typeof obj.error === "object") {
    const errObj = obj.error as { formErrors?: string[]; fieldErrors?: Record<string, string[]> };
    const firstForm = errObj.formErrors?.find(Boolean);
    if (firstForm) return firstForm;
    if (errObj.fieldErrors) {
      for (const msgs of Object.values(errObj.fieldErrors)) {
        const first = msgs?.find(Boolean);
        if (first) return first;
      }
    }
  }
  return fallback;
}

export function ElevenLabsSection({
  form,
  fieldErrors,
  onFieldChange,
  onSettingsSynced,
  onSaveManual,
  onCopyUrl,
  onNotify,
}: Props) {
  const [showKey, setShowKey] = React.useState(false);
  const [showSecret, setShowSecret] = React.useState(false);
  const [publicBaseUrl, setPublicBaseUrl] = React.useState("");
  const [selectedVoiceId, setSelectedVoiceId] = React.useState("");
  const [recreateWebhook, setRecreateWebhook] = React.useState(false);

  const [loadingResources, setLoadingResources] = React.useState(false);
  const [resourcesError, setResourcesError] = React.useState<string | null>(null);
  const [resources, setResources] = React.useState<AccountResources | null>(null);

  const [provisioning, setProvisioning] = React.useState(false);
  const [provisionError, setProvisionError] = React.useState<string | null>(null);
  const [provisionResult, setProvisionResult] = React.useState<ProvisionResult | null>(null);

  const autoLoadedRef = React.useRef(false);

  React.useEffect(() => {
    if (typeof window !== "undefined") {
      setPublicBaseUrl(window.location.origin);
    }
  }, []);

  const loadAccountResources = React.useCallback(
    async (
      silent = false,
      overrides?: {
        apiKey?: string;
        prefix?: string;
        agentId?: string;
        phoneNumberId?: string;
      }
    ) => {
      const effectiveApiKey = (overrides?.apiKey ?? form.elevenLabsApiKey).trim();
      const effectivePrefix = overrides?.prefix ?? form.elevenLabsResourcePrefix;
      const effectiveAgentId = (overrides?.agentId ?? form.elevenLabsAgentId).trim();
      const effectivePhoneId = (overrides?.phoneNumberId ?? form.elevenLabsPhoneNumberId).trim();

      if (!effectiveApiKey) {
        if (!silent) {
          setResourcesError("Informe a ElevenLabs API Key antes de carregar os recursos.");
        }
        return;
      }

      setLoadingResources(true);
      setResourcesError(null);
      try {
        const res = await fetch("/api/elevenlabs/resources", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            apiKey: effectiveApiKey,
            prefix: effectivePrefix,
          }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data?.ok) {
          const msg = extractApiError(data, "Falha ao consultar a ElevenLabs.");
          if (!silent) setResourcesError(msg);
          return;
        }

        const loaded: AccountResources = data.resources;
        setResources(loaded);

        if (!selectedVoiceId && effectiveAgentId) {
          const currentAgent = loaded.agents.find((a) => a.agentId === effectiveAgentId);
          if (currentAgent?.voiceId) {
            setSelectedVoiceId(currentAgent.voiceId);
          }
        }

        if (!effectivePhoneId && loaded.sipPhoneNumbers.length === 1) {
          onFieldChange({ elevenLabsPhoneNumberId: loaded.sipPhoneNumbers[0].phoneNumberId });
        }

        if (!silent) {
          onNotify(
            `Recursos carregados: ${loaded.sipPhoneNumbers.length} número(s) SIP e ${loaded.voices.length} voz(es).`
          );
        }
      } catch (err: unknown) {
        if (!silent) {
          setResourcesError(err instanceof Error ? err.message : "Erro de rede ao consultar ElevenLabs.");
        }
      } finally {
        setLoadingResources(false);
      }
    },
    [
      form.elevenLabsApiKey,
      form.elevenLabsAgentId,
      form.elevenLabsPhoneNumberId,
      form.elevenLabsResourcePrefix,
      onFieldChange,
      onNotify,
      selectedVoiceId,
    ]
  );

  React.useEffect(() => {
    if (!autoLoadedRef.current && form.elevenLabsApiKey === MASKED) {
      autoLoadedRef.current = true;
      void loadAccountResources(true);
    }
  }, [form.elevenLabsApiKey, loadAccountResources]);

  async function handleProvisionAll() {
    setProvisionError(null);
    setProvisionResult(null);

    if (!form.elevenLabsApiKey.trim()) {
      setProvisionError("Informe a ElevenLabs API Key (xi-api-key) antes de provisionar.");
      return;
    }

    if (isLocalOrigin(publicBaseUrl)) {
      setProvisionError(
        "A URL pública do painel precisa ser HTTPS acessível pela internet (não pode ser localhost/IP privado/HTTP)."
      );
      return;
    }

    setProvisioning(true);
    try {
      const res = await fetch("/api/elevenlabs/provision", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          apiKey: form.elevenLabsApiKey,
          publicBaseUrl: publicBaseUrl.trim(),
          prefix: form.elevenLabsResourcePrefix,
          voiceId: selectedVoiceId || undefined,
          phoneNumberId: form.elevenLabsPhoneNumberId.trim() || undefined,
          agentId: form.elevenLabsAgentId.trim() || undefined,
          recreateWebhook,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.ok) {
        setProvisionError(extractApiError(data, "Falha ao provisionar recursos na ElevenLabs."));
        return;
      }

      const result: ProvisionResult = data.result;
      setProvisionResult(result);
      setRecreateWebhook(false);

      const syncedApiKey = data.settings?.elevenLabsApiKey ?? form.elevenLabsApiKey;
      const syncedAgentId = data.settings?.elevenLabsAgentId ?? result.agent.agentId;
      const syncedPhoneId = data.settings?.elevenLabsPhoneNumberId ?? form.elevenLabsPhoneNumberId;
      const syncedWebhookId = data.settings?.elevenLabsWebhookId ?? result.webhook.webhookId;
      const syncedWebhookSecret =
        data.settings?.elevenLabsWebhookSecret ?? form.elevenLabsWebhookSecret;
      const syncedPrefix = data.settings?.elevenLabsResourcePrefix ?? result.prefix;

      // Marca como já carregado antes de atualizar estado para evitar disparo duplicado do useEffect
      autoLoadedRef.current = true;
      onSettingsSynced({
        elevenLabsApiKey: syncedApiKey,
        elevenLabsAgentId: syncedAgentId,
        elevenLabsPhoneNumberId: syncedPhoneId,
        elevenLabsWebhookId: syncedWebhookId,
        elevenLabsWebhookSecret: syncedWebhookSecret,
        elevenLabsResourcePrefix: syncedPrefix,
      });

      onNotify("Provisionamento na ElevenLabs concluído com sucesso!");
      void loadAccountResources(true, {
        apiKey: syncedApiKey,
        prefix: syncedPrefix,
        agentId: syncedAgentId,
        phoneNumberId: syncedPhoneId,
      });
    } catch (err: unknown) {
      setProvisionError(
        err instanceof Error ? err.message : "Erro inesperado ao sincronizar com a ElevenLabs."
      );
    } finally {
      setProvisioning(false);
    }
  }

  const normalizedPrefix = previewSlugPrefix(form.elevenLabsResourcePrefix || "painel_vendas");
  const cleanPublicUrl = publicBaseUrl.trim().replace(/\/+$/, "");
  const effectiveWebhookUrl = cleanPublicUrl
    ? `${cleanPublicUrl}/api/webhooks/elevenlabs`
    : "/api/webhooks/elevenlabs";
  const publicUrlIsLocal = isLocalOrigin(publicBaseUrl);

  const selectablePhoneNumbers = resources
    ? resources.sipPhoneNumbers.length > 0
      ? resources.sipPhoneNumbers
      : resources.phoneNumbers
    : [];

  const agentWebhookMatches =
    Boolean(resources?.activeAgentWebhookId) &&
    resources?.activeAgentWebhookId === form.elevenLabsWebhookId;
  const webhookChipLabel = agentWebhookMatches
    ? "Webhook isolado do agente ativo"
    : resources?.activeAgentWebhookId
      ? "Agente usa outro webhook na ElevenLabs"
      : "Webhook do agente não vinculado";

  return (
    <Stack spacing={2.5}>
      {/* PASSO 1: API KEY E DESCOBERTA */}
      <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} alignItems={{ sm: "flex-start" }}>
        <TextField
          label="ElevenLabs API Key (xi-api-key)"
          fullWidth
          type={showKey && form.elevenLabsApiKey !== MASKED ? "text" : "password"}
          value={form.elevenLabsApiKey}
          error={!!fieldErrors.elevenLabsApiKey}
          helperText={
            fieldErrors.elevenLabsApiKey ??
            (form.elevenLabsApiKey === MASKED
              ? "Chave salva no banco. Digite uma nova chave para substituir ou limpe o campo para remover."
              : "Chave da API ElevenLabs com permissão de workspace para agentes, tools, secrets e webhooks.")
          }
          placeholder="sk_..."
          onChange={(e) => onFieldChange({ elevenLabsApiKey: e.target.value })}
          InputProps={{
            endAdornment:
              form.elevenLabsApiKey !== MASKED ? (
                <InputAdornment position="end">
                  <IconButton
                    edge="end"
                    onClick={() => setShowKey((v) => !v)}
                    aria-label="Mostrar ou ocultar API Key"
                  >
                    {showKey ? <VisibilityOffIcon fontSize="small" /> : <VisibilityIcon fontSize="small" />}
                  </IconButton>
                </InputAdornment>
              ) : undefined,
          }}
        />
        <Button
          variant="outlined"
          color="secondary"
          onClick={() => void loadAccountResources(false)}
          disabled={loadingResources || !form.elevenLabsApiKey.trim()}
          startIcon={loadingResources ? <CircularProgress size={16} color="inherit" /> : <RefreshIcon />}
          sx={{ minWidth: 230, height: 56, flexShrink: 0 }}
        >
          {loadingResources ? "Carregando..." : "Carregar SIP e vozes"}
        </Button>
      </Stack>

      {resourcesError && <Alert severity="error">{resourcesError}</Alert>}

      {resources && (
        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
          <Chip
            size="small"
            icon={<PhoneInTalkIcon />}
            color={resources.sipPhoneNumbers.length > 0 ? "success" : "warning"}
            variant="outlined"
            label={`${resources.sipPhoneNumbers.length} número(s) SIP Trunk na conta`}
          />
          <Chip
            size="small"
            color={resources.prefixedToolsCount > 0 ? "success" : "default"}
            variant="outlined"
            label={`${resources.prefixedToolsCount} tool(s) com prefixo "${resources.currentPrefix}_"`}
          />
          <Chip
            size="small"
            color={agentWebhookMatches ? "success" : "default"}
            variant="outlined"
            label={webhookChipLabel}
          />
        </Stack>
      )}

      {/* PASSO 2: PROVISIONAMENTO AUTOMÁTICO EM 1 CLIQUE */}
      <Box
        sx={{
          p: 2.5,
          borderRadius: 2,
          border: 1,
          borderColor: "secondary.main",
          bgcolor: "rgba(156, 39, 176, 0.03)",
        }}
      >
        <Stack spacing={2}>
          <Box>
            <Stack direction="row" alignItems="center" spacing={1} mb={0.5}>
              <AutoFixHighIcon color="secondary" fontSize="small" />
              <Typography variant="subtitle1" fontWeight={700}>
                Provisionamento Automático (1 Clique)
              </Typography>
            </Stack>
            <Typography variant="body2" color="text.secondary">
              Cria ou sincroniza automaticamente na sua conta ElevenLabs o <strong>Secret</strong>, as{" "}
              <strong>12 ferramentas</strong> (<code>/api/agent/*</code>), o <strong>Agente de Voz</strong>{" "}
              (com prompt, primeira mensagem, overrides e <strong>Webhook pós-chamada isolado</strong> no
              próprio agente, sem alterar o webhook global de outros projetos) e vincula o{" "}
              <strong>Número SIP Trunk</strong> escolhido.
            </Typography>
          </Box>

          <Grid container spacing={2}>
            <Grid size={{ xs: 12, sm: 7 }}>
              <TextField
                label="URL Pública HTTPS do Painel"
                fullWidth
                size="small"
                value={publicBaseUrl}
                onChange={(e) => setPublicBaseUrl(e.target.value)}
                placeholder="https://painel.seudominio.com.br"
                error={Boolean(publicBaseUrl) && publicUrlIsLocal}
                helperText={
                  publicUrlIsLocal
                    ? "Substitua localhost/IP privado pelo domínio público HTTPS acessível pela ElevenLabs."
                    : "Base usada para cadastrar as 12 tools (/api/agent/*) e o webhook pós-chamada."
                }
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 5 }}>
              <TextField
                label="Prefixo dos Recursos na ElevenLabs"
                fullWidth
                size="small"
                value={form.elevenLabsResourcePrefix}
                error={!!fieldErrors.elevenLabsResourcePrefix}
                inputProps={{ maxLength: 40 }}
                onChange={(e) => onFieldChange({ elevenLabsResourcePrefix: e.target.value })}
                placeholder="painel_vendas"
                helperText={
                  fieldErrors.elevenLabsResourcePrefix ??
                  `Slug aplicado: "${normalizedPrefix}" (evita conflito com outros projetos).`
                }
              />
            </Grid>
          </Grid>

          <Box
            sx={{
              px: 1.5,
              py: 1,
              borderRadius: 1.5,
              bgcolor: "background.paper",
              border: 1,
              borderColor: "divider",
            }}
          >
            <Typography variant="caption" color="text.secondary" component="div" sx={{ lineHeight: 1.7 }}>
              <strong>Nomes gerados na ElevenLabs:</strong> Agente{" "}
              <code>[{normalizedPrefix}] {form.brandName || "Painel de Vendas"} — Prospecção de Voz</code> ·
              Secret <code>{normalizedPrefix}_agent_api_token</code> · Tools{" "}
              <code>{normalizedPrefix}_buscar_cliente</code>, <code>{normalizedPrefix}_listar_areas</code>, …
              (12 no total) · Webhook <code>[{normalizedPrefix}] Webhook Pós-Chamada</code>
            </Typography>
          </Box>

          <Grid container spacing={2}>
            <Grid size={{ xs: 12, sm: 6 }}>
              <FormControl fullWidth size="small">
                <InputLabel id="sip-number-select-label">Número SIP Trunk (ElevenLabs)</InputLabel>
                <Select
                  labelId="sip-number-select-label"
                  label="Número SIP Trunk (ElevenLabs)"
                  value={
                    selectablePhoneNumbers.some(
                      (p) => p.phoneNumberId === form.elevenLabsPhoneNumberId
                    )
                      ? form.elevenLabsPhoneNumberId
                      : ""
                  }
                  onChange={(e) => onFieldChange({ elevenLabsPhoneNumberId: String(e.target.value) })}
                  displayEmpty
                >
                  <MenuItem value="">
                    <em>
                      {resources
                        ? selectablePhoneNumbers.length > 0
                          ? "Selecione um número SIP da conta..."
                          : "Nenhum número SIP encontrado na ElevenLabs"
                        : 'Clique em "Carregar SIP e vozes" para listar'}
                    </em>
                  </MenuItem>
                  {selectablePhoneNumbers.map((item) => (
                    <MenuItem key={item.phoneNumberId} value={item.phoneNumberId}>
                      <Box>
                        <Typography variant="body2" fontWeight={600}>
                          {item.label || item.phoneNumber} ({item.phoneNumber})
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {item.phoneNumberId} · {item.provider}
                          {item.assignedAgentName ? ` · Atual: ${item.assignedAgentName}` : ""}
                        </Typography>
                      </Box>
                    </MenuItem>
                  ))}
                </Select>
                <FormHelperText>
                  Ao sincronizar, o agente será vinculado automaticamente a este número SIP.
                </FormHelperText>
              </FormControl>
            </Grid>

            <Grid size={{ xs: 12, sm: 6 }}>
              <FormControl fullWidth size="small">
                <InputLabel id="elevenlabs-voice-select-label">Voz do Agente (Opcional)</InputLabel>
                <Select
                  labelId="elevenlabs-voice-select-label"
                  label="Voz do Agente (Opcional)"
                  value={
                    resources?.voices.some((v) => v.voiceId === selectedVoiceId)
                      ? selectedVoiceId
                      : ""
                  }
                  onChange={(e) => setSelectedVoiceId(String(e.target.value))}
                  displayEmpty
                >
                  <MenuItem value="">
                    <em>
                      {resources
                        ? "Manter voz atual / padrão da ElevenLabs"
                        : 'Clique em "Carregar SIP e vozes" para listar'}
                    </em>
                  </MenuItem>
                  {(resources?.voices ?? []).map((v) => (
                    <MenuItem key={v.voiceId} value={v.voiceId}>
                      {v.name}
                      {v.category ? ` (${v.category})` : ""}
                    </MenuItem>
                  ))}
                </Select>
                <FormHelperText>
                  Na criação do agente, usa modelo <code>eleven_flash_v2_5</code> (PT-BR baixa latência).
                </FormHelperText>
              </FormControl>
            </Grid>
          </Grid>

          <Stack
            direction={{ xs: "column", sm: "row" }}
            justifyContent="space-between"
            alignItems={{ xs: "stretch", sm: "center" }}
            spacing={1.5}
          >
            <FormControlLabel
              control={
                <Checkbox
                  size="small"
                  checked={recreateWebhook}
                  onChange={(e) => setRecreateWebhook(e.target.checked)}
                />
              }
              label={
                <Typography variant="body2" color="text.secondary">
                  Recriar webhook pós-chamada e gerar novo signing secret
                </Typography>
              }
            />
            <Button
              variant="contained"
              color="secondary"
              size="large"
              disabled={provisioning || !form.elevenLabsApiKey.trim() || publicUrlIsLocal}
              onClick={() => void handleProvisionAll()}
              startIcon={
                provisioning ? (
                  <CircularProgress size={18} color="inherit" />
                ) : (
                  <AutoFixHighIcon />
                )
              }
            >
              {provisioning
                ? "Provisionando na ElevenLabs..."
                : "Provisionar / Sincronizar na ElevenLabs"}
            </Button>
          </Stack>

          {provisionError && <Alert severity="error">{provisionError}</Alert>}

          {provisionResult && (
            <Alert severity="success" icon={<CheckCircleOutlineIcon fontSize="inherit" />}>
              <Typography variant="subtitle2" fontWeight={700} gutterBottom>
                Sincronização concluída (prefixo: {provisionResult.prefix})
              </Typography>
              <Stack spacing={0.5} sx={{ fontSize: 13 }}>
                <div>
                  • <strong>Secret:</strong> <code>{provisionResult.secret.name}</code> (
                  {provisionResult.secret.action === "created" ? "criado" : "atualizado"})
                </div>
                <div>
                  • <strong>Ferramentas:</strong> {provisionResult.tools.total} sincronizadas (
                  {provisionResult.tools.created} criadas, {provisionResult.tools.updated} atualizadas)
                </div>
                <div>
                  • <strong>Agente:</strong> {provisionResult.agent.name} (
                  <code>{provisionResult.agent.agentId}</code> —{" "}
                  {provisionResult.agent.action === "created" ? "criado" : "atualizado"})
                </div>
                <div>
                  • <strong>Webhook pós-chamada (escopo do agente):</strong>{" "}
                  <code>{provisionResult.webhook.url}</code> (
                  {provisionResult.webhook.action === "created" ? "criado" : "reutilizado"}
                  {provisionResult.webhook.secretRotated ? ", signing secret salvo" : ""})
                </div>
                {provisionResult.phoneNumber && (
                  <div>
                    • <strong>Número SIP:</strong>{" "}
                    <code>{provisionResult.phoneNumber.phoneNumberId}</code> vinculado ao agente
                  </div>
                )}
              </Stack>
              {provisionResult.warnings.length > 0 && (
                <Box mt={1}>
                  {provisionResult.warnings.map((w, i) => (
                    <Typography key={i} variant="caption" color="warning.dark" display="block">
                      Aviso: {w}
                    </Typography>
                  ))}
                </Box>
              )}
            </Alert>
          )}
        </Stack>
      </Box>

      <Divider />

      {/* PASSO 3: IDS E CREDENCIAIS SALVAS (AUTO-PREENCHIDAS OU AJUSTE MANUAL) */}
      <Typography variant="subtitle2" color="text.secondary" fontWeight={600}>
        Identificadores Salvos (preenchidos automaticamente pela sincronização ou editáveis manualmente)
      </Typography>

      <Grid container spacing={2}>
        <Grid size={{ xs: 12, sm: 6 }}>
          <TextField
            label="Agent ID (agent_id)"
            fullWidth
            value={form.elevenLabsAgentId}
            error={!!fieldErrors.elevenLabsAgentId}
            helperText={
              fieldErrors.elevenLabsAgentId ?? "ID do agente sincronizado no ElevenLabs Agents."
            }
            placeholder="agent_..."
            onChange={(e) => onFieldChange({ elevenLabsAgentId: e.target.value })}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6 }}>
          <TextField
            label="Phone Number ID (SIP Trunk)"
            fullWidth
            value={form.elevenLabsPhoneNumberId}
            error={!!fieldErrors.elevenLabsPhoneNumberId}
            helperText={
              fieldErrors.elevenLabsPhoneNumberId ??
              "Preenchido ao escolher o número SIP acima ou colado manualmente."
            }
            placeholder="phnum_..."
            onChange={(e) => onFieldChange({ elevenLabsPhoneNumberId: e.target.value })}
          />
        </Grid>
      </Grid>

      <TextField
        label="Webhook Signing Secret (ElevenLabs)"
        fullWidth
        type={showSecret && form.elevenLabsWebhookSecret !== MASKED ? "text" : "password"}
        value={form.elevenLabsWebhookSecret}
        error={!!fieldErrors.elevenLabsWebhookSecret}
        helperText={
          fieldErrors.elevenLabsWebhookSecret ??
          (form.elevenLabsWebhookSecret === MASKED
            ? "Secret salvo no banco (gerado automaticamente na sincronização ou salvo manualmente)."
            : "Usado para validar a assinatura HMAC-SHA256 (header ElevenLabs-Signature) nos eventos pós-chamada.")
        }
        placeholder="wsec_..."
        onChange={(e) => onFieldChange({ elevenLabsWebhookSecret: e.target.value })}
        InputProps={{
          endAdornment:
            form.elevenLabsWebhookSecret !== MASKED ? (
              <InputAdornment position="end">
                <IconButton
                  edge="end"
                  onClick={() => setShowSecret((v) => !v)}
                  aria-label="Mostrar ou ocultar Secret"
                >
                  {showSecret ? <VisibilityOffIcon fontSize="small" /> : <VisibilityIcon fontSize="small" />}
                </IconButton>
              </InputAdornment>
            ) : undefined,
        }}
      />

      <Box sx={{ p: 2, bgcolor: "grey.50", borderRadius: 2, border: 1, borderColor: "divider" }}>
        <Typography variant="subtitle2" gutterBottom fontWeight={600}>
          Post-Call Webhook da ElevenLabs
        </Typography>
        <Typography variant="body2" color="text.secondary" paragraph sx={{ mb: 1.5 }}>
          Vinculado automaticamente ao agente ao clicar em <strong>Provisionar / Sincronizar</strong>{" "}
          (eventos <code>transcript</code> e <code>call_initiation_failure</code>). Caso prefira configurar
          manualmente:
        </Typography>

        <TextField
          label="URL do Post-Call Webhook"
          fullWidth
          size="small"
          value={effectiveWebhookUrl}
          disabled
          InputProps={{
            endAdornment: (
              <InputAdornment position="end">
                <Tooltip title="Copiar URL">
                  <IconButton edge="end" onClick={() => onCopyUrl(effectiveWebhookUrl)}>
                    <ContentCopyIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              </InputAdornment>
            ),
          }}
        />
      </Box>

      <Stack direction="row" justifyContent="flex-end">
        <Button variant="contained" onClick={() => void onSaveManual()}>
          Salvar integração ElevenLabs
        </Button>
      </Stack>
    </Stack>
  );
}

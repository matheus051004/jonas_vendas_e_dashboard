"use client";

import * as React from "react";
import {
  Alert,
  Box,
  Button,
  Checkbox,
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
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import RefreshIcon from "@mui/icons-material/Refresh";
import VisibilityIcon from "@mui/icons-material/Visibility";
import VisibilityOffIcon from "@mui/icons-material/VisibilityOff";
import type { FieldErrors } from "@/lib/form-errors";

export interface ElevenLabsFormFields {
  elevenLabsApiKey: string;
  elevenLabsAgentId: string;
  elevenLabsPhoneNumberId: string;
  elevenLabsWebhookId: string;
  elevenLabsWebhookSecret: string;
  elevenLabsResourcePrefix: string;
  elevenLabsLlmModel: string;
  elevenLabsTtsModelId: string;
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

interface LlmModelItem {
  llm: string;
  maxContextLimit: number | null;
  maxTokensLimit: number | null;
  supportsParallelToolCalls: boolean;
  isDeprecated: boolean;
  isInWarningPeriod: boolean;
}

interface TtsModelItem {
  modelId: string;
  name: string;
  description: string;
  supportsPortuguese: boolean;
  isLowLatency: boolean;
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
  llmModels: LlmModelItem[];
  ttsModels: TtsModelItem[];
  agents: AgentSummary[];
  prefixedToolsCount: number;
  prefixedToolNames: string[];
  activeAgentWebhookId: string | null;
  activeAgentWebhookEvents: string[];
  activeAgentLlmModel: string | null;
  activeAgentTtsModelId: string | null;
  activeAgentVoiceId: string | null;
  activeWorkspaceWebhookId: string | null;
  currentPrefix: string;
  configuredAgentId: string;
  configuredPhoneNumberId: string;
  configuredWebhookId: string;
  configuredLlmModel: string;
  configuredTtsModelId: string;
  hasWebhookSecret: boolean;
}

interface ProvisionResult {
  prefix: string;
  publicBaseUrl: string;
  secret: { secretId: string; name: string; action: "created" | "updated" };
  tools: { total: number; created: number; updated: number; names: string[]; ids: string[] };
  agent: {
    agentId: string;
    name: string;
    action: "created" | "updated";
    voiceId: string | null;
    llmModel: string | null;
    ttsModelId: string | null;
  };
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

function previewPrefixLabel(slug: string): string {
  return slug
    .split("_")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
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
  const modelsTouchedRef = React.useRef(false);

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
        skipPrefill?: boolean;
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
            agentId: effectiveAgentId,
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
          const resolvedVoiceId = loaded.activeAgentVoiceId || currentAgent?.voiceId;
          if (resolvedVoiceId) {
            setSelectedVoiceId(resolvedVoiceId);
          }
        }

        const fieldPatch: Partial<ElevenLabsFormFields> = {};
        if (!effectivePhoneId && loaded.sipPhoneNumbers.length === 1) {
          fieldPatch.elevenLabsPhoneNumberId = loaded.sipPhoneNumbers[0].phoneNumberId;
        }
        if (!overrides?.skipPrefill && !modelsTouchedRef.current) {
          if (!form.elevenLabsLlmModel.trim() && loaded.activeAgentLlmModel) {
            fieldPatch.elevenLabsLlmModel = loaded.activeAgentLlmModel;
          }
          if (!form.elevenLabsTtsModelId.trim() && loaded.activeAgentTtsModelId) {
            fieldPatch.elevenLabsTtsModelId = loaded.activeAgentTtsModelId;
          }
        }
        if (Object.keys(fieldPatch).length > 0) {
          onFieldChange(fieldPatch);
        }

        if (!silent) {
          onNotify(
            `Recursos carregados: ${loaded.sipPhoneNumbers.length} SIP, ${loaded.voices.length} voz(es), ${loaded.llmModels.length} LLM(s) e ${loaded.ttsModels.length} modelo(s) de voz.`
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
      form.elevenLabsLlmModel,
      form.elevenLabsTtsModelId,
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
          llmModel: form.elevenLabsLlmModel.trim(),
          ttsModelId: form.elevenLabsTtsModelId.trim(),
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
      const syncedLlmModel = data.settings?.elevenLabsLlmModel ?? form.elevenLabsLlmModel;
      const syncedTtsModelId = data.settings?.elevenLabsTtsModelId ?? form.elevenLabsTtsModelId;

      // Marca como já carregado antes de atualizar estado para evitar disparo duplicado do useEffect
      autoLoadedRef.current = true;
      onSettingsSynced({
        elevenLabsApiKey: syncedApiKey,
        elevenLabsAgentId: syncedAgentId,
        elevenLabsPhoneNumberId: syncedPhoneId,
        elevenLabsWebhookId: syncedWebhookId,
        elevenLabsWebhookSecret: syncedWebhookSecret,
        elevenLabsResourcePrefix: syncedPrefix,
        elevenLabsLlmModel: syncedLlmModel,
        elevenLabsTtsModelId: syncedTtsModelId,
      });

      onNotify("Provisionamento na ElevenLabs concluído com sucesso!");
      void loadAccountResources(true, {
        apiKey: syncedApiKey,
        prefix: syncedPrefix,
        agentId: syncedAgentId,
        phoneNumberId: syncedPhoneId,
        skipPrefill: true,
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
  const prefixLabel = previewPrefixLabel(normalizedPrefix);
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
              ? "Chave salva no banco. Digite outra para substituir ou limpe para remover."
              : "Chave de API com permissão para agentes, tools, secrets e webhooks.")
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
          onClick={() => void loadAccountResources(false)}
          disabled={loadingResources || !form.elevenLabsApiKey.trim()}
          startIcon={loadingResources ? <CircularProgress size={16} color="inherit" /> : <RefreshIcon />}
          sx={{ minWidth: 210, height: 56, flexShrink: 0 }}
        >
          {loadingResources ? "Carregando..." : "Carregar recursos"}
        </Button>
      </Stack>

      {resourcesError && <Alert severity="error">{resourcesError}</Alert>}

      {resources && (
        <Typography variant="caption" color="text.secondary">
          Conta conectada: {resources.sipPhoneNumbers.length} SIP · {resources.voices.length} voz(es) ·{" "}
          {resources.llmModels.length} LLM(s) · {resources.ttsModels.length} modelo(s) de voz ·{" "}
          {resources.prefixedToolsCount} tool(s) ({resources.currentPrefix}_*) · {webhookChipLabel}
        </Typography>
      )}

      <Box
        sx={{
          p: 2,
          borderRadius: 1.5,
          border: 1,
          borderColor: "divider",
          bgcolor: "grey.50",
        }}
      >
        <Stack spacing={2}>
          <Box>
            <Typography variant="subtitle2" fontWeight={600} gutterBottom>
              Sincronização com a ElevenLabs
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Cria ou atualiza o secret, as 12 tools (/api/agent/*), o agente de voz, o webhook
              pós-chamada do agente e vincula o número SIP selecionado.
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
                    ? "Substitua localhost/IP privado pelo domínio público HTTPS."
                    : "Base usada nas tools (/api/agent/*) e no webhook pós-chamada."
                }
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 5 }}>
              <TextField
                label="Prefixo dos Recursos"
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
              borderRadius: 1,
              bgcolor: "background.paper",
              border: 1,
              borderColor: "divider",
            }}
          >
            <Grid container spacing={0.75} sx={{ fontSize: 12, color: "text.secondary" }}>
              <Grid size={{ xs: 12, sm: 6 }}>
                <strong>Agente:</strong> <code>{prefixLabel} - Prospecção de Voz</code>
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <strong>Webhook:</strong> <code>{prefixLabel} - Pós-Chamada</code>
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <strong>Secret:</strong> <code>{normalizedPrefix}_api_token</code>
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <strong>Tools (12):</strong> <code>{normalizedPrefix}_*</code>
              </Grid>
            </Grid>
          </Box>

          <Grid container spacing={2}>
            <Grid size={{ xs: 12, sm: 6 }}>
              <FormControl fullWidth size="small">
                <InputLabel id="sip-number-select-label" shrink>
                  Número SIP Trunk
                </InputLabel>
                <Select
                  labelId="sip-number-select-label"
                  label="Número SIP Trunk"
                  notched
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
                          ? "Selecione um número SIP..."
                          : "Nenhum número SIP encontrado"
                        : 'Clique em "Carregar recursos" para listar'}
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
                  Vinculado automaticamente ao agente durante a sincronização.
                </FormHelperText>
              </FormControl>
            </Grid>

            <Grid size={{ xs: 12, sm: 6 }}>
              <FormControl fullWidth size="small">
                <InputLabel id="elevenlabs-voice-select-label" shrink>
                  Voz do Agente (Opcional)
                </InputLabel>
                <Select
                  labelId="elevenlabs-voice-select-label"
                  label="Voz do Agente (Opcional)"
                  notched
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
                        ? "Manter voz atual / padrão"
                        : 'Clique em "Carregar recursos" para listar'}
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
                  Voz usada pelo agente nas ligações SIP.
                </FormHelperText>
              </FormControl>
            </Grid>

            <Grid size={{ xs: 12, sm: 6 }}>
              <FormControl fullWidth size="small" error={!!fieldErrors.elevenLabsLlmModel}>
                <InputLabel id="elevenlabs-llm-select-label" shrink>
                  Modelo de Raciocínio (LLM)
                </InputLabel>
                <Select
                  labelId="elevenlabs-llm-select-label"
                  label="Modelo de Raciocínio (LLM)"
                  notched
                  value={form.elevenLabsLlmModel}
                  onChange={(e) => {
                    modelsTouchedRef.current = true;
                    onFieldChange({ elevenLabsLlmModel: String(e.target.value) });
                  }}
                  displayEmpty
                  renderValue={(value) => {
                    const v = String(value ?? "");
                    if (!v) {
                      return (
                        <em>
                          {resources
                            ? "Manter atual / padrão do agente"
                            : 'Clique em "Carregar recursos" para listar'}
                        </em>
                      );
                    }
                    return v;
                  }}
                >
                  <MenuItem value="">
                    <em>
                      {resources
                        ? "Manter atual / padrão do agente"
                        : 'Clique em "Carregar recursos" para listar'}
                    </em>
                  </MenuItem>
                  {form.elevenLabsLlmModel &&
                    !resources?.llmModels.some((m) => m.llm === form.elevenLabsLlmModel) && (
                      <MenuItem value={form.elevenLabsLlmModel}>
                        {form.elevenLabsLlmModel} (atual / salvo)
                      </MenuItem>
                    )}
                  {(resources?.llmModels ?? []).map((m) => (
                    <MenuItem key={m.llm} value={m.llm}>
                      <Box>
                        <Typography variant="body2" fontWeight={600}>
                          {m.llm}
                          {m.isDeprecated
                            ? " (descontinuado)"
                            : m.isInWarningPeriod
                              ? " (em aviso de descontinuação)"
                              : ""}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {m.maxContextLimit ? `Contexto ${Math.round(m.maxContextLimit / 1000)}k` : "LLM ElevenAgents"}
                          {m.supportsParallelToolCalls ? " · Tools paralelas" : ""}
                        </Typography>
                      </Box>
                    </MenuItem>
                  ))}
                </Select>
                <FormHelperText>
                  {fieldErrors.elevenLabsLlmModel ??
                    "Consultado na conta ElevenLabs. Aplicado ao agente ao provisionar."}
                </FormHelperText>
              </FormControl>
            </Grid>

            <Grid size={{ xs: 12, sm: 6 }}>
              <FormControl fullWidth size="small" error={!!fieldErrors.elevenLabsTtsModelId}>
                <InputLabel id="elevenlabs-tts-select-label" shrink>
                  Modelo de Voz (TTS)
                </InputLabel>
                <Select
                  labelId="elevenlabs-tts-select-label"
                  label="Modelo de Voz (TTS)"
                  notched
                  value={form.elevenLabsTtsModelId}
                  onChange={(e) => {
                    modelsTouchedRef.current = true;
                    onFieldChange({ elevenLabsTtsModelId: String(e.target.value) });
                  }}
                  displayEmpty
                  renderValue={(value) => {
                    const v = String(value ?? "");
                    if (!v) {
                      return (
                        <em>
                          {resources
                            ? "Manter atual / eleven_flash_v2_5 na criação"
                            : 'Clique em "Carregar recursos" para listar'}
                        </em>
                      );
                    }
                    const found = resources?.ttsModels.find((m) => m.modelId === v);
                    return found ? `${found.name} (${found.modelId})` : v;
                  }}
                >
                  <MenuItem value="">
                    <em>
                      {resources
                        ? "Manter atual / eleven_flash_v2_5 na criação"
                        : 'Clique em "Carregar recursos" para listar'}
                    </em>
                  </MenuItem>
                  {form.elevenLabsTtsModelId &&
                    !resources?.ttsModels.some((m) => m.modelId === form.elevenLabsTtsModelId) && (
                      <MenuItem value={form.elevenLabsTtsModelId}>
                        {form.elevenLabsTtsModelId} (atual / salvo)
                      </MenuItem>
                    )}
                  {(resources?.ttsModels ?? []).map((m) => (
                    <MenuItem key={m.modelId} value={m.modelId}>
                      <Box>
                        <Typography variant="body2" fontWeight={600}>
                          {m.name} ({m.modelId})
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {m.supportsPortuguese ? "Suporta português" : "Sem suporte explícito a PT"}
                          {m.isLowLatency ? " · Baixa latência" : ""}
                        </Typography>
                      </Box>
                    </MenuItem>
                  ))}
                </Select>
                <FormHelperText>
                  {fieldErrors.elevenLabsTtsModelId ??
                    "Consultado na conta ElevenLabs. Para ligações ao vivo, prefira modelos Flash/Turbo com suporte a PT."}
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
              disabled={provisioning || !form.elevenLabsApiKey.trim() || publicUrlIsLocal}
              onClick={() => void handleProvisionAll()}
              startIcon={provisioning ? <CircularProgress size={16} color="inherit" /> : undefined}
            >
              {provisioning ? "Provisionando..." : "Provisionar na ElevenLabs"}
            </Button>
          </Stack>

          {provisionError && <Alert severity="error">{provisionError}</Alert>}

          {provisionResult && (
            <Alert severity="success">
              <Typography variant="subtitle2" fontWeight={600} gutterBottom>
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
                {(provisionResult.agent.llmModel || provisionResult.agent.ttsModelId) && (
                  <div>
                    • <strong>Modelos aplicados:</strong>{" "}
                    {provisionResult.agent.llmModel ? `LLM ${provisionResult.agent.llmModel}` : "LLM padrão"}
                    {" · "}
                    {provisionResult.agent.ttsModelId ? `TTS ${provisionResult.agent.ttsModelId}` : "TTS padrão"}
                  </div>
                )}
                <div>
                  • <strong>Webhook pós-chamada:</strong> <code>{provisionResult.webhook.url}</code> (
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

      <Typography variant="subtitle2" color="text.secondary" fontWeight={600}>
        Credenciais e IDs salvos
      </Typography>

      <Grid container spacing={2}>
        <Grid size={{ xs: 12, sm: 6 }}>
          <TextField
            label="Agent ID (agent_id)"
            fullWidth
            value={form.elevenLabsAgentId}
            error={!!fieldErrors.elevenLabsAgentId}
            helperText={fieldErrors.elevenLabsAgentId ?? "ID do agente na ElevenLabs."}
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
              fieldErrors.elevenLabsPhoneNumberId ?? "ID do número SIP vinculado às chamadas."
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
            ? "Secret salvo no banco."
            : "Usado para validar o header ElevenLabs-Signature (HMAC-SHA256) nos eventos pós-chamada.")
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

      <TextField
        label="URL do Post-Call Webhook"
        fullWidth
        size="small"
        value={effectiveWebhookUrl}
        disabled
        helperText="Vinculada ao agente automaticamente na sincronização (eventos transcript e call_initiation_failure)."
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

      <Stack direction="row" justifyContent="flex-end">
        <Button variant="contained" onClick={() => void onSaveManual()}>
          Salvar integração ElevenLabs
        </Button>
      </Stack>
    </Stack>
  );
}

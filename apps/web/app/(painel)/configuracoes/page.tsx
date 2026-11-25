"use client";

import * as React from "react";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Divider,
  IconButton,
  InputAdornment,
  Paper,
  Snackbar,
  Stack,
  Tab,
  Tabs,
  TextField,
  Tooltip,
  Typography,
  Chip,
  MenuItem,
  Select,
  FormControl,
  InputLabel,
} from "@mui/material";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import PaletteIcon from "@mui/icons-material/Palette";
import SmartToyIcon from "@mui/icons-material/SmartToy";
import WebhookIcon from "@mui/icons-material/Webhook";
import TuneIcon from "@mui/icons-material/Tune";
import RecordVoiceOverIcon from "@mui/icons-material/RecordVoiceOver";
import ChatBubbleOutlineIcon from "@mui/icons-material/ChatBubbleOutline";
import SupportAgentIcon from "@mui/icons-material/SupportAgent";
import PhoneInTalkIcon from "@mui/icons-material/PhoneInTalk";
import AddIcon from "@mui/icons-material/Add";
import { ElevenLabsSection } from "./elevenlabs-section";
import {
  SettingsBrandingSchema,
  SettingsElevenLabsSchema,
  SettingsWebhooksSchema,
  SettingsPromptSchema,
  SettingsHubsoftSchema,
  SettingsFollowUpSchema,
} from "@/lib/crud-schemas";
import { firstFieldError, submitJson, zodFieldErrors, type FieldErrors } from "@/lib/form-errors";
import { ColorPickerField } from "@/lib/color-picker-field";
import { useBranding, type Branding } from "@/lib/branding";
import { formatMinutes, DEFAULT_FOLLOW_UP_INTERVALS } from "@/lib/formatters";
import Grid from "@mui/material/Grid2";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import ImageIcon from "@mui/icons-material/Image";

interface Settings {
  brandName: string;
  brandLogo: string | null;
  colorPrimary: string;
  colorSecondary: string;
  colorBackground: string;
  aiPrompt: string;
  voiceAiPrompt: string;
  voiceFirstMessage: string;
  textAiPrompt: string;
  elevenLabsApiKey: string;
  elevenLabsAgentId: string;
  elevenLabsPhoneNumberId: string;
  elevenLabsWebhookId: string;
  elevenLabsWebhookSecret: string;
  elevenLabsResourcePrefix: string;
  agentWebhookUrl: string;
  outboundWebhookUrl: string;
  contractWebhookUrl: string;
  prospectingTextWebhookUrl: string;
  outboundWebhookSecret: string | null;
  followUpStartTime: string | null;
  followUpEndTime: string | null;
  followUpIntervals: number[];
  hubsoftBaseUrl: string;
  hubsoftVendedorId: number;
  hubsoftMotivoContratacaoId: number;
  hubsoftGruposClienteIds: number[];
  hubsoftGruposServicoIds: number[];
  hubsoftServicoStatusId: number;
}

const BRANDING_FIELDS: (keyof Settings)[] = [
  "brandName",
  "brandLogo",
  "colorPrimary",
  "colorSecondary",
  "colorBackground",
];

const PROMPT_FIELDS: (keyof Settings)[] = [
  "aiPrompt",
  "voiceAiPrompt",
  "voiceFirstMessage",
  "textAiPrompt",
];

const ELEVENLABS_FIELDS: (keyof Settings)[] = [
  "elevenLabsApiKey",
  "elevenLabsAgentId",
  "elevenLabsPhoneNumberId",
  "elevenLabsWebhookSecret",
  "elevenLabsResourcePrefix",
];

const FOLLOWUP_FIELDS: (keyof Settings)[] = [
  "followUpStartTime",
  "followUpEndTime",
  "followUpIntervals",
];

const WEBHOOK_FIELDS: (keyof Settings)[] = [
  "agentWebhookUrl",
  "outboundWebhookUrl",
  "contractWebhookUrl",
  "prospectingTextWebhookUrl",
  "outboundWebhookSecret",
];

const HUBSOFT_FIELDS: (keyof Settings)[] = [
  "hubsoftBaseUrl",
  "hubsoftVendedorId",
  "hubsoftMotivoContratacaoId",
  "hubsoftGruposClienteIds",
  "hubsoftGruposServicoIds",
  "hubsoftServicoStatusId",
];

const MAX_LOGO_BYTES = 500_000;

/** Redimensiona e converte a imagem para data URL PNG. */
async function fileToLogoDataUrl(file: File): Promise<string> {
  if (!file.type.startsWith("image/")) {
    throw new Error("Selecione um arquivo de imagem (PNG, JPG, SVG, WebP…).");
  }
  if (file.size > MAX_LOGO_BYTES * 2) {
    throw new Error("Imagem muito grande. Use um arquivo de até ~500 KB.");
  }

  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Falha ao ler o arquivo."));
    reader.readAsDataURL(file);
  });

  if (file.type === "image/svg+xml" || file.type === "image/gif") {
    if (dataUrl.length > 1_000_000) throw new Error("Logo muito grande após leitura.");
    return dataUrl;
  }

  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const el = new Image();
    el.onload = () => resolve(el);
    el.onerror = () => reject(new Error("Não foi possível processar a imagem."));
    el.src = dataUrl;
  });

  const maxW = 512;
  const maxH = 192;
  const scale = Math.min(1, maxW / img.width, maxH / img.height);
  const w = Math.max(1, Math.round(img.width * scale));
  const h = Math.max(1, Math.round(img.height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas não disponível neste navegador.");
  ctx.drawImage(img, 0, 0, w, h);

  const out = canvas.toDataURL("image/png");
  if (out.length > 1_000_000) throw new Error("Logo ainda grande demais — tente outra imagem.");
  return out;
}

function SectionCard({
  title,
  description,
  badge,
  children,
}: {
  title: string;
  description: string;
  badge?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Paper variant="outlined" sx={{ p: { xs: 2.5, sm: 3 } }}>
      <Stack spacing={2.5}>
        <Box display="flex" justifyContent="space-between" alignItems="flex-start" flexWrap="wrap" gap={1}>
          <Box>
            <Typography variant="h6" component="h2" gutterBottom sx={{ mb: 0.5 }}>
              {title}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {description}
            </Typography>
          </Box>
          {badge}
        </Box>
        {children}
      </Stack>
    </Paper>
  );
}

function IntervalRow({
  index,
  minutes,
  total,
  onChange,
  onRemove,
}: {
  index: number;
  minutes: number;
  total: number;
  onChange: (val: number) => void;
  onRemove: () => void;
}) {
  const initialUnit: "minutos" | "horas" | "dias" =
    minutes >= 1440 && minutes % 1440 === 0
      ? "dias"
      : minutes >= 60 && minutes % 60 === 0
      ? "horas"
      : "minutos";
  const initialVal =
    initialUnit === "dias"
      ? minutes / 1440
      : initialUnit === "horas"
      ? minutes / 60
      : minutes;

  const [unit, setUnit] = React.useState<"minutos" | "horas" | "dias">(initialUnit);
  const [valInput, setValInput] = React.useState<string>(String(initialVal));

  React.useEffect(() => {
    const u: "minutos" | "horas" | "dias" =
      minutes >= 1440 && minutes % 1440 === 0
        ? "dias"
        : minutes >= 60 && minutes % 60 === 0
        ? "horas"
        : "minutos";
    const v =
      u === "dias"
        ? minutes / 1440
        : u === "horas"
        ? minutes / 60
        : minutes;
    setUnit(u);
    setValInput(String(v));
  }, [minutes]);

  const commitValue = (rawString: string, currentUnit: "minutos" | "horas" | "dias") => {
    const parsed = parseInt(rawString, 10);
    const safeVal = isNaN(parsed) || parsed < 1 ? 1 : Math.min(parsed, 43200);
    setValInput(String(safeVal));
    const m = currentUnit === "dias" ? safeVal * 1440 : currentUnit === "horas" ? safeVal * 60 : safeVal;
    onChange(m);
  };

  const handleUnitChange = (newUnit: "minutos" | "horas" | "dias") => {
    setUnit(newUnit);
    commitValue(valInput, newUnit);
  };

  return (
    <Box
      sx={{
        p: 2,
        borderRadius: 2,
        border: 1,
        borderColor: "divider",
        bgcolor: "background.paper",
        transition: "border-color 0.2s, box-shadow 0.2s",
        "&:hover": { borderColor: "primary.main" },
      }}
    >
      <Stack spacing={1.5}>
        <Stack direction="row" alignItems="center" justifyContent="space-between">
          <Stack direction="row" alignItems="center" spacing={1}>
            <Chip
              label={`${index + 1}ª Tentativa`}
              size="small"
              color={index === 0 ? "primary" : "secondary"}
              variant="outlined"
              sx={{ fontWeight: 600 }}
            />
            <Typography variant="body2" fontWeight={600} color="text.primary">
              {formatMinutes(minutes)}
            </Typography>
          </Stack>
          <Tooltip title={total <= 1 ? "Mínimo de 1 etapa necessária" : "Excluir etapa"}>
            <span>
              <IconButton
                size="small"
                color="error"
                onClick={onRemove}
                disabled={total <= 1}
                aria-label={`Excluir etapa ${index + 1}`}
              >
                <DeleteOutlineIcon fontSize="small" />
              </IconButton>
            </span>
          </Tooltip>
        </Stack>

        <Grid container spacing={2} alignItems="center">
          <Grid size={{ xs: 12, sm: 6 }}>
            <TextField
              label="Tempo de espera"
              type="number"
              size="small"
              fullWidth
              value={valInput}
              inputProps={{ min: 1, step: 1, max: 43200 }}
              onChange={(e) => {
                setValInput(e.target.value);
                const p = parseInt(e.target.value, 10);
                if (!isNaN(p) && p >= 1) {
                  const m = unit === "dias" ? p * 1440 : unit === "horas" ? p * 60 : p;
                  onChange(Math.min(m, 43200));
                }
              }}
              onBlur={() => commitValue(valInput, unit)}
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <FormControl size="small" fullWidth>
              <InputLabel id={`unit-label-${index}`}>Unidade</InputLabel>
              <Select
                labelId={`unit-label-${index}`}
                label="Unidade"
                value={unit}
                onChange={(e) => handleUnitChange(e.target.value as "minutos" | "horas" | "dias")}
              >
                <MenuItem value="minutos">Minutos</MenuItem>
                <MenuItem value="horas">Horas</MenuItem>
                <MenuItem value="dias">Dias</MenuItem>
              </Select>
            </FormControl>
          </Grid>
        </Grid>

        <Typography variant="caption" color="text.secondary">
          {index === 0
            ? `Dispara ${formatMinutes(minutes)} após a última mensagem enviada pelo cliente.`
            : `Dispara ${formatMinutes(minutes)} após a tentativa anterior sem retorno.`}
        </Typography>
      </Stack>
    </Box>
  );
}

export default function ConfiguracoesPage() {
  const { setBranding } = useBranding();
  const [activeTab, setActiveTab] = React.useState(0);
  const [form, setForm] = React.useState<Settings | null>(null);
  const [snackbar, setSnackbar] = React.useState<{ open: boolean; message: string }>({
    open: false,
    message: "",
  });
  const [fieldErrors, setFieldErrors] = React.useState<FieldErrors>({});
  const logoInputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    fetch("/api/configuracoes")
      .then((r) => r.json())
      .then((data: Settings) => {
        setForm({
          ...data,
          brandName: data.brandName?.trim() ? data.brandName : "Painel de Vendas",
          brandLogo: data.brandLogo ?? null,
          colorPrimary: data.colorPrimary || "#1565c0",
          colorSecondary: data.colorSecondary || "#9c27b0",
          colorBackground: data.colorBackground || "#f5f5f5",
          aiPrompt: data.aiPrompt ?? "",
          voiceAiPrompt: data.voiceAiPrompt ?? "",
          voiceFirstMessage: data.voiceFirstMessage ?? "",
          textAiPrompt: data.textAiPrompt ?? "",
          elevenLabsApiKey: data.elevenLabsApiKey ?? "",
          elevenLabsAgentId: data.elevenLabsAgentId ?? "",
          elevenLabsPhoneNumberId: data.elevenLabsPhoneNumberId ?? "",
          elevenLabsWebhookId: data.elevenLabsWebhookId ?? "",
          elevenLabsWebhookSecret: data.elevenLabsWebhookSecret ?? "",
          elevenLabsResourcePrefix: data.elevenLabsResourcePrefix || "painel_vendas",
          agentWebhookUrl: data.agentWebhookUrl ?? "",
          outboundWebhookUrl: data.outboundWebhookUrl ?? "",
          contractWebhookUrl: data.contractWebhookUrl ?? "",
          prospectingTextWebhookUrl: data.prospectingTextWebhookUrl ?? "",
          outboundWebhookSecret: data.outboundWebhookSecret ?? null,
          followUpStartTime: data.followUpStartTime ?? "",
          followUpEndTime: data.followUpEndTime ?? "",
          followUpIntervals:
            Array.isArray(data.followUpIntervals) && data.followUpIntervals.length > 0
              ? data.followUpIntervals
              : [...DEFAULT_FOLLOW_UP_INTERVALS],
          hubsoftBaseUrl: data.hubsoftBaseUrl || "https://api.ligtop.hubsoft.com.br",
          hubsoftVendedorId: data.hubsoftVendedorId ?? 636,
          hubsoftMotivoContratacaoId: data.hubsoftMotivoContratacaoId ?? 48,
          hubsoftGruposClienteIds: data.hubsoftGruposClienteIds?.length ? data.hubsoftGruposClienteIds : [4],
          hubsoftGruposServicoIds: data.hubsoftGruposServicoIds?.length ? data.hubsoftGruposServicoIds : [835],
          hubsoftServicoStatusId: data.hubsoftServicoStatusId ?? 6,
        });
      });
  }, []);

  function sliceFields(fields: (keyof Settings)[]): Partial<Settings> {
    if (!form) return {};
    return Object.fromEntries(fields.map((k) => [k, form[k]])) as Partial<Settings>;
  }

  async function patch(partial: Partial<Settings>) {
    const result = await submitJson("/api/configuracoes", { method: "PATCH", body: partial });
    if (!result.ok) {
      setFieldErrors(result.fieldErrors);
      const detail = result.formError ?? firstFieldError(result.fieldErrors);
      return { ok: false as const, message: detail ?? "Verifique os campos destacados." };
    }
    setFieldErrors({});
    return { ok: true as const, message: "Salvo", data: result.data };
  }

  async function handleSaveBranding() {
    setFieldErrors({});
    const payload = sliceFields(BRANDING_FIELDS);
    const parsed = SettingsBrandingSchema.safeParse(payload);
    if (!parsed.success) {
      const errors = zodFieldErrors(parsed.error);
      setFieldErrors(errors);
      setSnackbar({ open: true, message: firstFieldError(errors) ?? "Verifique a aparência do painel." });
      return;
    }

    const result = await patch(parsed.data);
    setSnackbar({
      open: true,
      message: result.ok ? "Aparência salva com sucesso" : `Erro ao salvar — ${result.message}`,
    });
    if (result.ok) {
      const b = parsed.data as Branding;
      setBranding({
        brandName: b.brandName,
        brandLogo: b.brandLogo,
        colorPrimary: b.colorPrimary,
        colorSecondary: b.colorSecondary,
        colorBackground: b.colorBackground,
      });
    }
  }

  async function handleLogoFile(file: File | null) {
    if (!form || !file) return;
    try {
      const dataUrl = await fileToLogoDataUrl(file);
      setForm({ ...form, brandLogo: dataUrl });
      setFieldErrors((prev) => {
        const next = { ...prev };
        delete next.brandLogo;
        return next;
      });
    } catch (e) {
      const message = e instanceof Error ? e.message : "Falha ao processar a logo.";
      setFieldErrors((prev) => ({ ...prev, brandLogo: message }));
    }
  }

  async function handleSavePrompts() {
    setFieldErrors({});
    const payload = sliceFields(PROMPT_FIELDS);
    const parsed = SettingsPromptSchema.safeParse(payload);
    if (!parsed.success) {
      const errors = zodFieldErrors(parsed.error);
      setFieldErrors(errors);
      setSnackbar({ open: true, message: firstFieldError(errors) ?? "Verifique os campos de prompt." });
      return;
    }

    const result = await patch(parsed.data);
    setSnackbar({
      open: true,
      message: result.ok ? "Prompts de IA salvos com sucesso" : `Erro ao salvar prompts — ${result.message}`,
    });
  }

  async function handleSaveFollowUp() {
    setFieldErrors({});
    const payload = sliceFields(FOLLOWUP_FIELDS);
    const parsed = SettingsFollowUpSchema.safeParse(payload);
    if (!parsed.success) {
      const errors = zodFieldErrors(parsed.error);
      setFieldErrors(errors);
      setSnackbar({ open: true, message: firstFieldError(errors) ?? "Verifique os horários de follow-up." });
      return;
    }

    const result = await patch(parsed.data);
    setSnackbar({
      open: true,
      message: result.ok ? "Regras de follow-up salvas com sucesso" : `Erro ao salvar follow-up — ${result.message}`,
    });
  }

  async function handleSaveElevenLabs() {
    setFieldErrors({});
    const payload = sliceFields(ELEVENLABS_FIELDS);
    const parsed = SettingsElevenLabsSchema.safeParse(payload);
    if (!parsed.success) {
      const errors = zodFieldErrors(parsed.error);
      setFieldErrors(errors);
      setSnackbar({ open: true, message: firstFieldError(errors) ?? "Verifique os campos da ElevenLabs." });
      return;
    }

    const result = await patch(parsed.data);
    if (result.ok && result.data) {
      const saved = result.data as Partial<Settings>;
      setForm((prev) =>
        prev
          ? {
              ...prev,
              elevenLabsApiKey: saved.elevenLabsApiKey ?? prev.elevenLabsApiKey,
              elevenLabsAgentId: saved.elevenLabsAgentId ?? prev.elevenLabsAgentId,
              elevenLabsPhoneNumberId: saved.elevenLabsPhoneNumberId ?? prev.elevenLabsPhoneNumberId,
              elevenLabsWebhookId: saved.elevenLabsWebhookId ?? prev.elevenLabsWebhookId,
              elevenLabsWebhookSecret: saved.elevenLabsWebhookSecret ?? prev.elevenLabsWebhookSecret,
              elevenLabsResourcePrefix: saved.elevenLabsResourcePrefix ?? prev.elevenLabsResourcePrefix,
            }
          : prev
      );
    }
    setSnackbar({
      open: true,
      message: result.ok ? "Integração ElevenLabs salva com sucesso" : `Erro ao salvar ElevenLabs — ${result.message}`,
    });
  }

  async function handleSaveWebhooks() {
    setFieldErrors({});
    const payload = sliceFields(WEBHOOK_FIELDS);
    const parsed = SettingsWebhooksSchema.safeParse(payload);
    if (!parsed.success) {
      const errors = zodFieldErrors(parsed.error);
      setFieldErrors(errors);
      setSnackbar({ open: true, message: firstFieldError(errors) ?? "Verifique os campos de webhook." });
      return;
    }

    const result = await patch(parsed.data);
    setSnackbar({
      open: true,
      message: result.ok ? "Webhooks salvos com sucesso" : `Erro ao salvar webhooks — ${result.message}`,
    });
  }

  async function handleSaveHubsoft() {
    setFieldErrors({});
    const payload = sliceFields(HUBSOFT_FIELDS);
    const parsed = SettingsHubsoftSchema.safeParse(payload);
    if (!parsed.success) {
      const errors = zodFieldErrors(parsed.error);
      setFieldErrors(errors);
      setSnackbar({ open: true, message: firstFieldError(errors) ?? "Verifique os parâmetros do Hubsoft." });
      return;
    }

    const result = await patch(parsed.data);
    setSnackbar({
      open: true,
      message: result.ok ? "Padrões Hubsoft salvos com sucesso" : `Erro ao salvar Hubsoft — ${result.message}`,
    });
  }

  const copyUrl = React.useCallback(async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      setSnackbar({ open: true, message: "URL copiada para a área de transferência" });
    } catch {
      setSnackbar({ open: true, message: "Não foi possível copiar a URL" });
    }
  }, []);

  const handleElevenLabsFieldChange = React.useCallback((changes: Partial<Settings>) => {
    setForm((prev) => (prev ? { ...prev, ...changes } : prev));
  }, []);

  const handleNotify = React.useCallback((message: string) => {
    setSnackbar({ open: true, message });
  }, []);

  const handleCopyUrlVoid = React.useCallback(
    (url: string) => {
      void copyUrl(url);
    },
    [copyUrl]
  );

  if (!form) {
    return (
      <Box display="flex" alignItems="center" gap={1.5} py={4}>
        <CircularProgress size={22} />
        <Typography color="text.secondary">Carregando configurações…</Typography>
      </Box>
    );
  }

  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const inboundUrl = `${origin}/api/webhooks/inbound`;
  const agentReplyUrl = `${origin}/api/webhooks/agent/reply`;
  const agentPromptUrl = `${origin}/api/agent/prompt`;
  const voicePromptUrl = `${origin}/api/agent/prompt/voice`;
  const textPromptUrl = `${origin}/api/agent/prompt/text`;

  return (
    <Box sx={{ maxWidth: 980 }}>
      <Box mb={3}>
        <Typography variant="h4" component="h1" gutterBottom sx={{ mb: 0.5, fontWeight: 700 }}>
          Configurações
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Personalização de branding, prompts de IA, webhooks e parâmetros de integração.
        </Typography>
      </Box>

      {/* Navegação por Abas Limpas */}
      <Paper variant="outlined" sx={{ mb: 3, borderRadius: 2 }}>
        <Tabs
          value={activeTab}
          onChange={(_, val) => setActiveTab(val)}
          variant="scrollable"
          scrollButtons="auto"
          sx={{
            px: 2,
            borderBottom: 1,
            borderColor: "divider",
            "& .MuiTab-root": { minHeight: 56, textTransform: "none", fontSize: 15, fontWeight: 600 },
          }}
        >
          <Tab icon={<PaletteIcon />} iconPosition="start" label="Aparência & Marca" />
          <Tab icon={<SmartToyIcon />} iconPosition="start" label="Prompts de IA" />
          <Tab icon={<WebhookIcon />} iconPosition="start" label="Webhooks & Integrações" />
          <Tab icon={<TuneIcon />} iconPosition="start" label="Follow-up & Hubsoft" />
        </Tabs>
      </Paper>

      {/* ABA 0: APARÊNCIA */}
      {activeTab === 0 && (
        <Stack spacing={3}>
          <SectionCard
            title="Aparência do Painel"
            description="Nome do sistema, logotipo e cores (barra superior, botões e plano de fundo). Também refletido na tela de login."
          >
            <TextField
              label="Nome do sistema"
              fullWidth
              required
              value={form.brandName}
              error={!!fieldErrors.brandName}
              helperText={fieldErrors.brandName ?? "Exibido na barra superior, menu lateral e página de login."}
              onChange={(e) => setForm({ ...form, brandName: e.target.value })}
            />

            <Box>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                Logotipo da Marca
              </Typography>
              <Stack direction={{ xs: "column", sm: "row" }} spacing={2} alignItems={{ sm: "center" }}>
                <Box
                  sx={{
                    width: 200,
                    height: 72,
                    borderRadius: 2,
                    border: 1,
                    borderColor: fieldErrors.brandLogo ? "error.main" : "divider",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    bgcolor: "grey.50",
                    overflow: "hidden",
                    flexShrink: 0,
                    px: 1,
                  }}
                >
                  {form.brandLogo ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={form.brandLogo}
                      alt="Pré-visualização da logo"
                      style={{
                        maxWidth: "100%",
                        maxHeight: "100%",
                        width: "auto",
                        height: "auto",
                        objectFit: "contain",
                      }}
                    />
                  ) : (
                    <ImageIcon color="disabled" fontSize="large" />
                  )}
                </Box>
                <Stack spacing={1}>
                  <input
                    ref={logoInputRef}
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/svg+xml,image/gif"
                    hidden
                    onChange={(e) => {
                      const file = e.target.files?.[0] ?? null;
                      e.target.value = "";
                      void handleLogoFile(file);
                    }}
                  />
                  <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                    <Button variant="outlined" startIcon={<ImageIcon />} onClick={() => logoInputRef.current?.click()}>
                      Enviar logo
                    </Button>
                    {form.brandLogo && (
                      <Button
                        variant="text"
                        color="error"
                        startIcon={<DeleteOutlineIcon />}
                        onClick={() => setForm({ ...form, brandLogo: null })}
                      >
                        Remover
                      </Button>
                    )}
                  </Stack>
                  <Typography variant="caption" color={fieldErrors.brandLogo ? "error" : "text.secondary"}>
                    {fieldErrors.brandLogo ??
                      "PNG, JPG, WebP ou SVG. Preferência para formato retangular. Até ~500 KB."}
                  </Typography>
                </Stack>
              </Stack>
            </Box>

            <Grid container spacing={3}>
              <Grid size={{ xs: 12, sm: 4 }}>
                <ColorPickerField
                  label="Cor primária"
                  value={form.colorPrimary}
                  error={!!fieldErrors.colorPrimary}
                  helperText={fieldErrors.colorPrimary ?? "Barra superior e botões principais"}
                  onChange={(hex) => setForm({ ...form, colorPrimary: hex })}
                />
              </Grid>
              <Grid size={{ xs: 12, sm: 4 }}>
                <ColorPickerField
                  label="Cor secundária"
                  value={form.colorSecondary}
                  error={!!fieldErrors.colorSecondary}
                  helperText={fieldErrors.colorSecondary ?? "Ações secundárias e destaques"}
                  onChange={(hex) => setForm({ ...form, colorSecondary: hex })}
                />
              </Grid>
              <Grid size={{ xs: 12, sm: 4 }}>
                <ColorPickerField
                  label="Cor de fundo"
                  value={form.colorBackground}
                  error={!!fieldErrors.colorBackground}
                  helperText={fieldErrors.colorBackground ?? "Fundo geral do painel e login"}
                  onChange={(hex) => setForm({ ...form, colorBackground: hex })}
                />
              </Grid>
            </Grid>

            <Box
              sx={{
                p: 2,
                borderRadius: 2,
                border: 1,
                borderColor: "divider",
                bgcolor: form.colorBackground,
              }}
            >
              <Typography variant="caption" color="text.secondary" display="block" mb={1}>
                Pré-visualização
              </Typography>
              <Box
                sx={{
                  display: "flex",
                  alignItems: "center",
                  gap: 1.5,
                  px: 2,
                  py: 1.25,
                  borderRadius: 1,
                  bgcolor: form.colorPrimary,
                  color: "#fff",
                  mb: 1.5,
                }}
              >
                {form.brandLogo ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={form.brandLogo}
                    alt=""
                    style={{
                      height: 28,
                      width: "auto",
                      maxWidth: 120,
                      objectFit: "contain",
                      borderRadius: 4,
                      display: "block",
                    }}
                  />
                ) : null}
                <Typography variant="subtitle2" fontWeight={600} noWrap>
                  {form.brandName || "Nome do sistema"}
                </Typography>
              </Box>
              <Stack direction="row" spacing={1}>
                <Button
                  size="small"
                  variant="contained"
                  sx={{ bgcolor: form.colorPrimary, "&:hover": { bgcolor: form.colorPrimary } }}
                >
                  Primário
                </Button>
                <Button
                  size="small"
                  variant="contained"
                  sx={{ bgcolor: form.colorSecondary, "&:hover": { bgcolor: form.colorSecondary } }}
                >
                  Secundário
                </Button>
              </Stack>
            </Box>

            <Stack direction="row" justifyContent="flex-end">
              <Button variant="contained" onClick={() => void handleSaveBranding()}>
                Salvar aparência
              </Button>
            </Stack>
          </SectionCard>
        </Stack>
      )}

      {/* ABA 1: PROMPTS DE IA */}
      {activeTab === 1 && (
        <Stack spacing={3}>
          {/* IA DE VENDAS (CHAT GERAL) */}
          <SectionCard
            title="1. IA de Atendimento & Vendas (WhatsApp / Chat)"
            description="Instruções e persona para o atendimento receptivo de mensagens e conversas via chat."
            badge={<Chip label="Receptivo / Chat" color="primary" variant="outlined" size="small" icon={<SupportAgentIcon />} />}
          >
            <TextField
              label="Endpoint do Prompt de Vendas (GET)"
              fullWidth
              value={agentPromptUrl}
              disabled
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    <Tooltip title="Copiar URL">
                      <IconButton edge="end" onClick={() => void copyUrl(agentPromptUrl)}>
                        <ContentCopyIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </InputAdornment>
                ),
              }}
            />

            <TextField
              label="Prompt / Instruções da IA de Vendas (Chat)"
              fullWidth
              multiline
              minRows={6}
              maxRows={20}
              value={form.aiPrompt}
              error={!!fieldErrors.aiPrompt}
              helperText={
                fieldErrors.aiPrompt ??
                `Regras de conversa, planos e negociação no chat (${form.aiPrompt.length} caracteres).`
              }
              placeholder="Exemplo: Você é o assistente virtual de vendas. Seja simpático, tire dúvidas sobre planos e guie o cliente até a contratação..."
              onChange={(e) => setForm({ ...form, aiPrompt: e.target.value })}
              InputProps={{
                sx: {
                  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace',
                  fontSize: 13,
                  lineHeight: 1.6,
                },
              }}
            />
          </SectionCard>

          {/* IA DE VOZ (PROSPECÇÃO ATIVA POR LIGAÇÃO) */}
          <SectionCard
            title="2. IA de Voz (Prospecção Ativa — ElevenLabs Agents)"
            description="Persona, script de abordagem telefônica e saudação inicial enviados via override em cada chamada SIP."
            badge={<Chip label="Prospecção Ativa (Voz)" color="secondary" variant="outlined" size="small" icon={<RecordVoiceOverIcon />} />}
          >
            <Alert severity="info" variant="outlined">
              Variáveis dinâmicas injetadas automaticamente em toda ligação:{" "}
              <code>{"{{name}}"}</code>, <code>{"{{phone}}"}</code>, <code>{"{{raw_document}}"}</code>,{" "}
              <code>{"{{neighborhood}}"}</code>, <code>{"{{city}}"}</code>, <code>{"{{full_address}}"}</code>.
              <br />
              Lembre-se de ativar <strong>System Prompt</strong> e <strong>First Message</strong> em{" "}
              <em>Agent → Security → Enable overrides</em> no painel da ElevenLabs.
            </Alert>

            <TextField
              label="Saudação Inicial da Ligação (voiceFirstMessage)"
              fullWidth
              value={form.voiceFirstMessage}
              error={!!fieldErrors.voiceFirstMessage}
              helperText={
                fieldErrors.voiceFirstMessage ??
                "Primeira frase falada pelo agente ao o lead atender. Se vazio, usa a saudação padrão configurada na ElevenLabs."
              }
              placeholder="Olá {{name}}, tudo bem? Aqui é da Ligtop Fibra, estou falando com o responsável?"
              onChange={(e) => setForm({ ...form, voiceFirstMessage: e.target.value })}
            />

            <TextField
              label="Endpoint do Prompt de Voz (GET)"
              fullWidth
              value={voicePromptUrl}
              disabled
              helperText="Disponível também com filtro: /api/agent/prompt?type=voice"
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    <Tooltip title="Copiar URL">
                      <IconButton edge="end" onClick={() => void copyUrl(voicePromptUrl)}>
                        <ContentCopyIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </InputAdornment>
                ),
              }}
            />

            <TextField
              label="Prompt / Instruções da IA de Voz (voiceAiPrompt)"
              fullWidth
              multiline
              minRows={6}
              maxRows={20}
              value={form.voiceAiPrompt}
              error={!!fieldErrors.voiceAiPrompt}
              helperText={
                fieldErrors.voiceAiPrompt ??
                `Se preenchido, sobrescreve o System Prompt do agente na ElevenLabs (${form.voiceAiPrompt.length} caracteres).`
              }
              placeholder="Exemplo: Você é o consultor de prospecção por voz da Ligtop Fibra falando com {{name}} ({{neighborhood}}). Apresente os planos disponíveis e use as tools para consultar cobertura e fechar contrato..."
              onChange={(e) => setForm({ ...form, voiceAiPrompt: e.target.value })}
              InputProps={{
                sx: {
                  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace',
                  fontSize: 13,
                  lineHeight: 1.6,
                },
              }}
            />
          </SectionCard>

          {/* IA DE TEXTO (PROSPECÇÃO ATIVA / FALLBACK) */}
          <SectionCard
            title="3. IA de Texto (Prospecção / Mensagem de Fallback)"
            description="Mensagem e instruções para envio via texto quando a ligação não for atendida ou em prospecção direta."
            badge={<Chip label="Prospecção Ativa (Texto)" color="info" variant="outlined" size="small" icon={<ChatBubbleOutlineIcon />} />}
          >
            <TextField
              label="Endpoint do Prompt de Texto (GET)"
              fullWidth
              value={textPromptUrl}
              disabled
              helperText="Disponível também com filtro: /api/agent/prompt?type=text"
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    <Tooltip title="Copiar URL">
                      <IconButton edge="end" onClick={() => void copyUrl(textPromptUrl)}>
                        <ContentCopyIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </InputAdornment>
                ),
              }}
            />

            <TextField
              label="Prompt / Instruções da IA de Texto"
              fullWidth
              multiline
              minRows={6}
              maxRows={20}
              value={form.textAiPrompt}
              error={!!fieldErrors.textAiPrompt}
              helperText={
                fieldErrors.textAiPrompt ??
                `Defina o modelo de mensagem de abordagem que será enviado quando a ligação falhar (${form.textAiPrompt.length} caracteres).`
              }
              placeholder="Exemplo: Olá! Tentamos contato por telefone para apresentar nossa condição especial de internet fibra para o seu endereço em Ceilândia. Responda esta mensagem para conferir os planos disponíveis com instalação grátis!"
              onChange={(e) => setForm({ ...form, textAiPrompt: e.target.value })}
              InputProps={{
                sx: {
                  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace',
                  fontSize: 13,
                  lineHeight: 1.6,
                },
              }}
            />
          </SectionCard>

          <Stack direction="row" justifyContent="flex-end">
            <Button size="large" variant="contained" onClick={() => void handleSavePrompts()}>
              Salvar todos os prompts
            </Button>
          </Stack>
        </Stack>
      )}

      {/* ABA 2: WEBHOOKS & INTEGRAÇÕES */}
      {activeTab === 2 && (
        <Stack spacing={3}>
          {/* ELEVENLABS AGENTS (SIP TRUNK) */}
          <SectionCard
            title="ElevenLabs Agents — Ligações de Voz (SIP Trunk)"
            description="Conecte sua conta ElevenLabs, selecione o número SIP Trunk e provisione automaticamente Secret, 12 ferramentas, Agente de Voz e Webhook pós-chamada com prefixo isolado."
            badge={<Chip label="Voz Nativa" color="secondary" size="small" icon={<PhoneInTalkIcon />} />}
          >
            <ElevenLabsSection
              form={{
                brandName: form.brandName,
                elevenLabsApiKey: form.elevenLabsApiKey,
                elevenLabsAgentId: form.elevenLabsAgentId,
                elevenLabsPhoneNumberId: form.elevenLabsPhoneNumberId,
                elevenLabsWebhookId: form.elevenLabsWebhookId,
                elevenLabsWebhookSecret: form.elevenLabsWebhookSecret,
                elevenLabsResourcePrefix: form.elevenLabsResourcePrefix,
              }}
              fieldErrors={fieldErrors}
              onFieldChange={handleElevenLabsFieldChange}
              onSettingsSynced={handleElevenLabsFieldChange}
              onSaveManual={handleSaveElevenLabs}
              onCopyUrl={handleCopyUrlVoid}
              onNotify={handleNotify}
            />
          </SectionCard>

          {/* FALLBACK DE TEXTO DA PROSPECÇÃO */}
          <SectionCard
            title="Fallback de Texto da Prospecção (Opcional)"
            description="Webhook acionado apenas quando a ligação SIP não é atendida ou falha e você deseja disparar uma abordagem por texto."
            badge={<Chip label="Fallback Texto" color="info" variant="outlined" size="small" />}
          >
            <TextField
              label="URL do Webhook de Fallback de Texto (prospectingTextWebhookUrl)"
              fullWidth
              value={form.prospectingTextWebhookUrl}
              error={!!fieldErrors.prospectingTextWebhookUrl}
              helperText={
                fieldErrors.prospectingTextWebhookUrl ??
                "Opcional. Se preenchido, recebe POST com { leadId, clientId, phone, name, action: 'TEXT', metadata } quando o lead não atender."
              }
              placeholder="https://seu-disparador.com.br/api/enviar-texto"
              onChange={(e) => setForm({ ...form, prospectingTextWebhookUrl: e.target.value })}
            />
          </SectionCard>

          {/* WEBHOOKS DE ATENDIMENTO E CHAT */}
          <SectionCard
            title="Webhooks de Atendimento & Chat"
            description="Entrada e saída de mensagens para chat/WhatsApp e notificações de fechamento de contrato."
          >
            <TextField
              label="Webhook de entrada do chat (URL fixa)"
              fullWidth
              value={inboundUrl}
              disabled
              helperText="Configure no app de chat. Header x-webhook-token = INBOUND_WEBHOOK_TOKEN."
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    <Tooltip title="Copiar URL">
                      <IconButton edge="end" onClick={() => void copyUrl(inboundUrl)} aria-label="Copiar URL">
                        <ContentCopyIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </InputAdornment>
                ),
              }}
            />

            <TextField
              label="URL para a IA responder (fixa)"
              fullWidth
              value={agentReplyUrl}
              disabled
              helperText="A IA externa faz POST aqui com { phone, text }. Header x-webhook-token = AGENT_API_TOKEN (ou INBOUND)."
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    <Tooltip title="Copiar URL">
                      <IconButton edge="end" onClick={() => void copyUrl(agentReplyUrl)} aria-label="Copiar URL de reply">
                        <ContentCopyIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </InputAdornment>
                ),
              }}
            />

            <Divider />

            <TextField
              label="Webhook do sistema de IA (agentWebhookUrl)"
              fullWidth
              value={form.agentWebhookUrl}
              error={!!fieldErrors.agentWebhookUrl}
              helperText={
                fieldErrors.agentWebhookUrl ??
                "POST message.inbound e followup.due para o seu sistema de IA processar."
              }
              onChange={(e) => setForm({ ...form, agentWebhookUrl: e.target.value })}
            />
            <TextField
              label="Webhook de saída para o chat (outboundWebhookUrl)"
              fullWidth
              value={form.outboundWebhookUrl}
              error={!!fieldErrors.outboundWebhookUrl}
              helperText={
                fieldErrors.outboundWebhookUrl ?? "POST com a resposta ao lead (disparado após agent/reply)."
              }
              onChange={(e) => setForm({ ...form, outboundWebhookUrl: e.target.value })}
            />
            <TextField
              label="Webhook de contrato (venda fechada)"
              fullWidth
              value={form.contractWebhookUrl}
              error={!!fieldErrors.contractWebhookUrl}
              helperText={
                fieldErrors.contractWebhookUrl ??
                "Disparado quando a API do agente registra o contrato."
              }
              onChange={(e) => setForm({ ...form, contractWebhookUrl: e.target.value })}
            />
            <TextField
              label="Secret dos webhooks de saída (opcional)"
              fullWidth
              value={form.outboundWebhookSecret ?? ""}
              helperText="Se preenchido, envia HMAC-SHA256 no header x-webhook-signature (IA, chat e contrato)."
              onChange={(e) => setForm({ ...form, outboundWebhookSecret: e.target.value })}
            />
          </SectionCard>

          <Stack direction="row" justifyContent="flex-end">
            <Button size="large" variant="contained" onClick={() => void handleSaveWebhooks()}>
              Salvar webhooks
            </Button>
          </Stack>
        </Stack>
      )}

      {/* ABA 3: FOLLOW-UP & HUBSOFT */}
      {activeTab === 3 && (
        <Stack spacing={3}>
          {/* INTERVALOS DE FOLLOW-UP */}
          <SectionCard
            title="Períodos de Follow-up (Vendas)"
            description="Configure as etapas e intervalos de espera para retomar o contato automaticamente quando o cliente parar de responder no chat."
            badge={
              <Chip
                label={`${form.followUpIntervals?.length || 0} ${(form.followUpIntervals?.length || 0) === 1 ? "etapa" : "etapas"}`}
                color="primary"
                variant="outlined"
                size="small"
              />
            }
          >
            {/* Modelos prontos / Presets */}
            <Box>
              <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600 }}>
                Modelos prontos
              </Typography>
              <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                {[
                  { label: "Padrão (1h, 2h, 3h)", intervals: [60, 120, 180] },
                  { label: "Ágil (15m, 1h, 3h)", intervals: [15, 60, 180] },
                  { label: "Espaçado (2h, 6h, 24h)", intervals: [120, 360, 1440] },
                  { label: "Curto (30m, 2h)", intervals: [30, 120] },
                ].map((preset) => (
                  <Chip
                    key={preset.label}
                    label={preset.label}
                    onClick={() => setForm({ ...form, followUpIntervals: [...preset.intervals] })}
                    variant="outlined"
                    size="small"
                    sx={{ cursor: "pointer", "&:hover": { borderColor: "primary.main", bgcolor: "action.hover" } }}
                  />
                ))}
              </Stack>
            </Box>

            <Divider />

            {/* Lista de etapas configuradas */}
            <Stack spacing={2}>
              {(form.followUpIntervals ?? [60, 120, 180]).map((minutes, idx) => (
                <IntervalRow
                  key={idx}
                  index={idx}
                  minutes={minutes}
                  total={form.followUpIntervals?.length ?? 1}
                  onChange={(newMinutes) => {
                    const next = [...(form.followUpIntervals ?? [60, 120, 180])];
                    next[idx] = newMinutes;
                    setForm({ ...form, followUpIntervals: next });
                  }}
                  onRemove={() => {
                    const current = form.followUpIntervals ?? [60, 120, 180];
                    if (current.length <= 1) return;
                    const next = current.filter((_, i) => i !== idx);
                    setForm({ ...form, followUpIntervals: next });
                  }}
                />
              ))}
            </Stack>

            <Stack direction="row" justifyContent="space-between" alignItems="center" flexWrap="wrap" gap={1}>
              <Button
                variant="outlined"
                startIcon={<AddIcon />}
                disabled={(form.followUpIntervals?.length ?? 0) >= 10}
                onClick={() => {
                  const current = form.followUpIntervals ?? [60, 120, 180];
                  if (current.length >= 10) return;
                  const last = current[current.length - 1] ?? 60;
                  setForm({ ...form, followUpIntervals: [...current, last + 60] });
                }}
              >
                Adicionar etapa
              </Button>
              <Typography variant="caption" color="text.secondary">
                {(form.followUpIntervals?.length ?? 0) >= 10
                  ? "Limite máximo de 10 etapas atingido."
                  : `Configuradas ${form.followUpIntervals?.length ?? 0} de até 10 etapas.`}
              </Typography>
            </Stack>

            <Typography variant="body2" color="text.secondary">
              Após a última etapa configurada sem retorno do cliente, o lead é movido automaticamente para o estágio{" "}
              <strong>Parou de responder</strong>.
            </Typography>
          </SectionCard>

          {/* JANELA DE HORÁRIOS */}
          <SectionCard
            title="Janela de Horários para Follow-up"
            description="Configure o intervalo de horário permitido para envio de follow-up automático aos leads (horário de São Paulo). Fora desta janela, os disparos são ignorados."
          >
            <Grid container spacing={3}>
              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField
                  label="Horário de início (SP)"
                  type="time"
                  fullWidth
                  value={form.followUpStartTime ?? ""}
                  error={!!fieldErrors.followUpStartTime}
                  helperText={fieldErrors.followUpStartTime ?? "Início da janela para disparo (ex.: 08:00)"}
                  onChange={(e) => setForm({ ...form, followUpStartTime: e.target.value })}
                  InputLabelProps={{ shrink: true }}
                  inputProps={{ step: 300 }}
                />
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField
                  label="Horário de término (SP)"
                  type="time"
                  fullWidth
                  value={form.followUpEndTime ?? ""}
                  error={!!fieldErrors.followUpEndTime}
                  helperText={fieldErrors.followUpEndTime ?? "Fim da janela para disparo (ex.: 20:00)"}
                  onChange={(e) => setForm({ ...form, followUpEndTime: e.target.value })}
                  InputLabelProps={{ shrink: true }}
                  inputProps={{ step: 300 }}
                />
              </Grid>
            </Grid>

            <Typography variant="body2" color="text.secondary">
              Respeitando o horário oficial de Brasília/São Paulo (America/Sao_Paulo). Se a fila de follow-up rodar fora dessa janela, o disparo é ignorado e não perturba o lead. Deixe em branco caso deseje desativar a restrição de horário.
            </Typography>
          </SectionCard>

          <Stack direction="row" justifyContent="flex-end">
            <Button size="large" variant="contained" onClick={() => void handleSaveFollowUp()}>
              Salvar configurações de follow-up
            </Button>
          </Stack>

          <SectionCard
            title="Padrões de Integração Hubsoft"
            description="Parâmetros padrão da empresa (vendedor, vencimento, grupos, cobrança) enviados diretamente à API do Hubsoft no fechamento de vendas."
          >
            <TextField
              label="URL Base da API do Hubsoft"
              fullWidth
              value={form.hubsoftBaseUrl}
              error={!!fieldErrors.hubsoftBaseUrl}
              helperText={fieldErrors.hubsoftBaseUrl ?? "Endpoint base (padrão: https://api.ligtop.hubsoft.com.br)"}
              onChange={(e) => setForm({ ...form, hubsoftBaseUrl: e.target.value })}
            />

            <Grid container spacing={2}>
              <Grid size={{ xs: 12, sm: 6, md: 4 }}>
                <TextField
                  label="ID Vendedor (id_usuario_vendedor)"
                  type="number"
                  fullWidth
                  value={form.hubsoftVendedorId}
                  error={!!fieldErrors.hubsoftVendedorId}
                  helperText={fieldErrors.hubsoftVendedorId ?? "Padrão: 636"}
                  onChange={(e) => setForm({ ...form, hubsoftVendedorId: Number(e.target.value) })}
                />
              </Grid>
              <Grid size={{ xs: 12, sm: 6, md: 4 }}>
                <TextField
                  label="ID Motivo de Contratação"
                  type="number"
                  fullWidth
                  value={form.hubsoftMotivoContratacaoId}
                  error={!!fieldErrors.hubsoftMotivoContratacaoId}
                  helperText={fieldErrors.hubsoftMotivoContratacaoId ?? "Padrão: 48"}
                  onChange={(e) => setForm({ ...form, hubsoftMotivoContratacaoId: Number(e.target.value) })}
                />
              </Grid>
              <Grid size={{ xs: 12, sm: 6, md: 4 }}>
                <TextField
                  label="ID Status do Serviço"
                  type="number"
                  fullWidth
                  value={form.hubsoftServicoStatusId}
                  error={!!fieldErrors.hubsoftServicoStatusId}
                  helperText={fieldErrors.hubsoftServicoStatusId ?? "Padrão: 6"}
                  onChange={(e) => setForm({ ...form, hubsoftServicoStatusId: Number(e.target.value) })}
                />
              </Grid>
              <Grid size={{ xs: 12, sm: 6, md: 4 }}>
                <TextField
                  label="IDs Grupos de Cliente"
                  fullWidth
                  value={form.hubsoftGruposClienteIds?.join(", ") ?? "4"}
                  error={!!fieldErrors.hubsoftGruposClienteIds}
                  helperText={fieldErrors.hubsoftGruposClienteIds ?? "Separados por vírgula (ex: 4)"}
                  onChange={(e) => {
                    const arr = e.target.value.split(",").map((s) => Number(s.trim())).filter((n) => !isNaN(n) && n > 0);
                    setForm({ ...form, hubsoftGruposClienteIds: arr });
                  }}
                />
              </Grid>
              <Grid size={{ xs: 12, sm: 6, md: 4 }}>
                <TextField
                  label="IDs Grupos de Serviço"
                  fullWidth
                  value={form.hubsoftGruposServicoIds?.join(", ") ?? "835"}
                  error={!!fieldErrors.hubsoftGruposServicoIds}
                  helperText={fieldErrors.hubsoftGruposServicoIds ?? "Separados por vírgula (ex: 835)"}
                  onChange={(e) => {
                    const arr = e.target.value.split(",").map((s) => Number(s.trim())).filter((n) => !isNaN(n) && n > 0);
                    setForm({ ...form, hubsoftGruposServicoIds: arr });
                  }}
                />
              </Grid>
            </Grid>

            <Stack direction="row" justifyContent="flex-end">
              <Button variant="contained" onClick={() => void handleSaveHubsoft()}>
                Salvar padrões Hubsoft
              </Button>
            </Stack>
          </SectionCard>
        </Stack>
      )}

      <Snackbar
        open={snackbar.open}
        autoHideDuration={2500}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
        message={snackbar.message}
      />
    </Box>
  );
}

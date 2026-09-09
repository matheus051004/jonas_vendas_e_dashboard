"use client";

import * as React from "react";
import {
  Box,
  Button,
  CircularProgress,
  Divider,
  IconButton,
  InputAdornment,
  Paper,
  Snackbar,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import { SettingsBrandingSchema, SettingsWebhooksSchema, SettingsPromptSchema, SettingsHubsoftSchema } from "@/lib/crud-schemas";
import { firstFieldError, submitJson, zodFieldErrors, type FieldErrors } from "@/lib/form-errors";
import { ColorPickerField } from "@/lib/color-picker-field";
import { useBranding, type Branding } from "@/lib/branding";
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
  agentWebhookUrl: string;
  outboundWebhookUrl: string;
  contractWebhookUrl: string;
  outboundWebhookSecret: string | null;
  hubsoftBaseUrl: string;
  hubsoftVendedorId: number;
  hubsoftVencimentoId: number;
  hubsoftMotivoContratacaoId: number;
  hubsoftGruposClienteIds: number[];
  hubsoftGruposServicoIds: number[];
  hubsoftFormaCobrancaId: number;
  hubsoftServicoStatusId: number;
}

const BRANDING_FIELDS: (keyof Settings)[] = [
  "brandName",
  "brandLogo",
  "colorPrimary",
  "colorSecondary",
  "colorBackground",
];

const PROMPT_FIELDS: (keyof Settings)[] = ["aiPrompt"];

const WEBHOOK_FIELDS: (keyof Settings)[] = [
  "agentWebhookUrl",
  "outboundWebhookUrl",
  "contractWebhookUrl",
  "outboundWebhookSecret",
];

const HUBSOFT_FIELDS: (keyof Settings)[] = [
  "hubsoftBaseUrl",
  "hubsoftVendedorId",
  "hubsoftVencimentoId",
  "hubsoftMotivoContratacaoId",
  "hubsoftGruposClienteIds",
  "hubsoftGruposServicoIds",
  "hubsoftFormaCobrancaId",
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
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <Paper variant="outlined" sx={{ p: { xs: 2.5, sm: 3 } }}>
      <Stack spacing={2.5}>
        <Box>
          <Typography variant="h6" component="h2" gutterBottom sx={{ mb: 0.5 }}>
            {title}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {description}
          </Typography>
        </Box>
        {children}
      </Stack>
    </Paper>
  );
}

export default function ConfiguracoesPage() {
  const { setBranding } = useBranding();
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
          agentWebhookUrl: data.agentWebhookUrl ?? "",
          outboundWebhookUrl: data.outboundWebhookUrl ?? "",
          contractWebhookUrl: data.contractWebhookUrl ?? "",
          outboundWebhookSecret: data.outboundWebhookSecret ?? null,
          hubsoftBaseUrl: data.hubsoftBaseUrl || "https://api.ligtop.hubsoft.com.br",
          hubsoftVendedorId: data.hubsoftVendedorId ?? 636,
          hubsoftVencimentoId: data.hubsoftVencimentoId ?? 9,
          hubsoftMotivoContratacaoId: data.hubsoftMotivoContratacaoId ?? 48,
          hubsoftGruposClienteIds: data.hubsoftGruposClienteIds?.length ? data.hubsoftGruposClienteIds : [4],
          hubsoftGruposServicoIds: data.hubsoftGruposServicoIds?.length ? data.hubsoftGruposServicoIds : [835],
          hubsoftFormaCobrancaId: data.hubsoftFormaCobrancaId ?? 94,
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
    return { ok: true as const, message: "Salvo" };
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
      message: result.ok ? "Aparência salva" : `Erro ao salvar — ${result.message}`,
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
      setSnackbar({ open: true, message });
    }
  }

  async function handleSavePrompt() {
    setFieldErrors({});
    const payload = sliceFields(PROMPT_FIELDS);
    const parsed = SettingsPromptSchema.safeParse(payload);
    if (!parsed.success) {
      const errors = zodFieldErrors(parsed.error);
      setFieldErrors(errors);
      setSnackbar({ open: true, message: firstFieldError(errors) ?? "Verifique o campo de prompt." });
      return;
    }

    const result = await patch(parsed.data);
    setSnackbar({
      open: true,
      message: result.ok ? "Prompt da IA salvo com sucesso" : `Erro ao salvar prompt — ${result.message}`,
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
      message: result.ok ? "Webhooks salvos" : `Erro ao salvar webhooks — ${result.message}`,
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

  async function copyInboundUrl(url: string) {
    try {
      await navigator.clipboard.writeText(url);
      setSnackbar({ open: true, message: "URL copiada" });
    } catch {
      setSnackbar({ open: true, message: "Não foi possível copiar a URL" });
    }
  }

  if (!form) {
    return (
      <Box display="flex" alignItems="center" gap={1.5} py={4}>
        <CircularProgress size={22} />
        <Typography color="text.secondary">Carregando configurações…</Typography>
      </Box>
    );
  }

  const inboundUrl =
    typeof window !== "undefined" ? `${window.location.origin}/api/webhooks/inbound` : "/api/webhooks/inbound";
  const agentReplyUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/api/webhooks/agent/reply`
      : "/api/webhooks/agent/reply";
  const agentPromptUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/api/agent/prompt`
      : "/api/agent/prompt";

  return (
    <Box sx={{ maxWidth: 960 }}>
      <Box mb={3}>
        <Typography variant="h4" component="h1" gutterBottom sx={{ mb: 0.5 }}>
          Configurações
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Aparência do painel e webhooks de integração com o chat e o sistema de IA externo.
        </Typography>
      </Box>

      <Stack spacing={3}>
        <SectionCard
          title="Aparência"
          description="Nome do sistema, logo e cores do painel (barra superior, botões e fundo). Também aparece na tela de login."
        >
          <TextField
            label="Nome do sistema"
            fullWidth
            required
            value={form.brandName}
            error={!!fieldErrors.brandName}
            helperText={fieldErrors.brandName ?? "Exibido na barra superior, menu lateral e login."}
            onChange={(e) => setForm({ ...form, brandName: e.target.value })}
          />

          <Box>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
              Logo
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
                    "PNG, JPG, WebP ou SVG. Preferência a logo retangular (larga). Máx. 512×192 px. Até ~500 KB."}
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

        <SectionCard
          title="Prompt da IA"
          description="Instruções de sistema, persona, tom de voz, regras de negócio e diretrizes de atendimento que serão repassadas para a IA externa."
        >
          <TextField
            label="Endpoint do Prompt da IA (fixo)"
            fullWidth
            value={agentPromptUrl}
            disabled
            InputProps={{
              endAdornment: (
                <InputAdornment position="end">
                  <Tooltip title="Copiar URL">
                    <IconButton
                      edge="end"
                      onClick={() => void copyInboundUrl(agentPromptUrl)}
                      aria-label="Copiar URL do prompt"
                    >
                      <ContentCopyIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </InputAdornment>
              ),
            }}
          />

          <TextField
            label="Instruções do Sistema / Prompt da IA"
            fullWidth
            multiline
            minRows={8}
            maxRows={24}
            value={form.aiPrompt}
            error={!!fieldErrors.aiPrompt}
            helperText={
              fieldErrors.aiPrompt ??
              `Defina o comportamento, tom de conversa, regras de planos e objeções para o agente (${form.aiPrompt.length} caracteres).`
            }
            placeholder="Exemplo: Você é o assistente virtual de vendas da empresa de internet fibra óptica. Seja cortês, objetivo e tire as dúvidas dos clientes sobre planos, cobertura e contratação..."
            onChange={(e) => setForm({ ...form, aiPrompt: e.target.value })}
            InputProps={{
              sx: {
                fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace',
                fontSize: 13,
                lineHeight: 1.6,
              },
            }}
          />

          <Stack direction="row" justifyContent="flex-end">
            <Button variant="contained" onClick={() => void handleSavePrompt()}>
              Salvar prompt
            </Button>
          </Stack>
        </SectionCard>

        <SectionCard
          title="Webhooks"
          description="Chat externo (entrada/saída), sistema de IA externo e notificação de contrato."
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
                    <IconButton edge="end" onClick={() => void copyInboundUrl(inboundUrl)} aria-label="Copiar URL">
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
                    <IconButton
                      edge="end"
                      onClick={() => void copyInboundUrl(agentReplyUrl)}
                      aria-label="Copiar URL de reply"
                    >
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

          <Stack direction="row" justifyContent="flex-end">
            <Button variant="contained" onClick={() => void handleSaveWebhooks()}>
              Salvar webhooks
            </Button>
          </Stack>
        </SectionCard>

        <SectionCard
          title="Integração Hubsoft"
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
            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
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
            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
              <TextField
                label="ID Vencimento (id_vencimento)"
                type="number"
                fullWidth
                value={form.hubsoftVencimentoId}
                error={!!fieldErrors.hubsoftVencimentoId}
                helperText={fieldErrors.hubsoftVencimentoId ?? "Padrão: 9"}
                onChange={(e) => setForm({ ...form, hubsoftVencimentoId: Number(e.target.value) })}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
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
            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
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
                label="ID Forma de Cobrança"
                type="number"
                fullWidth
                value={form.hubsoftFormaCobrancaId}
                error={!!fieldErrors.hubsoftFormaCobrancaId}
                helperText={fieldErrors.hubsoftFormaCobrancaId ?? "Padrão: 94"}
                onChange={(e) => setForm({ ...form, hubsoftFormaCobrancaId: Number(e.target.value) })}
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

      <Snackbar
        open={snackbar.open}
        autoHideDuration={2500}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
        message={snackbar.message}
      />
    </Box>
  );
}

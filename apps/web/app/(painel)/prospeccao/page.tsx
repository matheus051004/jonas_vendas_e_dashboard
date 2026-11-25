"use client";

import * as React from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  IconButton,
  InputAdornment,
  MenuItem,
  Paper,
  Select,
  Snackbar,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import Grid from "@mui/material/Grid2";
import { DataGrid, type GridColDef, type GridRowSelectionModel } from "@mui/x-data-grid";
import PhoneInTalkIcon from "@mui/icons-material/PhoneInTalk";
import PhoneCallbackIcon from "@mui/icons-material/PhoneCallback";
import PhoneMissedIcon from "@mui/icons-material/PhoneMissed";
import SmsIcon from "@mui/icons-material/Sms";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import PauseIcon from "@mui/icons-material/Pause";
import FileUploadIcon from "@mui/icons-material/FileUpload";
import AddIcon from "@mui/icons-material/Add";
import SearchIcon from "@mui/icons-material/Search";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import EditIcon from "@mui/icons-material/Edit";
import RefreshIcon from "@mui/icons-material/Refresh";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import HourglassEmptyIcon from "@mui/icons-material/HourglassEmpty";
import ErrorOutlineIcon from "@mui/icons-material/ErrorOutline";
import { ProspectLeadFormSchema } from "@/lib/crud-schemas";
import { firstFieldError, submitJson, zodFieldErrors, type FieldErrors } from "@/lib/form-errors";

interface ProspectLead {
  id: string;
  name: string;
  phone: string;
  secondaryPhone: string | null;
  email: string | null;
  rawDocument: string | null;
  street: string | null;
  number: string | null;
  complement: string | null;
  neighborhood: string | null;
  city: string | null;
  state: string | null;
  cep: string | null;
  status: "PENDENTE" | "EM_CHAMADA" | "ATENDEU" | "NAO_ATENDEU" | "TEXTO_ENVIADO" | "ERRO";
  lastAction: string | null;
  calledAt: string | null;
  textSentAt: string | null;
  notes: string | null;
  elevenLabsConversationId: string | null;
  callDurationSecs: number | null;
  callSummary: string | null;
  clientId: string | null;
  client?: {
    id: string;
    stage: string;
    currentProvider: string | null;
    currentPrice: string | number | null;
  } | null;
  createdAt: string;
}

type ProspectStatusKey = ProspectLead["status"];

interface Metrics {
  total: number;
  pending: number;
  calling: number;
  answered: number;
  notAnswered: number;
  textSent: number;
  error: number;
  isProspectingActive: boolean;
}

const STATUS_CONFIG: Record<
  ProspectStatusKey,
  { label: string; color: "default" | "primary" | "secondary" | "error" | "info" | "success" | "warning"; icon: React.ReactElement }
> = {
  PENDENTE: { label: "Pendente", color: "warning", icon: <HourglassEmptyIcon fontSize="small" /> },
  EM_CHAMADA: { label: "Em Chamada", color: "info", icon: <PhoneInTalkIcon fontSize="small" /> },
  ATENDEU: { label: "Atendeu", color: "success", icon: <CheckCircleOutlineIcon fontSize="small" /> },
  NAO_ATENDEU: { label: "Não Atendeu", color: "error", icon: <PhoneMissedIcon fontSize="small" /> },
  TEXTO_ENVIADO: { label: "Texto Enviado", color: "secondary", icon: <SmsIcon fontSize="small" /> },
  ERRO: { label: "Erro", color: "error", icon: <ErrorOutlineIcon fontSize="small" /> },
};

const CRM_STAGE_LABELS: Record<string, string> = {
  NOVO_LEAD: "Novo lead",
  INTERESSADO: "Interessado",
  PAROU_DE_RESPONDER: "Sem resposta",
  ACHOU_CARO: "Achou caro",
  FECHOU_VENDA: "Fechou venda",
  DESISTIU: "Desistiu",
};

const CRM_STAGE_COLORS: Record<
  string,
  "default" | "primary" | "success" | "warning" | "error" | "info"
> = {
  NOVO_LEAD: "info",
  INTERESSADO: "primary",
  PAROU_DE_RESPONDER: "warning",
  ACHOU_CARO: "error",
  FECHOU_VENDA: "success",
  DESISTIU: "default",
};

function MetricCard({
  title,
  count,
  icon,
  color,
  active = false,
  onClick,
}: {
  title: string;
  count: number;
  icon: React.ReactNode;
  color: string;
  active?: boolean;
  onClick?: () => void;
}) {
  return (
    <Card
      variant="outlined"
      onClick={onClick}
      sx={{
        cursor: onClick ? "pointer" : "default",
        borderColor: active ? color : "divider",
        borderWidth: active ? 2 : 1,
        transition: "all 0.2s ease-in-out",
        "&:hover": onClick ? { borderColor: color, transform: "translateY(-2px)", boxShadow: 1 } : {},
      }}
    >
      <CardContent sx={{ p: 2, "&:last-child": { pb: 2 } }}>
        <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={1}>
          <Box>
            <Typography variant="caption" color="text.secondary" fontWeight={500} textTransform="uppercase">
              {title}
            </Typography>
            <Typography variant="h5" fontWeight={700} sx={{ color: active ? color : "text.primary", mt: 0.25 }}>
              {count.toLocaleString("pt-BR")}
            </Typography>
          </Box>
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: 44,
              height: 44,
              borderRadius: "50%",
              bgcolor: `${color}15`,
              color,
            }}
          >
            {icon}
          </Box>
        </Stack>
      </CardContent>
    </Card>
  );
}

export default function ProspeccaoPage() {
  const [leads, setLeads] = React.useState<ProspectLead[]>([]);
  const [totalLeads, setTotalLeads] = React.useState(0);
  const [loading, setLoading] = React.useState(true);
  const [metrics, setMetrics] = React.useState<Metrics>({
    total: 0,
    pending: 0,
    calling: 0,
    answered: 0,
    notAnswered: 0,
    textSent: 0,
    error: 0,
    isProspectingActive: false,
  });

  const [paginationModel, setPaginationModel] = React.useState({
    page: 0,
    pageSize: 25,
  });
  const [searchTerm, setSearchTerm] = React.useState("");
  const [debouncedSearch, setDebouncedSearch] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState<string>("TODOS");
  const [selectedIds, setSelectedIds] = React.useState<GridRowSelectionModel>([]);

  // Modais
  const [leadModalOpen, setLeadModalOpen] = React.useState(false);
  const [editingLead, setEditingLead] = React.useState<ProspectLead | null>(null);
  const [leadForm, setLeadForm] = React.useState({
    name: "",
    phone: "",
    secondaryPhone: "",
    email: "",
    rawDocument: "",
    street: "",
    number: "",
    complement: "",
    neighborhood: "",
    city: "",
    state: "",
    cep: "",
    notes: "",
    status: "PENDENTE" as ProspectStatusKey,
  });
  const [leadFieldErrors, setLeadFieldErrors] = React.useState<FieldErrors>({});

  const [importModalOpen, setImportModalOpen] = React.useState(false);
  const [importFile, setImportFile] = React.useState<File | null>(null);
  const [importing, setImporting] = React.useState(false);
  const [importResult, setImportResult] = React.useState<{
    total: number;
    imported: number;
    skippedDuplicates: number;
    skippedInvalid: number;
  } | null>(null);

  const [deleteTarget, setDeleteTarget] = React.useState<
    { type: "single"; lead: ProspectLead } | { type: "bulk"; ids: string[] } | null
  >(null);

  const [campaignActionLoading, setCampaignActionLoading] = React.useState(false);

  const [snackbar, setSnackbar] = React.useState<{ open: boolean; message: string; severity?: "success" | "error" | "info" }>({
    open: false,
    message: "",
  });

  const isInitialSearchMount = React.useRef(true);

  function handleSelectStatusFilter(nextStatus: string) {
    setStatusFilter(nextStatus);
    setPaginationModel((prev) => ({ ...prev, page: 0 }));
  }

  // Debounce na busca (ignora disparo redundante na montagem inicial)
  React.useEffect(() => {
    if (isInitialSearchMount.current) {
      isInitialSearchMount.current = false;
      return;
    }
    const timer = setTimeout(() => {
      setDebouncedSearch(searchTerm);
      setPaginationModel((prev) => ({ ...prev, page: 0 }));
    }, 400);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  const loadData = React.useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("page", String(paginationModel.page + 1));
      params.set("pageSize", String(paginationModel.pageSize));
      if (debouncedSearch) params.set("search", debouncedSearch);
      if (statusFilter !== "TODOS") params.set("status", statusFilter);

      const res = await fetch(`/api/prospeccao?${params.toString()}`);
      const data = await res.json();
      if (data.ok) {
        setLeads(data.leads || []);
        setTotalLeads(data.total || 0);
        if (data.metrics) {
          setMetrics(data.metrics);
        }
      }
    } catch (err) {
      console.error("Erro ao carregar leads:", err);
      setSnackbar({ open: true, message: "Erro ao carregar leads.", severity: "error" });
    } finally {
      setLoading(false);
    }
  }, [paginationModel.page, paginationModel.pageSize, debouncedSearch, statusFilter]);

  React.useEffect(() => {
    void loadData();
  }, [loadData]);

  // Polling leve de métricas a cada 8s caso a campanha esteja ativa
  React.useEffect(() => {
    if (!metrics.isProspectingActive) return;
    const interval = setInterval(() => {
      void loadData();
    }, 8000);
    return () => clearInterval(interval);
  }, [metrics.isProspectingActive, loadData]);

  async function handleToggleCampaign() {
    setCampaignActionLoading(true);
    try {
      if (metrics.isProspectingActive) {
        const res = await fetch("/api/prospeccao/pause", { method: "POST" });
        const data = await res.json().catch(() => ({}));
        if (res.ok && data.ok) {
          setMetrics((prev) => ({ ...prev, isProspectingActive: false }));
          setSnackbar({ open: true, message: "Campanha pausada com sucesso.", severity: "info" });
        } else {
          setSnackbar({
            open: true,
            message: data.error || "Não foi possível pausar a campanha.",
            severity: "error",
          });
        }
      } else {
        const res = await fetch("/api/prospeccao/start", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}),
        });
        const data = await res.json().catch(() => ({}));
        if (res.ok && data.ok) {
          if (data.queuedCount > 0 || data.alreadyQueuedCount > 0) {
            setMetrics((prev) => ({ ...prev, isProspectingActive: true }));
            setSnackbar({
              open: true,
              message: `Prospecção iniciada! ${data.queuedCount} lead(s) adicionado(s) à fila.`,
              severity: "success",
            });
          } else {
            setSnackbar({
              open: true,
              message: "Não há leads pendentes para iniciar a prospecção.",
              severity: "info",
            });
          }
        } else {
          setSnackbar({
            open: true,
            message: data.error || "Não foi possível iniciar a prospecção.",
            severity: "error",
          });
        }
      }
      await loadData();
    } catch {
      setSnackbar({ open: true, message: "Falha ao alterar estado da campanha.", severity: "error" });
    } finally {
      setCampaignActionLoading(false);
    }
  }

  async function handleStartSelected(overrideIds?: string[]) {
    const ids = overrideIds ?? selectedIds.map(String);
    if (ids.length === 0) return;
    setCampaignActionLoading(true);
    try {
      const res = await fetch("/api/prospeccao/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leadIds: ids }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.ok) {
        if (data.queuedCount > 0) {
          setMetrics((prev) => ({ ...prev, isProspectingActive: true }));
          setSnackbar({
            open: true,
            message: `${data.queuedCount} lead(s) adicionado(s) à fila de chamadas.`,
            severity: "success",
          });
        } else if (data.alreadyQueuedCount > 0) {
          setSnackbar({
            open: true,
            message: "Os leads selecionados já estão na fila de chamadas.",
            severity: "info",
          });
        } else {
          setSnackbar({
            open: true,
            message: "Nenhum lead elegível na seleção (já atendido, em chamada ou com texto enviado).",
            severity: "info",
          });
        }
        if (!overrideIds) setSelectedIds([]);
        await loadData();
      } else {
        setSnackbar({
          open: true,
          message: data.error || "Falha ao disparar leads selecionados.",
          severity: "error",
        });
      }
    } catch {
      setSnackbar({ open: true, message: "Falha ao disparar leads selecionados.", severity: "error" });
    } finally {
      setCampaignActionLoading(false);
    }
  }

  function handleRequestDeleteSelected() {
    const ids = selectedIds.map(String);
    if (ids.length === 0) return;
    setDeleteTarget({ type: "bulk", ids });
  }

  function handleOpenCreateModal() {
    setEditingLead(null);
    setLeadForm({
      name: "",
      phone: "",
      secondaryPhone: "",
      email: "",
      rawDocument: "",
      street: "",
      number: "",
      complement: "",
      neighborhood: "",
      city: "Brasília",
      state: "DF",
      cep: "",
      notes: "",
      status: "PENDENTE",
    });
    setLeadFieldErrors({});
    setLeadModalOpen(true);
  }

  function handleOpenEditModal(lead: ProspectLead) {
    setEditingLead(lead);
    setLeadForm({
      name: lead.name,
      phone: lead.phone,
      secondaryPhone: lead.secondaryPhone ?? "",
      email: lead.email ?? "",
      rawDocument: lead.rawDocument ?? "",
      street: lead.street ?? "",
      number: lead.number ?? "",
      complement: lead.complement ?? "",
      neighborhood: lead.neighborhood ?? "",
      city: lead.city ?? "",
      state: lead.state ?? "",
      cep: lead.cep ?? "",
      notes: lead.notes ?? "",
      status: lead.status,
    });
    setLeadFieldErrors({});
    setLeadModalOpen(true);
  }

  async function handleSaveLead() {
    setLeadFieldErrors({});
    const parsed = ProspectLeadFormSchema.safeParse(leadForm);
    if (!parsed.success) {
      setLeadFieldErrors(zodFieldErrors(parsed.error));
      return;
    }

    const isEdit = !!editingLead;
    const url = isEdit ? `/api/prospeccao/${editingLead.id}` : "/api/prospeccao";
    const method = isEdit ? "PATCH" : "POST";
    const payload = isEdit ? { ...parsed.data, status: leadForm.status } : parsed.data;

    const result = await submitJson(url, { method, body: payload });
    if (!result.ok) {
      setLeadFieldErrors(result.fieldErrors);
      setSnackbar({
        open: true,
        message: result.formError ?? firstFieldError(result.fieldErrors) ?? "Erro ao salvar lead.",
        severity: "error",
      });
      return;
    }

    setSnackbar({
      open: true,
      message: isEdit ? "Lead atualizado com sucesso" : "Lead cadastrado com sucesso",
      severity: "success",
    });
    setLeadModalOpen(false);
    await loadData();
  }

  async function handleConfirmDelete() {
    if (!deleteTarget) return;
    try {
      if (deleteTarget.type === "single") {
        const res = await fetch(`/api/prospeccao/${deleteTarget.lead.id}`, { method: "DELETE" });
        const data = await res.json().catch(() => ({}));
        if (res.ok && data.ok) {
          setSnackbar({ open: true, message: "Lead excluído com sucesso", severity: "success" });
          setDeleteTarget(null);
          await loadData();
        } else {
          setSnackbar({ open: true, message: data.error || "Falha ao excluir lead.", severity: "error" });
        }
      } else {
        const res = await fetch("/api/prospeccao", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ids: deleteTarget.ids }),
        });
        const data = await res.json().catch(() => ({}));
        if (res.ok && data.ok) {
          setSnackbar({ open: true, message: `${data.count} lead(s) excluído(s) com sucesso.`, severity: "success" });
          setSelectedIds([]);
          setDeleteTarget(null);
          await loadData();
        } else {
          setSnackbar({ open: true, message: data.error || "Erro ao excluir leads selecionados.", severity: "error" });
        }
      }
    } catch {
      setSnackbar({ open: true, message: "Falha ao excluir lead(s).", severity: "error" });
    }
  }

  async function handleImportSubmit() {
    if (!importFile) return;
    setImporting(true);
    setImportResult(null);

    try {
      const formData = new FormData();
      formData.append("file", importFile);

      const res = await fetch("/api/prospeccao/import", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      if (data.ok) {
        setImportResult({
          total: data.total,
          imported: data.imported,
          skippedDuplicates: data.skippedDuplicates,
          skippedInvalid: data.skippedInvalid,
        });
        setSnackbar({
          open: true,
          message: `Importação concluída: ${data.imported} leads adicionados!`,
          severity: "success",
        });
        await loadData();
      } else {
        setSnackbar({ open: true, message: data.error || "Erro ao processar planilha.", severity: "error" });
      }
    } catch {
      setSnackbar({ open: true, message: "Falha na requisição de upload.", severity: "error" });
    } finally {
      setImporting(false);
    }
  }

  const columns: GridColDef[] = [
    {
      field: "name",
      headerName: "Lead / Razão Social",
      flex: 1.4,
      minWidth: 200,
      renderCell: (params) => {
        const lead = params.row as ProspectLead;
        return (
          <Box sx={{ py: 1 }}>
            <Typography variant="body2" fontWeight={600} noWrap>
              {lead.name}
            </Typography>
            {lead.rawDocument && (
              <Typography variant="caption" color="text.secondary" display="block">
                Doc/CNPJ: {lead.rawDocument}
              </Typography>
            )}
          </Box>
        );
      },
    },
    {
      field: "phone",
      headerName: "Contato",
      flex: 1.2,
      minWidth: 160,
      renderCell: (params) => {
        const lead = params.row as ProspectLead;
        return (
          <Box sx={{ py: 1 }}>
            <Typography variant="body2" fontWeight={500}>
              {lead.phone}
            </Typography>
            {lead.secondaryPhone && (
              <Typography variant="caption" color="text.secondary" display="block">
                Alt: {lead.secondaryPhone}
              </Typography>
            )}
            {lead.email && (
              <Typography variant="caption" color="text.secondary" display="block" noWrap>
                {lead.email}
              </Typography>
            )}
          </Box>
        );
      },
    },
    {
      field: "location",
      headerName: "Localização",
      flex: 1.4,
      minWidth: 190,
      valueGetter: (_value, row) => `${row.neighborhood || ""} ${row.street || ""} ${row.city || ""}`,
      renderCell: (params) => {
        const lead = params.row as ProspectLead;
        const line1 = [lead.neighborhood, lead.city].filter(Boolean).join(" - ");
        const line2 = [lead.street, lead.number].filter(Boolean).join(", ");
        return (
          <Box sx={{ py: 1 }}>
            <Typography variant="body2" fontWeight={500} noWrap>
              {line1 || "Não informado"}
            </Typography>
            <Typography variant="caption" color="text.secondary" display="block" noWrap>
              {line2} {lead.cep ? `(${lead.cep})` : ""}
            </Typography>
          </Box>
        );
      },
    },
    {
      field: "status",
      headerName: "Status",
      width: 240,
      renderCell: (params) => {
        const lead = params.row as ProspectLead;
        const conf = STATUS_CONFIG[lead.status] || { label: lead.status, color: "default", icon: undefined };
        const crmStage = lead.client?.stage;
        const detailNote = lead.callSummary || lead.notes;
        return (
          <Box sx={{ py: 0.75, minWidth: 0, width: "100%" }}>
            <Stack direction="row" spacing={0.5} alignItems="center" flexWrap="wrap" useFlexGap>
              <Chip
                size="small"
                variant="filled"
                color={conf.color}
                icon={conf.icon}
                label={conf.label}
                sx={{ fontWeight: 600 }}
              />
              {crmStage && (
                <Chip
                  size="small"
                  variant="outlined"
                  color={CRM_STAGE_COLORS[crmStage] ?? "default"}
                  label={CRM_STAGE_LABELS[crmStage] ?? crmStage}
                  sx={{ height: 22, fontSize: 11 }}
                />
              )}
            </Stack>
            {detailNote && (
              <Tooltip title={detailNote}>
                <Typography
                  variant="caption"
                  color={lead.status === "ERRO" ? "error.main" : "text.secondary"}
                  display="block"
                  noWrap
                  sx={{ mt: 0.25 }}
                >
                  {detailNote}
                </Typography>
              </Tooltip>
            )}
          </Box>
        );
      },
    },
    {
      field: "lastAction",
      headerName: "Última Ação",
      width: 160,
      renderCell: (params) => {
        const lead = params.row as ProspectLead;
        if (!lead.lastAction) {
          return (
            <Typography variant="caption" color="text.secondary">
              Nenhuma
            </Typography>
          );
        }
        const date = lead.lastAction === "VOICE" ? lead.calledAt : lead.textSentAt;
        return (
          <Box>
            <Chip
              size="small"
              variant="outlined"
              label={lead.lastAction === "VOICE" ? "Ligação" : "WhatsApp"}
              color={lead.lastAction === "VOICE" ? "primary" : "secondary"}
              sx={{ height: 20, fontSize: 11 }}
            />
            {date && (
              <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.25 }}>
                {new Date(date).toLocaleString("pt-BR", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit" })}
                {lead.callDurationSecs != null ? ` • ${lead.callDurationSecs}s` : ""}
              </Typography>
            )}
          </Box>
        );
      },
    },
    {
      field: "actions",
      headerName: "Ações",
      width: 120,
      sortable: false,
      renderCell: (params) => {
        const lead = params.row as ProspectLead;
        const callDisabled =
          campaignActionLoading ||
          lead.status === "ATENDEU" ||
          lead.status === "TEXTO_ENVIADO" ||
          lead.status === "EM_CHAMADA";
        return (
          <Stack direction="row" spacing={0.5}>
            <Tooltip
              title={
                lead.status === "EM_CHAMADA"
                  ? "Ligação em andamento"
                  : lead.status === "ATENDEU" || lead.status === "TEXTO_ENVIADO"
                    ? "Lead já atendido ou texto enviado"
                    : "Disparar Ligação Avulsa"
              }
            >
              <span>
                <IconButton
                  size="small"
                  color="primary"
                  disabled={callDisabled}
                  onClick={() => void handleStartSelected([lead.id])}
                >
                  <PhoneCallbackIcon fontSize="small" />
                </IconButton>
              </span>
            </Tooltip>
            <Tooltip title="Editar Lead">
              <IconButton size="small" onClick={() => handleOpenEditModal(lead)}>
                <EditIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            <Tooltip title="Excluir Lead">
              <IconButton
                size="small"
                color="error"
                onClick={() => setDeleteTarget({ type: "single", lead })}
              >
                <DeleteOutlineIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </Stack>
        );
      },
    },
  ];

  return (
    <Box>
      {/* Título & Ações Principais */}
      <Box mb={3} display="flex" justifyContent="space-between" alignItems="flex-start" flexWrap="wrap" gap={2}>
        <Box>
          <Typography variant="h4" component="h1" gutterBottom sx={{ mb: 0.5, fontWeight: 700 }}>
            Prospecção de Leads
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Disparo automático de chamadas de voz e mensagens de texto a partir de planilhas de leads.
          </Typography>
        </Box>

        <Stack direction="row" spacing={1.5} flexWrap="wrap" useFlexGap>
          <Button
            variant="outlined"
            startIcon={<FileUploadIcon />}
            onClick={() => {
              setImportFile(null);
              setImportResult(null);
              setImportModalOpen(true);
            }}
          >
            Importar Planilha
          </Button>

          <Button variant="outlined" startIcon={<AddIcon />} onClick={handleOpenCreateModal}>
            Novo Lead
          </Button>

          <Button
            variant="contained"
            color={metrics.isProspectingActive ? "warning" : "success"}
            startIcon={
              campaignActionLoading ? (
                <CircularProgress size={18} color="inherit" />
              ) : metrics.isProspectingActive ? (
                <PauseIcon />
              ) : (
                <PlayArrowIcon />
              )
            }
            onClick={() => void handleToggleCampaign()}
            disabled={campaignActionLoading}
            sx={{ minWidth: 190, fontWeight: 600 }}
          >
            {metrics.isProspectingActive ? "Pausar Prospecção" : "Iniciar Prospecção"}
          </Button>
        </Stack>
      </Box>

      {/* Cards de Métricas */}
      <Grid container spacing={2} mb={3} columns={{ xs: 12, sm: 12, lg: 14 }}>
        <Grid size={{ xs: 6, sm: 4, lg: 2 }}>
          <MetricCard
            title="Total de Leads"
            count={metrics.total}
            color="#1565c0"
            icon={<PhoneInTalkIcon />}
            active={statusFilter === "TODOS"}
            onClick={() => handleSelectStatusFilter("TODOS")}
          />
        </Grid>
        <Grid size={{ xs: 6, sm: 4, lg: 2 }}>
          <MetricCard
            title="Pendentes"
            count={metrics.pending}
            color="#ed6c02"
            icon={<HourglassEmptyIcon />}
            active={statusFilter === "PENDENTE"}
            onClick={() => handleSelectStatusFilter("PENDENTE")}
          />
        </Grid>
        <Grid size={{ xs: 6, sm: 4, lg: 2 }}>
          <MetricCard
            title="Em Chamada"
            count={metrics.calling}
            color="#0288d1"
            icon={<PhoneInTalkIcon />}
            active={statusFilter === "EM_CHAMADA"}
            onClick={() => handleSelectStatusFilter("EM_CHAMADA")}
          />
        </Grid>
        <Grid size={{ xs: 6, sm: 4, lg: 2 }}>
          <MetricCard
            title="Atendeu"
            count={metrics.answered}
            color="#2e7d32"
            icon={<CheckCircleOutlineIcon />}
            active={statusFilter === "ATENDEU"}
            onClick={() => handleSelectStatusFilter("ATENDEU")}
          />
        </Grid>
        <Grid size={{ xs: 6, sm: 4, lg: 2 }}>
          <MetricCard
            title="Não Atendeu"
            count={metrics.notAnswered}
            color="#d32f2f"
            icon={<PhoneMissedIcon />}
            active={statusFilter === "NAO_ATENDEU"}
            onClick={() => handleSelectStatusFilter("NAO_ATENDEU")}
          />
        </Grid>
        <Grid size={{ xs: 6, sm: 4, lg: 2 }}>
          <MetricCard
            title="Texto Enviado"
            count={metrics.textSent}
            color="#7b1fa2"
            icon={<SmsIcon />}
            active={statusFilter === "TEXTO_ENVIADO"}
            onClick={() => handleSelectStatusFilter("TEXTO_ENVIADO")}
          />
        </Grid>
        <Grid size={{ xs: 6, sm: 4, lg: 2 }}>
          <MetricCard
            title="Erros"
            count={metrics.error}
            color="#c62828"
            icon={<ErrorOutlineIcon />}
            active={statusFilter === "ERRO"}
            onClick={() => handleSelectStatusFilter("ERRO")}
          />
        </Grid>
      </Grid>

      {/* Barra de Filtros, Busca e Ações em Massa */}
      <Paper variant="outlined" sx={{ p: 2, mb: 2, borderRadius: 2 }}>
        <Stack direction={{ xs: "column", sm: "row" }} spacing={2} alignItems="center" justifyContent="space-between">
          <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} alignItems="center" sx={{ width: { xs: "100%", sm: "auto" } }}>
            <TextField
              size="small"
              placeholder="Buscar por nome, telefone, bairro..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              sx={{ width: { xs: "100%", sm: 300 } }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon fontSize="small" color="action" />
                  </InputAdornment>
                ),
              }}
            />

            <Select
              size="small"
              value={statusFilter}
              onChange={(e) => handleSelectStatusFilter(e.target.value)}
              sx={{ minWidth: 160 }}
            >
              <MenuItem value="TODOS">Todos os Status</MenuItem>
              <MenuItem value="PENDENTE">Apenas Pendentes</MenuItem>
              <MenuItem value="EM_CHAMADA">Em Chamada</MenuItem>
              <MenuItem value="ATENDEU">Atendeu</MenuItem>
              <MenuItem value="NAO_ATENDEU">Não Atendeu</MenuItem>
              <MenuItem value="TEXTO_ENVIADO">Texto Enviado</MenuItem>
              <MenuItem value="ERRO">Erros</MenuItem>
            </Select>

            <Tooltip title="Atualizar dados">
              <IconButton onClick={() => void loadData()} size="small">
                <RefreshIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </Stack>

          {/* Ações em lote quando houver seleção */}
          {selectedIds.length > 0 && (
            <Stack direction="row" spacing={1} alignItems="center">
              <Typography variant="body2" color="text.secondary" fontWeight={500}>
                {selectedIds.length} selecionado(s)
              </Typography>
              <Button
                size="small"
                variant="outlined"
                color="primary"
                startIcon={<PhoneInTalkIcon />}
                onClick={() => void handleStartSelected()}
                disabled={campaignActionLoading}
              >
                Disparar Selecionados
              </Button>
              <Button
                size="small"
                variant="outlined"
                color="error"
                startIcon={<DeleteOutlineIcon />}
                onClick={handleRequestDeleteSelected}
              >
                Excluir
              </Button>
            </Stack>
          )}
        </Stack>
      </Paper>

      {/* Tabela de Leads */}
      <Paper variant="outlined" sx={{ borderRadius: 2, overflow: "hidden" }}>
        <DataGrid
          rows={leads}
          columns={columns}
          rowCount={totalLeads}
          loading={loading}
          paginationMode="server"
          paginationModel={paginationModel}
          onPaginationModelChange={setPaginationModel}
          pageSizeOptions={[25, 50, 100]}
          checkboxSelection
          rowSelectionModel={selectedIds}
          onRowSelectionModelChange={setSelectedIds}
          disableRowSelectionOnClick
          autoHeight
          rowHeight={72}
          sx={{
            border: "none",
            "& .MuiDataGrid-cell:focus": { outline: "none" },
            "& .MuiDataGrid-row:hover": { bgcolor: "action.hover" },
          }}
        />
      </Paper>

      {/* MODAL: Importar Planilha */}
      <Dialog open={importModalOpen} onClose={() => !importing && setImportModalOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>Importar Planilha de Leads (.xlsx)</DialogTitle>
        <DialogContent>
          <DialogContentText paragraph>
            Envie uma planilha Excel (.xlsx ou .xls). As colunas são detectadas automaticamente quando houver cabeçalho (ex.: Nome/Razão Social, Telefone, Endereço, Bairro, E-mail), mantendo compatibilidade com o layout padrão (<code>ceilandia.xlsx</code>).
          </DialogContentText>

          <Box
            sx={{
              p: 3,
              border: "2px dashed",
              borderColor: importFile ? "primary.main" : "divider",
              borderRadius: 2,
              textAlign: "center",
              bgcolor: "grey.50",
              cursor: "pointer",
              mb: 2,
            }}
            onClick={() => document.getElementById("xlsx-file-input")?.click()}
          >
            <input
              id="xlsx-file-input"
              type="file"
              accept=".xlsx,.xls"
              hidden
              onChange={(e) => {
                const f = e.target.files?.[0] ?? null;
                setImportFile(f);
                setImportResult(null);
              }}
            />
            <FileUploadIcon sx={{ fontSize: 44, color: "text.secondary", mb: 1 }} />
            <Typography variant="body1" fontWeight={600}>
              {importFile ? importFile.name : "Clique para selecionar o arquivo .xlsx"}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {importFile ? `${(importFile.size / 1024).toFixed(1)} KB` : "Suporta arquivos até 20 MB"}
            </Typography>
          </Box>

          {importing && (
            <Box display="flex" alignItems="center" gap={1.5} py={2}>
              <CircularProgress size={24} />
              <Typography variant="body2" color="text.secondary">
                Processando linhas da planilha e salvando leads...
              </Typography>
            </Box>
          )}

          {importResult && (
            <Alert severity="success" sx={{ mt: 2 }}>
              <Typography variant="subtitle2" fontWeight={600} gutterBottom>
                Importação concluída com sucesso!
              </Typography>
              <Typography variant="body2">• Total de linhas lidas: {importResult.total}</Typography>
              <Typography variant="body2">• Novos leads importados: {importResult.imported}</Typography>
              <Typography variant="body2">• Duplicados ignorados: {importResult.skippedDuplicates}</Typography>
              {importResult.skippedInvalid > 0 && (
                <Typography variant="body2">• Linhas inválidas/cabeçalho: {importResult.skippedInvalid}</Typography>
              )}
            </Alert>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5 }}>
          <Button onClick={() => setImportModalOpen(false)} disabled={importing}>
            {importResult ? "Fechar" : "Cancelar"}
          </Button>
          {!importResult && (
            <Button
              variant="contained"
              onClick={() => void handleImportSubmit()}
              disabled={!importFile || importing}
            >
              Iniciar Importação
            </Button>
          )}
        </DialogActions>
      </Dialog>

      {/* MODAL: Criar / Editar Lead */}
      <Dialog open={leadModalOpen} onClose={() => setLeadModalOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>
          {editingLead ? "Editar Lead de Prospecção" : "Adicionar Lead Manualmente"}
        </DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 0.5 }}>
            <Grid size={{ xs: 12, sm: 8 }}>
              <TextField
                label="Nome completo / Razão Social"
                fullWidth
                required
                value={leadForm.name}
                error={!!leadFieldErrors.name}
                helperText={leadFieldErrors.name}
                onChange={(e) => setLeadForm({ ...leadForm, name: e.target.value })}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 4 }}>
              <TextField
                label="CNPJ / Documento (opcional)"
                fullWidth
                value={leadForm.rawDocument}
                onChange={(e) => setLeadForm({ ...leadForm, rawDocument: e.target.value })}
              />
            </Grid>

            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                label="Telefone Principal (DDI + DDD + Fone)"
                fullWidth
                required
                placeholder="Ex: 5561991640073 ou 61991640073"
                value={leadForm.phone}
                error={!!leadFieldErrors.phone}
                helperText={leadFieldErrors.phone ?? "Será normalizado automaticamente com DDI 55"}
                onChange={(e) => setLeadForm({ ...leadForm, phone: e.target.value })}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                label="Telefone Secundário (opcional)"
                fullWidth
                value={leadForm.secondaryPhone}
                onChange={(e) => setLeadForm({ ...leadForm, secondaryPhone: e.target.value })}
              />
            </Grid>

            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                label="E-mail (opcional)"
                fullWidth
                value={leadForm.email}
                error={!!leadFieldErrors.email}
                helperText={leadFieldErrors.email}
                onChange={(e) => setLeadForm({ ...leadForm, email: e.target.value })}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                label="Bairro"
                fullWidth
                value={leadForm.neighborhood}
                onChange={(e) => setLeadForm({ ...leadForm, neighborhood: e.target.value })}
              />
            </Grid>

            <Grid size={{ xs: 12, sm: 8 }}>
              <TextField
                label="Endereço / Logradouro"
                fullWidth
                value={leadForm.street}
                onChange={(e) => setLeadForm({ ...leadForm, street: e.target.value })}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 4 }}>
              <TextField
                label="Número"
                fullWidth
                value={leadForm.number}
                onChange={(e) => setLeadForm({ ...leadForm, number: e.target.value })}
              />
            </Grid>

            <Grid size={{ xs: 12, sm: 4 }}>
              <TextField
                label="Complemento"
                fullWidth
                value={leadForm.complement}
                onChange={(e) => setLeadForm({ ...leadForm, complement: e.target.value })}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 4 }}>
              <TextField
                label="Cidade"
                fullWidth
                value={leadForm.city}
                onChange={(e) => setLeadForm({ ...leadForm, city: e.target.value })}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 2 }}>
              <TextField
                label="UF"
                fullWidth
                value={leadForm.state}
                onChange={(e) => setLeadForm({ ...leadForm, state: e.target.value })}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 2 }}>
              <TextField
                label="CEP"
                fullWidth
                value={leadForm.cep}
                onChange={(e) => setLeadForm({ ...leadForm, cep: e.target.value })}
              />
            </Grid>

            {editingLead && (
              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField
                  select
                  label="Status na Prospecção"
                  fullWidth
                  value={leadForm.status}
                  onChange={(e) => setLeadForm({ ...leadForm, status: e.target.value as ProspectStatusKey })}
                  helperText="Permite redefinir leads com erro ou travados para Pendente."
                >
                  <MenuItem value="PENDENTE">Pendente</MenuItem>
                  <MenuItem value="EM_CHAMADA">Em Chamada</MenuItem>
                  <MenuItem value="ATENDEU">Atendeu</MenuItem>
                  <MenuItem value="NAO_ATENDEU">Não Atendeu</MenuItem>
                  <MenuItem value="TEXTO_ENVIADO">Texto Enviado</MenuItem>
                  <MenuItem value="ERRO">Erro</MenuItem>
                </TextField>
              </Grid>
            )}

            <Grid size={{ xs: 12 }}>
              <TextField
                label="Observações / Notas internas"
                fullWidth
                multiline
                rows={2}
                value={leadForm.notes}
                onChange={(e) => setLeadForm({ ...leadForm, notes: e.target.value })}
              />
            </Grid>

            {editingLead?.elevenLabsConversationId && (
              <Grid size={{ xs: 12 }}>
                <Alert severity="info" variant="outlined">
                  <Typography variant="subtitle2" fontWeight={600}>
                    Registro da Ligação ElevenLabs
                  </Typography>
                  <Typography variant="caption" display="block" sx={{ fontFamily: "monospace" }}>
                    Conversation ID: {editingLead.elevenLabsConversationId}
                    {editingLead.callDurationSecs != null ? ` | Duração: ${editingLead.callDurationSecs}s` : ""}
                  </Typography>
                  {editingLead.callSummary && (
                    <Typography variant="body2" sx={{ mt: 0.5 }}>
                      {editingLead.callSummary}
                    </Typography>
                  )}
                </Alert>
              </Grid>
            )}
          </Grid>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5 }}>
          <Button onClick={() => setLeadModalOpen(false)}>Cancelar</Button>
          <Button variant="contained" onClick={() => void handleSaveLead()}>
            {editingLead ? "Salvar Alterações" : "Cadastrar Lead"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* MODAL: Confirmação de Exclusão */}
      <Dialog open={!!deleteTarget} onClose={() => setDeleteTarget(null)}>
        <DialogTitle>
          {deleteTarget?.type === "bulk" ? "Excluir Leads Selecionados" : "Excluir Lead de Prospecção"}
        </DialogTitle>
        <DialogContent>
          <DialogContentText>
            {deleteTarget?.type === "bulk" ? (
              <>
                Tem certeza de que deseja excluir os <strong>{deleteTarget.ids.length}</strong> leads selecionados?
                Essa ação não pode ser desfeita.
              </>
            ) : (
              <>
                Tem certeza de que deseja excluir o lead <strong>{deleteTarget?.lead.name}</strong> (
                {deleteTarget?.lead.phone})? Essa ação não pode ser desfeita.
              </>
            )}
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteTarget(null)}>Cancelar</Button>
          <Button variant="contained" color="error" onClick={() => void handleConfirmDelete()}>
            Excluir
          </Button>
        </DialogActions>
      </Dialog>

      {/* Feedback Snackbar */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={4500}
        onClose={() => setSnackbar((prev) => ({ ...prev, open: false }))}
      >
        <Alert
          onClose={() => setSnackbar((prev) => ({ ...prev, open: false }))}
          severity={snackbar.severity ?? "info"}
          variant="filled"
          sx={{ width: "100%" }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}

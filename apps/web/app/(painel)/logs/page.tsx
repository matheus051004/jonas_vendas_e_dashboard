"use client";

import * as React from "react";
import {
  Box,
  Typography,
  Paper,
  Stack,
  Chip,
  Button,
  IconButton,
  TextField,
  InputAdornment,
  MenuItem,
  Select,
  FormControl,
  InputLabel,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  DialogContentText,
  Alert,
  Tooltip,
  Switch,
  FormControlLabel,
  Card,
  CardContent,
  Divider,
} from "@mui/material";
import Grid from "@mui/material/Grid2";
import SearchIcon from "@mui/icons-material/Search";
import RefreshIcon from "@mui/icons-material/Refresh";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import ErrorOutlineIcon from "@mui/icons-material/ErrorOutline";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import CheckIcon from "@mui/icons-material/Check";
import PhoneIcon from "@mui/icons-material/Phone";
import CodeIcon from "@mui/icons-material/Code";

interface SystemLog {
  id: string;
  timestamp: string;
  level: "error" | "warn" | "info";
  source: string;
  message: string;
  phone?: string;
  payload?: unknown;
  details?: unknown;
  stack?: string;
}

const LEVEL_CONFIG = {
  error: {
    label: "ERRO",
    color: "error" as const,
    icon: <ErrorOutlineIcon fontSize="small" />,
    bg: "rgba(211, 47, 47, 0.08)",
    border: "error.main",
  },
  warn: {
    label: "AVISO",
    color: "warning" as const,
    icon: <WarningAmberIcon fontSize="small" />,
    bg: "rgba(237, 108, 2, 0.08)",
    border: "warning.main",
  },
  info: {
    label: "INFO",
    color: "info" as const,
    icon: <InfoOutlinedIcon fontSize="small" />,
    bg: "rgba(2, 136, 209, 0.08)",
    border: "info.main",
  },
};

const dateFmt = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
});

function formatDate(iso: string) {
  try {
    return dateFmt.format(new Date(iso));
  } catch {
    return iso;
  }
}

export default function LogsPage() {
  const [logs, setLogs] = React.useState<SystemLog[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [query, setQuery] = React.useState("");
  const [levelFilter, setLevelFilter] = React.useState<string>("all");
  const [sourceFilter, setSourceFilter] = React.useState<string>("all");
  const [autoRefresh, setAutoRefresh] = React.useState(true);

  const [selectedLog, setSelectedLog] = React.useState<SystemLog | null>(null);
  const [copiedKey, setCopiedKey] = React.useState<string | null>(null);

  const [confirmClearOpen, setConfirmClearOpen] = React.useState(false);
  const [clearing, setClearing] = React.useState(false);

  const fetchLogs = React.useCallback(async () => {
    try {
      const res = await fetch("/api/logs?limit=250");
      const data = await res.json();
      if (data.ok && Array.isArray(data.logs)) {
        setLogs(data.logs);
      }
    } catch (err) {
      console.error("Erro ao buscar logs:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  React.useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(fetchLogs, 5000);
    return () => clearInterval(interval);
  }, [autoRefresh, fetchLogs]);

  const handleClearLogs = async () => {
    setClearing(true);
    try {
      const res = await fetch("/api/logs", { method: "DELETE" });
      if (res.ok) {
        setLogs([]);
        setConfirmClearOpen(false);
      }
    } catch (err) {
      console.error("Erro ao limpar logs:", err);
    } finally {
      setClearing(false);
    }
  };

  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const sources = React.useMemo(() => {
    const set = new Set<string>();
    logs.forEach((l) => {
      if (l.source) set.add(l.source);
    });
    return Array.from(set);
  }, [logs]);

  const filteredLogs = React.useMemo(() => {
    return logs.filter((log) => {
      if (levelFilter !== "all" && log.level !== levelFilter) return false;
      if (sourceFilter !== "all" && log.source !== sourceFilter) return false;

      if (!query.trim()) return true;
      const q = query.toLowerCase();
      const matchMsg = log.message.toLowerCase().includes(q);
      const matchPhone = log.phone?.toLowerCase().includes(q);
      const matchSource = log.source.toLowerCase().includes(q);
      const matchDetails = log.details ? JSON.stringify(log.details).toLowerCase().includes(q) : false;
      return matchMsg || matchPhone || matchSource || matchDetails;
    });
  }, [logs, levelFilter, sourceFilter, query]);

  const countError = logs.filter((l) => l.level === "error").length;
  const countWarn = logs.filter((l) => l.level === "warn").length;
  const countInfo = logs.filter((l) => l.level === "info").length;

  return (
    <Box>
      {/* Header */}
      <Stack
        direction={{ xs: "column", sm: "row" }}
        justifyContent="space-between"
        alignItems={{ xs: "flex-start", sm: "center" }}
        spacing={2}
        mb={3}
      >
        <Box>
          <Typography variant="h4" fontWeight="bold">
            Logs do Sistema
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Acompanhe em tempo real erros de integração com o Hubsoft, requisições da IA e eventos.
          </Typography>
        </Box>

        <Stack direction="row" spacing={1.5} alignItems="center">
          <FormControlLabel
            control={
              <Switch
                checked={autoRefresh}
                onChange={(e) => setAutoRefresh(e.target.checked)}
                size="small"
                color="primary"
              />
            }
            label={
              <Typography variant="caption" color="text.secondary">
                Auto-refresh (5s)
              </Typography>
            }
          />

          <Tooltip title="Atualizar agora">
            <IconButton onClick={fetchLogs} color="primary" disabled={loading}>
              <RefreshIcon />
            </IconButton>
          </Tooltip>

          <Button
            variant="outlined"
            color="error"
            size="small"
            startIcon={<DeleteOutlineIcon />}
            onClick={() => setConfirmClearOpen(true)}
            disabled={logs.length === 0}
          >
            Limpar logs
          </Button>
        </Stack>
      </Stack>

      {/* Cards de Métricas */}
      <Grid container spacing={2} mb={3}>
        <Grid size={{ xs: 6, sm: 3 }}>
          <Card variant="outlined">
            <CardContent sx={{ py: 1.5, "&:last-child": { pb: 1.5 } }}>
              <Typography variant="caption" color="text.secondary">
                Total de Logs
              </Typography>
              <Typography variant="h5" fontWeight="bold">
                {logs.length}
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs: 6, sm: 3 }}>
          <Card variant="outlined" sx={{ borderLeft: 4, borderColor: "error.main" }}>
            <CardContent sx={{ py: 1.5, "&:last-child": { pb: 1.5 } }}>
              <Stack direction="row" alignItems="center" spacing={1}>
                <ErrorOutlineIcon color="error" fontSize="small" />
                <Typography variant="caption" color="text.secondary">
                  Erros
                </Typography>
              </Stack>
              <Typography variant="h5" fontWeight="bold" color="error.main">
                {countError}
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs: 6, sm: 3 }}>
          <Card variant="outlined" sx={{ borderLeft: 4, borderColor: "warning.main" }}>
            <CardContent sx={{ py: 1.5, "&:last-child": { pb: 1.5 } }}>
              <Stack direction="row" alignItems="center" spacing={1}>
                <WarningAmberIcon color="warning" fontSize="small" />
                <Typography variant="caption" color="text.secondary">
                  Avisos
                </Typography>
              </Stack>
              <Typography variant="h5" fontWeight="bold" color="warning.main">
                {countWarn}
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs: 6, sm: 3 }}>
          <Card variant="outlined" sx={{ borderLeft: 4, borderColor: "info.main" }}>
            <CardContent sx={{ py: 1.5, "&:last-child": { pb: 1.5 } }}>
              <Stack direction="row" alignItems="center" spacing={1}>
                <InfoOutlinedIcon color="info" fontSize="small" />
                <Typography variant="caption" color="text.secondary">
                  Informativos
                </Typography>
              </Stack>
              <Typography variant="h5" fontWeight="bold" color="info.main">
                {countInfo}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Filtros e Busca */}
      <Paper variant="outlined" sx={{ p: 2, mb: 3 }}>
        <Grid container spacing={2} alignItems="center">
          <Grid size={{ xs: 12, md: 6 }}>
            <TextField
              size="small"
              fullWidth
              placeholder="Buscar por mensagem, telefone, detalhes..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon fontSize="small" color="action" />
                  </InputAdornment>
                ),
              }}
            />
          </Grid>

          <Grid size={{ xs: 6, md: 3 }}>
            <FormControl size="small" fullWidth>
              <InputLabel>Nível</InputLabel>
              <Select
                value={levelFilter}
                label="Nível"
                onChange={(e) => setLevelFilter(e.target.value)}
              >
                <MenuItem value="all">Todos os níveis</MenuItem>
                <MenuItem value="error">Apenas Erros</MenuItem>
                <MenuItem value="warn">Apenas Avisos</MenuItem>
                <MenuItem value="info">Apenas Informativos</MenuItem>
              </Select>
            </FormControl>
          </Grid>

          <Grid size={{ xs: 6, md: 3 }}>
            <FormControl size="small" fullWidth>
              <InputLabel>Origem</InputLabel>
              <Select
                value={sourceFilter}
                label="Origem"
                onChange={(e) => setSourceFilter(e.target.value)}
              >
                <MenuItem value="all">Todas as origens</MenuItem>
                {sources.map((src) => (
                  <MenuItem key={src} value={src}>
                    {src}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
        </Grid>
      </Paper>

      {/* Lista de Logs */}
      <Stack spacing={1.5}>
        {filteredLogs.length === 0 ? (
          <Paper variant="outlined" sx={{ p: 6, textAlign: "center" }}>
            <Typography variant="body1" color="text.secondary">
              {loading ? "Carregando logs..." : "Nenhum log encontrado para os filtros selecionados."}
            </Typography>
          </Paper>
        ) : (
          filteredLogs.map((log) => {
            const config = LEVEL_CONFIG[log.level] ?? LEVEL_CONFIG.info;
            return (
              <Paper
                key={log.id}
                variant="outlined"
                sx={{
                  p: 2,
                  borderLeft: 5,
                  borderColor: config.border,
                  transition: "background-color 0.15s",
                  "&:hover": {
                    bgcolor: (theme) =>
                      theme.palette.mode === "dark"
                        ? "rgba(255, 255, 255, 0.02)"
                        : "rgba(0, 0, 0, 0.01)",
                  },
                }}
              >
                <Stack
                  direction={{ xs: "column", sm: "row" }}
                  alignItems={{ xs: "flex-start", sm: "center" }}
                  justifyContent="space-between"
                  spacing={1}
                >
                  <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
                    <Chip
                      icon={config.icon}
                      label={config.label}
                      color={config.color}
                      size="small"
                      sx={{ fontWeight: "bold", fontSize: "0.75rem" }}
                    />

                    <Chip
                      label={log.source}
                      size="small"
                      variant="outlined"
                      sx={{ fontFamily: "monospace", fontSize: "0.75rem" }}
                    />

                    {log.phone && (
                      <Chip
                        icon={<PhoneIcon sx={{ fontSize: "0.85rem !important" }} />}
                        label={log.phone}
                        size="small"
                        color="default"
                        sx={{ fontSize: "0.75rem" }}
                      />
                    )}

                    <Typography variant="caption" color="text.secondary">
                      {formatDate(log.timestamp)}
                    </Typography>
                  </Stack>

                  {(log.details || log.payload || log.stack) && (
                    <Button
                      size="small"
                      variant="text"
                      startIcon={<CodeIcon fontSize="small" />}
                      onClick={() => setSelectedLog(log)}
                      sx={{ textTransform: "none" }}
                    >
                      Ver detalhes
                    </Button>
                  )}
                </Stack>

                <Typography
                  variant="body2"
                  sx={{
                    mt: 1,
                    fontFamily: "monospace",
                    wordBreak: "break-word",
                    color: log.level === "error" ? "error.main" : "text.primary",
                    fontWeight: log.level === "error" ? 500 : 400,
                  }}
                >
                  {log.message}
                </Typography>
              </Paper>
            );
          })
        )}
      </Stack>

      {/* Modal de Detalhes do Log */}
      <Dialog
        open={Boolean(selectedLog)}
        onClose={() => setSelectedLog(null)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle sx={{ pb: 1 }}>
          <Stack direction="row" alignItems="center" spacing={1.5}>
            {selectedLog && (
              <Chip
                label={LEVEL_CONFIG[selectedLog.level]?.label}
                color={LEVEL_CONFIG[selectedLog.level]?.color}
                size="small"
                sx={{ fontWeight: "bold" }}
              />
            )}
            <Typography variant="h6" component="span" fontWeight="bold">
              Detalhes do Evento
            </Typography>
          </Stack>
          <Typography variant="caption" color="text.secondary" display="block" mt={0.5}>
            {selectedLog ? formatDate(selectedLog.timestamp) : ""} • Origem: {selectedLog?.source}
            {selectedLog?.phone ? ` • Lead: ${selectedLog.phone}` : ""}
          </Typography>
        </DialogTitle>

        <DialogContent dividers>
          {selectedLog && (
            <Stack spacing={2.5}>
              <Box>
                <Typography variant="subtitle2" fontWeight="bold" gutterBottom>
                  Mensagem
                </Typography>
                <Alert
                  severity={selectedLog.level === "warn" ? "warning" : selectedLog.level}
                  sx={{ py: 0.5, fontFamily: "monospace" }}
                >
                  {selectedLog.message}
                </Alert>
              </Box>

              {/* Detalhes / Resposta da API do Hubsoft */}
              {Boolean(selectedLog.details) && (
                <Box>
                  <Stack direction="row" justifyContent="space-between" alignItems="center" mb={0.5}>
                    <Typography variant="subtitle2" fontWeight="bold">
                      Resposta / Detalhes retornados do Hubsoft
                    </Typography>
                    <Button
                      size="small"
                      startIcon={copiedKey === "details" ? <CheckIcon /> : <ContentCopyIcon />}
                      onClick={() =>
                        handleCopy(
                          JSON.stringify(selectedLog.details, null, 2),
                          "details"
                        )
                      }
                      sx={{ textTransform: "none", fontSize: "0.75rem" }}
                    >
                      {copiedKey === "details" ? "Copiado!" : "Copiar JSON"}
                    </Button>
                  </Stack>
                  <Paper
                    variant="outlined"
                    sx={{
                      p: 1.5,
                      bgcolor: (theme) =>
                        theme.palette.mode === "dark" ? "#121212" : "#f8f9fa",
                      fontFamily: "monospace",
                      fontSize: "0.8rem",
                      maxHeight: 260,
                      overflowY: "auto",
                      whiteSpace: "pre-wrap",
                      wordBreak: "break-all",
                    }}
                  >
                    {JSON.stringify(selectedLog.details, null, 2)}
                  </Paper>
                </Box>
              )}

              {/* Payload enviado na requisição */}
              {Boolean(selectedLog.payload) && (
                <Box>
                  <Stack direction="row" justifyContent="space-between" alignItems="center" mb={0.5}>
                    <Typography variant="subtitle2" fontWeight="bold">
                      Dados enviados na Requisição (Payload da IA)
                    </Typography>
                    <Button
                      size="small"
                      startIcon={copiedKey === "payload" ? <CheckIcon /> : <ContentCopyIcon />}
                      onClick={() =>
                        handleCopy(
                          JSON.stringify(selectedLog.payload, null, 2),
                          "payload"
                        )
                      }
                      sx={{ textTransform: "none", fontSize: "0.75rem" }}
                    >
                      {copiedKey === "payload" ? "Copiado!" : "Copiar JSON"}
                    </Button>
                  </Stack>
                  <Paper
                    variant="outlined"
                    sx={{
                      p: 1.5,
                      bgcolor: (theme) =>
                        theme.palette.mode === "dark" ? "#121212" : "#f8f9fa",
                      fontFamily: "monospace",
                      fontSize: "0.8rem",
                      maxHeight: 260,
                      overflowY: "auto",
                      whiteSpace: "pre-wrap",
                      wordBreak: "break-all",
                    }}
                  >
                    {JSON.stringify(selectedLog.payload, null, 2)}
                  </Paper>
                </Box>
              )}
            </Stack>
          )}
        </DialogContent>

        <DialogActions>
          <Button onClick={() => setSelectedLog(null)}>Fechar</Button>
        </DialogActions>
      </Dialog>

      {/* Dialog Confirmação Limpar Logs */}
      <Dialog open={confirmClearOpen} onClose={() => setConfirmClearOpen(false)}>
        <DialogTitle>Limpar todos os logs?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Esta ação removerá todos os registros de logs atuais. Não será possível desfazer.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmClearOpen(false)} disabled={clearing}>
            Cancelar
          </Button>
          <Button onClick={handleClearLogs} color="error" variant="contained" disabled={clearing}>
            {clearing ? "Limpando..." : "Sim, limpar"}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

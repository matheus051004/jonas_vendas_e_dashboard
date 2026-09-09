"use client";

import * as React from "react";
import {
  Alert,
  Avatar,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Divider,
  FormControl,
  FormControlLabel,
  FormLabel,
  IconButton,
  InputAdornment,
  List,
  ListItemAvatar,
  ListItemButton,
  ListItemText,
  Paper,
  Radio,
  RadioGroup,
  Snackbar,
  Stack,
  TextField,
  Tooltip,
  Typography,
  useMediaQuery,
  useTheme,
} from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import MicIcon from "@mui/icons-material/Mic";
import ChatBubbleOutlineIcon from "@mui/icons-material/ChatBubbleOutline";
import CircleIcon from "@mui/icons-material/Circle";
import ScheduleSendIcon from "@mui/icons-material/ScheduleSend";

import PersonIcon from "@mui/icons-material/Person";

const STAGE_LABELS: Record<string, string> = {
  NOVO_LEAD: "Novo lead",
  INTERESSADO: "Interessado",
  FECHOU_VENDA: "Fechou venda",
  DESISTIU: "Desistiu",
  PAROU_DE_RESPONDER: "Parou de responder",
  ACHOU_CARO: "Achou caro",
};

const STAGE_COLORS: Record<
  string,
  "default" | "primary" | "success" | "warning" | "error" | "info"
> = {
  NOVO_LEAD: "info",
  INTERESSADO: "primary",
  FECHOU_VENDA: "success",
  DESISTIU: "default",
  PAROU_DE_RESPONDER: "warning",
  ACHOU_CARO: "error",
};

interface ChatMessage {
  id: string;
  role: string;
  content: string;
  kind: string;
  hasAudio?: boolean;
  createdAt: string;
}

interface ConversationSummary {
  id: string;
  name: string | null;
  phone: string;
  stage: string;
  origin: { name: string } | null;
  area: { name: string } | null;
  followUpCount?: number;
  lastMessage: ChatMessage;
}

interface ConversationDetail {
  id: string;
  name: string | null;
  phone: string;
  stage: string;
  origin: { name: string } | null;
  area: { name: string } | null;
  followUpCount?: number;
  messages: ChatMessage[];
}

type StreamStatus = "connecting" | "live" | "offline";

function initials(name: string | null | undefined): React.ReactNode {
  if (!name) return <PersonIcon sx={{ fontSize: "1.25rem" }} />;
  const clean = name.trim();
  if (!clean) return <PersonIcon sx={{ fontSize: "1.25rem" }} />;

  const words = clean.split(/\s+/).filter((w) => /[a-zA-ZÀ-ÿ]/.test(w));
  if (words.length === 0) {
    return <PersonIcon sx={{ fontSize: "1.25rem" }} />;
  }

  if (words.length >= 2) {
    const first = words[0].replace(/[^a-zA-ZÀ-ÿ]/g, "")[0];
    const last = words[words.length - 1].replace(/[^a-zA-ZÀ-ÿ]/g, "")[0];
    if (first && last) return (first + last).toUpperCase();
    if (first) return first.toUpperCase();
  }

  const firstWordLetters = words[0].replace(/[^a-zA-ZÀ-ÿ]/g, "");
  if (firstWordLetters.length >= 2) {
    return firstWordLetters.slice(0, 2).toUpperCase();
  }
  if (firstWordLetters.length === 1) {
    return firstWordLetters.toUpperCase();
  }

  return <PersonIcon sx={{ fontSize: "1.25rem" }} />;
}

function formatTime(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const sameDay =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();

  if (sameDay) {
    return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  }

  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const isYesterday =
    d.getFullYear() === yesterday.getFullYear() &&
    d.getMonth() === yesterday.getMonth() &&
    d.getDate() === yesterday.getDate();

  if (isYesterday) return "Ontem";

  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

function formatBubbleTime(iso: string) {
  return new Date(iso).toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function previewText(msg: ChatMessage) {
  const prefix = msg.kind === "audio" ? "🎤 " : msg.role === "assistant" ? "Você: " : "";
  const text = msg.content?.trim() || "(sem texto)";
  return prefix + (text.length > 60 ? text.slice(0, 60) + "…" : text);
}

function dayKey(iso: string) {
  const d = new Date(iso);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

function formatDayLabel(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const sameDay =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();
  if (sameDay) return "Hoje";

  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (
    d.getFullYear() === yesterday.getFullYear() &&
    d.getMonth() === yesterday.getMonth() &&
    d.getDate() === yesterday.getDate()
  ) {
    return "Ontem";
  }

  return d.toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
  });
}

function MessageBubble({ message }: { message: ChatMessage }) {
  if (message.role === "system") {
    return (
      <Box sx={{ alignSelf: "center", maxWidth: "85%", py: 0.5 }}>
        <Typography
          variant="caption"
          color="text.secondary"
          sx={{
            display: "block",
            textAlign: "center",
            px: 2,
            py: 0.75,
            borderRadius: 2,
            bgcolor: "action.hover",
          }}
        >
          {message.content}
        </Typography>
      </Box>
    );
  }

  const isUser = message.role === "user";

  return (
    <Box
      sx={{
        alignSelf: isUser ? "flex-start" : "flex-end",
        maxWidth: { xs: "88%", sm: "75%" },
      }}
    >
      <Box
        sx={{
          px: 1.75,
          py: 1.1,
          borderRadius: isUser ? "16px 16px 16px 4px" : "16px 16px 4px 16px",
          bgcolor: isUser ? "grey.100" : "primary.main",
          color: isUser ? "text.primary" : "primary.contrastText",
          boxShadow: 1,
        }}
      >
        {message.kind === "audio" && (
          <Stack spacing={0.75} mb={message.content && message.content !== "[áudio]" ? 0.75 : 0}>
            <Stack direction="row" spacing={0.75} alignItems="center" sx={{ opacity: 0.9 }}>
              <MicIcon sx={{ fontSize: 16 }} />
              <Typography variant="caption" fontWeight={600}>
                Áudio
              </Typography>
            </Stack>
            {message.hasAudio ? (
              <Box
                component="audio"
                controls
                preload="metadata"
                src={`/api/messages/${message.id}/audio`}
                sx={{
                  width: "100%",
                  minWidth: 200,
                  maxWidth: 320,
                  height: 36,
                  display: "block",
                }}
              />
            ) : (
              <Typography variant="caption" sx={{ opacity: 0.7, fontStyle: "italic" }}>
                Áudio original indisponível (só transcrição)
              </Typography>
            )}
          </Stack>
        )}
        {message.content && (message.kind !== "audio" || message.content !== "[áudio]" || !message.hasAudio) ? (
          <Typography
            variant="body2"
            sx={{ whiteSpace: "pre-wrap", wordBreak: "break-word", lineHeight: 1.45 }}
          >
            {message.kind === "audio" ? (
              <>
                <Box
                  component="span"
                  sx={{ opacity: 0.75, fontSize: "0.75rem", display: "block", mb: 0.25 }}
                >
                  Transcrição
                </Box>
                {message.content}
              </>
            ) : (
              message.content
            )}
          </Typography>
        ) : null}
        <Typography
          variant="caption"
          sx={{
            display: "block",
            textAlign: "right",
            mt: 0.5,
            opacity: isUser ? 0.55 : 0.75,
            fontSize: "0.68rem",
          }}
        >
          {formatBubbleTime(message.createdAt)}
        </Typography>
      </Box>
    </Box>
  );
}

export default function AtendimentosPage() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));

  const [conversations, setConversations] = React.useState<ConversationSummary[]>([]);
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [detail, setDetail] = React.useState<ConversationDetail | null>(null);
  const [messages, setMessages] = React.useState<ChatMessage[]>([]);
  const [search, setSearch] = React.useState("");
  const [listLoading, setListLoading] = React.useState(true);
  const [threadLoading, setThreadLoading] = React.useState(false);
  const [streamStatus, setStreamStatus] = React.useState<StreamStatus>("connecting");

  const selectedIdRef = React.useRef<string | null>(null);
  const threadEndRef = React.useRef<HTMLDivElement | null>(null);

  const [followUpDialogOpen, setFollowUpDialogOpen] = React.useState(false);
  const [followUpAttempt, setFollowUpAttempt] = React.useState<number>(1);
  const [followUpLoading, setFollowUpLoading] = React.useState(false);
  const [feedbackSnackbar, setFeedbackSnackbar] = React.useState<{
    open: boolean;
    message: string;
    severity: "success" | "error" | "info";
  }>({
    open: false,
    message: "",
    severity: "success",
  });

  const handleOpenFollowUpDialog = () => {
    if (!detail) return;
    const currentCount = detail.followUpCount ?? 0;
    const nextAttempt = Math.min(Math.max(currentCount + 1, 1), 3);
    setFollowUpAttempt(nextAttempt);
    setFollowUpDialogOpen(true);
  };

  const handleConfirmForceFollowUp = async () => {
    if (!detail) return;
    setFollowUpLoading(true);
    try {
      const res = await fetch(`/api/atendimentos/${detail.id}/followup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ attempt: followUpAttempt }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Falha ao forçar follow-up");
      }

      setFeedbackSnackbar({
        open: true,
        message: `Follow-up (tentativa ${followUpAttempt}) disparado com sucesso!`,
        severity: "success",
      });

      setDetail((prev) =>
        prev
          ? {
              ...prev,
              stage: data.stage ?? prev.stage,
              followUpCount: data.followUpCount ?? followUpAttempt,
            }
          : prev
      );

      setConversations((prev) =>
        prev.map((c) =>
          c.id === detail.id
            ? {
                ...c,
                stage: data.stage ?? c.stage,
                followUpCount: data.followUpCount ?? followUpAttempt,
              }
            : c
        )
      );

      setFollowUpDialogOpen(false);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erro ao disparar follow-up";
      setFeedbackSnackbar({
        open: true,
        message: msg,
        severity: "error",
      });
    } finally {
      setFollowUpLoading(false);
    }
  };

  React.useEffect(() => {
    selectedIdRef.current = selectedId;
  }, [selectedId]);

  const loadList = React.useCallback(async () => {
    try {
      const res = await fetch("/api/atendimentos");
      if (!res.ok) return;
      const data: ConversationSummary[] = await res.json();
      setConversations(data);
    } finally {
      setListLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void loadList();
  }, [loadList]);

  React.useEffect(() => {
    if (!selectedId) {
      setDetail(null);
      setMessages([]);
      return;
    }

    let cancelled = false;
    setThreadLoading(true);

    void fetch(`/api/atendimentos/${selectedId}`)
      .then(async (res) => {
        if (!res.ok) return null;
        return (await res.json()) as ConversationDetail;
      })
      .then((data) => {
        if (cancelled || !data) return;
        setDetail(data);
        setMessages(data.messages);
      })
      .finally(() => {
        if (!cancelled) setThreadLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [selectedId]);

  React.useEffect(() => {
    threadEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // SSE tempo real (EventSource reconecta sozinho; onopen refresca a lista para preencher gaps)
  React.useEffect(() => {
    setStreamStatus("connecting");
    const es = new EventSource("/api/atendimentos/stream");

    es.onopen = () => {
      setStreamStatus("live");
      void loadList();
    };

    es.onmessage = (ev) => {
      try {
        const event = JSON.parse(ev.data) as {
          type: string;
          clientId: string;
          message: ChatMessage;
          client?: {
            id: string;
            name: string | null;
            phone: string;
            stage: string;
          };
        };
        if (event.type !== "message" || !event.message) return;

        setConversations((prev) => {
          const existing = prev.find((c) => c.id === event.clientId);
          const lastMessage = event.message;
          if (existing) {
            const updated: ConversationSummary = {
              ...existing,
              name: event.client?.name ?? existing.name,
              stage: event.client?.stage ?? existing.stage,
              lastMessage,
            };
            return [updated, ...prev.filter((c) => c.id !== event.clientId)];
          }
          if (!event.client) return prev;
          const created: ConversationSummary = {
            id: event.client.id,
            name: event.client.name,
            phone: event.client.phone,
            stage: event.client.stage,
            origin: null,
            area: null,
            lastMessage,
          };
          return [created, ...prev];
        });

        if (selectedIdRef.current === event.clientId) {
          setMessages((prev) => {
            if (prev.some((m) => m.id === event.message.id)) return prev;
            return [...prev, event.message];
          });
          if (event.client) {
            setDetail((prev) =>
              prev
                ? {
                    ...prev,
                    name: event.client!.name,
                    stage: event.client!.stage,
                  }
                : prev
            );
          }
        }
      } catch {
        /* ignore malformed */
      }
    };

    es.onerror = () => {
      setStreamStatus("offline");
    };

    return () => {
      es.close();
    };
  }, [loadList]);

  const filtered = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return conversations;
    return conversations.filter(
      (c) =>
        (c.name ?? "").toLowerCase().includes(q) ||
        c.phone.includes(q) ||
        (c.area?.name ?? "").toLowerCase().includes(q)
    );
  }, [conversations, search]);

  const showList = !isMobile || !selectedId;
  const showThread = !isMobile || !!selectedId;

  return (
    <Box
      sx={{
        height: { xs: "calc(100vh - 112px)", md: "calc(100vh - 128px)" },
        display: "flex",
        flexDirection: "column",
        minHeight: 0,
      }}
    >
      <Stack
        direction="row"
        alignItems="center"
        justifyContent="space-between"
        mb={1.5}
        flexShrink={0}
      >
        <Typography variant="h4">Atendimentos</Typography>
        <Stack direction="row" spacing={1} alignItems="center">
          <CircleIcon
            sx={{
              fontSize: 10,
              color:
                streamStatus === "live"
                  ? "success.main"
                  : streamStatus === "connecting"
                    ? "warning.main"
                    : "text.disabled",
            }}
          />
          <Typography variant="caption" color="text.secondary">
            {streamStatus === "live"
              ? "Ao vivo"
              : streamStatus === "connecting"
                ? "Conectando…"
                : "Offline — reconectando"}
          </Typography>
        </Stack>
      </Stack>

      <Paper
        variant="outlined"
        sx={{
          flex: 1,
          minHeight: 0,
          display: "flex",
          overflow: "hidden",
          borderRadius: 2,
        }}
      >
        {/* Lista de conversas */}
        {showList && (
          <Box
            sx={{
              width: { xs: "100%", md: 360 },
              flexShrink: 0,
              borderRight: { md: 1 },
              borderColor: "divider",
              display: "flex",
              flexDirection: "column",
              minHeight: 0,
              bgcolor: "background.paper",
            }}
          >
            <Box sx={{ p: 1.5, flexShrink: 0 }}>
              <TextField
                size="small"
                fullWidth
                placeholder="Buscar nome ou telefone…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon fontSize="small" color="action" />
                    </InputAdornment>
                  ),
                }}
              />
            </Box>
            <Divider />
            <Box sx={{ flex: 1, overflowY: "auto", minHeight: 0 }}>
              {listLoading ? (
                <Stack alignItems="center" py={6}>
                  <CircularProgress size={28} />
                </Stack>
              ) : filtered.length === 0 ? (
                <Stack alignItems="center" spacing={1} py={6} px={2}>
                  <ChatBubbleOutlineIcon color="disabled" sx={{ fontSize: 40 }} />
                  <Typography variant="body2" color="text.secondary" textAlign="center">
                    {search ? "Nenhuma conversa encontrada." : "Nenhuma conversa ainda."}
                  </Typography>
                </Stack>
              ) : (
                <List disablePadding>
                  {filtered.map((c) => {
                    const selected = c.id === selectedId;
                    return (
                      <ListItemButton
                        key={c.id}
                        selected={selected}
                        onClick={() => setSelectedId(c.id)}
                        alignItems="flex-start"
                        sx={{
                          py: 1.25,
                          px: 1.5,
                          borderLeft: 3,
                          borderColor: selected ? "primary.main" : "transparent",
                        }}
                      >
                        <ListItemAvatar>
                          <Avatar
                            sx={{
                              bgcolor: selected ? "primary.main" : "grey.300",
                              color: selected ? "primary.contrastText" : "text.primary",
                              width: 44,
                              height: 44,
                              fontSize: "0.9rem",
                              fontWeight: 600,
                            }}
                          >
                            {initials(c.name)}
                          </Avatar>
                        </ListItemAvatar>
                        <ListItemText
                          primary={
                            <Stack direction="row" justifyContent="space-between" spacing={1}>
                              <Typography
                                variant="subtitle2"
                                noWrap
                                fontWeight={selected ? 700 : 600}
                                sx={{ flex: 1, minWidth: 0 }}
                              >
                                {c.name?.trim() || c.phone}
                              </Typography>
                              <Typography
                                variant="caption"
                                color="text.secondary"
                                sx={{ flexShrink: 0 }}
                              >
                                {formatTime(c.lastMessage.createdAt)}
                              </Typography>
                            </Stack>
                          }
                          secondary={
                            <Box component="span" sx={{ display: "block", mt: 0.25 }}>
                              <Typography
                                component="span"
                                variant="body2"
                                color="text.secondary"
                                noWrap
                                sx={{ display: "block" }}
                              >
                                {previewText(c.lastMessage)}
                              </Typography>
                              <Stack direction="row" spacing={0.5} alignItems="center" sx={{ mt: 0.5, flexWrap: "wrap", gap: 0.5 }}>
                                <Chip
                                  size="small"
                                  label={STAGE_LABELS[c.stage] ?? c.stage}
                                  color={STAGE_COLORS[c.stage] ?? "default"}
                                  variant="outlined"
                                  sx={{ height: 20, fontSize: "0.68rem" }}
                                />
                                {c.followUpCount != null && c.followUpCount > 0 && (
                                  <Chip
                                    size="small"
                                    label={`Follow-up ${c.followUpCount}/3`}
                                    color="secondary"
                                    variant="outlined"
                                    sx={{ height: 20, fontSize: "0.65rem" }}
                                  />
                                )}
                              </Stack>
                            </Box>
                          }
                          secondaryTypographyProps={{ component: "div" }}
                        />
                      </ListItemButton>
                    );
                  })}
                </List>
              )}
            </Box>
          </Box>
        )}

        {/* Thread */}
        {showThread && (
          <Box
            sx={{
              flex: 1,
              minWidth: 0,
              minHeight: 0,
              display: "flex",
              flexDirection: "column",
              bgcolor: "grey.50",
            }}
          >
            {!selectedId ? (
              <Stack
                flex={1}
                alignItems="center"
                justifyContent="center"
                spacing={1.5}
                px={3}
              >
                <ChatBubbleOutlineIcon sx={{ fontSize: 56, color: "text.disabled" }} />
                <Typography variant="h6" color="text.secondary" fontWeight={500}>
                  Selecione um atendimento
                </Typography>
                <Typography variant="body2" color="text.secondary" textAlign="center">
                  Acompanhe as conversas em tempo real. As mensagens aparecem
                  automaticamente quando o lead ou a IA responde.
                </Typography>
              </Stack>
            ) : (
              <>
                <Box
                  sx={{
                    px: 2,
                    py: 1.25,
                    borderBottom: 1,
                    borderColor: "divider",
                    bgcolor: "background.paper",
                    flexShrink: 0,
                  }}
                >
                  <Stack direction="row" alignItems="center" spacing={1.5}>
                    {isMobile && (
                      <IconButton size="small" onClick={() => setSelectedId(null)} edge="start">
                        <ArrowBackIcon />
                      </IconButton>
                    )}
                    <Avatar sx={{ bgcolor: "primary.main", width: 40, height: 40, fontWeight: 600 }}>
                      {initials(detail?.name)}
                    </Avatar>
                    <Box sx={{ minWidth: 0, flex: 1 }}>
                      <Typography variant="subtitle1" fontWeight={600} noWrap>
                        {detail?.name?.trim() || detail?.phone || "…"}
                      </Typography>
                      <Typography variant="caption" color="text.secondary" noWrap display="block">
                        {detail?.phone}
                        {detail?.area?.name ? ` · ${detail.area.name}` : ""}
                        {detail?.origin?.name ? ` · ${detail.origin.name}` : ""}
                      </Typography>
                    </Box>
                    {detail && (
                      <Chip
                        size="small"
                        label={STAGE_LABELS[detail.stage] ?? detail.stage}
                        color={STAGE_COLORS[detail.stage] ?? "default"}
                      />
                    )}
                    {detail && detail.followUpCount != null && detail.followUpCount > 0 && (
                      <Chip
                        size="small"
                        label={`Follow-up ${detail.followUpCount}/3`}
                        color="secondary"
                        variant="outlined"
                      />
                    )}
                    {detail && (
                      <Tooltip
                        title={
                          detail.stage === "FECHOU_VENDA"
                            ? "Venda já fechada"
                            : "Forçar envio de follow-up da IA para este atendimento"
                        }
                      >
                        <span>
                          <Button
                            variant="outlined"
                            size="small"
                            color="secondary"
                            disabled={detail.stage === "FECHOU_VENDA"}
                            onClick={handleOpenFollowUpDialog}
                            startIcon={<ScheduleSendIcon />}
                            sx={{
                              textTransform: "none",
                              whiteSpace: "nowrap",
                              fontWeight: 600,
                              px: { xs: 1, sm: 1.5 },
                            }}
                          >
                            <Box component="span" sx={{ display: { xs: "none", sm: "inline" } }}>
                              Forçar follow-up
                            </Box>
                          </Button>
                        </span>
                      </Tooltip>
                    )}
                  </Stack>
                </Box>

                <Box
                  sx={{
                    flex: 1,
                    overflowY: "auto",
                    minHeight: 0,
                    px: { xs: 1.5, md: 3 },
                    py: 2,
                    backgroundImage: (t) =>
                      `radial-gradient(${t.palette.grey[200]} 1px, transparent 1px)`,
                    backgroundSize: "18px 18px",
                  }}
                >
                  {threadLoading ? (
                    <Stack alignItems="center" py={8}>
                      <CircularProgress size={28} />
                    </Stack>
                  ) : messages.length === 0 ? (
                    <Typography variant="body2" color="text.secondary" textAlign="center" mt={4}>
                      Nenhuma mensagem neste atendimento.
                    </Typography>
                  ) : (
                    <Stack spacing={1.25}>
                      {messages.map((m, i) => {
                        const prev = messages[i - 1];
                        const showDay = !prev || dayKey(prev.createdAt) !== dayKey(m.createdAt);
                        return (
                          <React.Fragment key={m.id}>
                            {showDay && (
                              <Box sx={{ alignSelf: "center", my: 1 }}>
                                <Chip
                                  size="small"
                                  label={formatDayLabel(m.createdAt)}
                                  sx={{
                                    bgcolor: "background.paper",
                                    fontWeight: 500,
                                    textTransform: "capitalize",
                                    boxShadow: 1,
                                  }}
                                />
                              </Box>
                            )}
                            <MessageBubble message={m} />
                          </React.Fragment>
                        );
                      })}
                      <div ref={threadEndRef} />
                    </Stack>
                  )}
                </Box>

                <Box
                  sx={{
                    px: 2,
                    py: 1,
                    borderTop: 1,
                    borderColor: "divider",
                    bgcolor: "background.paper",
                    flexShrink: 0,
                  }}
                >
                  <Typography variant="caption" color="text.secondary">
                    Somente leitura
                  </Typography>
                </Box>
              </>
            )}
          </Box>
        )}
      </Paper>

      {/* Dialog para confirmação e seleção da tentativa de follow-up */}
      <Dialog
        open={followUpDialogOpen}
        onClose={() => !followUpLoading && setFollowUpDialogOpen(false)}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle sx={{ fontWeight: 600, display: "flex", alignItems: "center", gap: 1 }}>
          <ScheduleSendIcon color="primary" /> Forçar Follow-up
        </DialogTitle>
        <DialogContent dividers>
          <DialogContentText sx={{ mb: 2 }}>
            Disparar imediatamente uma mensagem de acompanhamento da IA para{" "}
            <strong>{detail?.name?.trim() || detail?.phone}</strong>.
          </DialogContentText>
          <FormControl component="fieldset" sx={{ width: "100%" }}>
            <FormLabel component="legend" sx={{ fontSize: "0.875rem", fontWeight: 600, mb: 1 }}>
              Escolha a abordagem da IA:
            </FormLabel>
            <RadioGroup
              value={followUpAttempt}
              onChange={(e) => setFollowUpAttempt(Number(e.target.value))}
            >
              <FormControlLabel
                value={1}
                control={<Radio size="small" />}
                label={
                  <Box sx={{ py: 0.5 }}>
                    <Typography variant="body2" fontWeight={600}>
                      Tentativa 1 · Retomada amigável
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Mensagem inicial para reatar o contato e tirar dúvidas pendentes.
                    </Typography>
                  </Box>
                }
                sx={{ mb: 1, alignItems: "flex-start" }}
              />
              <FormControlLabel
                value={2}
                control={<Radio size="small" />}
                label={
                  <Box sx={{ py: 0.5 }}>
                    <Typography variant="body2" fontWeight={600}>
                      Tentativa 2 · Vantagens e diferenciais
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Reforço dos benefícios do plano e valor agregado do provedor.
                    </Typography>
                  </Box>
                }
                sx={{ mb: 1, alignItems: "flex-start" }}
              />
              <FormControlLabel
                value={3}
                control={<Radio size="small" />}
                label={
                  <Box sx={{ py: 0.5 }}>
                    <Typography variant="body2" fontWeight={600}>
                      Tentativa 3 · Última chamada
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Última tentativa de contato antes do encerramento do atendimento.
                    </Typography>
                  </Box>
                }
                sx={{ alignItems: "flex-start" }}
              />
            </RadioGroup>
          </FormControl>
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 1.5 }}>
          <Button
            onClick={() => setFollowUpDialogOpen(false)}
            disabled={followUpLoading}
            color="inherit"
          >
            Cancelar
          </Button>
          <Button
            onClick={handleConfirmForceFollowUp}
            variant="contained"
            color="primary"
            disabled={followUpLoading}
            startIcon={followUpLoading ? <CircularProgress size={16} color="inherit" /> : <ScheduleSendIcon />}
          >
            {followUpLoading ? "Disparando..." : "Disparar agora"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Feedback de sucesso ou erro */}
      <Snackbar
        open={feedbackSnackbar.open}
        autoHideDuration={5000}
        onClose={() => setFeedbackSnackbar((prev) => ({ ...prev, open: false }))}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert
          onClose={() => setFeedbackSnackbar((prev) => ({ ...prev, open: false }))}
          severity={feedbackSnackbar.severity}
          variant="filled"
          sx={{ width: "100%" }}
        >
          {feedbackSnackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}

"use client";

import * as React from "react";
import {
  Box,
  Typography,
  Paper,
  Chip,
  TextField,
  Button,
  Stack,
  InputAdornment,
  Snackbar,
} from "@mui/material";
import { submitJson } from "@/lib/form-errors";
import Grid from "@mui/material/Grid2";
import SearchIcon from "@mui/icons-material/Search";
import PhoneIcon from "@mui/icons-material/Phone";
import { DragDropContext, Droppable, Draggable, type DropResult } from "@hello-pangea/dnd";

const STAGES = [
  { key: "NOVO_LEAD", label: "Novo lead" },
  { key: "INTERESSADO", label: "Interessado" },
  { key: "PAROU_DE_RESPONDER", label: "Sumiu / Sem resposta" },
  { key: "ACHOU_CARO", label: "Achou caro" },
  { key: "FECHOU_VENDA", label: "Fechou venda" },
  { key: "DESISTIU", label: "Desistiu" },
] as const;

type StageKey = (typeof STAGES)[number]["key"];

const STAGE_COLORS: Record<StageKey, string> = {
  NOVO_LEAD: "info.main",
  INTERESSADO: "warning.main",
  PAROU_DE_RESPONDER: "#9c27b0",
  ACHOU_CARO: "#ed6c02",
  FECHOU_VENDA: "success.main",
  DESISTIU: "grey.400",
};

interface Client {
  id: string;
  name: string | null;
  phone: string;
  stage: StageKey;
  origin: { name: string } | null;
  createdAt: string;
}

const dateFmt = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});

function formatDate(iso: string) {
  return dateFmt.format(new Date(iso));
}

function matches(client: Client, query: string) {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const name = (client.name ?? "sem nome").toLowerCase();
  return name.includes(q) || client.phone.toLowerCase().includes(q);
}

function Column({
  stage,
  clients,
}: {
  stage: (typeof STAGES)[number];
  clients: Client[];
}) {
  const [query, setQuery] = React.useState("");
  const [limit, setLimit] = React.useState(10);

  const filtered = clients.filter((c) => matches(c, query)).slice(0, limit);
  const total = clients.length;

  return (
    <Droppable droppableId={stage.key}>
      {(provided) => (
        <Paper
          ref={provided.innerRef}
          {...provided.droppableProps}
          sx={{
            width: { xs: 280, sm: 320 },
            minHeight: 480,
            p: 1.5,
            flexShrink: 0,
            bgcolor: (theme) =>
              theme.palette.mode === "dark"
                ? "rgba(255,255,255,0.03)"
                : "rgba(0,0,0,0.02)",
            borderTop: 3,
            borderColor: STAGE_COLORS[stage.key],
          }}
        >
          <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1.5, px: 0.5 }}>
            <Box
              sx={{
                width: 10,
                height: 10,
                borderRadius: "50%",
                bgcolor: STAGE_COLORS[stage.key],
              }}
            />
            <Typography variant="subtitle1" fontWeight="bold" flex={1}>
              {stage.label}
            </Typography>
            <Chip label={total} size="small" color="default" />
          </Stack>

          <TextField
            size="small"
            fullWidth
            placeholder="Buscar nome, telefone..."
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setLimit(10);
            }}
            slotProps={{
              input: {
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon fontSize="small" />
                  </InputAdornment>
                ),
              },
            }}
            sx={{ mb: 1.5 }}
          />

          {filtered.map((client, index) => (
            <Draggable draggableId={client.id} index={index} key={client.id}>
              {(dragProvided) => (
                <Paper
                  ref={dragProvided.innerRef}
                  {...dragProvided.draggableProps}
                  {...dragProvided.dragHandleProps}
                  sx={{
                    p: 1.5,
                    mb: 1,
                    borderLeft: 4,
                    borderColor: STAGE_COLORS[stage.key],
                  }}
                  variant="outlined"
                >
                  <Typography fontWeight="bold" noWrap>
                    {client.name ?? "Sem nome"}
                  </Typography>
                  <Stack direction="row" alignItems="center" spacing={0.5} sx={{ mt: 0.5 }}>
                    <PhoneIcon fontSize="inherit" color="action" />
                    <Typography variant="body2" color="text.secondary">
                      {client.phone}
                    </Typography>
                  </Stack>
                  {client.origin && (
                    <Chip
                      label={client.origin.name}
                      size="small"
                      sx={{ mt: 1, bgcolor: (theme) => theme.palette.action.hover }}
                    />
                  )}
                  <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.5 }}>
                    {formatDate(client.createdAt)}
                  </Typography>
                </Paper>
              )}
            </Draggable>
          ))}

          {clients.filter((c) => matches(c, query)).length > limit && (
            <Button fullWidth size="small" onClick={() => setLimit((l) => l + 10)}>
              Mostrar mais
            </Button>
          )}

          {provided.placeholder}
        </Paper>
      )}
    </Droppable>
  );
}

export default function KanbanPage() {
  const [clients, setClients] = React.useState<Client[]>([]);
  const [snackbar, setSnackbar] = React.useState({ open: false, message: "" });

  const load = React.useCallback(() => {
    fetch("/api/clientes")
      .then((r) => r.json())
      .then((data: Client[]) => setClients(data));
  }, []);

  React.useEffect(() => load(), [load]);

  React.useEffect(() => {
    const id = setInterval(load, 10000);
    return () => clearInterval(id);
  }, [load]);

  React.useEffect(() => {
    function handleVisibility() {
      if (!document.hidden) load();
    }
    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, [load]);

  async function handleDragEnd(result: DropResult) {
    const { destination, draggableId } = result;
    if (!destination) return;
    const newStage = destination.droppableId as StageKey;
    const previous = clients;

    setClients((prev) => prev.map((c) => (c.id === draggableId ? { ...c, stage: newStage } : c)));
    const save = await submitJson(`/api/clientes/${draggableId}`, {
      method: "PATCH",
      body: { stage: newStage },
    });
    if (!save.ok) {
      setClients(previous);
      setSnackbar({
        open: true,
        message: save.formError ?? "Não foi possível mover o lead. Tente novamente.",
      });
    }
  }

  return (
    <Box>
      <Typography variant="h4" mb={3}>
        Kanban de vendas
      </Typography>
      <DragDropContext onDragEnd={handleDragEnd}>
        <Box sx={{ display: "flex", gap: 2, overflowX: "auto", pb: 2 }}>
          {STAGES.map((stage) => (
            <Column
              key={stage.key}
              stage={stage}
              clients={clients.filter((c) => c.stage === stage.key)}
            />
          ))}
        </Box>
      </DragDropContext>
      <Snackbar
        open={snackbar.open}
        autoHideDuration={3500}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
        message={snackbar.message}
      />
    </Box>
  );
}

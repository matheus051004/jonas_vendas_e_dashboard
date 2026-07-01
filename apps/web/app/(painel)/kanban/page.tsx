"use client";

import * as React from "react";
import { Box, Typography, Paper, Chip } from "@mui/material";
import { DragDropContext, Droppable, Draggable, type DropResult } from "@hello-pangea/dnd";

const STAGES = [
  { key: "NOVO_LEAD", label: "Novo lead" },
  { key: "INTERESSADO", label: "Interessado" },
  { key: "FECHOU_VENDA", label: "Fechou venda" },
  { key: "DESISTIU", label: "Desistiu" },
] as const;

interface Client {
  id: string;
  name: string | null;
  phone: string;
  stage: string;
  origin: { name: string } | null;
}

export default function KanbanPage() {
  const [clients, setClients] = React.useState<Client[]>([]);

  const load = React.useCallback(() => {
    fetch("/api/clientes").then((r) => r.json()).then(setClients);
  }, []);

  React.useEffect(() => load(), [load]);

  async function handleDragEnd(result: DropResult) {
    const { destination, draggableId } = result;
    if (!destination) return;
    const newStage = destination.droppableId;

    setClients((prev) => prev.map((c) => (c.id === draggableId ? { ...c, stage: newStage } : c)));
    await fetch(`/api/clientes/${draggableId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ stage: newStage }),
    });
  }

  return (
    <Box>
      <Typography variant="h4" mb={3}>
        Kanban de vendas
      </Typography>
      <DragDropContext onDragEnd={handleDragEnd}>
        <Box sx={{ display: "flex", gap: 2, overflowX: "auto" }}>
          {STAGES.map((stage) => (
            <Droppable droppableId={stage.key} key={stage.key}>
              {(provided) => (
                <Paper
                  ref={provided.innerRef}
                  {...provided.droppableProps}
                  sx={{ width: 280, minHeight: 400, p: 1, bgcolor: "grey.50", flexShrink: 0 }}
                >
                  <Typography variant="subtitle1" fontWeight="bold" mb={1} px={1}>
                    {stage.label} ({clients.filter((c) => c.stage === stage.key).length})
                  </Typography>
                  {clients
                    .filter((c) => c.stage === stage.key)
                    .map((client, index) => (
                      <Draggable draggableId={client.id} index={index} key={client.id}>
                        {(dragProvided) => (
                          <Paper
                            ref={dragProvided.innerRef}
                            {...dragProvided.draggableProps}
                            {...dragProvided.dragHandleProps}
                            sx={{ p: 1.5, mb: 1 }}
                            variant="outlined"
                          >
                            <Typography fontWeight="bold">{client.name ?? "Sem nome"}</Typography>
                            <Typography variant="body2" color="text.secondary">
                              {client.phone}
                            </Typography>
                            {client.origin && <Chip label={client.origin.name} size="small" sx={{ mt: 0.5 }} />}
                          </Paper>
                        )}
                      </Draggable>
                    ))}
                  {provided.placeholder}
                </Paper>
              )}
            </Droppable>
          ))}
        </Box>
      </DragDropContext>
    </Box>
  );
}

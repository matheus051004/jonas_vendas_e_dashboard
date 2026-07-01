"use client";

import * as React from "react";
import { Box, Typography, Dialog, DialogTitle, DialogContent, Chip, Stack, Paper } from "@mui/material";
import { DataGrid, type GridColDef } from "@mui/x-data-grid";

interface Client {
  id: string;
  name: string | null;
  phone: string;
  cep: string | null;
  stage: string;
  origin: { name: string } | null;
}

interface Message {
  id: string;
  role: string;
  content: string;
  kind: string;
  createdAt: string;
}

interface ClientDetail extends Client {
  messages: Message[];
}

const columns: GridColDef<Client>[] = [
  { field: "name", headerName: "Nome", flex: 1, valueGetter: (_v, row) => row.name ?? "Sem nome" },
  { field: "phone", headerName: "Telefone", flex: 1 },
  { field: "cep", headerName: "CEP", flex: 1, valueGetter: (_v, row) => row.cep ?? "-" },
  { field: "origin", headerName: "Origem", flex: 1, valueGetter: (_v, row) => row.origin?.name ?? "-" },
  { field: "stage", headerName: "Etapa", flex: 1 },
];

export default function ClientesPage() {
  const [clients, setClients] = React.useState<Client[]>([]);
  const [detail, setDetail] = React.useState<ClientDetail | null>(null);

  React.useEffect(() => {
    fetch("/api/clientes").then((r) => r.json()).then(setClients);
  }, []);

  async function openDetail(id: string) {
    const res = await fetch(`/api/clientes/${id}`);
    setDetail(await res.json());
  }

  return (
    <Box>
      <Typography variant="h4" mb={3}>
        Clientes
      </Typography>
      <Box sx={{ height: 600, bgcolor: "background.paper" }}>
        <DataGrid
          rows={clients}
          columns={columns}
          onRowClick={(params) => openDetail(params.row.id)}
          disableRowSelectionOnClick
        />
      </Box>

      <Dialog open={!!detail} onClose={() => setDetail(null)} maxWidth="sm" fullWidth>
        <DialogTitle>{detail?.name ?? detail?.phone}</DialogTitle>
        <DialogContent>
          <Stack spacing={1} mb={2}>
            <Typography variant="body2">Telefone: {detail?.phone}</Typography>
            <Typography variant="body2">Etapa: {detail?.stage}</Typography>
          </Stack>
          <Typography variant="subtitle2" mb={1}>
            Histórico
          </Typography>
          <Stack spacing={1} sx={{ maxHeight: 400, overflowY: "auto" }}>
            {detail?.messages.map((m) => (
              <Paper key={m.id} variant="outlined" sx={{ p: 1 }}>
                <Chip label={m.role} size="small" sx={{ mb: 0.5 }} />
                <Typography variant="body2">{m.content}</Typography>
              </Paper>
            ))}
          </Stack>
        </DialogContent>
      </Dialog>
    </Box>
  );
}

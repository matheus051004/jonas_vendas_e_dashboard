"use client";

import * as React from "react";
import {
  Box,
  Typography,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControlLabel,
  Switch,
  IconButton,
  Card,
  CardContent,
} from "@mui/material";
import Grid from "@mui/material/Grid2";
import { DataGrid, type GridColDef } from "@mui/x-data-grid";
import AddIcon from "@mui/icons-material/Add";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";

interface Origin {
  id: string;
  name: string;
  active: boolean;
  _count: { clients: number };
}

const EMPTY_FORM = { name: "", active: true };

export default function OrigensPage() {
  const [origins, setOrigins] = React.useState<Origin[]>([]);
  const [open, setOpen] = React.useState(false);
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [form, setForm] = React.useState(EMPTY_FORM);

  const load = React.useCallback(() => {
    fetch("/api/origens").then((r) => r.json()).then(setOrigins);
  }, []);

  React.useEffect(() => load(), [load]);

  function openCreate() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setOpen(true);
  }

  function openEdit(origin: Origin) {
    setEditingId(origin.id);
    setForm({ name: origin.name, active: origin.active });
    setOpen(true);
  }

  async function handleSave() {
    const url = editingId ? `/api/origens/${editingId}` : "/api/origens";
    await fetch(url, {
      method: editingId ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    setOpen(false);
    load();
  }

  async function handleDelete(id: string) {
    await fetch(`/api/origens/${id}`, { method: "DELETE" });
    load();
  }

  const columns: GridColDef<Origin>[] = [
    { field: "name", headerName: "Nome", flex: 1 },
    { field: "leads", headerName: "Leads", flex: 1, valueGetter: (_v, row) => row._count.clients },
    { field: "active", headerName: "Ativo", flex: 1, valueGetter: (_v, row) => (row.active ? "Sim" : "Não") },
    {
      field: "actions",
      headerName: "",
      sortable: false,
      width: 100,
      renderCell: (params) => (
        <>
          <IconButton size="small" onClick={() => openEdit(params.row)}>
            <EditIcon fontSize="small" />
          </IconButton>
          <IconButton size="small" onClick={() => handleDelete(params.row.id)}>
            <DeleteIcon fontSize="small" />
          </IconButton>
        </>
      ),
    },
  ];

  return (
    <Box>
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 3 }}>
        <Typography variant="h4">Origens</Typography>
        <Button startIcon={<AddIcon />} variant="contained" onClick={openCreate}>
          Nova origem
        </Button>
      </Box>

      <Grid container spacing={2} mb={3}>
        {origins.map((origin) => (
          <Grid size={{ xs: 12, sm: 6, md: 3 }} key={origin.id}>
            <Card>
              <CardContent>
                <Typography color="text.secondary">{origin.name}</Typography>
                <Typography variant="h4">{origin._count.clients}</Typography>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      <Box sx={{ height: 500, bgcolor: "background.paper" }}>
        <DataGrid rows={origins} columns={columns} disableRowSelectionOnClick />
      </Box>

      <Dialog open={open} onClose={() => setOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{editingId ? "Editar origem" : "Nova origem"}</DialogTitle>
        <DialogContent>
          <TextField
            label="Nome"
            fullWidth
            margin="normal"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
          <FormControlLabel
            control={<Switch checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} />}
            label="Ativo"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)}>Cancelar</Button>
          <Button variant="contained" onClick={handleSave}>
            Salvar
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

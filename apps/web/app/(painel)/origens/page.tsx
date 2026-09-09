"use client";

import * as React from "react";
import {
  Alert,
  Box,
  Typography,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  TextField,
  FormControlLabel,
  Switch,
  IconButton,
  Card,
  CardContent,
} from "@mui/material";
import { OriginFormSchema } from "@/lib/crud-schemas";
import { submitJson, zodFieldErrors, type FieldErrors } from "@/lib/form-errors";
import Grid from "@mui/material/Grid2";
import { DataGrid, type GridColDef } from "@mui/x-data-grid";
import AddIcon from "@mui/icons-material/Add";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";

interface Origin {
  id: string;
  name: string;
  hubsoftOriginId?: number | null;
  active: boolean;
  _count: { clients: number };
}

const EMPTY_FORM = { name: "", hubsoftOriginId: "", active: true };

export default function OrigensPage() {
  const [origins, setOrigins] = React.useState<Origin[]>([]);
  const [open, setOpen] = React.useState(false);
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = React.useState<Origin | null>(null);
  const [form, setForm] = React.useState(EMPTY_FORM);
  const [fieldErrors, setFieldErrors] = React.useState<FieldErrors>({});
  const [formError, setFormError] = React.useState<string | null>(null);
  const [deleteError, setDeleteError] = React.useState<string | null>(null);

  const load = React.useCallback(() => {
    fetch("/api/origens").then((r) => r.json()).then(setOrigins);
  }, []);

  React.useEffect(() => load(), [load]);

  function resetErrors() {
    setFieldErrors({});
    setFormError(null);
  }

  function openCreate() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    resetErrors();
    setOpen(true);
  }

  function openEdit(origin: Origin) {
    setEditingId(origin.id);
    setForm({
      name: origin.name,
      hubsoftOriginId: origin.hubsoftOriginId ? String(origin.hubsoftOriginId) : "",
      active: origin.active,
    });
    resetErrors();
    setOpen(true);
  }

  async function handleSave() {
    resetErrors();

    const payload = {
      name: form.name.trim(),
      hubsoftOriginId: form.hubsoftOriginId ? Number(form.hubsoftOriginId) : null,
      active: form.active,
    };
    const parsed = OriginFormSchema.safeParse(payload);
    if (!parsed.success) {
      setFieldErrors(zodFieldErrors(parsed.error));
      return;
    }

    const url = editingId ? `/api/origens/${editingId}` : "/api/origens";
    const result = await submitJson(url, {
      method: editingId ? "PATCH" : "POST",
      body: parsed.data,
    });
    if (!result.ok) {
      setFieldErrors(result.fieldErrors);
      setFormError(result.formError ?? "Não foi possível salvar a origem.");
      return;
    }

    setOpen(false);
    load();
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleteError(null);
    const result = await submitJson(`/api/origens/${deleteTarget.id}`, { method: "DELETE" });
    if (!result.ok) {
      setDeleteError(result.formError ?? "Não foi possível excluir a origem.");
      return;
    }
    setDeleteTarget(null);
    load();
  }

  const columns: GridColDef<Origin>[] = [
    { field: "name", headerName: "Nome", flex: 1 },
    {
      field: "hubsoftOriginId",
      headerName: "ID Hubsoft",
      flex: 0.8,
      valueGetter: (_v, row) => row.hubsoftOriginId ?? "-",
    },
    { field: "leads", headerName: "Leads", flex: 0.8, valueGetter: (_v, row) => row._count.clients },
    { field: "active", headerName: "Ativo", flex: 0.6, valueGetter: (_v, row) => (row.active ? "Sim" : "Não") },
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
          <IconButton
            size="small"
            onClick={() => {
              setDeleteError(null);
              setDeleteTarget(params.row);
            }}
          >
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

      <Box sx={{ height: { xs: "calc(100vh - 180px)", md: 500 }, bgcolor: "background.paper" }}>
        <DataGrid rows={origins} columns={columns} disableRowSelectionOnClick />
      </Box>

      <Dialog open={open} onClose={() => setOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{editingId ? "Editar origem" : "Nova origem"}</DialogTitle>
        <DialogContent>
          {formError && (
            <Alert severity="error" sx={{ mt: 1 }}>
              {formError}
            </Alert>
          )}
          <TextField
            label="Nome"
            fullWidth
            required
            margin="normal"
            value={form.name}
            error={!!fieldErrors.name}
            helperText={fieldErrors.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
          <TextField
            label="ID da Origem no Hubsoft (id_origem_cliente)"
            type="number"
            fullWidth
            margin="normal"
            value={form.hubsoftOriginId}
            error={!!fieldErrors.hubsoftOriginId}
            helperText={fieldErrors.hubsoftOriginId ?? "Código da origem no Hubsoft (ex: 55)"}
            onChange={(e) => setForm({ ...form, hubsoftOriginId: e.target.value })}
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

      <Dialog open={!!deleteTarget} onClose={() => setDeleteTarget(null)} maxWidth="xs" fullWidth>
        <DialogTitle>Excluir origem?</DialogTitle>
        <DialogContent>
          {deleteError && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {deleteError}
            </Alert>
          )}
          <DialogContentText>
            Isso vai apagar {deleteTarget?.name}. Leads vinculados a essa origem podem impedir a exclusão. Não dá pra
            desfazer.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteTarget(null)}>Cancelar</Button>
          <Button color="error" variant="contained" onClick={handleDelete}>
            Excluir
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

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
  MenuItem,
  Select,
  Chip,
  InputLabel,
  FormControl,
  Snackbar,
  type SelectChangeEvent,
} from "@mui/material";
import { AreaFormSchema } from "@/lib/crud-schemas";
import { MultilineTextField } from "@/lib/multiline-text-field";
import { submitJson, zodFieldErrors, type FieldErrors } from "@/lib/form-errors";
import { DataGrid, type GridColDef } from "@mui/x-data-grid";
import AddIcon from "@mui/icons-material/Add";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";

interface Plan {
  id: string;
  name: string;
}

interface Area {
  id: string;
  name: string;
  observation: string | null;
  active: boolean;
  plans: { plan: Plan }[];
}

const EMPTY_FORM = { name: "", observation: "", active: true, planIds: [] as string[] };

export default function AreasPage() {
  const [areas, setAreas] = React.useState<Area[]>([]);
  const [plans, setPlans] = React.useState<Plan[]>([]);
  const [open, setOpen] = React.useState(false);
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = React.useState<Area | null>(null);
  const [form, setForm] = React.useState(EMPTY_FORM);
  const [fieldErrors, setFieldErrors] = React.useState<FieldErrors>({});
  const [formError, setFormError] = React.useState<string | null>(null);
  const [deleteError, setDeleteError] = React.useState<string | null>(null);
  const [snackbar, setSnackbar] = React.useState({ open: false, message: "" });

  const load = React.useCallback(() => {
    fetch("/api/areas").then((r) => r.json()).then(setAreas);
    fetch("/api/planos").then((r) => r.json()).then(setPlans);
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

  function openEdit(area: Area) {
    setEditingId(area.id);
    setForm({
      name: area.name,
      observation: area.observation ?? "",
      active: area.active,
      planIds: area.plans.map((p) => p.plan.id),
    });
    resetErrors();
    setOpen(true);
  }

  async function handleSave() {
    resetErrors();

    const payload = {
      name: form.name.trim(),
      observation: form.observation,
      active: form.active,
      planIds: form.planIds,
    };
    const parsed = AreaFormSchema.safeParse(payload);
    if (!parsed.success) {
      setFieldErrors(zodFieldErrors(parsed.error));
      return;
    }

    const body = {
      ...parsed.data,
      observation: parsed.data.observation || null,
    };
    const url = editingId ? `/api/areas/${editingId}` : "/api/areas";
    const result = await submitJson(url, {
      method: editingId ? "PATCH" : "POST",
      body,
    });
    if (!result.ok) {
      setFieldErrors(result.fieldErrors);
      setFormError(result.formError ?? "Não foi possível salvar a área.");
      return;
    }

    setOpen(false);
    load();
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleteError(null);
    const result = await submitJson(`/api/areas/${deleteTarget.id}`, { method: "DELETE" });
    if (!result.ok) {
      setDeleteError(result.formError ?? "Não foi possível excluir a área.");
      return;
    }
    setDeleteTarget(null);
    load();
  }

  function uniqueCopyName(base: string) {
    const existing = new Set(areas.map((a) => a.name));
    let candidate = `${base} (cópia)`;
    let n = 2;
    while (existing.has(candidate)) {
      candidate = `${base} (cópia ${n})`;
      n++;
    }
    return candidate;
  }

  async function handleDuplicate(area: Area) {
    const result = await submitJson("/api/areas", {
      method: "POST",
      body: {
        name: uniqueCopyName(area.name),
        observation: area.observation,
        active: area.active,
        planIds: area.plans.map((p) => p.plan.id),
      },
    });
    if (!result.ok) {
      setSnackbar({ open: true, message: result.formError ?? "Não foi possível duplicar a área." });
      return;
    }
    setSnackbar({ open: true, message: "Área duplicada." });
    load();
  }

  function handlePlanIdsChange(e: SelectChangeEvent<string[]>) {
    const value = e.target.value;
    setForm({ ...form, planIds: typeof value === "string" ? value.split(",") : value });
  }

  const columns: GridColDef<Area>[] = [
    { field: "name", headerName: "Área / local", flex: 1.5 },
    {
      field: "observation",
      headerName: "Observação",
      flex: 1.5,
      valueGetter: (_v, row) => row.observation ?? "-",
    },
    {
      field: "plans",
      headerName: "Planos",
      flex: 2,
      valueGetter: (_v, row) => row.plans.map((p) => p.plan.name).join(", ") || "-",
    },
    { field: "active", headerName: "Ativo", flex: 0.6, valueGetter: (_v, row) => (row.active ? "Sim" : "Não") },
    {
      field: "actions",
      headerName: "",
      sortable: false,
      width: 140,
      renderCell: (params) => (
        <>
          <IconButton size="small" onClick={() => openEdit(params.row)} title="Editar">
            <EditIcon fontSize="small" />
          </IconButton>
          <IconButton size="small" onClick={() => handleDuplicate(params.row)} title="Duplicar">
            <ContentCopyIcon fontSize="small" />
          </IconButton>
          <IconButton
            size="small"
            onClick={() => {
              setDeleteError(null);
              setDeleteTarget(params.row);
            }}
            title="Excluir"
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
        <Typography variant="h4">Áreas</Typography>
        <Button startIcon={<AddIcon />} variant="contained" onClick={openCreate}>
          Nova área
        </Button>
      </Box>
      <Box sx={{ height: { xs: "calc(100vh - 180px)", md: 600 }, bgcolor: "background.paper" }}>
        <DataGrid rows={areas} columns={columns} disableRowSelectionOnClick />
      </Box>

      <Dialog open={open} onClose={() => setOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{editingId ? "Editar área" : "Nova área"}</DialogTitle>
        <DialogContent>
          {formError && (
            <Alert severity="error" sx={{ mt: 1 }}>
              {formError}
            </Alert>
          )}
          <TextField
            label="Nome (setor, distrito, bairro…)"
            fullWidth
            required
            margin="normal"
            value={form.name}
            error={!!fieldErrors.name}
            helperText={fieldErrors.name ?? "Ex.: Palmeiras e Piraputanga, Setor Industrial, Distrito Centro"}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
          <MultilineTextField
            label="Observação"
            fullWidth
            minRows={3}
            margin="normal"
            value={form.observation}
            onChange={(e) => setForm({ ...form, observation: e.target.value })}
            helperText="Ex.: Taxa de instalação: ISENTO"
          />
          <FormControl fullWidth margin="normal">
            <InputLabel>Planos da área</InputLabel>
            <Select
              multiple
              value={form.planIds}
              onChange={handlePlanIdsChange}
              label="Planos da área"
              renderValue={(selected) => (
                <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5 }}>
                  {selected.map((id) => (
                    <Chip key={id} label={plans.find((p) => p.id === id)?.name ?? id} size="small" />
                  ))}
                </Box>
              )}
            >
              {plans.map((plan) => (
                <MenuItem key={plan.id} value={plan.id}>
                  {plan.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
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
        <DialogTitle>Excluir área?</DialogTitle>
        <DialogContent>
          {deleteError && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {deleteError}
            </Alert>
          )}
          <DialogContentText>
            Isso vai apagar {deleteTarget?.name} e desvincular os planos associados. Leads vinculados a essa área
            podem impedir a exclusão. Não dá pra desfazer.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteTarget(null)}>Cancelar</Button>
          <Button color="error" variant="contained" onClick={handleDelete}>
            Excluir
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
        message={snackbar.message}
      />
    </Box>
  );
}

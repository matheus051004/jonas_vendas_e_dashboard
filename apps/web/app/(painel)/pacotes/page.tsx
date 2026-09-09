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
import { PackageFormSchema } from "@/lib/crud-schemas";
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

interface Package {
  id: string;
  name: string;
  price: string | number;
  description: string;
  hubsoftPackageId?: number | null;
  active: boolean;
  plans: { plan: Plan }[];
}

const EMPTY_FORM = {
  name: "",
  price: "",
  description: "",
  hubsoftPackageId: "",
  active: true,
  planIds: [] as string[],
};

export default function PacotesPage() {
  const [packages, setPackages] = React.useState<Package[]>([]);
  const [plans, setPlans] = React.useState<Plan[]>([]);
  const [open, setOpen] = React.useState(false);
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = React.useState<Package | null>(null);
  const [form, setForm] = React.useState(EMPTY_FORM);
  const [fieldErrors, setFieldErrors] = React.useState<FieldErrors>({});
  const [formError, setFormError] = React.useState<string | null>(null);
  const [deleteError, setDeleteError] = React.useState<string | null>(null);
  const [snackbar, setSnackbar] = React.useState({ open: false, message: "" });

  const load = React.useCallback(() => {
    fetch("/api/pacotes").then((r) => r.json()).then(setPackages);
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

  function openEdit(pkg: Package) {
    setEditingId(pkg.id);
    setForm({
      name: pkg.name,
      price: String(pkg.price),
      description: pkg.description,
      hubsoftPackageId: pkg.hubsoftPackageId ? String(pkg.hubsoftPackageId) : "",
      active: pkg.active,
      planIds: pkg.plans.map((p) => p.plan.id),
    });
    resetErrors();
    setOpen(true);
  }

  async function handleSave() {
    resetErrors();

    const payload = {
      name: form.name.trim(),
      price: form.price,
      description: form.description.trim(),
      hubsoftPackageId: form.hubsoftPackageId ? Number(form.hubsoftPackageId) : null,
      active: form.active,
      planIds: form.planIds,
    };
    const parsed = PackageFormSchema.safeParse(payload);
    if (!parsed.success) {
      setFieldErrors(zodFieldErrors(parsed.error));
      return;
    }

    const url = editingId ? `/api/pacotes/${editingId}` : "/api/pacotes";
    const result = await submitJson(url, {
      method: editingId ? "PATCH" : "POST",
      body: parsed.data,
    });
    if (!result.ok) {
      setFieldErrors(result.fieldErrors);
      setFormError(result.formError ?? "Não foi possível salvar o pacote.");
      return;
    }

    setOpen(false);
    load();
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleteError(null);
    const result = await submitJson(`/api/pacotes/${deleteTarget.id}`, { method: "DELETE" });
    if (!result.ok) {
      setDeleteError(result.formError ?? "Não foi possível excluir o pacote.");
      return;
    }
    setDeleteTarget(null);
    load();
  }

  async function handleDuplicate(pkg: Package) {
    const result = await submitJson("/api/pacotes", {
      method: "POST",
      body: {
        name: `${pkg.name} (cópia)`,
        price: Number(pkg.price),
        description: pkg.description,
        hubsoftPackageId: pkg.hubsoftPackageId ?? null,
        active: pkg.active,
        planIds: pkg.plans.map((p) => p.plan.id),
      },
    });
    if (!result.ok) {
      setSnackbar({ open: true, message: result.formError ?? "Não foi possível duplicar o pacote." });
      return;
    }
    setSnackbar({ open: true, message: "Pacote duplicado." });
    load();
  }

  function handlePlanIdsChange(e: SelectChangeEvent<string[]>) {
    const value = e.target.value;
    setForm({ ...form, planIds: typeof value === "string" ? value.split(",") : value });
  }

  const columns: GridColDef<Package>[] = [
    { field: "name", headerName: "Nome", flex: 1 },
    { field: "price", headerName: "Valor (R$)", flex: 0.8 },
    {
      field: "hubsoftPackageId",
      headerName: "ID Hubsoft",
      flex: 0.8,
      valueGetter: (_v, row) => row.hubsoftPackageId ?? "-",
    },
    {
      field: "plans",
      headerName: "Planos vinculados",
      flex: 1.5,
      valueGetter: (_v, row) => row.plans.map((p) => p.plan.name).join(", ") || "-",
    },
    { field: "description", headerName: "Descrição", flex: 1.5 },
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
        <Typography variant="h4">Pacotes Adicionais</Typography>
        <Button startIcon={<AddIcon />} variant="contained" onClick={openCreate}>
          Novo pacote
        </Button>
      </Box>
      <Box sx={{ height: { xs: "calc(100vh - 180px)", md: 600 }, bgcolor: "background.paper" }}>
        <DataGrid rows={packages} columns={columns} disableRowSelectionOnClick />
      </Box>

      <Dialog open={open} onClose={() => setOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{editingId ? "Editar pacote" : "Novo pacote"}</DialogTitle>
        <DialogContent>
          {formError && (
            <Alert severity="error" sx={{ mt: 1 }}>
              {formError}
            </Alert>
          )}
          <TextField
            label="Nome do Pacote"
            fullWidth
            required
            margin="normal"
            value={form.name}
            error={!!fieldErrors.name}
            helperText={fieldErrors.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
          <TextField
            label="ID do Pacote no Hubsoft (id_pacote)"
            type="number"
            fullWidth
            margin="normal"
            value={form.hubsoftPackageId}
            error={!!fieldErrors.hubsoftPackageId}
            helperText={fieldErrors.hubsoftPackageId ?? "Código do pacote no Hubsoft enviado em ids_pacotes (ex: 12)"}
            onChange={(e) => setForm({ ...form, hubsoftPackageId: e.target.value })}
          />
          <TextField
            label="Valor Adicional (R$)"
            type="number"
            fullWidth
            required
            margin="normal"
            value={form.price}
            error={!!fieldErrors.price}
            helperText={fieldErrors.price}
            onChange={(e) => setForm({ ...form, price: e.target.value })}
          />
          <MultilineTextField
            label="Descrição"
            fullWidth
            required
            minRows={3}
            margin="normal"
            value={form.description}
            error={!!fieldErrors.description}
            helperText={fieldErrors.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
          />
          <FormControl fullWidth margin="normal">
            <InputLabel>Planos que aceitam este pacote</InputLabel>
            <Select
              multiple
              value={form.planIds}
              onChange={handlePlanIdsChange}
              label="Planos que aceitam este pacote"
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
        <DialogTitle>Excluir pacote?</DialogTitle>
        <DialogContent>
          {deleteError && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {deleteError}
            </Alert>
          )}
          <DialogContentText>
            Isso vai apagar {deleteTarget?.name} e desvincular dos planos e contratos associados. Não dá pra desfazer.
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

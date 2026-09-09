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
import { PromotionFormSchema } from "@/lib/crud-schemas";
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

interface Promotion {
  id: string;
  name: string;
  description?: string | null;
  hubsoftPromotionId?: number | null;
  active: boolean;
  plans: { plan: Plan }[];
}

const EMPTY_FORM = {
  name: "",
  description: "",
  hubsoftPromotionId: "",
  active: true,
  planIds: [] as string[],
};

export default function PromocoesPage() {
  const [promotions, setPromotions] = React.useState<Promotion[]>([]);
  const [plans, setPlans] = React.useState<Plan[]>([]);
  const [open, setOpen] = React.useState(false);
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = React.useState<Promotion | null>(null);
  const [form, setForm] = React.useState(EMPTY_FORM);
  const [fieldErrors, setFieldErrors] = React.useState<FieldErrors>({});
  const [formError, setFormError] = React.useState<string | null>(null);
  const [deleteError, setDeleteError] = React.useState<string | null>(null);
  const [snackbar, setSnackbar] = React.useState({ open: false, message: "" });

  const load = React.useCallback(() => {
    fetch("/api/promocoes").then((r) => r.json()).then(setPromotions);
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

  function openEdit(promo: Promotion) {
    setEditingId(promo.id);
    setForm({
      name: promo.name,
      description: promo.description || "",
      hubsoftPromotionId: promo.hubsoftPromotionId ? String(promo.hubsoftPromotionId) : "",
      active: promo.active,
      planIds: promo.plans.map((p) => p.plan.id),
    });
    resetErrors();
    setOpen(true);
  }

  async function handleSave() {
    resetErrors();

    const payload = {
      name: form.name.trim(),
      description: form.description.trim(),
      hubsoftPromotionId: form.hubsoftPromotionId ? Number(form.hubsoftPromotionId) : null,
      active: form.active,
      planIds: form.planIds,
    };
    const parsed = PromotionFormSchema.safeParse(payload);
    if (!parsed.success) {
      setFieldErrors(zodFieldErrors(parsed.error));
      return;
    }

    const url = editingId ? `/api/promocoes/${editingId}` : "/api/promocoes";
    const result = await submitJson(url, {
      method: editingId ? "PATCH" : "POST",
      body: parsed.data,
    });
    if (!result.ok) {
      setFieldErrors(result.fieldErrors);
      setFormError(result.formError ?? "Não foi possível salvar a promoção.");
      return;
    }

    setOpen(false);
    load();
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleteError(null);
    const result = await submitJson(`/api/promocoes/${deleteTarget.id}`, { method: "DELETE" });
    if (!result.ok) {
      setDeleteError(result.formError ?? "Não foi possível excluir a promoção.");
      return;
    }
    setDeleteTarget(null);
    load();
  }

  async function handleDuplicate(promo: Promotion) {
    const result = await submitJson("/api/promocoes", {
      method: "POST",
      body: {
        name: `${promo.name} (cópia)`,
        description: promo.description || "",
        hubsoftPromotionId: promo.hubsoftPromotionId ?? null,
        active: promo.active,
        planIds: promo.plans.map((p) => p.plan.id),
      },
    });
    if (!result.ok) {
      setSnackbar({ open: true, message: result.formError ?? "Não foi possível duplicar a promoção." });
      return;
    }
    setSnackbar({ open: true, message: "Promoção duplicada." });
    load();
  }

  function handlePlanIdsChange(e: SelectChangeEvent<string[]>) {
    const value = e.target.value;
    setForm({ ...form, planIds: typeof value === "string" ? value.split(",") : value });
  }

  const columns: GridColDef<Promotion>[] = [
    { field: "name", headerName: "Nome da Promoção", flex: 1.2 },
    {
      field: "hubsoftPromotionId",
      headerName: "ID Hubsoft (ids_promocoes)",
      flex: 1,
      valueGetter: (_v, row) => row.hubsoftPromotionId ?? "-",
    },
    {
      field: "plans",
      headerName: "Planos vinculados",
      flex: 1.5,
      valueGetter: (_v, row) => row.plans.map((p) => p.plan.name).join(", ") || "-",
    },
    {
      field: "description",
      headerName: "Descrição",
      flex: 1.5,
      valueGetter: (_v, row) => row.description || "-",
    },
    {
      field: "active",
      headerName: "Ativo",
      flex: 0.6,
      valueGetter: (_v, row) => (row.active ? "Sim" : "Não"),
    },
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
        <Typography variant="h4">Promoções e Descontos</Typography>
        <Button startIcon={<AddIcon />} variant="contained" onClick={openCreate}>
          Nova promoção
        </Button>
      </Box>
      <Box sx={{ height: { xs: "calc(100vh - 180px)", md: 600 }, bgcolor: "background.paper" }}>
        <DataGrid rows={promotions} columns={columns} disableRowSelectionOnClick />
      </Box>

      <Dialog open={open} onClose={() => setOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{editingId ? "Editar promoção" : "Nova promoção"}</DialogTitle>
        <DialogContent>
          {formError && (
            <Alert severity="error" sx={{ mt: 1 }}>
              {formError}
            </Alert>
          )}
          <TextField
            label="Nome da Promoção / Desconto"
            fullWidth
            required
            margin="normal"
            value={form.name}
            error={!!fieldErrors.name}
            helperText={fieldErrors.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
          <TextField
            label="ID da Promoção no Hubsoft (enviado em ids_promocoes)"
            type="number"
            fullWidth
            margin="normal"
            value={form.hubsoftPromotionId}
            error={!!fieldErrors.hubsoftPromotionId}
            helperText={
              fieldErrors.hubsoftPromotionId ||
              "ID numérico da promoção ou desconto cadastrado no Hubsoft"
            }
            onChange={(e) => setForm({ ...form, hubsoftPromotionId: e.target.value })}
          />

          <FormControl fullWidth margin="normal">
            <InputLabel id="promocoes-plan-select-label">Planos vinculados</InputLabel>
            <Select
              labelId="promocoes-plan-select-label"
              multiple
              value={form.planIds}
              onChange={handlePlanIdsChange}
              renderValue={(selected) => (
                <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5 }}>
                  {selected.map((id) => {
                    const plan = plans.find((p) => p.id === id);
                    return <Chip key={id} label={plan?.name || id} size="small" />;
                  })}
                </Box>
              )}
            >
              {plans.map((p) => (
                <MenuItem key={p.id} value={p.id}>
                  {p.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <MultilineTextField
            label="Descrição / Detalhes do desconto"
            fullWidth
            margin="normal"
            value={form.description}
            error={!!fieldErrors.description}
            helperText={fieldErrors.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
          />

          <FormControlLabel
            control={
              <Switch
                checked={form.active}
                onChange={(e) => setForm({ ...form, active: e.target.checked })}
              />
            }
            label="Ativo"
            sx={{ mt: 1 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)}>Cancelar</Button>
          <Button variant="contained" onClick={handleSave}>
            Salvar
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={!!deleteTarget} onClose={() => setDeleteTarget(null)}>
        <DialogTitle>Excluir promoção</DialogTitle>
        <DialogContent>
          {deleteError && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {deleteError}
            </Alert>
          )}
          <DialogContentText>
            Tem certeza de que deseja excluir a promoção &ldquo;{deleteTarget?.name}&rdquo;?
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
        autoHideDuration={3000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
        message={snackbar.message}
      />
    </Box>
  );
}

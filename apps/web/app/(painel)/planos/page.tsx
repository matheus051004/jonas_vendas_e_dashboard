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
import { PlanFormSchema } from "@/lib/crud-schemas";
import { MultilineTextField } from "@/lib/multiline-text-field";
import { submitJson, zodFieldErrors, type FieldErrors } from "@/lib/form-errors";
import { DataGrid, type GridColDef } from "@mui/x-data-grid";
import AddIcon from "@mui/icons-material/Add";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";

interface Area {
  id: string;
  name: string;
}

interface PackageOption {
  id: string;
  name: string;
  price: string | number;
}

interface PromotionOption {
  id: string;
  name: string;
  hubsoftPromotionId?: number | null;
}

interface Plan {
  id: string;
  name: string;
  price: string;
  priceWithLoyalty?: string | number | null;
  loyaltyMonths: number;
  description: string;
  hubsoftServiceId?: number | null;
  active: boolean;
  areas: { area: Area }[];
  packages: { package: PackageOption }[];
  promotions?: { promotion: PromotionOption }[];
}

const EMPTY_FORM = {
  name: "",
  price: "",
  priceWithLoyalty: "",
  loyaltyMonths: "",
  description: "",
  hubsoftServiceId: "",
  active: true,
  areaIds: [] as string[],
  packageIds: [] as string[],
  promotionIds: [] as string[],
};

export default function PlanosPage() {
  const [plans, setPlans] = React.useState<Plan[]>([]);
  const [areas, setAreas] = React.useState<Area[]>([]);
  const [availablePackages, setAvailablePackages] = React.useState<PackageOption[]>([]);
  const [availablePromotions, setAvailablePromotions] = React.useState<PromotionOption[]>([]);
  const [open, setOpen] = React.useState(false);
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = React.useState<Plan | null>(null);
  const [form, setForm] = React.useState(EMPTY_FORM);
  const [fieldErrors, setFieldErrors] = React.useState<FieldErrors>({});
  const [formError, setFormError] = React.useState<string | null>(null);
  const [deleteError, setDeleteError] = React.useState<string | null>(null);
  const [snackbar, setSnackbar] = React.useState({ open: false, message: "" });

  const load = React.useCallback(() => {
    fetch("/api/planos").then((r) => r.json()).then(setPlans);
    fetch("/api/areas").then((r) => r.json()).then(setAreas);
    fetch("/api/pacotes").then((r) => r.json()).then(setAvailablePackages);
    fetch("/api/promocoes").then((r) => r.json()).then(setAvailablePromotions);
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

  function openEdit(plan: Plan) {
    setEditingId(plan.id);
    setForm({
      name: plan.name,
      price: String(plan.price),
      priceWithLoyalty: plan.priceWithLoyalty != null ? String(plan.priceWithLoyalty) : "",
      loyaltyMonths: String(plan.loyaltyMonths),
      description: plan.description,
      hubsoftServiceId: plan.hubsoftServiceId ? String(plan.hubsoftServiceId) : "",
      active: plan.active,
      areaIds: plan.areas.map((a) => a.area.id),
      packageIds: plan.packages ? plan.packages.map((p) => p.package.id) : [],
      promotionIds: plan.promotions ? plan.promotions.map((p) => p.promotion.id) : [],
    });
    resetErrors();
    setOpen(true);
  }

  async function handleSave() {
    resetErrors();

    const payload = {
      name: form.name.trim(),
      price: form.price,
      priceWithLoyalty: form.priceWithLoyalty ? form.priceWithLoyalty : null,
      loyaltyMonths: form.loyaltyMonths,
      description: form.description.trim(),
      hubsoftServiceId: form.hubsoftServiceId ? Number(form.hubsoftServiceId) : null,
      active: form.active,
      areaIds: form.areaIds,
      packageIds: form.packageIds,
      promotionIds: form.promotionIds,
    };
    const parsed = PlanFormSchema.safeParse(payload);
    if (!parsed.success) {
      setFieldErrors(zodFieldErrors(parsed.error));
      return;
    }

    const url = editingId ? `/api/planos/${editingId}` : "/api/planos";
    const result = await submitJson(url, {
      method: editingId ? "PATCH" : "POST",
      body: parsed.data,
    });
    if (!result.ok) {
      setFieldErrors(result.fieldErrors);
      setFormError(result.formError ?? "Não foi possível salvar o plano.");
      return;
    }

    setOpen(false);
    load();
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleteError(null);
    const result = await submitJson(`/api/planos/${deleteTarget.id}`, { method: "DELETE" });
    if (!result.ok) {
      setDeleteError(result.formError ?? "Não foi possível excluir o plano.");
      return;
    }
    setDeleteTarget(null);
    load();
  }

  async function handleDuplicate(plan: Plan) {
    const result = await submitJson("/api/planos", {
      method: "POST",
      body: {
        name: `${plan.name} (cópia)`,
        price: Number(plan.price),
        priceWithLoyalty: plan.priceWithLoyalty != null ? Number(plan.priceWithLoyalty) : null,
        loyaltyMonths: plan.loyaltyMonths,
        description: plan.description,
        hubsoftServiceId: plan.hubsoftServiceId ?? null,
        active: plan.active,
        areaIds: plan.areas.map((a) => a.area.id),
        packageIds: plan.packages ? plan.packages.map((p) => p.package.id) : [],
        promotionIds: plan.promotions ? plan.promotions.map((p) => p.promotion.id) : [],
      },
    });
    if (!result.ok) {
      setSnackbar({ open: true, message: result.formError ?? "Não foi possível duplicar o plano." });
      return;
    }
    setSnackbar({ open: true, message: "Plano duplicado." });
    load();
  }

  function handleAreaIdsChange(e: SelectChangeEvent<string[]>) {
    const value = e.target.value;
    setForm({ ...form, areaIds: typeof value === "string" ? value.split(",") : value });
  }

  function handlePackageIdsChange(e: SelectChangeEvent<string[]>) {
    const value = e.target.value;
    setForm({ ...form, packageIds: typeof value === "string" ? value.split(",") : value });
  }

  function handlePromotionIdsChange(e: SelectChangeEvent<string[]>) {
    const value = e.target.value;
    setForm({ ...form, promotionIds: typeof value === "string" ? value.split(",") : value });
  }

  const columns: GridColDef<Plan>[] = [
    { field: "name", headerName: "Nome", flex: 1 },
    { field: "price", headerName: "Sem Fidelidade (R$)", flex: 0.9 },
    {
      field: "priceWithLoyalty",
      headerName: "Com Fidelidade (R$)",
      flex: 0.9,
      valueGetter: (_v, row) => (row.priceWithLoyalty ? row.priceWithLoyalty : "-"),
    },
    { field: "loyaltyMonths", headerName: "Fidelidade (meses)", flex: 0.8 },
    {
      field: "hubsoftServiceId",
      headerName: "ID Hubsoft",
      flex: 0.8,
      valueGetter: (_v, row) => row.hubsoftServiceId ?? "-",
    },
    {
      field: "areas",
      headerName: "Áreas",
      flex: 1.2,
      valueGetter: (_v, row) => row.areas.map((a) => a.area.name).join(", ") || "-",
    },
    {
      field: "packages",
      headerName: "Pacotes",
      flex: 1.2,
      valueGetter: (_v, row) => row.packages?.map((p) => p.package.name).join(", ") || "-",
    },
    {
      field: "promotions",
      headerName: "Promoções",
      flex: 1.2,
      valueGetter: (_v, row) => row.promotions?.map((p) => p.promotion.name).join(", ") || "-",
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
        <Typography variant="h4">Planos</Typography>
        <Button startIcon={<AddIcon />} variant="contained" onClick={openCreate}>
          Novo plano
        </Button>
      </Box>
      <Box sx={{ height: { xs: "calc(100vh - 180px)", md: 600 }, bgcolor: "background.paper" }}>
        <DataGrid rows={plans} columns={columns} disableRowSelectionOnClick />
      </Box>

      <Dialog open={open} onClose={() => setOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{editingId ? "Editar plano" : "Novo plano"}</DialogTitle>
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
            label="ID do Serviço no Hubsoft (id_servico)"
            type="number"
            fullWidth
            margin="normal"
            value={form.hubsoftServiceId}
            error={!!fieldErrors.hubsoftServiceId}
            helperText={fieldErrors.hubsoftServiceId ?? "Código do plano/serviço no Hubsoft (ex: 947)"}
            onChange={(e) => setForm({ ...form, hubsoftServiceId: e.target.value })}
          />
          <TextField
            label="Valor sem fidelidade (R$)"
            type="number"
            fullWidth
            required
            margin="normal"
            value={form.price}
            error={!!fieldErrors.price}
            helperText={fieldErrors.price ?? "Valor padrão mensal sem fidelidade (enviado ao Hubsoft)"}
            onChange={(e) => setForm({ ...form, price: e.target.value })}
          />
          <TextField
            label="Valor com fidelidade (R$)"
            type="number"
            fullWidth
            margin="normal"
            value={form.priceWithLoyalty}
            error={!!fieldErrors.priceWithLoyalty}
            helperText={fieldErrors.priceWithLoyalty ?? "Valor promocional mensal com fidelidade (opcional)"}
            onChange={(e) => setForm({ ...form, priceWithLoyalty: e.target.value })}
          />
          <TextField
            label="Fidelidade (meses)"
            type="number"
            fullWidth
            required
            margin="normal"
            value={form.loyaltyMonths}
            error={!!fieldErrors.loyaltyMonths}
            helperText={fieldErrors.loyaltyMonths}
            onChange={(e) => setForm({ ...form, loyaltyMonths: e.target.value })}
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
            <InputLabel>Áreas do plano</InputLabel>
            <Select
              multiple
              value={form.areaIds}
              onChange={handleAreaIdsChange}
              label="Áreas do plano"
              renderValue={(selected) => (
                <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5 }}>
                  {selected.map((id) => (
                    <Chip key={id} label={areas.find((a) => a.id === id)?.name ?? id} size="small" />
                  ))}
                </Box>
              )}
            >
              {areas.map((area) => (
                <MenuItem key={area.id} value={area.id}>
                  {area.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <FormControl fullWidth margin="normal">
            <InputLabel>Pacotes aceitos no plano</InputLabel>
            <Select
              multiple
              value={form.packageIds}
              onChange={handlePackageIdsChange}
              label="Pacotes aceitos no plano"
              renderValue={(selected) => (
                <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5 }}>
                  {selected.map((id) => (
                    <Chip key={id} label={availablePackages.find((p) => p.id === id)?.name ?? id} size="small" />
                  ))}
                </Box>
              )}
            >
              {availablePackages.map((pkg) => (
                <MenuItem key={pkg.id} value={pkg.id}>
                  {pkg.name} ({Number(pkg.price).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })})
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <FormControl fullWidth margin="normal">
            <InputLabel>Promoções vinculadas (enviadas no fechamento)</InputLabel>
            <Select
              multiple
              value={form.promotionIds}
              onChange={handlePromotionIdsChange}
              label="Promoções vinculadas (enviadas no fechamento)"
              renderValue={(selected) => (
                <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5 }}>
                  {selected.map((id) => (
                    <Chip key={id} label={availablePromotions.find((p) => p.id === id)?.name ?? id} size="small" />
                  ))}
                </Box>
              )}
            >
              {availablePromotions.map((promo) => (
                <MenuItem key={promo.id} value={promo.id}>
                  {promo.name} {promo.hubsoftPromotionId ? `(ID: ${promo.hubsoftPromotionId})` : ""}
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
        <DialogTitle>Excluir plano?</DialogTitle>
        <DialogContent>
          {deleteError && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {deleteError}
            </Alert>
          )}
          <DialogContentText>
            Isso vai apagar {deleteTarget?.name} e desvincular das áreas associadas. Contratos vinculados a esse plano
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
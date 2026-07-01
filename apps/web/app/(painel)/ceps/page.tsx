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
  MenuItem,
  Select,
  Chip,
  InputLabel,
  FormControl,
  type SelectChangeEvent,
} from "@mui/material";
import { DataGrid, type GridColDef } from "@mui/x-data-grid";
import AddIcon from "@mui/icons-material/Add";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";

interface Plan {
  id: string;
  name: string;
}

interface Cep {
  id: string;
  code: string;
  city: string | null;
  active: boolean;
  plans: { plan: Plan }[];
}

const EMPTY_FORM = { code: "", city: "", active: true, planIds: [] as string[] };

export default function CepsPage() {
  const [ceps, setCeps] = React.useState<Cep[]>([]);
  const [plans, setPlans] = React.useState<Plan[]>([]);
  const [open, setOpen] = React.useState(false);
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [form, setForm] = React.useState(EMPTY_FORM);

  const load = React.useCallback(() => {
    fetch("/api/ceps").then((r) => r.json()).then(setCeps);
    fetch("/api/planos").then((r) => r.json()).then(setPlans);
  }, []);

  React.useEffect(() => load(), [load]);

  function openCreate() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setOpen(true);
  }

  function openEdit(cep: Cep) {
    setEditingId(cep.id);
    setForm({
      code: cep.code,
      city: cep.city ?? "",
      active: cep.active,
      planIds: cep.plans.map((p) => p.plan.id),
    });
    setOpen(true);
  }

  async function handleSave() {
    const url = editingId ? `/api/ceps/${editingId}` : "/api/ceps";
    await fetch(url, {
      method: editingId ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    setOpen(false);
    load();
  }

  async function handleDelete(id: string) {
    await fetch(`/api/ceps/${id}`, { method: "DELETE" });
    load();
  }

  function handlePlanIdsChange(e: SelectChangeEvent<string[]>) {
    const value = e.target.value;
    setForm({ ...form, planIds: typeof value === "string" ? value.split(",") : value });
  }

  const columns: GridColDef<Cep>[] = [
    { field: "code", headerName: "CEP", flex: 1 },
    { field: "city", headerName: "Cidade", flex: 1, valueGetter: (_v, row) => row.city ?? "-" },
    {
      field: "plans",
      headerName: "Planos compatíveis",
      flex: 2,
      valueGetter: (_v, row) => row.plans.map((p) => p.plan.name).join(", ") || "-",
    },
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
        <Typography variant="h4">CEPs</Typography>
        <Button startIcon={<AddIcon />} variant="contained" onClick={openCreate}>
          Novo CEP
        </Button>
      </Box>
      <Box sx={{ height: 600, bgcolor: "background.paper" }}>
        <DataGrid rows={ceps} columns={columns} disableRowSelectionOnClick />
      </Box>

      <Dialog open={open} onClose={() => setOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{editingId ? "Editar CEP" : "Novo CEP"}</DialogTitle>
        <DialogContent>
          <TextField
            label="CEP"
            fullWidth
            margin="normal"
            value={form.code}
            onChange={(e) => setForm({ ...form, code: e.target.value })}
          />
          <TextField
            label="Cidade"
            fullWidth
            margin="normal"
            value={form.city}
            onChange={(e) => setForm({ ...form, city: e.target.value })}
          />
          <FormControl fullWidth margin="normal">
            <InputLabel>Planos compatíveis</InputLabel>
            <Select
              multiple
              value={form.planIds}
              onChange={handlePlanIdsChange}
              label="Planos compatíveis"
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
    </Box>
  );
}

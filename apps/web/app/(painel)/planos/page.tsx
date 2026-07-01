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
} from "@mui/material";
import { DataGrid, type GridColDef } from "@mui/x-data-grid";
import AddIcon from "@mui/icons-material/Add";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";

interface Plan {
  id: string;
  name: string;
  price: string;
  loyaltyMonths: number;
  description: string;
  active: boolean;
}

const EMPTY_FORM = { name: "", price: "", loyaltyMonths: "", description: "", active: true };

export default function PlanosPage() {
  const [plans, setPlans] = React.useState<Plan[]>([]);
  const [open, setOpen] = React.useState(false);
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [form, setForm] = React.useState(EMPTY_FORM);

  const load = React.useCallback(() => {
    fetch("/api/planos").then((r) => r.json()).then(setPlans);
  }, []);

  React.useEffect(() => load(), [load]);

  function openCreate() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setOpen(true);
  }

  function openEdit(plan: Plan) {
    setEditingId(plan.id);
    setForm({
      name: plan.name,
      price: String(plan.price),
      loyaltyMonths: String(plan.loyaltyMonths),
      description: plan.description,
      active: plan.active,
    });
    setOpen(true);
  }

  async function handleSave() {
    const payload = {
      name: form.name,
      price: Number(form.price),
      loyaltyMonths: Number(form.loyaltyMonths),
      description: form.description,
      active: form.active,
    };
    const url = editingId ? `/api/planos/${editingId}` : "/api/planos";
    await fetch(url, {
      method: editingId ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    setOpen(false);
    load();
  }

  async function handleDelete(id: string) {
    await fetch(`/api/planos/${id}`, { method: "DELETE" });
    load();
  }

  const columns: GridColDef<Plan>[] = [
    { field: "name", headerName: "Nome", flex: 1 },
    { field: "price", headerName: "Valor (R$)", flex: 1 },
    { field: "loyaltyMonths", headerName: "Fidelidade (meses)", flex: 1 },
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
        <Typography variant="h4">Planos</Typography>
        <Button startIcon={<AddIcon />} variant="contained" onClick={openCreate}>
          Novo plano
        </Button>
      </Box>
      <Box sx={{ height: 600, bgcolor: "background.paper" }}>
        <DataGrid rows={plans} columns={columns} disableRowSelectionOnClick />
      </Box>

      <Dialog open={open} onClose={() => setOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{editingId ? "Editar plano" : "Novo plano"}</DialogTitle>
        <DialogContent>
          <TextField
            label="Nome"
            fullWidth
            margin="normal"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
          <TextField
            label="Valor (R$)"
            type="number"
            fullWidth
            margin="normal"
            value={form.price}
            onChange={(e) => setForm({ ...form, price: e.target.value })}
          />
          <TextField
            label="Fidelidade (meses)"
            type="number"
            fullWidth
            margin="normal"
            value={form.loyaltyMonths}
            onChange={(e) => setForm({ ...form, loyaltyMonths: e.target.value })}
          />
          <TextField
            label="Descrição"
            fullWidth
            multiline
            rows={3}
            margin="normal"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
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

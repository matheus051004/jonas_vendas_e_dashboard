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
  Chip,
  Tooltip,
  Paper,
  Stack,
  Snackbar,
} from "@mui/material";
import Grid from "@mui/material/Grid2";
import { DataGrid, type GridColDef } from "@mui/x-data-grid";
import AddIcon from "@mui/icons-material/Add";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import PaymentIcon from "@mui/icons-material/Payment";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import WifiIcon from "@mui/icons-material/Wifi";
import { PaymentMethodFormSchema } from "@/lib/crud-schemas";
import { submitJson, zodFieldErrors, type FieldErrors } from "@/lib/form-errors";

interface PaymentMethodItem {
  id: string;
  name: string;
  description?: string | null;
  hubsoftId: number;
  active: boolean;
  createdAt: string;
  updatedAt: string;
  _count?: {
    plans: number;
  };
}

const EMPTY_FORM = {
  name: "",
  description: "",
  hubsoftId: "",
  active: true,
};

export default function FormasPagamentoPage() {
  const [paymentMethods, setPaymentMethods] = React.useState<PaymentMethodItem[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [open, setOpen] = React.useState(false);
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = React.useState<PaymentMethodItem | null>(null);
  const [form, setForm] = React.useState(EMPTY_FORM);
  const [fieldErrors, setFieldErrors] = React.useState<FieldErrors>({});
  const [formError, setFormError] = React.useState<string | null>(null);
  const [deleteError, setDeleteError] = React.useState<string | null>(null);
  const [snackbar, setSnackbar] = React.useState<{ open: boolean; message: string; severity?: "success" | "error" }>({
    open: false,
    message: "",
    severity: "success",
  });

  const load = React.useCallback(() => {
    setLoading(true);
    fetch("/api/formas-pagamento")
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setPaymentMethods(data);
        }
      })
      .catch(() => {
        setSnackbar({ open: true, message: "Erro ao carregar formas de pagamento", severity: "error" });
      })
      .finally(() => setLoading(false));
  }, []);

  React.useEffect(() => {
    load();
  }, [load]);

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

  function openEdit(item: PaymentMethodItem) {
    setEditingId(item.id);
    setForm({
      name: item.name,
      description: item.description || "",
      hubsoftId: String(item.hubsoftId),
      active: item.active,
    });
    resetErrors();
    setOpen(true);
  }

  async function handleSave() {
    resetErrors();

    const payload = {
      name: form.name.trim(),
      description: form.description.trim(),
      hubsoftId: form.hubsoftId === "" ? NaN : Number(form.hubsoftId),
      active: form.active,
    };

    const parsed = PaymentMethodFormSchema.safeParse(payload);
    if (!parsed.success) {
      setFieldErrors(zodFieldErrors(parsed.error));
      return;
    }

    const url = editingId ? `/api/formas-pagamento/${editingId}` : "/api/formas-pagamento";
    const result = await submitJson(url, {
      method: editingId ? "PATCH" : "POST",
      body: parsed.data,
    });

    if (!result.ok) {
      setFieldErrors(result.fieldErrors);
      setFormError(result.formError ?? "Não foi possível salvar a forma de pagamento.");
      return;
    }

    setSnackbar({
      open: true,
      message: editingId ? "Forma de pagamento atualizada com sucesso!" : "Forma de pagamento cadastrada com sucesso!",
      severity: "success",
    });
    setOpen(false);
    load();
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleteError(null);
    const result = await submitJson(`/api/formas-pagamento/${deleteTarget.id}`, { method: "DELETE" });
    if (!result.ok) {
      setDeleteError(result.formError ?? "Não foi possível excluir a forma de pagamento.");
      return;
    }
    setSnackbar({
      open: true,
      message: `Forma de pagamento "${deleteTarget.name}" excluída com sucesso.`,
      severity: "success",
    });
    setDeleteTarget(null);
    load();
  }

  async function handleToggleActive(item: PaymentMethodItem) {
    const result = await submitJson(`/api/formas-pagamento/${item.id}`, {
      method: "PATCH",
      body: { active: !item.active },
    });
    if (result.ok) {
      setPaymentMethods((prev) =>
        prev.map((pm) => (pm.id === item.id ? { ...pm, active: !item.active } : pm))
      );
      setSnackbar({
        open: true,
        message: `"${item.name}" ${!item.active ? "ativada" : "desativada"} com sucesso!`,
        severity: "success",
      });
    } else {
      setSnackbar({
        open: true,
        message: "Erro ao atualizar status da forma de pagamento",
        severity: "error",
      });
    }
  }

  const activeCount = paymentMethods.filter((d) => d.active).length;
  const inactiveCount = paymentMethods.filter((d) => !d.active).length;
  const totalPlans = paymentMethods.reduce((acc, curr) => acc + (curr._count?.plans ?? 0), 0);

  const columns: GridColDef<PaymentMethodItem>[] = [
    {
      field: "name",
      headerName: "Forma de Pagamento",
      flex: 1.2,
      minWidth: 180,
      renderCell: (params) => (
        <Stack direction="row" alignItems="center" spacing={1} sx={{ height: "100%" }}>
          <Chip
            icon={<PaymentIcon fontSize="small" />}
            label={params.row.name}
            color={params.row.active ? "primary" : "default"}
            variant={params.row.active ? "filled" : "outlined"}
            sx={{ fontWeight: 700 }}
          />
        </Stack>
      ),
    },
    {
      field: "hubsoftId",
      headerName: "ID no Hubsoft (id_forma_cobranca)",
      flex: 1,
      minWidth: 220,
      renderCell: (params) => (
        <Stack direction="row" alignItems="center" spacing={1} sx={{ height: "100%" }}>
          <Typography
            component="span"
            sx={{
              fontFamily: "monospace",
              bgcolor: "action.hover",
              px: 1,
              py: 0.5,
              borderRadius: 1,
              fontSize: "0.875rem",
              fontWeight: 600,
            }}
          >
            {params.row.hubsoftId}
          </Typography>
        </Stack>
      ),
    },
    {
      field: "description",
      headerName: "Descrição",
      flex: 1.5,
      minWidth: 200,
      valueGetter: (_value, row) => row.description || "—",
    },
    {
      field: "plans",
      headerName: "Planos Vinculados",
      width: 160,
      renderCell: (params) => {
        const count = params.row._count?.plans ?? 0;
        return (
          <Stack direction="row" alignItems="center" spacing={0.5} sx={{ height: "100%" }}>
            <Chip
              icon={<WifiIcon sx={{ fontSize: "16px !important" }} />}
              size="small"
              label={`${count} plano${count !== 1 ? "s" : ""}`}
              variant="outlined"
              color={count > 0 ? "secondary" : "default"}
            />
          </Stack>
        );
      },
    },
    {
      field: "active",
      headerName: "Status",
      flex: 0.8,
      minWidth: 130,
      renderCell: (params) => (
        <Stack direction="row" alignItems="center" sx={{ height: "100%" }}>
          <Switch
            checked={params.row.active}
            onChange={() => handleToggleActive(params.row)}
            size="small"
            color="success"
          />
          <Typography variant="body2" sx={{ ml: 0.5, color: params.row.active ? "success.main" : "text.secondary" }}>
            {params.row.active ? "Ativa" : "Inativa"}
          </Typography>
        </Stack>
      ),
    },
    {
      field: "actions",
      headerName: "Ações",
      width: 120,
      sortable: false,
      renderCell: (params) => (
        <Stack direction="row" spacing={0.5} alignItems="center" sx={{ height: "100%" }}>
          <Tooltip title="Editar">
            <IconButton size="small" onClick={() => openEdit(params.row)}>
              <EditIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="Excluir">
            <IconButton size="small" color="error" onClick={() => setDeleteTarget(params.row)}>
              <DeleteIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Stack>
      ),
    },
  ];

  return (
    <Box sx={{ maxWidth: 1200, mx: "auto", p: { xs: 1.5, sm: 3 } }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 3 }} flexWrap="wrap" gap={2}>
        <Box>
          <Typography variant="h5" component="h1" fontWeight={700}>
            Formas de Pagamento
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Cadastre as formas de pagamento disponíveis com o ID correspondente da forma de cobrança no Hubsoft.
          </Typography>
        </Box>
        <Button variant="contained" startIcon={<AddIcon />} onClick={openCreate}>
          Nova Forma de Pagamento
        </Button>
      </Stack>

      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid size={{ xs: 6, sm: 3 }}>
          <Card variant="outlined">
            <CardContent sx={{ p: 2, "&:last-child": { pb: 2 } }}>
              <Typography variant="caption" color="text.secondary" fontWeight={600}>
                Total Cadastradas
              </Typography>
              <Typography variant="h4" fontWeight={700} sx={{ mt: 0.5 }}>
                {paymentMethods.length}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 6, sm: 3 }}>
          <Card variant="outlined">
            <CardContent sx={{ p: 2, "&:last-child": { pb: 2 } }}>
              <Stack direction="row" alignItems="center" spacing={0.5}>
                <CheckCircleOutlineIcon color="success" fontSize="small" />
                <Typography variant="caption" color="success.main" fontWeight={600}>
                  Ativas
                </Typography>
              </Stack>
              <Typography variant="h4" fontWeight={700} color="success.main" sx={{ mt: 0.5 }}>
                {activeCount}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 6, sm: 3 }}>
          <Card variant="outlined">
            <CardContent sx={{ p: 2, "&:last-child": { pb: 2 } }}>
              <Typography variant="caption" color="text.secondary" fontWeight={600}>
                Inativas
              </Typography>
              <Typography variant="h4" fontWeight={700} color="text.secondary" sx={{ mt: 0.5 }}>
                {inactiveCount}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 6, sm: 3 }}>
          <Card variant="outlined">
            <CardContent sx={{ p: 2, "&:last-child": { pb: 2 } }}>
              <Typography variant="caption" color="text.secondary" fontWeight={600}>
                Planos Vinculados
              </Typography>
              <Typography variant="h4" fontWeight={700} color="primary.main" sx={{ mt: 0.5 }}>
                {totalPlans}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Alert severity="info" sx={{ mb: 3 }}>
        Cada plano de internet recebe uma forma de pagamento. No fechamento da venda e envio para o Hubsoft, o campo{" "}
        <strong>id_forma_cobranca</strong> é preenchido diretamente com o ID da forma atrelada ao plano contratado.
      </Alert>

      <Paper variant="outlined" sx={{ width: "100%", overflow: "hidden" }}>
        <DataGrid
          rows={paymentMethods}
          columns={columns}
          loading={loading}
          autoHeight
          pageSizeOptions={[10, 25, 50]}
          initialState={{
            pagination: { paginationModel: { pageSize: 10 } },
          }}
          disableRowSelectionOnClick
          sx={{
            border: 0,
            "& .MuiDataGrid-cell:focus": { outline: "none" },
          }}
        />
      </Paper>

      {/* Dialog Cadastro / Edição */}
      <Dialog open={open} onClose={() => setOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{editingId ? "Editar Forma de Pagamento" : "Nova Forma de Pagamento"}</DialogTitle>
        <DialogContent dividers>
          {formError ? (
            <Alert severity="error" sx={{ mb: 2 }}>
              {formError}
            </Alert>
          ) : null}

          <Stack spacing={2.5}>
            <TextField
              label="Nome da Forma de Pagamento"
              placeholder="Ex: Carnê, Boleto Bancário, Cartão de Crédito"
              fullWidth
              required
              value={form.name}
              error={!!fieldErrors.name}
              helperText={fieldErrors.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />

            <TextField
              label="ID no Hubsoft (id_forma_cobranca)"
              placeholder="Ex: 94"
              type="number"
              fullWidth
              required
              value={form.hubsoftId}
              error={!!fieldErrors.hubsoftId}
              helperText={
                fieldErrors.hubsoftId ??
                "ID numérico correspondente à Forma de Cobrança cadastrada na sua conta Hubsoft."
              }
              onChange={(e) => setForm({ ...form, hubsoftId: e.target.value })}
            />

            <TextField
              label="Descrição / Observação"
              placeholder="Descrição interna ou instrução para a equipe"
              fullWidth
              multiline
              rows={2}
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
                  color="success"
                />
              }
              label={form.active ? "Forma de pagamento ativa" : "Forma de pagamento inativa"}
            />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button onClick={() => setOpen(false)}>Cancelar</Button>
          <Button variant="contained" onClick={handleSave}>
            {editingId ? "Salvar Alterações" : "Cadastrar"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Dialog Confirmação de Exclusão */}
      <Dialog open={!!deleteTarget} onClose={() => setDeleteTarget(null)} maxWidth="xs" fullWidth>
        <DialogTitle>Confirmar Exclusão</DialogTitle>
        <DialogContent>
          {deleteError ? (
            <Alert severity="error" sx={{ mb: 2 }}>
              {deleteError}
            </Alert>
          ) : null}
          <DialogContentText>
            Tem certeza de que deseja excluir a forma de pagamento <strong>{deleteTarget?.name}</strong> (ID Hubsoft:{" "}
            {deleteTarget?.hubsoftId})?
            {deleteTarget && (deleteTarget._count?.plans ?? 0) > 0 && (
              <Box component="span" sx={{ display: "block", mt: 1, color: "warning.main" }}>
                Atenção: Existem {deleteTarget._count?.plans} plano(s) vinculado(s) a esta forma. Ao excluir, esses planos
                ficarão sem forma de pagamento associada.
              </Box>
            )}
          </DialogContentText>
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button onClick={() => setDeleteTarget(null)}>Cancelar</Button>
          <Button variant="contained" color="error" onClick={handleDelete}>
            Excluir
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={() => setSnackbar((prev) => ({ ...prev, open: false }))}
        message={snackbar.message}
      />
    </Box>
  );
}

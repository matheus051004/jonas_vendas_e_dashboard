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
import CalendarMonthIcon from "@mui/icons-material/CalendarMonth";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import SmartToyOutlinedIcon from "@mui/icons-material/SmartToyOutlined";
import { DueDateFormSchema } from "@/lib/crud-schemas";
import { submitJson, zodFieldErrors, type FieldErrors } from "@/lib/form-errors";

interface DueDateItem {
  id: string;
  day: number;
  hubsoftId: number;
  active: boolean;
  createdAt: string;
  updatedAt: string;
  _count?: {
    contracts: number;
  };
}

const EMPTY_FORM = {
  day: "",
  hubsoftId: "",
  active: true,
};

export default function VencimentosPage() {
  const [dueDates, setDueDates] = React.useState<DueDateItem[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [open, setOpen] = React.useState(false);
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = React.useState<DueDateItem | null>(null);
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
    fetch("/api/vencimentos")
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setDueDates(data);
        }
      })
      .catch(() => {
        setSnackbar({ open: true, message: "Erro ao carregar dias de vencimento", severity: "error" });
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

  function openEdit(item: DueDateItem) {
    setEditingId(item.id);
    setForm({
      day: String(item.day),
      hubsoftId: String(item.hubsoftId),
      active: item.active,
    });
    resetErrors();
    setOpen(true);
  }

  async function handleSave() {
    resetErrors();

    const payload = {
      day: form.day === "" ? NaN : Number(form.day),
      hubsoftId: form.hubsoftId === "" ? NaN : Number(form.hubsoftId),
      active: form.active,
    };

    const parsed = DueDateFormSchema.safeParse(payload);
    if (!parsed.success) {
      setFieldErrors(zodFieldErrors(parsed.error));
      return;
    }

    const url = editingId ? `/api/vencimentos/${editingId}` : "/api/vencimentos";
    const result = await submitJson(url, {
      method: editingId ? "PATCH" : "POST",
      body: parsed.data,
    });

    if (!result.ok) {
      setFieldErrors(result.fieldErrors);
      setFormError(result.formError ?? "Não foi possível salvar o dia de vencimento.");
      return;
    }

    setSnackbar({
      open: true,
      message: editingId ? "Vencimento atualizado com sucesso!" : "Dia de vencimento cadastrado com sucesso!",
      severity: "success",
    });
    setOpen(false);
    load();
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleteError(null);
    const result = await submitJson(`/api/vencimentos/${deleteTarget.id}`, { method: "DELETE" });
    if (!result.ok) {
      setDeleteError(result.formError ?? "Não foi possível excluir o vencimento.");
      return;
    }
    setSnackbar({
      open: true,
      message: `Vencimento dia ${deleteTarget.day} excluído com sucesso.`,
      severity: "success",
    });
    setDeleteTarget(null);
    load();
  }

  async function handleToggleActive(item: DueDateItem) {
    const result = await submitJson(`/api/vencimentos/${item.id}`, {
      method: "PATCH",
      body: { active: !item.active },
    });
    if (result.ok) {
      setDueDates((prev) =>
        prev.map((d) => (d.id === item.id ? { ...d, active: !item.active } : d))
      );
      setSnackbar({
        open: true,
        message: `Dia ${item.day} ${!item.active ? "ativado" : "desativado"} com sucesso!`,
        severity: "success",
      });
    } else {
      setSnackbar({
        open: true,
        message: "Erro ao atualizar status do vencimento",
        severity: "error",
      });
    }
  }

  const activeCount = dueDates.filter((d) => d.active).length;
  const inactiveCount = dueDates.filter((d) => !d.active).length;
  const totalContracts = dueDates.reduce((acc, curr) => acc + (curr._count?.contracts ?? 0), 0);

  const columns: GridColDef<DueDateItem>[] = [
    {
      field: "day",
      headerName: "Dia de Vencimento",
      flex: 1,
      minWidth: 160,
      renderCell: (params) => (
        <Stack direction="row" alignItems="center" spacing={1} sx={{ height: "100%" }}>
          <Chip
            icon={<CalendarMonthIcon fontSize="small" />}
            label={`Dia ${String(params.row.day).padStart(2, "0")}`}
            color={params.row.active ? "primary" : "default"}
            variant={params.row.active ? "filled" : "outlined"}
            sx={{ fontWeight: 700 }}
          />
        </Stack>
      ),
    },
    {
      field: "hubsoftId",
      headerName: "ID no Hubsoft (id_vencimento)",
      flex: 1,
      minWidth: 200,
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
      field: "active",
      headerName: "Disponível para IA / Vendas",
      flex: 1,
      minWidth: 180,
      renderCell: (params) => (
        <Stack direction="row" alignItems="center" spacing={1} sx={{ height: "100%" }}>
          <Switch
            size="small"
            checked={params.row.active}
            onChange={() => handleToggleActive(params.row)}
            color="primary"
          />
          <Chip
            size="small"
            label={params.row.active ? "Ativo" : "Inativo"}
            color={params.row.active ? "success" : "default"}
            variant="outlined"
          />
        </Stack>
      ),
    },
    {
      field: "contracts",
      headerName: "Contratos",
      flex: 0.8,
      minWidth: 120,
      valueGetter: (_v, row) => row._count?.contracts ?? 0,
      renderCell: (params) => (
        <Stack direction="row" alignItems="center" sx={{ height: "100%" }}>
          <Typography variant="body2" color="text.secondary">
            {params.row._count?.contracts ?? 0} contrato(s)
          </Typography>
        </Stack>
      ),
    },
    {
      field: "actions",
      headerName: "Ações",
      sortable: false,
      width: 120,
      renderCell: (params) => (
        <Stack direction="row" spacing={0.5} alignItems="center" sx={{ height: "100%" }}>
          <Tooltip title="Editar">
            <IconButton size="small" onClick={() => openEdit(params.row)} color="primary">
              <EditIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="Excluir">
            <IconButton
              size="small"
              onClick={() => {
                setDeleteError(null);
                setDeleteTarget(params.row);
              }}
              color="error"
            >
              <DeleteIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Stack>
      ),
    },
  ];

  return (
    <Box>
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", mb: 3, flexWrap: "wrap", gap: 2 }}>
        <Box>
          <Typography variant="h4" fontWeight={700} gutterBottom>
            Dias de Vencimento
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Cadastre os dias do mês (1 a 31) disponíveis para fatura e mapeie para os respectivos IDs de vencimento do Hubsoft.
          </Typography>
        </Box>
        <Button startIcon={<AddIcon />} variant="contained" onClick={openCreate} size="large">
          Novo dia de vencimento
        </Button>
      </Box>

      {/* Cards de Métricas */}
      <Grid container spacing={2} mb={3}>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <Card variant="outlined">
            <CardContent>
              <Typography variant="caption" color="text.secondary" textTransform="uppercase" fontWeight={600}>
                Total de Vencimentos
              </Typography>
              <Typography variant="h4" fontWeight={700} sx={{ mt: 0.5 }}>
                {dueDates.length}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <Card variant="outlined" sx={{ borderLeft: 4, borderColor: "success.main" }}>
            <CardContent>
              <Typography variant="caption" color="text.secondary" textTransform="uppercase" fontWeight={600}>
                Vencimentos Ativos (IA)
              </Typography>
              <Typography variant="h4" fontWeight={700} color="success.main" sx={{ mt: 0.5 }}>
                {activeCount}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <Card variant="outlined">
            <CardContent>
              <Typography variant="caption" color="text.secondary" textTransform="uppercase" fontWeight={600}>
                Inativos / Pausados
              </Typography>
              <Typography variant="h4" fontWeight={700} color="text.secondary" sx={{ mt: 0.5 }}>
                {inactiveCount}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <Card variant="outlined">
            <CardContent>
              <Typography variant="caption" color="text.secondary" textTransform="uppercase" fontWeight={600}>
                Contratos Vinculados
              </Typography>
              <Typography variant="h4" fontWeight={700} color="primary.main" sx={{ mt: 0.5 }}>
                {totalContracts}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Dica da ferramenta para IA */}
      <Paper
        variant="outlined"
        sx={{
          p: 2,
          mb: 3,
          bgcolor: "primary.50",
          borderColor: "primary.200",
          borderRadius: 2,
        }}
      >
        <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} alignItems={{ xs: "flex-start", sm: "center" }}>
          <Box sx={{ color: "primary.main", display: "flex", p: 1, bgcolor: "background.paper", borderRadius: 1.5 }}>
            <SmartToyOutlinedIcon />
          </Box>
          <Box sx={{ flex: 1 }}>
            <Typography variant="subtitle2" fontWeight={700} color="primary.dark">
              Integração com Ferramenta da IA (Tool: listDueDates)
            </Typography>
            <Typography variant="body2" color="text.secondary">
              A IA externa consulta esses dias ativos automaticamente através da rota{" "}
              <code>GET /api/agent/due-dates</code> para apresentar as opções de vencimento ao cliente durante o fechamento
              do contrato.
            </Typography>
          </Box>
        </Stack>
      </Paper>

      {/* Grid de Dados */}
      <Paper variant="outlined" sx={{ height: { xs: "calc(100vh - 280px)", md: 480 }, width: "100%" }}>
        <DataGrid
          rows={dueDates}
          columns={columns}
          loading={loading}
          disableRowSelectionOnClick
          pageSizeOptions={[10, 25, 50]}
          initialState={{
            pagination: { paginationModel: { pageSize: 25 } },
            sorting: { sortModel: [{ field: "day", sort: "asc" }] },
          }}
          sx={{
            border: "none",
            "& .MuiDataGrid-cell:focus": { outline: "none" },
          }}
        />
      </Paper>

      {/* Modal de Criação / Edição */}
      <Dialog open={open} onClose={() => setOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{editingId ? "Editar Dia de Vencimento" : "Cadastrar Dia de Vencimento"}</DialogTitle>
        <DialogContent>
          {formError && (
            <Alert severity="error" sx={{ mt: 1, mb: 2 }}>
              {formError}
            </Alert>
          )}

          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Informe o dia do mês e o ID de vencimento correspondente configurado no sistema Hubsoft.
          </Typography>

          <TextField
            label="Dia do Vencimento (1 a 31)"
            type="number"
            fullWidth
            required
            margin="normal"
            value={form.day}
            error={!!fieldErrors.day}
            helperText={fieldErrors.day ?? "Informe o dia do mês entre 1 e 31 (ex: 5, 10, 15, 20)"}
            inputProps={{ min: 1, max: 31, step: 1 }}
            onChange={(e) => setForm({ ...form, day: e.target.value })}
            autoFocus
          />

          <TextField
            label="ID do Vencimento no Hubsoft (id_vencimento)"
            type="number"
            fullWidth
            required
            margin="normal"
            value={form.hubsoftId}
            error={!!fieldErrors.hubsoftId}
            helperText={fieldErrors.hubsoftId ?? "Código numérico do vencimento no Hubsoft (ex: 9)"}
            inputProps={{ min: 1, step: 1 }}
            onChange={(e) => setForm({ ...form, hubsoftId: e.target.value })}
          />

          <Box sx={{ mt: 2 }}>
            <FormControlLabel
              control={
                <Switch
                  checked={form.active}
                  onChange={(e) => setForm({ ...form, active: e.target.checked })}
                  color="primary"
                />
              }
              label={
                <Box>
                  <Typography variant="body1" fontWeight={500}>
                    Ativo para seleção e IA
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Quando ativo, a IA oferece este dia aos clientes e ele pode ser selecionado nos contratos.
                  </Typography>
                </Box>
              }
            />
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setOpen(false)}>Cancelar</Button>
          <Button variant="contained" onClick={handleSave} startIcon={<CheckCircleOutlineIcon />}>
            Salvar Vencimento
          </Button>
        </DialogActions>
      </Dialog>

      {/* Modal de Exclusão */}
      <Dialog open={!!deleteTarget} onClose={() => setDeleteTarget(null)} maxWidth="xs" fullWidth>
        <DialogTitle>Excluir dia de vencimento?</DialogTitle>
        <DialogContent>
          {deleteError && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {deleteError}
            </Alert>
          )}
          <DialogContentText>
            Tem certeza que deseja remover o <strong>Dia {deleteTarget?.day}</strong> (ID Hubsoft:{" "}
            <strong>{deleteTarget?.hubsoftId}</strong>)?
            {deleteTarget?._count?.contracts ? (
              <Box component="span" sx={{ display: "block", mt: 1, color: "warning.main" }}>
                Atenção: há {deleteTarget._count.contracts} contrato(s) associado(s) a este dia. Eles serão mantidos, mas
                ficarão sem o vínculo direto deste cadastro.
              </Box>
            ) : null}
          </DialogContentText>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
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

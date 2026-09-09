"use client";

import * as React from "react";
import {
  Alert,
  Box,
  Typography,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  Chip,
  Stack,
  Paper,
  Button,
  TextField,
  IconButton,
  FormControlLabel,
  Switch,
  MenuItem,
  Select,
  FormControl,
  InputLabel,
} from "@mui/material";
import { ClientEditSchema } from "@/lib/crud-schemas";
import { MultilineTextField } from "@/lib/multiline-text-field";
import { submitJson, zodFieldErrors, type FieldErrors } from "@/lib/form-errors";
import Grid from "@mui/material/Grid2";
import { DataGrid, type GridColDef } from "@mui/x-data-grid";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";

const STAGES = [
  "NOVO_LEAD",
  "INTERESSADO",
  "PAROU_DE_RESPONDER",
  "ACHOU_CARO",
  "FECHOU_VENDA",
  "DESISTIU",
] as const;

const STAGE_LABELS: Record<string, string> = {
  NOVO_LEAD: "Novo lead",
  INTERESSADO: "Interessado",
  PAROU_DE_RESPONDER: "Sumiu / Sem resposta",
  ACHOU_CARO: "Achou caro",
  FECHOU_VENDA: "Fechou venda",
  DESISTIU: "Desistiu",
};

interface Origin {
  id: string;
  name: string;
}

interface Area {
  id: string;
  name: string;
}

interface Client {
  id: string;
  name: string | null;
  phone: string;
  areaId: string | null;
  area: { id: string; name: string } | null;
  stage: string;
  originId: string | null;
  origin: { name: string } | null;
  currentProvider: string | null;
  currentPrice: number | null;
  hadBadExperience: boolean | null;
  badExperienceNote: string | null;
}

interface Message {
  id: string;
  role: string;
  content: string;
  kind: string;
  hasAudio?: boolean;
  createdAt: string;
}

interface ContractDetail {
  id: string;
  personType?: "pf" | "pj" | null;
  fullName: string;
  cpf: string | null;
  companyName: string | null;
  tradeName: string | null;
  cnpj: string | null;
  stateRegistration: string | null;
  contactName: string | null;
  phonePrimary: string;
  phoneSecondary: string | null;
  email: string;
  gender: string | null;
  observation: string | null;
  rg: string | null;
  rgEmissor: string | null;
  birthDate: string | null;
  motherName: string | null;
  fatherName: string | null;
  maritalStatus: string | null;
  profession: string | null;
  cep: string | null;
  street: string | null;
  number: string | null;
  neighborhood: string | null;
  complement: string | null;
  reference: string | null;
  hubsoftClientId: number | null;
  hubsoftProtocol: string | null;
  createdAt: string;
  plan?: { id: string; name: string; price: string | number } | null;
  packages?: Array<{
    package: {
      id: string;
      name: string;
      price: string | number;
      hubsoftPackageId?: number | null;
    };
  }>;
}

interface ClientDetail extends Client {
  contract: ContractDetail | null;
  messages: Message[];
}

interface EditForm {
  name: string;
  areaId: string;
  originId: string;
  stage: string;
  currentProvider: string;
  currentPrice: string;
  hadBadExperience: boolean;
  badExperienceNote: string;
}

function toEditForm(client: Client): EditForm {
  return {
    name: client.name ?? "",
    areaId: client.areaId ?? "",
    originId: client.originId ?? "",
    stage: client.stage,
    currentProvider: client.currentProvider ?? "",
    currentPrice: client.currentPrice?.toString() ?? "",
    hadBadExperience: client.hadBadExperience ?? false,
    badExperienceNote: client.badExperienceNote ?? "",
  };
}

function fromEditForm(form: EditForm) {
  return {
    name: form.name || null,
    areaId: form.areaId || null,
    originId: form.originId || null,
    stage: form.stage,
    currentProvider: form.currentProvider || null,
    currentPrice: form.currentPrice ? Number(form.currentPrice) : null,
    hadBadExperience: form.hadBadExperience,
    badExperienceNote: form.badExperienceNote || null,
  };
}

export default function ClientesPage() {
  const [clients, setClients] = React.useState<Client[]>([]);
  const [origins, setOrigins] = React.useState<Origin[]>([]);
  const [areas, setAreas] = React.useState<Area[]>([]);
  const [detail, setDetail] = React.useState<ClientDetail | null>(null);
  const [editing, setEditing] = React.useState<Client | null>(null);
  const [form, setForm] = React.useState<EditForm>({
    name: "",
    areaId: "",
    originId: "",
    stage: "NOVO_LEAD",
    currentProvider: "",
    currentPrice: "",
    hadBadExperience: false,
    badExperienceNote: "",
  });
  const [deleteTarget, setDeleteTarget] = React.useState<Client | null>(null);
  const [fieldErrors, setFieldErrors] = React.useState<FieldErrors>({});
  const [formError, setFormError] = React.useState<string | null>(null);
  const [deleteError, setDeleteError] = React.useState<string | null>(null);

  const load = React.useCallback(() => {
    fetch("/api/clientes").then((r) => r.json()).then(setClients);
  }, []);

  React.useEffect(() => {
    load();
    fetch("/api/origens")
      .then((r) => r.json())
      .then((data: Origin[]) => setOrigins(data));
    fetch("/api/areas")
      .then((r) => r.json())
      .then((data: Area[]) => setAreas(data));
  }, [load]);

  async function openDetail(id: string) {
    const res = await fetch(`/api/clientes/${id}`);
    setDetail(await res.json());
  }

  function openEdit(client: Client) {
    setEditing(client);
    setForm(toEditForm(client));
    setFieldErrors({});
    setFormError(null);
  }

  async function handleSave() {
    if (!editing) return;
    setFieldErrors({});
    setFormError(null);

    const payload = fromEditForm(form);
    const parsed = ClientEditSchema.safeParse(payload);
    if (!parsed.success) {
      setFieldErrors(zodFieldErrors(parsed.error));
      return;
    }

    const result = await submitJson(`/api/clientes/${editing.id}`, {
      method: "PATCH",
      body: parsed.data,
    });
    if (!result.ok) {
      setFieldErrors(result.fieldErrors);
      setFormError(result.formError ?? "Não foi possível salvar o lead.");
      return;
    }

    setEditing(null);
    load();
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleteError(null);
    const result = await submitJson(`/api/clientes/${deleteTarget.id}`, { method: "DELETE" });
    if (!result.ok) {
      setDeleteError(result.formError ?? "Não foi possível excluir o lead.");
      return;
    }
    setDeleteTarget(null);
    load();
  }

  const columns: GridColDef<Client>[] = [
    { field: "name", headerName: "Nome", flex: 1, valueGetter: (_v, row) => row.name ?? "Sem nome" },
    { field: "phone", headerName: "Telefone", flex: 1 },
    { field: "area", headerName: "Área", flex: 1, valueGetter: (_v, row) => row.area?.name ?? "-" },
    { field: "origin", headerName: "Origem", flex: 1, valueGetter: (_v, row) => row.origin?.name ?? "-" },
    { field: "stage", headerName: "Etapa", flex: 1, valueGetter: (_v, row) => STAGE_LABELS[row.stage] ?? row.stage },
    {
      field: "actions",
      headerName: "",
      sortable: false,
      width: 100,
      renderCell: (params) => (
        <>
          <IconButton
            size="small"
            onClick={(e) => {
              e.stopPropagation();
              openEdit(params.row);
            }}
          >
            <EditIcon fontSize="small" />
          </IconButton>
          <IconButton
            size="small"
            color="error"
            onClick={(e) => {
              e.stopPropagation();
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
      <Typography variant="h4" mb={3}>
        Clientes
      </Typography>
      <Box sx={{ height: { xs: "calc(100vh - 180px)", md: 600 }, bgcolor: "background.paper" }}>
        <DataGrid
          rows={clients}
          columns={columns}
          onRowClick={(params) => openDetail(params.row.id)}
          disableRowSelectionOnClick
        />
      </Box>

      <Dialog open={!!detail} onClose={() => setDetail(null)} maxWidth="sm" fullWidth>
        <DialogTitle>{detail?.name ?? detail?.phone}</DialogTitle>
        <DialogContent>
          <Stack spacing={1} mb={2}>
            <Typography variant="body2">Telefone: {detail?.phone}</Typography>
            <Typography variant="body2">Etapa: {STAGE_LABELS[detail?.stage ?? ""] ?? detail?.stage}</Typography>
          </Stack>

          {detail?.contract && (
            <Paper variant="outlined" sx={{ p: 1.5, mb: 2, bgcolor: "action.hover" }}>
              <Typography variant="subtitle2" color="primary" fontWeight={700} mb={1}>
                Contrato & Integração Hubsoft
              </Typography>
              <Stack spacing={0.5}>
                {detail.contract.personType === "pj" ? (
                  <>
                    <Typography variant="body2">
                      <strong>Razão Social:</strong> {detail.contract.companyName || detail.contract.fullName} (CNPJ: {detail.contract.cnpj}
                      {detail.contract.stateRegistration ? ` | IE: ${detail.contract.stateRegistration}` : ""})
                    </Typography>
                    {detail.contract.tradeName && (
                      <Typography variant="body2">
                        <strong>Nome Fantasia:</strong> {detail.contract.tradeName}
                      </Typography>
                    )}
                    {detail.contract.contactName && (
                      <Typography variant="body2">
                        <strong>Responsável / Contato:</strong> {detail.contract.contactName}
                      </Typography>
                    )}
                  </>
                ) : (
                  <>
                    <Typography variant="body2">
                      <strong>Titular (PF):</strong> {detail.contract.fullName} (CPF: {detail.contract.cpf}
                      {detail.contract.rg ? ` | RG: ${detail.contract.rg} ${detail.contract.rgEmissor ?? ""}` : ""})
                    </Typography>
                    {detail.contract.birthDate && (
                      <Typography variant="body2">
                        <strong>Nascimento:</strong> {detail.contract.birthDate}
                        {detail.contract.maritalStatus ? ` | Estado civil: ${detail.contract.maritalStatus}` : ""}
                        {detail.contract.profession ? ` | Profissão: ${detail.contract.profession}` : ""}
                      </Typography>
                    )}
                    {detail.contract.motherName && (
                      <Typography variant="body2">
                        <strong>Mãe:</strong> {detail.contract.motherName}
                        {detail.contract.fatherName ? ` | Pai: ${detail.contract.fatherName}` : ""}
                      </Typography>
                    )}
                  </>
                )}
                {detail.contract.hubsoftClientId && (
                  <Typography variant="body2">
                    <strong>ID Cliente Hubsoft:</strong> {detail.contract.hubsoftClientId}
                    {detail.contract.hubsoftProtocol ? ` | Protocolo: ${detail.contract.hubsoftProtocol}` : ""}
                  </Typography>
                )}
                {detail.contract.street && (
                  <Typography variant="body2">
                    <strong>Instalação:</strong> {detail.contract.street}, {detail.contract.number} - {detail.contract.neighborhood}
                    {detail.contract.complement ? ` (${detail.contract.complement})` : ""}
                    {detail.contract.cep ? ` - CEP: ${detail.contract.cep}` : ""}
                    {detail.contract.reference ? ` | Ref: ${detail.contract.reference}` : ""}
                  </Typography>
                )}
                {detail.contract.plan && (
                  <Typography variant="body2">
                    <strong>Plano Contratado:</strong> {detail.contract.plan.name} (R$ {Number(detail.contract.plan.price).toFixed(2)})
                  </Typography>
                )}
                {detail.contract.packages && detail.contract.packages.length > 0 && (
                  <Box sx={{ mt: 0.5 }}>
                    <Typography variant="body2">
                      <strong>Pacotes Adicionais:</strong>
                    </Typography>
                    <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5, mt: 0.5 }}>
                      {detail.contract.packages.map((cp, idx) => (
                        <Chip
                          key={idx}
                          size="small"
                          color="primary"
                          variant="outlined"
                          label={`${cp.package.name} (+R$ ${Number(cp.package.price).toFixed(2)})`}
                        />
                      ))}
                    </Box>
                  </Box>
                )}
                {detail.contract.observation && (
                  <Typography variant="body2" color="text.secondary">
                    <strong>Obs:</strong> {detail.contract.observation}
                  </Typography>
                )}
              </Stack>
            </Paper>
          )}

          <Typography variant="subtitle2" mb={1}>
            Histórico
          </Typography>
          <Stack spacing={1} sx={{ maxHeight: 400, overflowY: "auto" }}>
            {detail?.messages.map((m) => (
              <Paper key={m.id} variant="outlined" sx={{ p: 1 }}>
                <Stack direction="row" spacing={0.5} alignItems="center" mb={0.5} flexWrap="wrap">
                  <Chip label={m.role} size="small" />
                  {m.kind === "audio" && <Chip label="áudio" size="small" variant="outlined" />}
                </Stack>
                {m.kind === "audio" && m.hasAudio && (
                  <Box
                    component="audio"
                    controls
                    preload="metadata"
                    src={`/api/messages/${m.id}/audio`}
                    sx={{ width: "100%", maxWidth: 360, height: 36, mb: 0.75, display: "block" }}
                  />
                )}
                {!(m.kind === "audio" && m.hasAudio && m.content === "[áudio]") && (
                  <Typography variant="body2">{m.content}</Typography>
                )}
              </Paper>
            ))}
          </Stack>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editing} onClose={() => setEditing(null)} maxWidth="sm" fullWidth>
        <DialogTitle>{editing?.name ?? editing?.phone}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            {formError && <Alert severity="error">{formError}</Alert>}
            <TextField label="Telefone" value={editing?.phone ?? ""} disabled fullWidth />
            <TextField
              label="Nome"
              fullWidth
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
            <FormControl fullWidth>
              <InputLabel id="area-label">Área</InputLabel>
              <Select
                labelId="area-label"
                label="Área"
                value={form.areaId}
                onChange={(e) => setForm({ ...form, areaId: e.target.value })}
              >
                <MenuItem value="">
                  <em>Nenhuma</em>
                </MenuItem>
                {areas.map((a) => (
                  <MenuItem key={a.id} value={a.id}>
                    {a.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <FormControl fullWidth>
              <InputLabel id="origin-label">Origem</InputLabel>
              <Select
                labelId="origin-label"
                label="Origem"
                value={form.originId}
                onChange={(e) => setForm({ ...form, originId: e.target.value })}
              >
                <MenuItem value="">
                  <em>Nenhuma</em>
                </MenuItem>
                {origins.map((o) => (
                  <MenuItem key={o.id} value={o.id}>
                    {o.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <FormControl fullWidth>
              <InputLabel id="stage-label">Etapa</InputLabel>
              <Select
                labelId="stage-label"
                label="Etapa"
                value={form.stage}
                onChange={(e) => setForm({ ...form, stage: e.target.value })}
              >
                {STAGES.map((s) => (
                  <MenuItem key={s} value={s}>
                    {STAGE_LABELS[s]}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <TextField
              label="Provedor atual"
              fullWidth
              value={form.currentProvider}
              onChange={(e) => setForm({ ...form, currentProvider: e.target.value })}
            />
            <TextField
              label="Preço atual"
              type="number"
              fullWidth
              value={form.currentPrice}
              error={!!fieldErrors.currentPrice}
              helperText={fieldErrors.currentPrice}
              onChange={(e) => setForm({ ...form, currentPrice: e.target.value })}
            />
            <FormControlLabel
              control={
                <Switch
                  checked={form.hadBadExperience}
                  onChange={(e) => setForm({ ...form, hadBadExperience: e.target.checked })}
                />
              }
              label="Teve má experiência"
            />
            <MultilineTextField
              label="Nota da má experiência"
              fullWidth
              minRows={3}
              value={form.badExperienceNote}
              onChange={(e) => setForm({ ...form, badExperienceNote: e.target.value })}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditing(null)}>Cancelar</Button>
          <Button variant="contained" onClick={handleSave}>
            Salvar
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={!!deleteTarget} onClose={() => setDeleteTarget(null)} maxWidth="xs" fullWidth>
        <DialogTitle>Excluir lead?</DialogTitle>
        <DialogContent>
          {deleteError && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {deleteError}
            </Alert>
          )}
          <DialogContentText>
            Isso vai apagar {deleteTarget?.name ?? deleteTarget?.phone} e todo o histórico de mensagens e contrato
            vinculados. Não dá pra desfazer.
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

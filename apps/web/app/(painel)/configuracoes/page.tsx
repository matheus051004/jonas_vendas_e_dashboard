"use client";

import * as React from "react";
import { Box, Typography, TextField, Button, Paper, Snackbar, Divider } from "@mui/material";
import Grid from "@mui/material/Grid2";

interface Settings {
  aiModel: string;
  maxTokens: number;
  temperature: number;
  openAiApiKey: string;
  generalPrompt: string;
  keyPoints: string;
  toolsDescription: string;
  outboundWebhookUrl: string;
  contractWebhookUrl: string;
  outboundWebhookSecret: string | null;
}

export default function ConfiguracoesPage() {
  const [form, setForm] = React.useState<Settings | null>(null);
  const [saved, setSaved] = React.useState(false);

  React.useEffect(() => {
    fetch("/api/configuracoes").then((r) => r.json()).then(setForm);
  }, []);

  async function handleSave() {
    if (!form) return;
    await fetch("/api/configuracoes", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    setSaved(true);
  }

  if (!form) return <Typography>Carregando...</Typography>;

  const inboundUrl =
    typeof window !== "undefined" ? `${window.location.origin}/api/webhooks/inbound` : "/api/webhooks/inbound";

  return (
    <Box>
      <Typography variant="h4" mb={3}>
        Configurações da IA
      </Typography>

      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" mb={2}>
          Modelo
        </Typography>
        <Grid container spacing={2}>
          <Grid size={{ xs: 12, sm: 4 }}>
            <TextField
              label="Modelo (ex: gpt-5.4)"
              fullWidth
              value={form.aiModel}
              onChange={(e) => setForm({ ...form, aiModel: e.target.value })}
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 4 }}>
            <TextField
              label="Max tokens"
              type="number"
              fullWidth
              value={form.maxTokens}
              onChange={(e) => setForm({ ...form, maxTokens: Number(e.target.value) })}
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 4 }}>
            <TextField
              label="Temperature"
              type="number"
              fullWidth
              inputProps={{ step: 0.1, min: 0, max: 2 }}
              value={form.temperature}
              onChange={(e) => setForm({ ...form, temperature: Number(e.target.value) })}
            />
          </Grid>
          <Grid size={12}>
            <TextField
              label="OpenAI API Key"
              type="password"
              fullWidth
              value={form.openAiApiKey}
              onChange={(e) => setForm({ ...form, openAiApiKey: e.target.value })}
            />
          </Grid>
        </Grid>
      </Paper>

      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" mb={2}>
          Prompt e comportamento
        </Typography>
        <TextField
          label="Prompt geral"
          fullWidth
          multiline
          rows={4}
          margin="normal"
          value={form.generalPrompt}
          onChange={(e) => setForm({ ...form, generalPrompt: e.target.value })}
        />
        <TextField
          label="Pontos principais a destacar"
          fullWidth
          multiline
          rows={2}
          margin="normal"
          value={form.keyPoints}
          onChange={(e) => setForm({ ...form, keyPoints: e.target.value })}
        />
        <TextField
          label="Descrição das ferramentas (tools)"
          fullWidth
          multiline
          rows={3}
          margin="normal"
          value={form.toolsDescription}
          onChange={(e) => setForm({ ...form, toolsDescription: e.target.value })}
        />
      </Paper>

      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" mb={2}>
          Webhooks
        </Typography>
        <TextField label="Webhook de entrada (URL fixa, configure no app de chat)" fullWidth margin="normal" value={inboundUrl} disabled />
        <Divider sx={{ my: 2 }} />
        <TextField
          label="Webhook de saída (IA enviando)"
          fullWidth
          margin="normal"
          value={form.outboundWebhookUrl}
          onChange={(e) => setForm({ ...form, outboundWebhookUrl: e.target.value })}
        />
        <TextField
          label="Webhook de contrato (venda fechada)"
          fullWidth
          margin="normal"
          value={form.contractWebhookUrl}
          onChange={(e) => setForm({ ...form, contractWebhookUrl: e.target.value })}
        />
        <TextField
          label="Secret dos webhooks de saída (opcional, HMAC)"
          fullWidth
          margin="normal"
          value={form.outboundWebhookSecret ?? ""}
          onChange={(e) => setForm({ ...form, outboundWebhookSecret: e.target.value })}
        />
      </Paper>

      <Button variant="contained" onClick={handleSave}>
        Salvar configurações
      </Button>

      <Snackbar open={saved} autoHideDuration={2500} onClose={() => setSaved(false)} message="Configurações salvas" />
    </Box>
  );
}

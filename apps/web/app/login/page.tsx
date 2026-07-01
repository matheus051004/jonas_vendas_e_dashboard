"use client";

import { useActionState } from "react";
import { Box, Button, Paper, TextField, Typography, Alert } from "@mui/material";
import { loginAction } from "./actions";

export default function LoginPage() {
  const [error, formAction, pending] = useActionState(loginAction, null);

  return (
    <Box
      sx={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        bgcolor: "grey.100",
      }}
    >
      <Paper sx={{ p: 4, width: 360 }} component="form" action={formAction}>
        <Typography variant="h5" mb={2}>
          Painel de Vendas
        </Typography>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}
        <TextField name="user" label="Usuário" fullWidth margin="normal" required autoFocus />
        <TextField name="password" label="Senha" type="password" fullWidth margin="normal" required />
        <Button type="submit" variant="contained" fullWidth sx={{ mt: 2 }} disabled={pending}>
          Entrar
        </Button>
      </Paper>
    </Box>
  );
}

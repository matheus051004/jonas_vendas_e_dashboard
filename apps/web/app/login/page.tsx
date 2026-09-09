"use client";

import { useActionState } from "react";
import { Box, Button, Paper, TextField, Typography, Alert } from "@mui/material";
import { loginAction } from "./actions";
import { useBranding } from "@/lib/branding";

export default function LoginPage() {
  const [error, formAction, pending] = useActionState(loginAction, null);
  const { branding } = useBranding();

  return (
    <Box
      sx={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        bgcolor: "background.default",
        p: 2,
      }}
    >
      <Paper sx={{ p: 4, width: "100%", maxWidth: 360 }} component="form" action={formAction}>
        <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", mb: 2, gap: 1.5 }}>
          {branding.brandLogo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={branding.brandLogo}
              alt={branding.brandName}
              height={56}
              style={{
                height: 56,
                width: "auto",
                maxWidth: 240,
                objectFit: "contain",
                borderRadius: 8,
                display: "block",
              }}
            />
          ) : null}
          <Typography variant="h5" textAlign="center">
            {branding.brandName}
          </Typography>
        </Box>
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

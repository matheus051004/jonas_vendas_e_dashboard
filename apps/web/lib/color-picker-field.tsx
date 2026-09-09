"use client";

import * as React from "react";
import { Box, TextField, Typography } from "@mui/material";

type Props = {
  label: string;
  value: string;
  onChange: (hex: string) => void;
  helperText?: string;
  error?: boolean;
};

/** Color picker nativo + campo hex (#RRGGBB). */
export function ColorPickerField({ label, value, onChange, helperText, error }: Props) {
  const safe = /^#([0-9A-Fa-f]{6})$/.test(value) ? value : "#000000";

  return (
    <Box>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 0.75 }}>
        {label}
      </Typography>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
        <Box
          component="label"
          sx={{
            width: 48,
            height: 48,
            borderRadius: 1,
            border: 1,
            borderColor: error ? "error.main" : "divider",
            overflow: "hidden",
            cursor: "pointer",
            flexShrink: 0,
            position: "relative",
            bgcolor: safe,
            boxShadow: 1,
          }}
        >
          <input
            type="color"
            value={safe}
            aria-label={label}
            onChange={(e) => onChange(e.target.value.toLowerCase())}
            style={{
              position: "absolute",
              inset: 0,
              width: "100%",
              height: "100%",
              opacity: 0,
              cursor: "pointer",
              border: "none",
              padding: 0,
            }}
          />
        </Box>
        <TextField
          size="small"
          value={value}
          error={error}
          helperText={helperText}
          onChange={(e) => {
            let v = e.target.value.trim();
            if (v && !v.startsWith("#")) v = `#${v}`;
            onChange(v.toLowerCase());
          }}
          inputProps={{ maxLength: 7, spellCheck: false, style: { fontFamily: "monospace" } }}
          sx={{ minWidth: 120 }}
        />
      </Box>
    </Box>
  );
}

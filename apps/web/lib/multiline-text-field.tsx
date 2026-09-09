import { TextField, type TextFieldProps } from "@mui/material";

type MultilineTextFieldProps = Omit<TextFieldProps, "multiline">;

export const resizableTextareaSx = {
  "& .MuiInputBase-inputMultiline": {
    lineHeight: 1.5,
    resize: "vertical",
  },
};

export function MultilineTextField({ minRows = 3, rows, sx, ...props }: MultilineTextFieldProps) {
  return (
    <TextField
      multiline
      {...(rows !== undefined ? { rows } : { minRows })}
      sx={{ ...resizableTextareaSx, ...sx }}
      {...props}
    />
  );
}
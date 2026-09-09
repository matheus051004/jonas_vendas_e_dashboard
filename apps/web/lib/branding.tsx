"use client";

import * as React from "react";
import { createTheme, ThemeProvider, type Theme } from "@mui/material";

export type Branding = {
  brandName: string;
  brandLogo: string | null;
  colorPrimary: string;
  colorSecondary: string;
  colorBackground: string;
};

export const DEFAULT_BRANDING: Branding = {
  brandName: "Painel de Vendas",
  brandLogo: null,
  colorPrimary: "#1565c0",
  colorSecondary: "#9c27b0",
  colorBackground: "#f5f5f5",
};

type BrandingContextValue = {
  branding: Branding;
  /** Atualiza o tema após salvar em Configurações (sem recarregar a página). */
  setBranding: (next: Branding) => void;
  reloadBranding: () => Promise<void>;
  ready: boolean;
};

const BrandingContext = React.createContext<BrandingContextValue | null>(null);

function buildTheme(b: Branding): Theme {
  return createTheme({
    palette: {
      primary: { main: b.colorPrimary },
      secondary: { main: b.colorSecondary },
      background: {
        default: b.colorBackground,
        paper: "#ffffff",
      },
    },
  });
}

export function BrandingProvider({ children }: { children: React.ReactNode }) {
  const [branding, setBrandingState] = React.useState<Branding>(DEFAULT_BRANDING);
  const [ready, setReady] = React.useState(false);

  const reloadBranding = React.useCallback(async () => {
    try {
      const res = await fetch("/api/branding");
      if (!res.ok) return;
      const data = (await res.json()) as Partial<Branding>;
      setBrandingState({
        brandName: typeof data.brandName === "string" && data.brandName.trim() ? data.brandName : DEFAULT_BRANDING.brandName,
        brandLogo: typeof data.brandLogo === "string" && data.brandLogo ? data.brandLogo : null,
        colorPrimary:
          typeof data.colorPrimary === "string" && /^#([0-9A-Fa-f]{6})$/.test(data.colorPrimary)
            ? data.colorPrimary
            : DEFAULT_BRANDING.colorPrimary,
        colorSecondary:
          typeof data.colorSecondary === "string" && /^#([0-9A-Fa-f]{6})$/.test(data.colorSecondary)
            ? data.colorSecondary
            : DEFAULT_BRANDING.colorSecondary,
        colorBackground:
          typeof data.colorBackground === "string" && /^#([0-9A-Fa-f]{6})$/.test(data.colorBackground)
            ? data.colorBackground
            : DEFAULT_BRANDING.colorBackground,
      });
    } catch {
      // mantém defaults
    } finally {
      setReady(true);
    }
  }, []);

  React.useEffect(() => {
    void reloadBranding();
  }, [reloadBranding]);

  React.useEffect(() => {
    if (typeof document !== "undefined") {
      document.title = branding.brandName;
    }
  }, [branding.brandName]);

  const setBranding = React.useCallback((next: Branding) => {
    setBrandingState(next);
  }, []);

  const theme = React.useMemo(() => buildTheme(branding), [branding]);

  const value = React.useMemo(
    () => ({ branding, setBranding, reloadBranding, ready }),
    [branding, setBranding, reloadBranding, ready],
  );

  return (
    <BrandingContext.Provider value={value}>
      <ThemeProvider theme={theme}>{children}</ThemeProvider>
    </BrandingContext.Provider>
  );
}

export function useBranding(): BrandingContextValue {
  const ctx = React.useContext(BrandingContext);
  if (!ctx) {
    throw new Error("useBranding deve ser usado dentro de BrandingProvider");
  }
  return ctx;
}

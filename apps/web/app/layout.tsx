import type { Metadata } from "next";
import ThemeRegistry from "./theme-registry";

export const metadata: Metadata = {
  title: "Painel de Vendas",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>
        <ThemeRegistry>{children}</ThemeRegistry>
      </body>
    </html>
  );
}

-- Branding do painel (nome, logo data URL, paleta de cores).
ALTER TABLE "Settings" ADD COLUMN "brandName" TEXT NOT NULL DEFAULT 'Painel de Vendas';
ALTER TABLE "Settings" ADD COLUMN "brandLogo" TEXT;
ALTER TABLE "Settings" ADD COLUMN "colorPrimary" TEXT NOT NULL DEFAULT '#1565c0';
ALTER TABLE "Settings" ADD COLUMN "colorSecondary" TEXT NOT NULL DEFAULT '#9c27b0';
ALTER TABLE "Settings" ADD COLUMN "colorBackground" TEXT NOT NULL DEFAULT '#f5f5f5';

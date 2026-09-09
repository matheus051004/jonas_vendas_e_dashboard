import { NextResponse } from "next/server";
import { getSettings } from "@jonas/shared";

/** Campos públicos de aparência (login + tema do painel). Sem segredos. */
export async function GET() {
  const settings = await getSettings();
  return NextResponse.json({
    brandName: settings.brandName,
    brandLogo: settings.brandLogo,
    colorPrimary: settings.colorPrimary,
    colorSecondary: settings.colorSecondary,
    colorBackground: settings.colorBackground,
  });
}

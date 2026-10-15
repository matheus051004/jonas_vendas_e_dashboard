import { NextResponse } from "next/server";
import { pauseProspecting } from "@jonas/shared";

export async function POST() {
  try {
    await pauseProspecting();
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[api/prospeccao/pause] Erro ao pausar prospecção:", err);
    const message = err instanceof Error ? err.message : "Erro ao pausar prospecção";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

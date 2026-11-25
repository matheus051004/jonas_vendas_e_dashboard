import { NextResponse, type NextRequest } from "next/server";
import { startProspecting } from "@jonas/shared";
import { z } from "zod";

const StartBodySchema = z.object({
  leadIds: z.array(z.string().min(1)).min(1, "Selecione ao menos um lead válido").optional(),
});

export async function POST(req: NextRequest) {
  const rawText = await req.text();
  let body: unknown = {};
  if (rawText.trim()) {
    try {
      body = JSON.parse(rawText);
    } catch {
      return NextResponse.json({ ok: false, error: "JSON inválido" }, { status: 400 });
    }
  }

  const parsed = StartBodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: "Parâmetros inválidos para iniciar prospecção.", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const leadIds = parsed.data.leadIds;

  try {
    const result = await startProspecting(leadIds);
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    console.error("[api/prospeccao/start] Erro ao iniciar prospecção:", err);
    const message = err instanceof Error ? err.message : "Erro ao iniciar prospecção";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

import { NextResponse, type NextRequest } from "next/server";
import { startProspecting } from "@jonas/shared";
import { z } from "zod";

const StartBodySchema = z.object({
  leadIds: z.array(z.string()).optional(),
});

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const parsed = StartBodySchema.safeParse(body);
  const leadIds = parsed.success ? parsed.data.leadIds : undefined;

  try {
    const result = await startProspecting(leadIds);
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    console.error("[api/prospeccao/start] Erro ao iniciar prospecção:", err);
    const message = err instanceof Error ? err.message : "Erro ao iniciar prospecção";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

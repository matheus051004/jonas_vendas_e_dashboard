import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { triggerFollowUp } from "@jonas/shared";

const ForceFollowUpBodySchema = z
  .object({
    attempt: z.number().int().min(1).max(20).optional(),
  })
  .optional();

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ clientId: string }> }
) {
  try {
    const { clientId } = await params;
    if (!clientId) {
      return NextResponse.json({ error: "clientId obrigatório" }, { status: 400 });
    }

    const raw = await req.json().catch(() => ({}));
    const parsed = ForceFollowUpBodySchema.safeParse(raw);
    const attempt = parsed.success ? parsed.data?.attempt : undefined;

    const result = await triggerFollowUp(clientId, attempt);
    return NextResponse.json(result);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Erro ao forçar follow-up";
    const status = message.includes("não encontrado") ? 404 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}

import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { listElevenLabsAccountResources } from "@jonas/shared";

const ResourcesRequestSchema = z.object({
  apiKey: z.string().optional(),
  prefix: z.string().optional(),
  agentId: z.string().optional(),
});

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const parsed = ResourcesRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const resources = await listElevenLabsAccountResources(
      parsed.data.apiKey,
      parsed.data.prefix,
      parsed.data.agentId
    );
    return NextResponse.json({ ok: true, resources });
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "Erro ao consultar recursos na ElevenLabs.";
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}

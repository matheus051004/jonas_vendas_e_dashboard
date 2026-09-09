import { NextResponse, type NextRequest } from "next/server";
import { triggerFollowUp } from "@jonas/shared";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ clientId: string }> }
) {
  try {
    const { clientId } = await params;
    if (!clientId) {
      return NextResponse.json({ error: "clientId obrigatório" }, { status: 400 });
    }

    let attempt: 1 | 2 | 3 | undefined;
    try {
      const body = await req.json();
      if (body && typeof body.attempt === "number" && [1, 2, 3].includes(body.attempt)) {
        attempt = body.attempt as 1 | 2 | 3;
      }
    } catch {
      // Body opcional, ignora se não tiver JSON
    }

    const result = await triggerFollowUp(clientId, attempt);
    return NextResponse.json(result);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Erro ao forçar follow-up";
    const status = message.includes("não encontrado") ? 404 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}

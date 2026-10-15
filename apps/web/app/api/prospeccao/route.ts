import { NextResponse, type NextRequest } from "next/server";
import {
  listProspectLeads,
  getProspectMetrics,
  createProspectLead,
  deleteManyProspectLeads,
  ProspectLeadSchema,
  ProspectStatus,
} from "@jonas/shared";
import { z } from "zod";

const DeleteManySchema = z.object({
  ids: z.array(z.string()).min(1, "Selecione ao menos um lead para excluir"),
});

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const page = parseInt(searchParams.get("page") || "1", 10);
  const pageSize = parseInt(searchParams.get("pageSize") || "25", 10);
  const search = searchParams.get("search") || undefined;
  const statusParam = searchParams.get("status");

  let status: ProspectStatus | undefined = undefined;
  if (statusParam && Object.values(ProspectStatus).includes(statusParam as ProspectStatus)) {
    status = statusParam as ProspectStatus;
  }

  const [result, metrics] = await Promise.all([
    listProspectLeads({ page, pageSize, search, status }),
    getProspectMetrics(),
  ]);

  return NextResponse.json({
    ok: true,
    ...result,
    metrics,
  });
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const parsed = ProspectLeadSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const lead = await createProspectLead(parsed.data);
    return NextResponse.json({ ok: true, lead }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro ao cadastrar lead";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function DELETE(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const parsed = DeleteManySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const result = await deleteManyProspectLeads(parsed.data.ids);
  return NextResponse.json({ ok: true, count: result.count });
}

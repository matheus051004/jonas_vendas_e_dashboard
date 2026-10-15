import { NextResponse, type NextRequest } from "next/server";
import { prisma, ProspectStatus } from "@jonas/db";
import { updateProspectLead, deleteProspectLead } from "@jonas/shared";
import { z } from "zod";

const UpdateLeadSchema = z.object({
  name: z.string().optional(),
  phone: z.string().optional(),
  secondaryPhone: z.string().optional().nullable(),
  email: z.string().optional().nullable(),
  rawDocument: z.string().optional().nullable(),
  street: z.string().optional().nullable(),
  number: z.string().optional().nullable(),
  complement: z.string().optional().nullable(),
  neighborhood: z.string().optional().nullable(),
  city: z.string().optional().nullable(),
  state: z.string().optional().nullable(),
  cep: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  status: z.nativeEnum(ProspectStatus).optional(),
});

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const lead = await prisma.prospectLead.findUnique({
    where: { id },
    include: { client: true },
  });

  if (!lead) {
    return NextResponse.json({ error: "Lead não encontrado" }, { status: 404 });
  }

  return NextResponse.json({ ok: true, lead });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await req.json().catch(() => null);
  const parsed = UpdateLeadSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const updated = await updateProspectLead(id, parsed.data);
    return NextResponse.json({ ok: true, lead: updated });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro ao atualizar lead";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    await deleteProspectLead(id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro ao excluir lead";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

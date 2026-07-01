import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@jonas/db";

const CepUpdateSchema = z.object({
  code: z.string().min(1).optional(),
  city: z.string().optional(),
  active: z.boolean().optional(),
  planIds: z.array(z.string()).optional(),
});

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json().catch(() => null);
  const parsed = CepUpdateSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const { planIds, ...data } = parsed.data;
  const cep = await prisma.$transaction(async (tx) => {
    if (planIds) {
      await tx.cepPlan.deleteMany({ where: { cepId: id } });
      await tx.cepPlan.createMany({ data: planIds.map((planId) => ({ cepId: id, planId })) });
    }
    return tx.cep.update({ where: { id }, data, include: { plans: { include: { plan: true } } } });
  });

  return NextResponse.json(cep);
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await prisma.cep.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}

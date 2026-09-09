import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@jonas/db";

const AreaUpdateSchema = z.object({
  name: z.string().min(1).optional(),
  observation: z.string().optional().nullable(),
  active: z.boolean().optional(),
  planIds: z.array(z.string()).optional(),
});

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json().catch(() => null);
  const parsed = AreaUpdateSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const { planIds, ...data } = parsed.data;
  const area = await prisma.$transaction(async (tx) => {
    if (planIds) {
      await tx.areaPlan.deleteMany({ where: { areaId: id } });
      await tx.areaPlan.createMany({ data: planIds.map((planId) => ({ areaId: id, planId })) });
    }
    return tx.area.update({
      where: { id },
      data: {
        ...data,
        ...(data.observation !== undefined ? { observation: data.observation || null } : {}),
      },
      include: { plans: { include: { plan: true } } },
    });
  });

  return NextResponse.json(area);
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await prisma.area.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}

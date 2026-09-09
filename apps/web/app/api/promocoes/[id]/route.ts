import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@jonas/db";

const PromotionUpdateSchema = z.object({
  name: z.string().min(1, "Informe o nome").optional(),
  description: z.string().optional(),
  hubsoftPromotionId: z.number().int().positive().nullable().optional(),
  active: z.boolean().optional(),
  planIds: z.array(z.string()).optional(),
});

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json().catch(() => null);
  const parsed = PromotionUpdateSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const { planIds, ...data } = parsed.data;
  const promo = await prisma.$transaction(async (tx) => {
    if (planIds) {
      await tx.planPromotion.deleteMany({ where: { promotionId: id } });
      await tx.planPromotion.createMany({ data: planIds.map((planId) => ({ planId, promotionId: id })) });
    }
    return tx.promotion.update({
      where: { id },
      data,
      include: { plans: { include: { plan: true } } },
    });
  });

  return NextResponse.json(promo);
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await prisma.promotion.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}

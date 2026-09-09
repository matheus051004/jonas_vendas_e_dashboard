import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@jonas/db";

const PlanUpdateSchema = z.object({
  name: z.string().min(1, "Informe o nome").optional(),
  price: z.number().positive("Informe um valor sem fidelidade maior que zero").optional(),
  priceWithLoyalty: z.number().positive("Informe um valor com fidelidade maior que zero").nullable().optional(),
  loyaltyMonths: z.number().int().min(0, "Informe meses de fidelidade válidos").optional(),
  description: z.string().min(1, "Informe a descrição").optional(),
  hubsoftServiceId: z.number().int().positive().nullable().optional(),
  active: z.boolean().optional(),
  areaIds: z.array(z.string()).optional(),
  packageIds: z.array(z.string()).optional(),
  promotionIds: z.array(z.string()).optional(),
});

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json().catch(() => null);
  const parsed = PlanUpdateSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const { areaIds, packageIds, promotionIds, ...data } = parsed.data;
  const plan = await prisma.$transaction(async (tx) => {
    if (areaIds) {
      await tx.areaPlan.deleteMany({ where: { planId: id } });
      await tx.areaPlan.createMany({ data: areaIds.map((areaId) => ({ areaId, planId: id })) });
    }
    if (packageIds) {
      await tx.planPackage.deleteMany({ where: { planId: id } });
      await tx.planPackage.createMany({ data: packageIds.map((packageId) => ({ packageId, planId: id })) });
    }
    if (promotionIds) {
      await tx.planPromotion.deleteMany({ where: { planId: id } });
      await tx.planPromotion.createMany({ data: promotionIds.map((promotionId) => ({ promotionId, planId: id })) });
    }
    return tx.plan.update({
      where: { id },
      data,
      include: {
        areas: { include: { area: true } },
        packages: { include: { package: true } },
        promotions: { include: { promotion: true } },
      },
    });
  });

  return NextResponse.json(plan);
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await prisma.plan.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}

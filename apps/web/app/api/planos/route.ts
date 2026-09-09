import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@jonas/db";

const PlanSchema = z.object({
  name: z.string().min(1, "Informe o nome"),
  price: z.number().positive("Informe um valor sem fidelidade maior que zero"),
  priceWithLoyalty: z.number().positive("Informe um valor com fidelidade maior que zero").nullable().optional(),
  loyaltyMonths: z.number().int().min(0, "Informe meses de fidelidade válidos"),
  description: z.string().min(1, "Informe a descrição"),
  hubsoftServiceId: z.number().int().positive().nullable().optional(),
  active: z.boolean().optional(),
  areaIds: z.array(z.string()).default([]),
  packageIds: z.array(z.string()).default([]),
  promotionIds: z.array(z.string()).default([]),
});

export async function GET() {
  const plans = await prisma.plan.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      areas: { include: { area: true } },
      packages: { include: { package: true } },
      promotions: { include: { promotion: true } },
    },
  });
  return NextResponse.json(plans);
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const parsed = PlanSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const { areaIds, packageIds = [], promotionIds = [], ...data } = parsed.data;
  const plan = await prisma.plan.create({
    data: {
      ...data,
      areas: { create: areaIds.map((areaId) => ({ areaId })) },
      packages: { create: packageIds.map((packageId) => ({ packageId })) },
      promotions: { create: promotionIds.map((promotionId) => ({ promotionId })) },
    },
    include: {
      areas: { include: { area: true } },
      packages: { include: { package: true } },
      promotions: { include: { promotion: true } },
    },
  });
  return NextResponse.json(plan, { status: 201 });
}

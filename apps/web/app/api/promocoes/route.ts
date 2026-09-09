import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@jonas/db";

const PromotionSchema = z.object({
  name: z.string().min(1, "Informe o nome"),
  description: z.string().optional().default(""),
  hubsoftPromotionId: z.number().int().positive().nullable().optional(),
  active: z.boolean().optional(),
  planIds: z.array(z.string()).default([]),
});

export async function GET() {
  const promotions = await prisma.promotion.findMany({
    orderBy: { createdAt: "desc" },
    include: { plans: { include: { plan: true } } },
  });
  return NextResponse.json(promotions);
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const parsed = PromotionSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const { planIds = [], ...data } = parsed.data;
  const promo = await prisma.promotion.create({
    data: {
      ...data,
      plans: { create: planIds.map((planId) => ({ planId })) },
    },
    include: { plans: { include: { plan: true } } },
  });
  return NextResponse.json(promo, { status: 201 });
}

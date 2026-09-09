import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@jonas/db";

const AreaSchema = z.object({
  name: z.string().min(1),
  observation: z.string().optional().nullable(),
  active: z.boolean().optional(),
  planIds: z.array(z.string()).default([]),
});

export async function GET() {
  const areas = await prisma.area.findMany({
    orderBy: { createdAt: "desc" },
    include: { plans: { include: { plan: true } } },
  });
  return NextResponse.json(areas);
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const parsed = AreaSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const { planIds, ...data } = parsed.data;
  const area = await prisma.area.create({
    data: {
      ...data,
      observation: data.observation || null,
      plans: { create: planIds.map((planId) => ({ planId })) },
    },
    include: { plans: { include: { plan: true } } },
  });
  return NextResponse.json(area, { status: 201 });
}

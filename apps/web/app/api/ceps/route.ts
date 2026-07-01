import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@jonas/db";

const CepSchema = z.object({
  code: z.string().min(1),
  city: z.string().optional(),
  active: z.boolean().optional(),
  planIds: z.array(z.string()).default([]),
});

export async function GET() {
  const ceps = await prisma.cep.findMany({
    orderBy: { createdAt: "desc" },
    include: { plans: { include: { plan: true } } },
  });
  return NextResponse.json(ceps);
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const parsed = CepSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const { planIds, ...data } = parsed.data;
  const cep = await prisma.cep.create({
    data: { ...data, plans: { create: planIds.map((planId) => ({ planId })) } },
    include: { plans: { include: { plan: true } } },
  });
  return NextResponse.json(cep, { status: 201 });
}

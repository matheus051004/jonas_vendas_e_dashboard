import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@jonas/db";

const PlanSchema = z.object({
  name: z.string().min(1),
  price: z.number().positive(),
  loyaltyMonths: z.number().int().min(0),
  description: z.string().min(1),
  active: z.boolean().optional(),
});

export async function GET() {
  const plans = await prisma.plan.findMany({ orderBy: { createdAt: "desc" } });
  return NextResponse.json(plans);
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const parsed = PlanSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const plan = await prisma.plan.create({ data: parsed.data });
  return NextResponse.json(plan, { status: 201 });
}

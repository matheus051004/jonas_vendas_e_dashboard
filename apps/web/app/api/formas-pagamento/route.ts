import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@jonas/db";

const PaymentMethodSchema = z.object({
  name: z.string().min(1, "Informe o nome"),
  description: z.string().optional().default(""),
  hubsoftId: z.coerce
    .number({ invalid_type_error: "Informe o ID do Hubsoft" })
    .int("O ID do Hubsoft deve ser um número inteiro")
    .positive("O ID do Hubsoft deve ser maior que zero"),
  active: z.boolean().optional().default(true),
});

export async function GET() {
  const paymentMethods = await prisma.paymentMethod.findMany({
    orderBy: { name: "asc" },
    include: { _count: { select: { plans: true } } },
  });
  return NextResponse.json(paymentMethods);
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const parsed = PaymentMethodSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const paymentMethod = await prisma.paymentMethod.create({
    data: parsed.data,
    include: { _count: { select: { plans: true } } },
  });
  return NextResponse.json(paymentMethod, { status: 201 });
}

import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@jonas/db";

const PaymentMethodUpdateSchema = z.object({
  name: z.string().min(1, "Informe o nome").optional(),
  description: z.string().optional(),
  hubsoftId: z.coerce
    .number({ invalid_type_error: "Informe o ID do Hubsoft" })
    .int("O ID do Hubsoft deve ser um número inteiro")
    .positive("O ID do Hubsoft deve ser maior que zero")
    .optional(),
  active: z.boolean().optional(),
});

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const paymentMethod = await prisma.paymentMethod.findUnique({
    where: { id },
    include: { _count: { select: { plans: true } } },
  });
  if (!paymentMethod) return NextResponse.json({ error: "Forma de pagamento não encontrada" }, { status: 404 });
  return NextResponse.json(paymentMethod);
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json().catch(() => null);
  const parsed = PaymentMethodUpdateSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const paymentMethod = await prisma.paymentMethod.update({
    where: { id },
    data: parsed.data,
    include: { _count: { select: { plans: true } } },
  });
  return NextResponse.json(paymentMethod);
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await prisma.paymentMethod.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}

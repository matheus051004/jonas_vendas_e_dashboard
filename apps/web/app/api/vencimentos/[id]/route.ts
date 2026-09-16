import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@jonas/db";

const DueDateUpdateSchema = z.object({
  day: z.coerce
    .number({ invalid_type_error: "Informe um dia válido" })
    .int("O dia deve ser um número inteiro")
    .min(1, "O dia deve ser entre 1 e 31")
    .max(31, "O dia deve ser entre 1 e 31")
    .optional(),
  hubsoftId: z.coerce
    .number({ invalid_type_error: "Informe o ID do Hubsoft" })
    .int("O ID do Hubsoft deve ser um número inteiro")
    .positive("O ID do Hubsoft deve ser maior que zero")
    .optional(),
  active: z.boolean().optional(),
});

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const dueDate = await prisma.dueDate.findUnique({
    where: { id },
    include: { _count: { select: { contracts: true } } },
  });
  if (!dueDate) return NextResponse.json({ error: "Vencimento não encontrado" }, { status: 404 });
  return NextResponse.json(dueDate);
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json().catch(() => null);
  const parsed = DueDateUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  if (parsed.data.day !== undefined) {
    const existing = await prisma.dueDate.findFirst({
      where: {
        day: parsed.data.day,
        NOT: { id },
      },
    });
    if (existing) {
      return NextResponse.json(
        {
          error: {
            formErrors: [`O dia de vencimento ${parsed.data.day} já está cadastrado em outro registro.`],
            fieldErrors: { day: ["Este dia já está cadastrado."] },
          },
        },
        { status: 400 }
      );
    }
  }

  const dueDate = await prisma.dueDate.update({
    where: { id },
    data: parsed.data,
    include: { _count: { select: { contracts: true } } },
  });
  return NextResponse.json(dueDate);
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await prisma.dueDate.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}

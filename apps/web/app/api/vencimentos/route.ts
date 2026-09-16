import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@jonas/db";

const DueDateCreateSchema = z.object({
  day: z.coerce
    .number({ invalid_type_error: "Informe um dia válido" })
    .int("O dia deve ser um número inteiro")
    .min(1, "O dia deve ser entre 1 e 31")
    .max(31, "O dia deve ser entre 1 e 31"),
  hubsoftId: z.coerce
    .number({ invalid_type_error: "Informe o ID do Hubsoft" })
    .int("O ID do Hubsoft deve ser um número inteiro")
    .positive("O ID do Hubsoft deve ser maior que zero"),
  active: z.boolean().default(true),
});

export async function GET() {
  const dueDates = await prisma.dueDate.findMany({
    orderBy: { day: "asc" },
    include: { _count: { select: { contracts: true } } },
  });
  return NextResponse.json(dueDates);
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const parsed = DueDateCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const existing = await prisma.dueDate.findUnique({
    where: { day: parsed.data.day },
  });

  if (existing) {
    return NextResponse.json(
      {
        error: {
          formErrors: [`O dia de vencimento ${parsed.data.day} já está cadastrado.`],
          fieldErrors: { day: ["Este dia já está cadastrado."] },
        },
      },
      { status: 400 }
    );
  }

  const dueDate = await prisma.dueDate.create({
    data: parsed.data,
    include: { _count: { select: { contracts: true } } },
  });

  return NextResponse.json(dueDate, { status: 201 });
}

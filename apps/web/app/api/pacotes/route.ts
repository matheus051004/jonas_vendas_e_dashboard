import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@jonas/db";

const PackageSchema = z.object({
  name: z.string().min(1, "Informe o nome"),
  price: z.number().nonnegative("Informe um valor válido"),
  description: z.string().min(1, "Informe a descrição"),
  hubsoftPackageId: z.number().int().positive().nullable().optional(),
  active: z.boolean().optional(),
  planIds: z.array(z.string()).default([]),
});

export async function GET() {
  const packages = await prisma.package.findMany({
    orderBy: { createdAt: "desc" },
    include: { plans: { include: { plan: true } } },
  });
  return NextResponse.json(packages);
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const parsed = PackageSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const { planIds = [], ...data } = parsed.data;
  const pkg = await prisma.package.create({
    data: {
      ...data,
      plans: { create: planIds.map((planId) => ({ planId })) },
    },
    include: { plans: { include: { plan: true } } },
  });
  return NextResponse.json(pkg, { status: 201 });
}

import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@jonas/db";

const PackageUpdateSchema = z.object({
  name: z.string().min(1, "Informe o nome").optional(),
  price: z.number().nonnegative("Informe um valor válido").optional(),
  description: z.string().min(1, "Informe a descrição").optional(),
  hubsoftPackageId: z.number().int().positive().nullable().optional(),
  active: z.boolean().optional(),
  planIds: z.array(z.string()).optional(),
});

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json().catch(() => null);
  const parsed = PackageUpdateSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const { planIds, ...data } = parsed.data;
  const pkg = await prisma.$transaction(async (tx) => {
    if (planIds) {
      await tx.planPackage.deleteMany({ where: { packageId: id } });
      await tx.planPackage.createMany({ data: planIds.map((planId) => ({ planId, packageId: id })) });
    }
    return tx.package.update({
      where: { id },
      data,
      include: { plans: { include: { plan: true } } },
    });
  });

  return NextResponse.json(pkg);
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await prisma.package.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}

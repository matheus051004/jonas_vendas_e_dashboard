import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@jonas/db";

const OriginUpdateSchema = z.object({
  name: z.string().min(1).optional(),
  hubsoftOriginId: z.number().int().positive().nullable().optional(),
  active: z.boolean().optional(),
});

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json().catch(() => null);
  const parsed = OriginUpdateSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const origin = await prisma.origin.update({ where: { id }, data: parsed.data });
  return NextResponse.json(origin);
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await prisma.origin.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}

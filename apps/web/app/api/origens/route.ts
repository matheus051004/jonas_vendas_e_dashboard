import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@jonas/db";

const OriginSchema = z.object({
  name: z.string().min(1),
  hubsoftOriginId: z.number().int().positive().nullable().optional(),
  active: z.boolean().optional(),
});

export async function GET() {
  const origins = await prisma.origin.findMany({
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { clients: true } } },
  });
  return NextResponse.json(origins);
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const parsed = OriginSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const origin = await prisma.origin.create({ data: parsed.data });
  return NextResponse.json(origin, { status: 201 });
}

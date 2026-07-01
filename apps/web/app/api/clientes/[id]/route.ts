import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { prisma, SaleStage } from "@jonas/db";

const ClientUpdateSchema = z.object({
  stage: z.nativeEnum(SaleStage).optional(),
});

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const client = await prisma.client.findUnique({
    where: { id },
    include: {
      origin: { select: { name: true } },
      contract: true,
      messages: { orderBy: { createdAt: "asc" } },
    },
  });
  if (!client) return NextResponse.json({ error: "não encontrado" }, { status: 404 });
  return NextResponse.json(client);
}

// Usado pelo drag-and-drop do kanban pra mover a etapa manualmente.
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json().catch(() => null);
  const parsed = ClientUpdateSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const client = await prisma.client.update({ where: { id }, data: parsed.data });
  return NextResponse.json(client);
}

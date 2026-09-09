import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { prisma, SaleStage } from "@jonas/db";

const ClientUpdateSchema = z.object({
  stage: z.nativeEnum(SaleStage).optional(),
  name: z.string().optional(),
  areaId: z.string().nullish(),
  originId: z.string().nullish(),
  currentProvider: z.string().nullish(),
  currentPrice: z.number().nonnegative().nullish(),
  hadBadExperience: z.boolean().nullish(),
  badExperienceNote: z.string().nullish(),
});

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const client = await prisma.client.findUnique({
    where: { id },
    include: {
      origin: { select: { name: true } },
      area: { select: { id: true, name: true } },
      contract: {
        include: {
          plan: true,
          packages: { include: { package: true } },
        },
      },
      messages: {
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          role: true,
          content: true,
          kind: true,
          audioMimeType: true,
          createdAt: true,
        },
      },
    },
  });
  if (!client) return NextResponse.json({ error: "não encontrado" }, { status: 404 });

  // Não serializa o binário do áudio no JSON — flag + endpoint dedicado.
  return NextResponse.json({
    ...client,
    messages: client.messages.map((m) => ({
      id: m.id,
      role: m.role,
      content: m.content,
      kind: m.kind,
      hasAudio: m.audioMimeType != null,
      createdAt: m.createdAt,
    })),
  });
}

// Usado pelo drag-and-drop do kanban pra mover a etapa manualmente,
// e pela página de clientes pra editar os dados do lead.
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json().catch(() => null);
  const parsed = ClientUpdateSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const client = await prisma.client.update({ where: { id }, data: parsed.data });
  return NextResponse.json(client);
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await prisma.client.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}

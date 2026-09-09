import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@jonas/db";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ clientId: string }> }
) {
  const { clientId } = await params;

  const client = await prisma.client.findUnique({
    where: { id: clientId },
    include: {
      origin: { select: { name: true } },
      area: { select: { name: true } },
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

  if (!client) {
    return NextResponse.json({ error: "não encontrado" }, { status: 404 });
  }

  return NextResponse.json({
    id: client.id,
    name: client.name,
    phone: client.phone,
    stage: client.stage,
    origin: client.origin,
    area: client.area,
    followUpCount: client.followUpCount,
    messages: client.messages.map((m) => ({
      id: m.id,
      role: m.role,
      content: m.content,
      kind: m.kind,
      hasAudio: m.audioMimeType != null,
      createdAt: m.createdAt.toISOString(),
    })),
  });
}

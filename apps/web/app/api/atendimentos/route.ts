import { NextResponse } from "next/server";
import { prisma } from "@jonas/db";

export async function GET() {
  const clients = await prisma.client.findMany({
    where: { messages: { some: {} } },
    include: {
      messages: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: {
          id: true,
          role: true,
          content: true,
          kind: true,
          createdAt: true,
        },
      },
      origin: { select: { name: true } },
      area: { select: { name: true } },
    },
  });

  const conversations = clients
    .map((c) => {
      const last = c.messages[0];
      if (!last) return null;
      return {
        id: c.id,
        name: c.name,
        phone: c.phone,
        stage: c.stage,
        origin: c.origin,
        area: c.area,
        followUpCount: c.followUpCount,
        lastMessage: {
          id: last.id,
          role: last.role,
          content: last.content,
          kind: last.kind,
          createdAt: last.createdAt.toISOString(),
        },
      };
    })
    .filter((c): c is NonNullable<typeof c> => c !== null)
    .sort(
      (a, b) =>
        new Date(b.lastMessage.createdAt).getTime() - new Date(a.lastMessage.createdAt).getTime()
    );

  return NextResponse.json(conversations);
}

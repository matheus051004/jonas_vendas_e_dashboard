import { NextResponse } from "next/server";
import { prisma } from "@jonas/db";

export async function GET() {
  const clients = await prisma.client.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      origin: { select: { name: true } },
      area: { select: { id: true, name: true } },
    },
  });
  return NextResponse.json(clients);
}

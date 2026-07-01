import { NextResponse } from "next/server";
import { prisma } from "@jonas/db";

export async function GET() {
  const byStage = await prisma.client.groupBy({ by: ["stage"], _count: true });
  const total = await prisma.client.count();

  return NextResponse.json({
    total,
    byStage: byStage.map((s) => ({ stage: s.stage, count: s._count })),
  });
}

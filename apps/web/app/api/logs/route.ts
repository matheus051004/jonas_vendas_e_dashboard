import { NextResponse, type NextRequest } from "next/server";
import { getSystemLogs, clearSystemLogs, addSystemLog } from "@jonas/shared";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const limit = parseInt(searchParams.get("limit") ?? "200", 10);
  const logs = await getSystemLogs(limit);
  return NextResponse.json({ ok: true, logs });
}

export async function DELETE() {
  await clearSystemLogs();
  return NextResponse.json({ ok: true });
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body || !body.message) {
    return NextResponse.json({ error: "message é obrigatório" }, { status: 400 });
  }
  const entry = await addSystemLog({
    level: body.level || "info",
    source: body.source || "manual",
    message: body.message,
    phone: body.phone,
    payload: body.payload,
    details: body.details,
  });
  return NextResponse.json({ ok: true, log: entry });
}

import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@jonas/db";

/** Serve o áudio original de uma mensagem (somente se autenticado via middleware). */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const message = await prisma.message.findUnique({
    where: { id },
    select: {
      kind: true,
      audioData: true,
      audioMimeType: true,
    },
  });

  if (!message || !message.audioData) {
    return NextResponse.json({ error: "áudio não encontrado" }, { status: 404 });
  }

  const body = new Uint8Array(message.audioData);
  const contentType = message.audioMimeType || "audio/ogg";

  return new NextResponse(body, {
    status: 200,
    headers: {
      "Content-Type": contentType,
      "Content-Length": String(body.byteLength),
      "Cache-Control": "private, max-age=3600",
      "Accept-Ranges": "bytes",
    },
  });
}

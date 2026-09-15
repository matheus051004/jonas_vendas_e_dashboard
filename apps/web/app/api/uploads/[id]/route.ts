import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@jonas/db";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const upload = await prisma.upload.findUnique({
    where: { id },
  });

  if (!upload) {
    return NextResponse.json({ error: "upload não encontrado" }, { status: 404 });
  }

  const safeFilename = encodeURIComponent(upload.filename).replace(/['()]/g, escape);

  return new NextResponse(new Uint8Array(upload.data), {
    status: 200,
    headers: {
      "Content-Type": upload.mimeType,
      "Content-Length": String(upload.size),
      "Content-Disposition": `inline; filename="${safeFilename}"`,
      "Cache-Control": "public, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

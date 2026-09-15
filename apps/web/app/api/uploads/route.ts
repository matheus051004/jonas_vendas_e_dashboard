import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@jonas/db";
import { COOKIE_NAME, verifySessionToken } from "@/lib/auth";

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_MIME_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];

export async function POST(req: NextRequest) {
  const token = req.cookies.get(COOKIE_NAME)?.value;
  if (!token || !(await verifySessionToken(token))) {
    return NextResponse.json({ error: "não autenticado" }, { status: 401 });
  }

  const formData = await req.formData().catch(() => null);
  if (!formData) {
    return NextResponse.json({ error: "requisição inválida" }, { status: 400 });
  }

  const file = formData.get("file");
  if (!file || !(file instanceof File)) {
    return NextResponse.json({ error: "arquivo não enviado" }, { status: 400 });
  }

  if (!file.type || !ALLOWED_MIME_TYPES.includes(file.type)) {
    return NextResponse.json(
      { error: "formato de imagem inválido. Formatos aceitos: JPEG, PNG, WebP e GIF." },
      { status: 400 }
    );
  }

  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json({ error: "o arquivo excede o tamanho máximo de 10MB" }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const upload = await prisma.upload.create({
    data: {
      filename: file.name || "imagem",
      mimeType: file.type,
      data: buffer,
      size: buffer.byteLength,
    },
  });

  return NextResponse.json(
    {
      ok: true,
      url: `/api/uploads/${upload.id}`,
      id: upload.id,
      filename: upload.filename,
      mimeType: upload.mimeType,
      size: upload.size,
    },
    { status: 201 }
  );
}

import { NextResponse, type NextRequest } from "next/server";
import { importLeadsFromXlsxBuffer } from "@jonas/shared";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const rawFile = formData.get("file");

    if (!(rawFile instanceof File)) {
      return NextResponse.json({ error: "Nenhum arquivo enviado" }, { status: 400 });
    }
    const file = rawFile;

    const lowerName = file.name.toLowerCase();
    if (
      !lowerName.endsWith(".xlsx") &&
      !lowerName.endsWith(".xls") &&
      file.type !== "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" &&
      file.type !== "application/vnd.ms-excel"
    ) {
      return NextResponse.json(
        { error: "Formato inválido. Por favor, envie um arquivo Excel (.xlsx ou .xls)" },
        { status: 400 }
      );
    }

    const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20 MB
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: "Arquivo muito grande. O tamanho máximo permitido é de 20 MB." },
        { status: 400 }
      );
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const result = await importLeadsFromXlsxBuffer(buffer);

    return NextResponse.json({
      ok: true,
      ...result,
    });
  } catch (err) {
    console.error("[api/prospeccao/import] Erro ao importar planilha:", err);
    const message = err instanceof Error ? err.message : "Erro ao processar planilha";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

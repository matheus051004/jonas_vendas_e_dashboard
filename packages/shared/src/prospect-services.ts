import * as xlsx from "xlsx";
import { prisma, ProspectStatus, SaleStage, type ProspectLead } from "@jonas/db";
import {
  prospectingQueue,
  createRedisClient,
  redisConnection,
} from "./queue";
import { updateSettings, getSettings } from "./settings";
import { sendProspectingWebhook } from "./webhooks";
import { addSystemLog } from "./logger";
import type { ProspectLeadInput } from "./types";

/**
 * Normaliza um telefone brasileiro para o formato E.164 sem '+' (com DDI 55).
 * Ex: '61991640073' -> '5561991640073'
 * Ex: '(61) 98438-0780' -> '5561984380780'
 */
export function normalizePhone(raw: unknown): string {
  if (raw === null || raw === undefined) return "";
  const clean = String(raw).replace(/\D/g, "");
  if (!clean) return "";

  // Se já tem 55 e tem 12 ou 13 dígitos
  if (clean.startsWith("55") && (clean.length === 12 || clean.length === 13)) {
    return clean;
  }
  // Se tem DDD (2 dígitos) + 8 ou 9 dígitos (total 10 ou 11)
  if (clean.length === 10 || clean.length === 11) {
    return `55${clean}`;
  }
  return clean;
}

/**
 * Limpa o prefixo de documento/CNPJ do campo de Razão Social da planilha.
 * Ex: '10.666.669 CARLOS ROBERTO LOPES' -> { document: '10.666.669', name: 'CARLOS ROBERTO LOPES' }
 */
export function cleanNameAndDocument(raw: unknown): { name: string; document: string | null } {
  if (raw === null || raw === undefined) return { name: "", document: null };
  const str = String(raw).trim();
  if (!str) return { name: "", document: null };

  const match = str.match(/^([\d./-]+)\s+(.+)$/);
  if (match && match[1] && match[2]) {
    const doc = match[1].replace(/[^\d./-]/g, "");
    // Valida se parece um pedaço de documento/CNPJ
    if (doc.length >= 6) {
      return { document: doc, name: match[2].trim() };
    }
  }

  return { name: str, document: null };
}

export interface ImportResult {
  total: number;
  imported: number;
  skippedDuplicates: number;
  skippedInvalid: number;
}

/**
 * Lê uma planilha XLSX em buffer e importa leads para a tabela ProspectLead.
 * Ignora duplicados (mesmo telefone) já cadastrados ou repetidos na mesma planilha.
 */
export async function importLeadsFromXlsxBuffer(buffer: Buffer): Promise<ImportResult> {
  const workbook = xlsx.read(buffer, { type: "buffer" });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) {
    throw new Error("A planilha não contém nenhuma aba.");
  }

  const sheet = workbook.Sheets[sheetName];
  if (!sheet) {
    throw new Error("Aba da planilha vazia.");
  }

  // Converte a planilha em matriz de linhas (array de arrays)
  const rows: unknown[][] = xlsx.utils.sheet_to_json(sheet, {
    header: 1,
    defval: "",
    blankrows: false,
  });

  if (rows.length === 0) {
    return { total: 0, imported: 0, skippedDuplicates: 0, skippedInvalid: 0 };
  }

  const seenInSheet = new Set<string>();
  const toInsert: Array<{
    name: string;
    phone: string;
    secondaryPhone: string | null;
    email: string | null;
    rawDocument: string | null;
    street: string | null;
    number: string | null;
    complement: string | null;
    neighborhood: string | null;
    city: string | null;
    state: string | null;
    cep: string | null;
    status: ProspectStatus;
  }> = [];

  let skippedDuplicates = 0;
  let skippedInvalid = 0;
  let totalProcessed = 0;

  for (let rowIndex = 0; rowIndex < rows.length; rowIndex++) {
    const row = rows[rowIndex];
    if (!Array.isArray(row) || row.length === 0) continue;

    // Coluna K (índice 10) = Telefone Principal
    const rawPhone = row[10];
    const phone = normalizePhone(rawPhone);

    // Se for cabeçalho (ex: texto 'telefone', 'celular') ou vazio
    if (!phone || phone.length < 10) {
      if (rowIndex === 0) continue;
      skippedInvalid++;
      continue;
    }

    totalProcessed++;

    if (seenInSheet.has(phone)) {
      skippedDuplicates++;
      continue;
    }

    seenInSheet.add(phone);

    // Coluna A (índice 0) = Razão Social / Nome
    const colA = row[0];
    const { name: parsedName, document: parsedDoc } = cleanNameAndDocument(colA);
    const finalName = parsedName || `Lead ${phone}`;

    // Colunas de Endereço
    const tipoLogradouro = String(row[2] || "").trim(); // Col C
    const logradouro = String(row[3] || "").trim();     // Col D
    const street = [tipoLogradouro, logradouro].filter(Boolean).join(" ") || null;

    const number = String(row[4] || "").trim() || null;       // Col E
    const complement = String(row[5] || "").trim() || null;   // Col F
    const neighborhood = String(row[6] || "").trim() || null; // Col G
    const city = String(row[7] || "").trim() || null;         // Col H
    const state = String(row[8] || "").trim() || null;        // Col I
    const cep = String(row[9] || "").trim() || null;          // Col J

    // Coluna L (índice 11) = Telefone Secundário
    const rawPhone2 = row[11];
    const secondaryPhone = rawPhone2 ? normalizePhone(rawPhone2) || null : null;

    // Coluna M (índice 12) = Email
    const emailRaw = String(row[12] || "").trim();
    const email = emailRaw && emailRaw.includes("@") ? emailRaw : null;

    toInsert.push({
      name: finalName,
      phone,
      secondaryPhone,
      email,
      rawDocument: parsedDoc,
      street,
      number,
      complement,
      neighborhood,
      city,
      state,
      cep,
      status: ProspectStatus.PENDENTE,
    });
  }

  // Inserção em lotes de 1.000 para performance
  const CHUNK_SIZE = 1000;
  let importedCount = 0;
  for (let i = 0; i < toInsert.length; i += CHUNK_SIZE) {
    const chunk = toInsert.slice(i, i + CHUNK_SIZE);
    const result = await prisma.prospectLead.createMany({
      data: chunk,
      skipDuplicates: true,
    });
    importedCount += result.count;
  }

  skippedDuplicates += (toInsert.length - importedCount);

  return {
    total: totalProcessed,
    imported: importedCount,
    skippedDuplicates,
    skippedInvalid,
  };
}

export interface ListProspectLeadsParams {
  page?: number;
  pageSize?: number;
  search?: string;
  status?: ProspectStatus;
}

export async function listProspectLeads(params: ListProspectLeadsParams = {}) {
  const page = Math.max(1, params.page ?? 1);
  const pageSize = Math.min(200, Math.max(1, params.pageSize ?? 25));
  const skip = (page - 1) * pageSize;

  const where: Record<string, unknown> = {};

  if (params.status) {
    where.status = params.status;
  }

  if (params.search && params.search.trim()) {
    const s = params.search.trim();
    where.OR = [
      { name: { contains: s, mode: "insensitive" } },
      { phone: { contains: s } },
      { email: { contains: s, mode: "insensitive" } },
      { neighborhood: { contains: s, mode: "insensitive" } },
      { rawDocument: { contains: s } },
    ];
  }

  const [leads, total] = await Promise.all([
    prisma.prospectLead.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take: pageSize,
      include: {
        client: {
          select: {
            id: true,
            stage: true,
            currentProvider: true,
            currentPrice: true,
          },
        },
      },
    }),
    prisma.prospectLead.count({ where }),
  ]);

  return {
    leads,
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  };
}

export async function getProspectMetrics() {
  const [
    total,
    pending,
    calling,
    answered,
    notAnswered,
    textSent,
    error,
    settings,
  ] = await Promise.all([
    prisma.prospectLead.count(),
    prisma.prospectLead.count({ where: { status: ProspectStatus.PENDENTE } }),
    prisma.prospectLead.count({ where: { status: ProspectStatus.EM_CHAMADA } }),
    prisma.prospectLead.count({ where: { status: ProspectStatus.ATENDEU } }),
    prisma.prospectLead.count({ where: { status: ProspectStatus.NAO_ATENDEU } }),
    prisma.prospectLead.count({ where: { status: ProspectStatus.TEXTO_ENVIADO } }),
    prisma.prospectLead.count({ where: { status: ProspectStatus.ERRO } }),
    getSettings(),
  ]);

  return {
    total,
    pending,
    calling,
    answered,
    notAnswered,
    textSent,
    error,
    isProspectingActive: settings.isProspectingActive,
  };
}

export async function createProspectLead(data: ProspectLeadInput) {
  const phone = normalizePhone(data.phone);
  if (!phone) {
    throw new Error("Telefone inválido.");
  }

  const existing = await prisma.prospectLead.findUnique({ where: { phone } });
  if (existing) {
    throw new Error("Já existe um lead cadastrado com este telefone.");
  }

  return prisma.prospectLead.create({
    data: {
      name: data.name.trim(),
      phone,
      secondaryPhone: data.secondaryPhone ? normalizePhone(data.secondaryPhone) : null,
      email: data.email?.trim() || null,
      rawDocument: data.rawDocument?.trim() || null,
      street: data.street?.trim() || null,
      number: data.number?.trim() || null,
      complement: data.complement?.trim() || null,
      neighborhood: data.neighborhood?.trim() || null,
      city: data.city?.trim() || null,
      state: data.state?.trim() || null,
      cep: data.cep?.trim() || null,
      notes: data.notes?.trim() || null,
      status: ProspectStatus.PENDENTE,
    },
  });
}

export async function updateProspectLead(
  id: string,
  data: Partial<ProspectLeadInput & { status: ProspectStatus; notes: string | null }>
) {
  const updateData: Record<string, unknown> = {};

  if (data.name !== undefined) updateData.name = data.name.trim();
  if (data.phone !== undefined) {
    const p = normalizePhone(data.phone);
    if (!p) throw new Error("Telefone inválido.");
    updateData.phone = p;
  }
  if (data.secondaryPhone !== undefined) {
    updateData.secondaryPhone = data.secondaryPhone ? normalizePhone(data.secondaryPhone) : null;
  }
  if (data.email !== undefined) updateData.email = data.email?.trim() || null;
  if (data.rawDocument !== undefined) updateData.rawDocument = data.rawDocument?.trim() || null;
  if (data.street !== undefined) updateData.street = data.street?.trim() || null;
  if (data.number !== undefined) updateData.number = data.number?.trim() || null;
  if (data.complement !== undefined) updateData.complement = data.complement?.trim() || null;
  if (data.neighborhood !== undefined) updateData.neighborhood = data.neighborhood?.trim() || null;
  if (data.city !== undefined) updateData.city = data.city?.trim() || null;
  if (data.state !== undefined) updateData.state = data.state?.trim() || null;
  if (data.cep !== undefined) updateData.cep = data.cep?.trim() || null;
  if (data.notes !== undefined) updateData.notes = data.notes?.trim() || null;
  if (data.status !== undefined) updateData.status = data.status;

  return prisma.prospectLead.update({
    where: { id },
    data: updateData,
  });
}

export async function deleteProspectLead(id: string) {
  return prisma.prospectLead.delete({ where: { id } });
}

export async function deleteManyProspectLeads(ids: string[]) {
  if (!ids || ids.length === 0) return { count: 0 };
  return prisma.prospectLead.deleteMany({
    where: { id: { in: ids } },
  });
}

/**
 * Inicia a campanha de prospecção.
 * Se leadIds forem fornecidos, enfileira apenas estes; caso contrário, enfileira todos com status PENDENTE.
 */
export async function startProspecting(leadIds?: string[]): Promise<{ queuedCount: number }> {
  await updateSettings({ isProspectingActive: true });
  await prospectingQueue.resume();

  const where: Record<string, unknown> = {};
  if (leadIds && leadIds.length > 0) {
    where.id = { in: leadIds };
  } else {
    where.status = ProspectStatus.PENDENTE;
  }

  const leads = await prisma.prospectLead.findMany({
    where,
    select: { id: true },
    orderBy: { createdAt: "asc" },
  });

  for (const lead of leads) {
    await prospectingQueue.add(
      "call",
      { leadId: lead.id },
      {
        jobId: `prospect-${lead.id}-${Date.now()}`,
        removeOnComplete: true,
        removeOnFail: true,
      }
    );
  }

  await addSystemLog({
    level: "info",
    source: "prospecting",
    message: `Prospecção iniciada. ${leads.length} leads enfileirados.`,
    details: { count: leads.length, specificSelection: !!(leadIds && leadIds.length > 0) },
  });

  return { queuedCount: leads.length };
}

/**
 * Pausa a campanha de prospecção e pausa a fila BullMQ.
 */
export async function pauseProspecting(): Promise<void> {
  await updateSettings({ isProspectingActive: false });
  await prospectingQueue.pause();

  await addSystemLog({
    level: "info",
    source: "prospecting",
    message: "Prospecção pausada pelo operador.",
  });
}

/**
 * Publica o resultado da ligação de voz no Redis Pub/Sub para destravar o worker.
 */
export async function publishCallResult(phone: string, answered: boolean): Promise<number> {
  const normalized = normalizePhone(phone);
  const payload = JSON.stringify({ phone: normalized, answered });
  return redisConnection.publish(`prospect:call-result:${normalized}`, payload);
}

/**
 * Aguarda no Redis Pub/Sub o resultado de uma ligação com timeout padrão de 120s.
 */
export async function waitForCallResult(
  phone: string,
  timeoutMs = 120_000
): Promise<{ answered: boolean; timeout: boolean }> {
  const normalized = normalizePhone(phone);
  const channel = `prospect:call-result:${normalized}`;
  const subClient = createRedisClient();
  subClient.on("error", (err) => console.error("[waitForCallResult] Redis sub error:", err));

  return new Promise((resolve) => {
    let resolved = false;

    const timer = setTimeout(() => {
      if (resolved) return;
      resolved = true;
      cleanup();
      resolve({ answered: false, timeout: true });
    }, timeoutMs);

    const onMessage = (_chan: string, message: string) => {
      try {
        const data = JSON.parse(message);
        if (data && typeof data.answered === "boolean") {
          if (!resolved) {
            resolved = true;
            clearTimeout(timer);
            cleanup();
            resolve({ answered: data.answered, timeout: false });
          }
        }
      } catch (err) {
        console.error("[waitForCallResult] Erro ao parsear mensagem do pubsub:", err);
      }
    };

    const cleanup = () => {
      subClient.removeListener("message", onMessage);
      subClient.unsubscribe(channel).catch(() => {});
      subClient.quit().catch(() => {
        subClient.disconnect();
      });
    };

    subClient.on("message", onMessage);
    subClient.subscribe(channel).catch((err) => {
      console.error("[waitForCallResult] Falha ao se inscrever no canal:", err);
      if (!resolved) {
        resolved = true;
        clearTimeout(timer);
        cleanup();
        resolve({ answered: false, timeout: false });
      }
    });
  });
}

/**
 * Garante a criação ou atualização do Cliente na tabela Client antes de disparar o contato.
 * Assim as ferramentas de vendas da IA têm o cliente pronto no banco.
 */
export async function ensureClientForProspect(lead: ProspectLead) {
  const client = await prisma.client.upsert({
    where: { phone: lead.phone },
    update: {
      name: lead.name,
    },
    create: {
      phone: lead.phone,
      name: lead.name,
      stage: SaleStage.NOVO_LEAD,
      metadata: {
        rawDocument: lead.rawDocument,
        street: lead.street,
        number: lead.number,
        complement: lead.complement,
        neighborhood: lead.neighborhood,
        city: lead.city,
        state: lead.state,
        cep: lead.cep,
        email: lead.email,
        source: "prospeccao_planilha",
      },
    },
  });

  if (lead.clientId !== client.id) {
    await prisma.prospectLead.update({
      where: { id: lead.id },
      data: { clientId: client.id },
    });
  }

  return client;
}

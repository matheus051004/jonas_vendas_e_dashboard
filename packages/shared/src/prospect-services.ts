import * as xlsx from "xlsx";
import { prisma, ProspectStatus, SaleStage, type ProspectLead } from "@jonas/db";
import {
  prospectingQueue,
  createRedisClient,
  redisConnection,
} from "./queue";
import { updateSettings, getSettings } from "./settings";
import { sendProspectingTextWebhook } from "./webhooks";
import { addSystemLog } from "./logger";
import { saveMessage } from "./messages";
import type { ElevenLabsWebhookEvent, ProspectLeadInput } from "./types";

function normalizeSinglePhoneToken(raw: string): string {
  let clean = raw.replace(/\D/g, "");
  if (!clean) return "";

  // Remove prefixo internacional 00 (ex.: 005561991640073 -> 5561991640073)
  if (clean.startsWith("00") && clean.length >= 12) {
    clean = clean.slice(2);
  }

  // Remove zero à esquerda do DDD brasileiro (ex.: 061991640073 -> 61991640073)
  if (clean.startsWith("0") && (clean.length === 11 || clean.length === 12)) {
    clean = clean.slice(1);
  }

  // Se já tem DDI 55 com 12 (fixo) ou 13 (celular) dígitos
  if (clean.startsWith("55") && (clean.length === 12 || clean.length === 13)) {
    return clean;
  }

  // Se tem DDD (2 dígitos) + 8 ou 9 dígitos (total 10 ou 11) sem zero inicial
  if (!clean.startsWith("0") && (clean.length === 10 || clean.length === 11)) {
    return `55${clean}`;
  }

  // Outros formatos internacionais válidos (E.164: 10 a 15 dígitos, sem zero inicial e sem 55 malformado)
  if (!clean.startsWith("0") && !clean.startsWith("55") && clean.length >= 10 && clean.length <= 15) {
    return clean;
  }

  return "";
}

/**
 * Normaliza um telefone brasileiro para o formato E.164 sem '+' (com DDI 55).
 * Aceita células com múltiplos números separados por '/', ';', ',' ou quebra de linha.
 * Ex: '61991640073' -> '5561991640073'
 * Ex: '061 98438-0780' -> '5561984380780'
 */
export function normalizePhone(raw: unknown): string {
  if (raw === null || raw === undefined) return "";
  const str = String(raw).trim();
  if (!str) return "";

  const candidates = str.split(/[/;,|\n]+/);
  for (const candidate of candidates) {
    const normalized = normalizeSinglePhoneToken(candidate);
    if (normalized) return normalized;
  }

  return "";
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

interface XlsxColumnMap {
  name: number;
  document: number | null;
  streetType: number | null;
  street: number | null;
  number: number | null;
  complement: number | null;
  neighborhood: number | null;
  city: number | null;
  state: number | null;
  cep: number | null;
  phone: number;
  secondaryPhone: number | null;
  email: number | null;
}

const DEFAULT_XLSX_COLUMNS: XlsxColumnMap = {
  name: 0,
  document: null,
  streetType: 2,
  street: 3,
  number: 4,
  complement: 5,
  neighborhood: 6,
  city: 7,
  state: 8,
  cep: 9,
  phone: 10,
  secondaryPhone: 11,
  email: 12,
};

function normalizeHeaderCell(val: unknown): string {
  return String(val ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function detectXlsxColumns(firstRow: unknown[]): { columns: XlsxColumnMap; startRow: number } {
  // Se a coluna padrão de telefone na linha 0 já contém um número válido, a planilha não tem cabeçalho
  if (normalizePhone(firstRow[DEFAULT_XLSX_COLUMNS.phone])) {
    return { columns: DEFAULT_XLSX_COLUMNS, startRow: 0 };
  }

  const headers = firstRow.map(normalizeHeaderCell);
  const used = new Set<number>();

  const takeCol = (patterns: RegExp[]): number | null => {
    for (let i = 0; i < headers.length; i++) {
      if (used.has(i)) continue;
      const h = headers[i];
      // Cabeçalhos reais são curtos e não carregam CPF/CNPJ/telefones/CEPs numéricos
      if (!h || h.length > 40 || h.replace(/\D/g, "").length >= 4) continue;
      if (patterns.some((p) => p.test(h))) {
        used.add(i);
        return i;
      }
    }
    return null;
  };

  const phoneIdx = takeCol([
    /\b(telefone|celular|whatsapp|fone|phone|tel)\b/,
    /^ddd\s*tel/,
  ]);

  if (phoneIdx === null) {
    return { columns: DEFAULT_XLSX_COLUMNS, startRow: 0 };
  }

  const secondaryPhoneIdx = takeCol([
    /\b(telefone\s*2|celular\s*2|fone\s*2|tel\s*2|secundario|alternativo|telefone|celular|fone)\b/,
  ]);

  const matchedNameIdx = takeCol([/\b(razao\s*social|nome|empresa|cliente|lead|fantasia)\b/]);
  const fallbackNameIdx = !used.has(0) ? 0 : headers.findIndex((_, idx) => !used.has(idx));
  const nameIdx = matchedNameIdx ?? (fallbackNameIdx >= 0 ? fallbackNameIdx : 0);
  used.add(nameIdx);

  const documentIdx = takeCol([/\b(cnpj|cpf|documento|doc)\b/]);
  const streetTypeIdx = takeCol([/\b(tipo\s*logradouro|tipo\s*endereco|tipo)\b/]);
  const streetIdx = takeCol([/\b(logradouro|endereco|rua|avenida)\b/]);
  const numberIdx = takeCol([/\b(numero|num|nro)\b/]);
  const complementIdx = takeCol([/\b(complemento|compl)\b/]);
  const neighborhoodIdx = takeCol([/\b(bairro|setor)\b/]);
  const cityIdx = takeCol([/\b(cidade|municipio|localidade)\b/]);
  const stateIdx = takeCol([/^(uf|estado)$/]);
  const cepIdx = takeCol([/\bcep\b/]);
  const emailIdx = takeCol([/\b(e\s*mail|email|correio)\b/]);

  return {
    columns: {
      name: nameIdx,
      document: documentIdx,
      streetType: streetTypeIdx,
      street: streetIdx,
      number: numberIdx,
      complement: complementIdx,
      neighborhood: neighborhoodIdx,
      city: cityIdx,
      state: stateIdx,
      cep: cepIdx,
      phone: phoneIdx,
      secondaryPhone: secondaryPhoneIdx,
      email: emailIdx,
    },
    startRow: 1,
  };
}

/**
 * Lê uma planilha XLSX em buffer e importa leads para a tabela ProspectLead.
 * Detecta cabeçalhos automaticamente quando presentes ou usa o layout padrão (ceilandia.xlsx).
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

  const { columns, startRow } = detectXlsxColumns(rows[0] ?? []);
  const cell = (row: unknown[], idx: number | null) =>
    idx !== null && idx >= 0 && idx < row.length ? row[idx] : "";

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

  for (let rowIndex = startRow; rowIndex < rows.length; rowIndex++) {
    const row = rows[rowIndex];
    if (!Array.isArray(row) || row.length === 0) continue;

    const rawPhone = cell(row, columns.phone);
    const phone = normalizePhone(rawPhone);

    // Se for cabeçalho sem detecção (linha 0) ou inválido/vazio
    if (!phone) {
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

    const rawNameCell = cell(row, columns.name);
    const { name: parsedName, document: parsedDoc } = cleanNameAndDocument(rawNameCell);
    const explicitDoc = String(cell(row, columns.document) || "").trim() || null;
    const finalName = parsedName || `Lead ${phone}`;

    const tipoLogradouro = String(cell(row, columns.streetType) || "").trim();
    const logradouro = String(cell(row, columns.street) || "").trim();
    const street = [tipoLogradouro, logradouro].filter(Boolean).join(" ") || null;

    const number = String(cell(row, columns.number) || "").trim() || null;
    const complement = String(cell(row, columns.complement) || "").trim() || null;
    const neighborhood = String(cell(row, columns.neighborhood) || "").trim() || null;
    const city = String(cell(row, columns.city) || "").trim() || null;
    const state = String(cell(row, columns.state) || "").trim() || null;
    const cep = String(cell(row, columns.cep) || "").trim() || null;

    const rawPhone2 = cell(row, columns.secondaryPhone);
    const secondaryPhone = rawPhone2 ? normalizePhone(rawPhone2) || null : null;

    const emailRaw = String(cell(row, columns.email) || "").trim();
    const email = emailRaw && emailRaw.includes("@") ? emailRaw : null;

    toInsert.push({
      name: finalName,
      phone,
      secondaryPhone,
      email,
      rawDocument: explicitDoc ?? parsedDoc,
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
    getSettings({ bypassCache: true }),
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
    throw new Error("Telefone inválido. Informe DDD + número (ex.: 61991640073).");
  }

  const existing = await prisma.prospectLead.findUnique({ where: { phone } });
  if (existing) {
    throw new Error("Já existe um lead cadastrado com este telefone.");
  }

  return prisma.prospectLead.create({
    data: {
      name: data.name.trim(),
      phone,
      secondaryPhone: data.secondaryPhone ? normalizePhone(data.secondaryPhone) || null : null,
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
    if (!p) throw new Error("Telefone inválido. Informe DDD + número (ex.: 61991640073).");
    const duplicate = await prisma.prospectLead.findFirst({
      where: { phone: p, id: { not: id } },
      select: { id: true },
    });
    if (duplicate) {
      throw new Error("Já existe outro lead cadastrado com este telefone.");
    }
    updateData.phone = p;
  }
  if (data.secondaryPhone !== undefined) {
    updateData.secondaryPhone = data.secondaryPhone ? normalizePhone(data.secondaryPhone) || null : null;
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

function prospectJobId(leadId: string): string {
  return `prospect-${leadId}`;
}

async function removeQueuedProspectJobs(ids: string[]) {
  await Promise.all(
    ids.map(async (id) => {
      try {
        const job = await prospectingQueue.getJob(prospectJobId(id));
        if (job) {
          const state = await job.getState();
          if (state === "waiting" || state === "delayed" || state === "prioritized") {
            await job.remove();
          }
        }
      } catch {
        // Ignora caso o job já esteja ativo ou removido
      }
    })
  );
}

export async function deleteProspectLead(id: string) {
  await removeQueuedProspectJobs([id]);
  return prisma.prospectLead.delete({ where: { id } });
}

export async function deleteManyProspectLeads(ids: string[]) {
  if (!ids || ids.length === 0) return { count: 0 };
  await removeQueuedProspectJobs(ids);
  return prisma.prospectLead.deleteMany({
    where: { id: { in: ids } },
  });
}

/**
 * Inicia a campanha de prospecção.
 * Se leadIds forem fornecidos, enfileira apenas os elegíveis dessa seleção; caso contrário, enfileira todos com status PENDENTE.
 * Usa jobId determinístico (`prospect-<leadId>`) para evitar duplicações na fila.
 */
export async function startProspecting(
  leadIds?: string[]
): Promise<{ queuedCount: number; alreadyQueuedCount: number }> {
  const isSpecificSelection = !!(leadIds && leadIds.length > 0);
  const where: Record<string, unknown> = isSpecificSelection
    ? {
        id: { in: leadIds },
        status: {
          notIn: [ProspectStatus.ATENDEU, ProspectStatus.TEXTO_ENVIADO, ProspectStatus.EM_CHAMADA],
        },
      }
    : { status: ProspectStatus.PENDENTE };

  const leads = await prisma.prospectLead.findMany({
    where,
    select: { id: true },
    orderBy: { createdAt: "asc" },
  });

  const existingJobs = await prospectingQueue.getJobs(["waiting", "paused", "active", "delayed"]);
  const existingJobIds = new Set(existingJobs.map((j) => j.id).filter((id): id is string => Boolean(id)));

  const newLeads = leads.filter((lead) => !existingJobIds.has(prospectJobId(lead.id)));
  const alreadyQueuedCount = leads.length - newLeads.length;

  if (newLeads.length === 0 && alreadyQueuedCount === 0) {
    return { queuedCount: 0, alreadyQueuedCount: 0 };
  }

  // Ativa a flag ANTES de enfileirar para evitar que o worker pegue o 1º job e aborte por ler false
  await updateSettings({ isProspectingActive: true });

  if (newLeads.length > 0) {
    await prospectingQueue.addBulk(
      newLeads.map((lead) => ({
        name: "call",
        data: { leadId: lead.id },
        opts: {
          jobId: prospectJobId(lead.id),
          removeOnComplete: true,
          removeOnFail: true,
        },
      }))
    );
  }

  await prospectingQueue.resume();

  await addSystemLog({
    level: "info",
    source: "prospecting",
    message: `Prospecção iniciada. ${newLeads.length} lead(s) enfileirado(s)${
      alreadyQueuedCount > 0 ? ` (${alreadyQueuedCount} já na fila)` : ""
    }.`,
    details: { count: newLeads.length, alreadyQueuedCount, specificSelection: isSpecificSelection },
  });

  return { queuedCount: newLeads.length, alreadyQueuedCount };
}

/**
 * Pausa a campanha de prospecção, pausa a fila BullMQ e limpa jobs aguardando (sem interromper chamada em andamento).
 */
export async function pauseProspecting(reason?: string): Promise<void> {
  await updateSettings({ isProspectingActive: false });
  await prospectingQueue.pause();
  await prospectingQueue.drain(true);

  await addSystemLog({
    level: "info",
    source: "prospecting",
    message: reason || "Prospecção pausada pelo operador.",
  });
}

/**
 * Desativa automaticamente `isProspectingActive` quando não restam jobs aguardando na fila.
 */
export async function deactivateProspectingIfIdle(): Promise<boolean> {
  const counts = await prospectingQueue.getJobCounts("waiting", "paused", "delayed");
  const remaining = (counts.waiting ?? 0) + (counts.paused ?? 0) + (counts.delayed ?? 0);
  if (remaining > 0) return false;

  const settings = await getSettings({ bypassCache: true });
  if (!settings.isProspectingActive) return false;

  await updateSettings({ isProspectingActive: false });
  await addSystemLog({
    level: "info",
    source: "prospecting",
    message: "Campanha de prospecção concluída automaticamente (fila vazia).",
  });
  return true;
}

export interface CallResultMessage {
  answered: boolean;
  reason?: string;
  conversationId?: string | null;
}

export interface WaitForCallResultOutput {
  answered: boolean;
  timeout: boolean;
  reason?: string;
  conversationId?: string;
}

function callResultChannel(leadId: string): string {
  return `prospect:call-result:${leadId}`;
}

/**
 * Publica o resultado da ligação de voz no Redis Pub/Sub para destravar o worker.
 */
export async function publishCallResult(
  leadId: string,
  result: CallResultMessage
): Promise<number> {
  const payload = JSON.stringify(result);
  return redisConnection.publish(callResultChannel(leadId), payload);
}

export interface CallResultWaiter {
  promise: Promise<WaitForCallResultOutput>;
  cancel: () => void;
}

/**
 * Inscreve-se no canal Redis Pub/Sub antes de disparar a chamada e retorna um handle com `promise` e `cancel()`.
 * Aguardar a inscrição elimina race conditions com falhas SIP imediatas; `cancel()` evita leak em caso de erro.
 */
export async function prepareCallResultWaiter(
  leadId: string,
  timeoutMs = 15 * 60 * 1000
): Promise<CallResultWaiter> {
  const channel = callResultChannel(leadId);
  const subClient = createRedisClient();
  subClient.on("error", (err) => console.error("[waitForCallResult] Redis sub error:", err));

  let settled = false;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let resolvePromise!: (val: WaitForCallResultOutput) => void;

  const promise = new Promise<WaitForCallResultOutput>((resolve) => {
    resolvePromise = resolve;
  });

  const onMessage = (_chan: string, message: string) => {
    try {
      const data = JSON.parse(message) as Partial<CallResultMessage> | null;
      if (data && typeof data.answered === "boolean" && !settled) {
        settled = true;
        cleanup();
        resolvePromise({
          answered: data.answered,
          timeout: false,
          reason: typeof data.reason === "string" ? data.reason : undefined,
          conversationId:
            typeof data.conversationId === "string" ? data.conversationId : undefined,
        });
      }
    } catch (err) {
      console.error("[waitForCallResult] Erro ao parsear mensagem do pubsub:", err);
    }
  };

  const cleanup = () => {
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
    subClient.removeListener("message", onMessage);
    subClient.unsubscribe(channel).catch(() => {});
    subClient.quit().catch(() => {
      subClient.disconnect();
    });
  };

  const cancel = () => {
    if (settled) return;
    settled = true;
    cleanup();
    resolvePromise({ answered: false, timeout: false });
  };

  subClient.on("message", onMessage);

  try {
    await subClient.subscribe(channel);
  } catch (err) {
    console.error("[waitForCallResult] Falha ao se inscrever no canal:", err);
    settled = true;
    cleanup();
    throw err;
  }

  if (!settled) {
    timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      cleanup();
      resolvePromise({ answered: false, timeout: true });
    }, timeoutMs);
  }

  return { promise, cancel };
}

/**
 * Garante a criação do Cliente na tabela Client antes de disparar o contato,
 * preservando nome/metadados de clientes já existentes no CRM.
 */
export async function ensureClientForProspect(lead: ProspectLead) {
  let client = await prisma.client.upsert({
    where: { phone: lead.phone },
    update: {},
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

  if (!client.name?.trim() && lead.name.trim()) {
    client = await prisma.client.update({
      where: { id: client.id },
      data: { name: lead.name.trim() },
    });
  }

  if (lead.clientId !== client.id) {
    await prisma.prospectLead.update({
      where: { id: lead.id },
      data: { clientId: client.id },
    });
  }

  return client;
}

/**
 * Marca o lead como NAO_ATENDEU (somente se ainda estiver EM_CHAMADA) e dispara o fallback de texto (se configurado).
 */
export async function finalizeUnansweredProspect(
  lead: ProspectLead,
  clientId: string,
  reason: string,
  conversationId?: string | null
): Promise<boolean> {
  const claimed = await prisma.prospectLead.updateMany({
    where: { id: lead.id, status: ProspectStatus.EM_CHAMADA },
    data: {
      status: ProspectStatus.NAO_ATENDEU,
      notes: reason,
      ...(conversationId ? { elevenLabsConversationId: conversationId } : {}),
    },
  });

  if (claimed.count === 0) {
    return false;
  }

  await addSystemLog({
    level: "warn",
    source: "prospecting",
    message: `Lead ${lead.phone} (${lead.name}) NÃO atendeu (${reason}).`,
    phone: lead.phone,
  });

  try {
    const sent = await sendProspectingTextWebhook({
      leadId: lead.id,
      clientId,
      phone: lead.phone,
      name: lead.name,
      action: "TEXT",
      metadata: {
        reason,
        secondaryPhone: lead.secondaryPhone,
        email: lead.email,
        rawDocument: lead.rawDocument,
        street: lead.street,
        number: lead.number,
        complement: lead.complement,
        neighborhood: lead.neighborhood,
        city: lead.city,
        state: lead.state,
        cep: lead.cep,
      },
    });

    if (sent) {
      await prisma.prospectLead.update({
        where: { id: lead.id },
        data: {
          status: ProspectStatus.TEXTO_ENVIADO,
          lastAction: "TEXT",
          textSentAt: new Date(),
        },
      });
    }
  } catch (textErr) {
    console.error(`[prospecting] Falha ao disparar webhook de TEXT para ${lead.phone}:`, textErr);
    await addSystemLog({
      level: "error",
      source: "prospecting",
      message: `Falha ao disparar webhook de TEXT para ${lead.phone}: ${
        textErr instanceof Error ? textErr.message : String(textErr)
      }`,
      phone: lead.phone,
    });
  }

  return true;
}

function extractDynamicVariables(event: ElevenLabsWebhookEvent): Record<string, unknown> {
  const fromInit = event.data.conversation_initiation_client_data?.dynamic_variables;
  const fromTop = event.data.dynamic_variables;
  return { ...(fromTop ?? {}), ...(fromInit ?? {}) };
}

async function resolveProspectLeadForWebhook(
  event: ElevenLabsWebhookEvent,
  dynamicVars: Record<string, unknown>
): Promise<ProspectLead | null> {
  const conversationId = event.data.conversation_id;
  if (conversationId) {
    const byConversation = await prisma.prospectLead.findFirst({
      where: { elevenLabsConversationId: conversationId },
    });
    if (byConversation) return byConversation;
  }

  const leadIdVar = dynamicVars.lead_id;
  if (typeof leadIdVar === "string" && leadIdVar.trim()) {
    const byId = await prisma.prospectLead.findUnique({ where: { id: leadIdVar.trim() } });
    if (byId) return byId;
  }

  const rawPhoneCandidates: unknown[] = [
    dynamicVars.phone,
    event.type === "call_initiation_failure" ? event.data.destination_phone_number : undefined,
    event.type === "post_call_transcription"
      ? event.data.metadata?.phone_call?.external_number
      : undefined,
  ];

  for (const candidate of rawPhoneCandidates) {
    const normalized = normalizePhone(candidate);
    if (!normalized) continue;
    const byPhone = await prisma.prospectLead.findUnique({ where: { phone: normalized } });
    if (byPhone) return byPhone;
  }

  return null;
}

export interface ElevenLabsWebhookProcessResult {
  handled: boolean;
  duplicate?: boolean;
  leadId?: string;
  status?: ProspectStatus;
  reason?: string;
}

async function handleUnansweredWebhookEvent(
  lead: ProspectLead,
  reason: string,
  conversationId: string | null
): Promise<ElevenLabsWebhookProcessResult> {
  const subscribers = await publishCallResult(lead.id, {
    answered: false,
    reason,
    conversationId,
  });

  if (subscribers === 0 && lead.status === ProspectStatus.EM_CHAMADA) {
    const client = await ensureClientForProspect(lead);
    await finalizeUnansweredProspect(lead, client.id, reason, conversationId);
  }

  return {
    handled: true,
    leadId: lead.id,
    status: ProspectStatus.NAO_ATENDEU,
    reason,
  };
}

/**
 * Processa eventos recebidos no Post-Call Webhook da ElevenLabs (`post_call_transcription` e `call_initiation_failure`).
 */
export async function processElevenLabsWebhookEvent(
  event: ElevenLabsWebhookEvent
): Promise<ElevenLabsWebhookProcessResult> {
  const dynamicVars = extractDynamicVariables(event);
  const lead = await resolveProspectLeadForWebhook(event, dynamicVars);

  if (!lead) {
    await addSystemLog({
      level: "warn",
      source: "elevenlabs-webhook",
      message: `Webhook ${event.type} recebido sem lead correspondente (conversation_id=${event.data.conversation_id ?? "n/a"}).`,
      details: { type: event.type, conversationId: event.data.conversation_id ?? null },
    });
    return { handled: false, reason: "lead_not_found" };
  }

  const conversationId = event.data.conversation_id ?? null;

  // Idempotência: ignora retries quando o lead não está mais EM_CHAMADA (inclusive call_initiation_failure sem conversationId)
  if (lead.status !== ProspectStatus.EM_CHAMADA) {
    return { handled: true, duplicate: true, leadId: lead.id, status: lead.status };
  }

  if (event.type === "call_initiation_failure") {
    const reason =
      event.data.error_reason?.trim() ||
      event.data.failure_reason?.trim() ||
      event.data.error?.trim() ||
      "Falha ao iniciar chamada SIP";

    return handleUnansweredWebhookEvent(lead, reason, conversationId);
  }

  // post_call_transcription
  const validTurns = event.data.transcript
    .map((turn) => ({
      role: turn.role,
      text: (turn.message ?? "").trim(),
      timeInCallSecs: typeof turn.time_in_call_secs === "number" ? turn.time_in_call_secs : null,
    }))
    .filter((turn) => turn.text.length > 0);

  const userTurns = validTurns.filter((turn) => turn.role === "user");

  const durationSecs =
    typeof event.data.metadata?.call_duration_secs === "number"
      ? Math.round(event.data.metadata.call_duration_secs)
      : null;

  const summary = event.data.analysis?.transcript_summary?.trim() || null;
  const terminationReason = event.data.metadata?.termination_reason?.trim() || "";
  const isVoicemail = /voicemail|caixa\s*postal|answering.?machine/i.test(terminationReason);

  // Só considera atendido quando não falhou, não caiu em caixa postal e houve ao menos 1 fala do lead
  const answered = event.data.status !== "failed" && !isVoicemail && userTurns.length > 0;

  if (!answered) {
    const reason = isVoicemail
      ? "Caixa postal detectada"
      : event.data.status === "failed"
        ? terminationReason || "Chamada encerrada com falha"
        : terminationReason
          ? `Sem resposta do lead (${terminationReason})`
          : "Lead não falou na chamada (desligou ou sem resposta)";

    return handleUnansweredWebhookEvent(lead, reason, conversationId);
  }

  // Reivindica atomicamente o lead antes de gravar mensagens para evitar duplicação em retries concorrentes
  const claimed = await prisma.prospectLead.updateMany({
    where: { id: lead.id, status: ProspectStatus.EM_CHAMADA },
    data: {
      status: ProspectStatus.ATENDEU,
      elevenLabsConversationId: conversationId,
      callDurationSecs: durationSecs,
      callSummary: summary,
      notes: summary ?? "Lead atendeu a chamada de voz (ElevenLabs).",
    },
  });

  if (claimed.count === 0) {
    return {
      handled: true,
      duplicate: true,
      leadId: lead.id,
      status: lead.status,
    };
  }

  const clientId = lead.clientId ?? (await ensureClientForProspect(lead)).id;

  const nowMs = Date.now();
  const baseMs =
    durationSecs != null && durationSecs > 0
      ? nowMs - durationSecs * 1000
      : nowMs - validTurns.length * 1000;
  let lastMs = baseMs - 1;

  for (let i = 0; i < validTurns.length; i++) {
    const turn = validTurns[i]!;
    const role = turn.role === "user" ? "user" : "assistant";
    const candidateMs =
      turn.timeInCallSecs !== null
        ? baseMs + Math.round(turn.timeInCallSecs * 1000)
        : baseMs + i * 1000;
    const timestampMs = Math.max(lastMs + 1, candidateMs);
    lastMs = timestampMs;
    await saveMessage(clientId, role, turn.text, "text", undefined, new Date(timestampMs));
  }

  await addSystemLog({
    level: "info",
    source: "prospecting",
    message: `Lead ${lead.phone} (${lead.name}) ATENDEU a chamada ElevenLabs (${durationSecs ?? 0}s, ${validTurns.length} turnos salvos).`,
    phone: lead.phone,
    details: { conversationId, durationSecs },
  });

  await publishCallResult(lead.id, {
    answered: true,
    conversationId,
  });

  return {
    handled: true,
    leadId: lead.id,
    status: ProspectStatus.ATENDEU,
  };
}

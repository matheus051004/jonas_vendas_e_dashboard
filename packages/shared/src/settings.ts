import { prisma, type Settings } from "@jonas/db";

const SETTINGS_ID = "default";

// Cache curto em memória: Settings é lido a cada mensagem processada pelo worker,
// não faz sentido bater no Postgres toda vez. Painel invalida ao salvar (invalidateSettingsCache).
let cached: { value: Settings; expiresAt: number } | null = null;
const TTL_MS = 30_000;

export async function getSettings(): Promise<Settings> {
  if (cached && cached.expiresAt > Date.now()) return cached.value;

  const settings = await prisma.settings.upsert({
    where: { id: SETTINGS_ID },
    update: {},
    create: { id: SETTINGS_ID },
  });

  cached = { value: settings, expiresAt: Date.now() + TTL_MS };
  return settings;
}

export function invalidateSettingsCache() {
  cached = null;
}

export async function updateSettings(data: Partial<Omit<Settings, "id">>): Promise<Settings> {
  const settings = await prisma.settings.update({
    where: { id: SETTINGS_ID },
    data,
  });
  invalidateSettingsCache();
  return settings;
}

/**
 * Verifica se a data/hora fornecida está dentro da janela permitida de follow-up,
 * considerando o fuso horário oficial de São Paulo (America/Sao_Paulo).
 *
 * Formato esperado de startTime e endTime: "HH:mm" (ex: "08:00", "20:00").
 * Se algum horário não for informado ou for inválido, considera dentro da janela (sem restrição).
 */
export function isWithinFollowUpWindow(
  now = new Date(),
  startTime?: string | null,
  endTime?: string | null
): boolean {
  if (!startTime || !endTime) return true;
  const timeRegex = /^([01]\d|2[0-3]):[0-5]\d$/;
  if (!timeRegex.test(startTime) || !timeRegex.test(endTime)) return true;

  const cur = now.toLocaleTimeString("en-GB", {
    timeZone: "America/Sao_Paulo",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });

  if (startTime <= endTime) {
    return cur >= startTime && cur <= endTime;
  }
  // Janela que cruza meia-noite (ex.: 22:00 às 06:00)
  return cur >= startTime || cur <= endTime;
}


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

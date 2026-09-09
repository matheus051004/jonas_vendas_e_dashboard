import { prisma, Prisma, type Client } from "@jonas/db";
import type { WebhookMetadata } from "./types";

/** Garante que o lead existe (1ª mensagem de um telefone novo). Atualiza metadata se enviada. */
export async function upsertClientByPhone(
  phone: string,
  metadata?: WebhookMetadata
): Promise<Client> {
  const metaUpdate =
    metadata !== undefined ? { metadata: metadata as Prisma.InputJsonValue } : {};
  return prisma.client.upsert({
    where: { phone },
    update: metaUpdate,
    create: { phone, ...metaUpdate },
  });
}

export async function findClientByPhone(phone: string) {
  const exact = await prisma.client.findUnique({
    where: { phone },
    include: {
      area: { select: { id: true, name: true, observation: true } },
      origin: { select: { id: true, name: true } },
      contract: true,
    },
  });
  if (exact) return exact;

  const clean = phone.replace(/\D/g, "");
  if (clean && clean !== phone) {
    return prisma.client.findUnique({
      where: { phone: clean },
      include: {
        area: { select: { id: true, name: true, observation: true } },
        origin: { select: { id: true, name: true } },
        contract: true,
      },
    });
  }

  return null;
}

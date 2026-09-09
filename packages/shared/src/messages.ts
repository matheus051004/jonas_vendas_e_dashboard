import { prisma } from "@jonas/db";
import { publishChatEvent } from "./chat-events";

const HISTORY_LIMIT = 30;

export type SaveMessageAudio = {
  data: Buffer | Uint8Array;
  mimeType?: string;
};

export type MessageHistoryItem = {
  role: string;
  content: string;
  kind: string;
  createdAt: string;
};

/** Últimas N mensagens user/assistant (ordem cronológica). */
export async function listMessages(
  clientId: string,
  limit = HISTORY_LIMIT
): Promise<MessageHistoryItem[]> {
  const take = Math.min(Math.max(limit, 1), 100);
  const rows = await prisma.message.findMany({
    where: { clientId, role: { in: ["user", "assistant"] } },
    orderBy: { createdAt: "desc" },
    take,
    select: { role: true, content: true, kind: true, createdAt: true },
  });

  return rows.reverse().map((row) => ({
    role: row.role,
    content: row.content,
    kind: row.kind,
    createdAt: row.createdAt.toISOString(),
  }));
}

export async function saveMessage(
  clientId: string,
  role: "user" | "assistant" | "system",
  content: string,
  kind: "text" | "audio" = "text",
  audio?: SaveMessageAudio
) {
  const text = typeof content === "string" ? content : String(content ?? "");
  const audioBytes = audio?.data ? Uint8Array.from(audio.data) : undefined;

  const message = await prisma.message.create({
    data: {
      clientId,
      role,
      content: text,
      kind,
      audioData: audioBytes,
      audioMimeType: audio?.mimeType ?? undefined,
    },
  });

  const client = await prisma.client.findUnique({
    where: { id: clientId },
    select: { id: true, name: true, phone: true, stage: true },
  });

  await publishChatEvent({
    type: "message",
    clientId,
    message: {
      id: message.id,
      role: message.role,
      content: message.content,
      kind: message.kind,
      hasAudio: Boolean(message.audioMimeType ?? audio),
      createdAt: message.createdAt.toISOString(),
    },
    client: client
      ? {
          id: client.id,
          name: client.name,
          phone: client.phone,
          stage: client.stage,
        }
      : undefined,
  });

  return message;
}

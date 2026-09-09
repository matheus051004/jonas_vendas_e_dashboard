import IORedis from "ioredis";
import { redisConnection } from "./queue";

/** Canal Redis pub/sub para eventos de chat (painel de atendimentos via SSE). */
export const CHAT_EVENTS_CHANNEL = "chat:events";

export type ChatMessagePayload = {
  id: string;
  role: string;
  content: string;
  kind: string;
  /** true se o áudio original foi persistido (reproduzível em /api/messages/:id/audio). */
  hasAudio?: boolean;
  createdAt: string; // ISO
};

export type ChatClientPreview = {
  id: string;
  name: string | null;
  phone: string;
  stage: string;
};

export type ChatEvent = {
  type: "message";
  clientId: string;
  message: ChatMessagePayload;
  client?: ChatClientPreview;
};

export async function publishChatEvent(event: ChatEvent): Promise<void> {
  try {
    await redisConnection.publish(CHAT_EVENTS_CHANNEL, JSON.stringify(event));
  } catch (err) {
    // Não quebra o fluxo de atendimento se o Redis de pub/sub falhar.
    console.error("[chat-events] falha ao publicar:", err);
  }
}

/** Conexão dedicada para subscribe (não reutilizar a do BullMQ). */
export function createChatEventsSubscriber(): IORedis {
  return new IORedis(process.env.REDIS_URL ?? "redis://localhost:6379", {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
  });
}

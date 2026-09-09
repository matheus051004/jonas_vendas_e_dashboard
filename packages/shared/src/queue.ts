import { Queue } from "bullmq";
import IORedis from "ioredis";
import type { IncomingMessageJob, FollowUpJob } from "./types";

// ponytail: uma conexão Redis compartilhada por processo; troque por pool se o volume exigir.
export const redisConnection = new IORedis(process.env.REDIS_URL ?? "redis://localhost:6379", {
  maxRetriesPerRequest: null,
});

export const QUEUE_NAMES = {
  messages: "messages",
  followups: "followups",
} as const;

export const messagesQueue = new Queue<IncomingMessageJob>(QUEUE_NAMES.messages, {
  connection: redisConnection,
});

export const followUpsQueue = new Queue<FollowUpJob>(QUEUE_NAMES.followups, {
  connection: redisConnection,
});

// Offsets em ms a partir do momento em que a IA responde e passa a aguardar o lead.
const FOLLOW_UP_DELAYS_MS = {
  1: 60 * 60 * 1000, // 1h
  2: 2 * 60 * 60 * 1000, // 2h
  3: 3 * 60 * 60 * 1000, // 3h
} as const;

function followUpJobId(phone: string) {
  return `followup-${phone}`;
}

export async function scheduleFollowUp(phone: string, attempt: 1 | 2 | 3) {
  // jobId fixo por telefone: agendar de novo remove o anterior (idempotente).
  await followUpsQueue.add(
    "followup",
    { phone, attempt },
    { jobId: followUpJobId(phone), delay: FOLLOW_UP_DELAYS_MS[attempt] }
  );
}

export async function cancelFollowUp(phone: string) {
  const job = await followUpsQueue.getJob(followUpJobId(phone));
  if (job) await job.remove();
}

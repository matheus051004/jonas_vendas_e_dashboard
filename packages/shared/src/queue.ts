import { Queue } from "bullmq";
import IORedis from "ioredis";
import type { IncomingMessageJob, FollowUpJob, ProspectingCallJob } from "./types";
import { getSettings } from "./settings";

// ponytail: uma conexão Redis compartilhada por processo; troque por pool se o volume exigir.
export const redisConnection = new IORedis(process.env.REDIS_URL ?? "redis://localhost:6379", {
  maxRetriesPerRequest: null,
});

export function createRedisClient() {
  return new IORedis(process.env.REDIS_URL ?? "redis://localhost:6379", {
    maxRetriesPerRequest: null,
  });
}

export const QUEUE_NAMES = {
  messages: "messages",
  followups: "followups",
  prospecting: "prospecting",
  hubsoftAuth: "hubsoft-auth",
} as const;

export const messagesQueue = new Queue<IncomingMessageJob>(QUEUE_NAMES.messages, {
  connection: redisConnection,
});

export const followUpsQueue = new Queue<FollowUpJob>(QUEUE_NAMES.followups, {
  connection: redisConnection,
});

export const prospectingQueue = new Queue<ProspectingCallJob>(QUEUE_NAMES.prospecting, {
  connection: redisConnection,
});

export const hubsoftAuthQueue = new Queue<Record<string, never>>(QUEUE_NAMES.hubsoftAuth, {
  connection: redisConnection,
});

const HUBSOFT_TOKEN_CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000;

/**
 * Garante o agendamento recorrente diário no BullMQ que verifica se o token OAuth
 * do Hubsoft atingiu 29 dias (ou expiração próxima) e o renova automaticamente.
 */
export async function ensureHubsoftTokenScheduler() {
  await hubsoftAuthQueue.upsertJobScheduler(
    "hubsoft-token-renew-check",
    { every: HUBSOFT_TOKEN_CHECK_INTERVAL_MS },
    {
      name: "renew-hubsoft-token-if-due",
      data: {},
      opts: {
        removeOnComplete: true,
        removeOnFail: true,
      },
    }
  );
}

// Intervalos padrão em minutos caso não configurado no painel.
export const DEFAULT_FOLLOW_UP_INTERVALS = [60, 120, 180];

function followUpJobId(phone: string) {
  return `followup-${phone}`;
}

export async function scheduleFollowUp(phone: string, attempt: number, customDelayMs?: number) {
  let delay = customDelayMs;
  if (delay === undefined) {
    const settings = await getSettings();
    const intervals =
      settings.followUpIntervals?.length ? settings.followUpIntervals : DEFAULT_FOLLOW_UP_INTERVALS;
    if (attempt < 1 || attempt > intervals.length) {
      return;
    }
    const intervalMinutes = intervals[attempt - 1];
    if (intervalMinutes == null || intervalMinutes <= 0) {
      return;
    }
    delay = intervalMinutes * 60 * 1000;
  }

  // jobId fixo por telefone: agendar de novo remove o anterior (idempotente).
  await followUpsQueue.add(
    "followup",
    { phone, attempt },
    {
      jobId: followUpJobId(phone),
      delay: Math.max(delay, 0),
      removeOnComplete: true,
      removeOnFail: true,
    }
  );
}

export async function cancelFollowUp(phone: string) {
  const job = await followUpsQueue.getJob(followUpJobId(phone));
  if (job) await job.remove();
}

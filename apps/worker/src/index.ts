import { Worker } from "bullmq";
import { prisma, SaleStage } from "@jonas/db";
import {
  QUEUE_NAMES,
  redisConnection,
  scheduleFollowUp,
  cancelFollowUp,
  upsertClientByPhone,
  asWebhookMetadata,
  saveMessage,
  listMessages,
  sendAgentWebhook,
  serializeClientForAgent,
  type IncomingMessageJob,
  type FollowUpJob,
} from "@jonas/shared";

const AUDIO_PLACEHOLDER = "[áudio]";

const messagesWorker = new Worker<IncomingMessageJob>(
  QUEUE_NAMES.messages,
  async (job) => {
    const { phone, type, text, transcription, audioBase64, mimeType, metadata } = job.data;

    const client = await upsertClientByPhone(phone, metadata);
    const replyMetadata = asWebhookMetadata(client.metadata) ?? metadata;

    const audioTranscription = transcription?.trim() || (type === "audio" ? text?.trim() : undefined);
    const userText =
      type === "audio"
        ? (audioTranscription || AUDIO_PLACEHOLDER)
        : text!;

    await saveMessage(
      client.id,
      "user",
      userText,
      type,
      type === "audio" && audioBase64
        ? {
            data: Buffer.from(audioBase64, "base64"),
            mimeType: mimeType ?? "audio/ogg",
          }
        : undefined
    );

    await cancelFollowUp(phone);
    const clientUpdateData: { lastInboundAt: Date; followUpCount: number; stage?: SaleStage } = {
      lastInboundAt: new Date(),
      followUpCount: 0,
    };
    if (client.stage === SaleStage.PAROU_DE_RESPONDER) {
      clientUpdateData.stage = SaleStage.INTERESSADO;
    }
    await prisma.client.update({
      where: { id: client.id },
      data: clientUpdateData,
    });

    const fresh = await prisma.client.findUniqueOrThrow({ where: { id: client.id } });
    const history = await listMessages(client.id);

    await sendAgentWebhook({
      event: "message.inbound",
      phone,
      clientId: client.id,
      type,
      ...(type === "text" ? { text: text! } : {}),
      ...(type === "audio"
        ? {
            ...(audioTranscription ? { text: audioTranscription, transcription: audioTranscription } : {}),
            ...(audioBase64 ? { audioBase64, mimeType: mimeType ?? "audio/ogg" } : {}),
          }
        : {}),
      ...(replyMetadata ? { metadata: replyMetadata } : {}),
      client: serializeClientForAgent(fresh),
      history,
    });

    const updated = await prisma.client.findUniqueOrThrow({ where: { id: client.id } });
    if (
      updated.stage !== SaleStage.FECHOU_VENDA &&
      updated.stage !== SaleStage.DESISTIU &&
      updated.stage !== SaleStage.ACHOU_CARO
    ) {
      await scheduleFollowUp(phone, 1);
    }
  },
  { connection: redisConnection }
);

const followUpsWorker = new Worker<FollowUpJob>(
  QUEUE_NAMES.followups,
  async (job) => {
    const { phone, attempt } = job.data;
    const client = await prisma.client.findUnique({ where: { phone } });
    if (!client) return;
    if (
      client.stage === SaleStage.FECHOU_VENDA ||
      client.stage === SaleStage.DESISTIU ||
      client.stage === SaleStage.ACHOU_CARO
    ) {
      return;
    }

    const stageUpdate =
      client.stage === SaleStage.INTERESSADO || client.stage === SaleStage.NOVO_LEAD
        ? { stage: SaleStage.PAROU_DE_RESPONDER }
        : {};

    await prisma.client.update({
      where: { id: client.id },
      data: {
        followUpCount: attempt,
        ...stageUpdate,
      },
    });

    const fresh = await prisma.client.findUniqueOrThrow({ where: { id: client.id } });
    const followUpMetadata = asWebhookMetadata(client.metadata);
    const history = await listMessages(client.id, 20);

    await sendAgentWebhook({
      event: "followup.due",
      phone,
      clientId: client.id,
      attempt,
      history,
      ...(followUpMetadata ? { metadata: followUpMetadata } : {}),
      client: serializeClientForAgent(fresh),
    });

    if (attempt < 3) {
      await scheduleFollowUp(phone, (attempt + 1) as 2 | 3);
    } else {
      await prisma.client.update({ where: { id: client.id }, data: { stage: SaleStage.PAROU_DE_RESPONDER } });
    }
  },
  { connection: redisConnection }
);

for (const worker of [messagesWorker, followUpsWorker]) {
  worker.on("failed", (job, err) => {
    console.error(`[${worker.name}] job ${job?.id} falhou:`, err);
  });
}

console.log("Worker rodando. Filas:", QUEUE_NAMES.messages, QUEUE_NAMES.followups);

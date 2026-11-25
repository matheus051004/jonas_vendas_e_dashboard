import { Worker } from "bullmq";
import { prisma, SaleStage, ProspectStatus } from "@jonas/db";
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
  getSettings,
  isWithinFollowUpWindow,
  addSystemLog,
  ensureClientForProspect,
  startElevenLabsSipOutboundCall,
  finalizeUnansweredProspect,
  prepareCallResultWaiter,
  pauseProspecting,
  deactivateProspectingIfIdle,
  DEFAULT_FOLLOW_UP_INTERVALS,
  type IncomingMessageJob,
  type FollowUpJob,
  type ProspectingCallJob,
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
    const clientUpdateData: {
      lastInboundAt: Date;
      followUpCount: number;
      stage?: SaleStage;
      followUpPaused: boolean;
    } = {
      lastInboundAt: new Date(),
      followUpCount: 0,
      followUpPaused: false, // Normaliza o follow-up ao receber nova mensagem do lead
    };
    if (client.stage === SaleStage.PAROU_DE_RESPONDER) {
      clientUpdateData.stage = SaleStage.INTERESSADO;
    }
    await prisma.client.update({
      where: { id: client.id },
      data: clientUpdateData,
    });
    if (client.followUpPaused) {
      console.log(`[messages] Follow-up para ${phone} normalizado (mensagem recebida do cliente).`);
    }

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
    const settings = await getSettings();
    const intervals =
      settings.followUpIntervals?.length ? settings.followUpIntervals : DEFAULT_FOLLOW_UP_INTERVALS;

    if (
      intervals.length > 0 &&
      updated.stage !== SaleStage.FECHOU_VENDA &&
      updated.stage !== SaleStage.DESISTIU &&
      updated.stage !== SaleStage.ACHOU_CARO &&
      !updated.followUpPaused
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
      client.stage === SaleStage.ACHOU_CARO ||
      client.followUpPaused
    ) {
      if (client.followUpPaused) {
        console.log(`[followups] Follow-up para ${phone} ignorado: pausado.`);
      }
      return;
    }

    const settings = await getSettings();
    if (!isWithinFollowUpWindow(new Date(), settings.followUpStartTime, settings.followUpEndTime)) {
      console.log(
        `[followups] Follow-up para ${phone} ignorado: fora da janela permitida (${settings.followUpStartTime ?? "08:00"} às ${settings.followUpEndTime ?? "20:00"} SP).`
      );
      await addSystemLog({
        level: "info",
        source: "worker",
        message: `Follow-up para ${phone} ignorado: fora da janela permitida (${settings.followUpStartTime ?? "08:00"} às ${settings.followUpEndTime ?? "20:00"} SP).`,
        phone,
        details: { attempt, stage: client.stage },
      });
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

    const intervals =
      settings.followUpIntervals?.length ? settings.followUpIntervals : DEFAULT_FOLLOW_UP_INTERVALS;
    const maxAttempts = intervals.length;

    if (attempt < maxAttempts) {
      await scheduleFollowUp(phone, attempt + 1);
    } else {
      await prisma.client.update({ where: { id: client.id }, data: { stage: SaleStage.PAROU_DE_RESPONDER } });
    }
  },
  { connection: redisConnection }
);

const PROSPECT_CALL_TIMEOUT_MS = 15 * 60 * 1000;
const STUCK_CALL_THRESHOLD_MS = 20 * 60 * 1000;

async function recoverStuckProspectingCalls() {
  try {
    const cutoff = new Date(Date.now() - STUCK_CALL_THRESHOLD_MS);
    const recovered = await prisma.prospectLead.updateMany({
      where: {
        status: ProspectStatus.EM_CHAMADA,
        OR: [{ calledAt: { lt: cutoff } }, { calledAt: null }],
      },
      data: {
        status: ProspectStatus.ERRO,
        notes: "Chamada interrompida sem retorno da ElevenLabs (recuperado pelo worker).",
      },
    });
    if (recovered.count > 0) {
      console.warn(`[prospecting] ${recovered.count} lead(s) presos em EM_CHAMADA marcados como ERRO.`);
      await addSystemLog({
        level: "warn",
        source: "prospecting",
        message: `${recovered.count} lead(s) presos em EM_CHAMADA por mais de 20 min foram marcados como ERRO.`,
      });
    }
  } catch (err) {
    console.error("[prospecting] Falha ao recuperar chamadas travadas:", err);
  }
}

void recoverStuckProspectingCalls();
setInterval(() => {
  void recoverStuckProspectingCalls();
}, 5 * 60 * 1000).unref();

const prospectingWorker = new Worker<ProspectingCallJob>(
  QUEUE_NAMES.prospecting,
  async (job) => {
    const { leadId } = job.data;
    try {
      const settings = await getSettings({ bypassCache: true });
      if (!settings.isProspectingActive) {
        console.log(`[prospecting] Campanha pausada. Job ${job.id} para lead ${leadId} abortado.`);
        return;
      }

      if (!isWithinFollowUpWindow(new Date(), settings.followUpStartTime, settings.followUpEndTime)) {
        const start = settings.followUpStartTime ?? "08:00";
        const end = settings.followUpEndTime ?? "20:00";
        console.log(
          `[prospecting] Fora do horário permitido (${start} às ${end} SP). Pausando campanha automaticamente.`
        );
        await pauseProspecting(
          `Prospecção pausada automaticamente: fora do horário permitido (${start} às ${end} SP).`
        );
        return;
      }

      const lead = await prisma.prospectLead.findUnique({ where: { id: leadId } });
      if (!lead) return;
      if (
        lead.status === ProspectStatus.ATENDEU ||
        lead.status === ProspectStatus.TEXTO_ENVIADO ||
        lead.status === ProspectStatus.EM_CHAMADA
      ) {
        return;
      }

      const client = await ensureClientForProspect(lead);
      if (client.stage === SaleStage.FECHOU_VENDA) {
        await prisma.prospectLead.updateMany({
          where: {
            id: lead.id,
            status: {
              notIn: [ProspectStatus.ATENDEU, ProspectStatus.TEXTO_ENVIADO, ProspectStatus.EM_CHAMADA],
            },
          },
          data: {
            status: ProspectStatus.ERRO,
            notes: "Ignorado: cliente já está em FECHOU_VENDA no CRM.",
          },
        });
        await addSystemLog({
          level: "warn",
          source: "prospecting",
          message: `Lead ${lead.phone} (${lead.name}) ignorado na prospecção: cliente já está em FECHOU_VENDA.`,
          phone: lead.phone,
        });
        return;
      }

      // Reivindica atomicamente o lead para EM_CHAMADA evitando ligações duplicadas concorrentes
      const claimed = await prisma.prospectLead.updateMany({
        where: {
          id: lead.id,
          status: {
            notIn: [ProspectStatus.ATENDEU, ProspectStatus.TEXTO_ENVIADO, ProspectStatus.EM_CHAMADA],
          },
        },
        data: {
          status: ProspectStatus.EM_CHAMADA,
          lastAction: "VOICE",
          calledAt: new Date(),
          elevenLabsConversationId: null,
          elevenLabsSipCallId: null,
          callDurationSecs: null,
          callSummary: null,
        },
      });
      if (claimed.count === 0) {
        return;
      }

      try {
        await addSystemLog({
          level: "info",
          source: "prospecting",
          message: `Iniciando chamada SIP ElevenLabs para ${lead.phone} (${lead.name})`,
          phone: lead.phone,
        });

        // Assina Redis Pub/Sub (aguardando SUBSCRIBE) antes de disparar a chamada para evitar race condition
        const waiter = await prepareCallResultWaiter(lead.id, PROSPECT_CALL_TIMEOUT_MS);

        try {
          const call = await startElevenLabsSipOutboundCall(lead, client.id);

          if (call.conversationId || call.sipCallId) {
            await prisma.prospectLead.updateMany({
              where: { id: lead.id, status: ProspectStatus.EM_CHAMADA },
              data: {
                ...(call.conversationId ? { elevenLabsConversationId: call.conversationId } : {}),
                ...(call.sipCallId ? { elevenLabsSipCallId: call.sipCallId } : {}),
              },
            });
          }

          const result = await waiter.promise;

          if (result.answered) {
            // Caso o webhook ainda não tenha gravado ATENDEU (ex.: payload mínimo), garante o status
            await prisma.prospectLead.updateMany({
              where: { id: lead.id, status: ProspectStatus.EM_CHAMADA },
              data: {
                status: ProspectStatus.ATENDEU,
                notes: "Lead atendeu a chamada de voz (ElevenLabs).",
              },
            });
          } else {
            const reason = result.timeout
              ? "Timeout aguardando retorno da chamada (15 min)"
              : result.reason || "Não atendeu / falha na chamada SIP";

            await finalizeUnansweredProspect(
              lead,
              client.id,
              reason,
              result.conversationId ?? call.conversationId
            );
          }
        } finally {
          waiter.cancel();
        }
      } catch (err) {
        console.error(`[prospecting] Erro ao processar lead ${lead.phone}:`, err);
        await prisma.prospectLead.updateMany({
          where: { id: lead.id, status: ProspectStatus.EM_CHAMADA },
          data: {
            status: ProspectStatus.ERRO,
            notes: err instanceof Error ? err.message : String(err),
          },
        });
        await addSystemLog({
          level: "error",
          source: "prospecting",
          message: `Erro na prospecção do lead ${lead.phone}: ${err instanceof Error ? err.message : String(err)}`,
          phone: lead.phone,
        });
      }
    } finally {
      await deactivateProspectingIfIdle().catch((err) => {
        console.error("[prospecting] Falha ao verificar encerramento automático da campanha:", err);
      });
    }
  },
  {
    connection: redisConnection,
    concurrency: 1, // Exclusividade: apenas 1 chamada de voz por vez
    lockDuration: 300_000, // 5 min (BullMQ renova automaticamente enquanto a promise estiver ativa)
    stalledInterval: 300_000,
  }
);

for (const worker of [messagesWorker, followUpsWorker, prospectingWorker]) {
  worker.on("failed", (job, err) => {
    console.error(`[${worker.name}] job ${job?.id} falhou:`, err);
  });
}

console.log(
  "Worker rodando. Filas:",
  QUEUE_NAMES.messages,
  QUEUE_NAMES.followups,
  QUEUE_NAMES.prospecting
);

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
  sendProspectingWebhook,
  waitForCallResult,
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
    if (
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

    if (attempt < 3) {
      await scheduleFollowUp(phone, (attempt + 1) as 2 | 3);
    } else {
      await prisma.client.update({ where: { id: client.id }, data: { stage: SaleStage.PAROU_DE_RESPONDER } });
    }
  },
  { connection: redisConnection }
);

const prospectingWorker = new Worker<ProspectingCallJob>(
  QUEUE_NAMES.prospecting,
  async (job) => {
    const { leadId } = job.data;
    const settings = await getSettings();
    if (!settings.isProspectingActive) {
      console.log(`[prospecting] Campanha pausada. Job ${job.id} para lead ${leadId} abortado.`);
      return;
    }

    const lead = await prisma.prospectLead.findUnique({ where: { id: leadId } });
    if (!lead) return;
    if (lead.status === ProspectStatus.ATENDEU || lead.status === ProspectStatus.TEXTO_ENVIADO) {
      return;
    }

    try {
      const client = await ensureClientForProspect(lead);

      await prisma.prospectLead.update({
        where: { id: lead.id },
        data: {
          status: ProspectStatus.EM_CHAMADA,
          lastAction: "VOICE",
          calledAt: new Date(),
        },
      });

      await addSystemLog({
        level: "info",
        source: "prospecting",
        message: `Iniciando chamada de voz para ${lead.phone} (${lead.name})`,
        phone: lead.phone,
      });

      // Inicia a escuta no Redis Pub/Sub antes de disparar o webhook de voz para evitar race condition
      const waitPromise = waitForCallResult(lead.phone, 120_000);

      await sendProspectingWebhook({
        leadId: lead.id,
        clientId: client.id,
        phone: lead.phone,
        name: lead.name,
        action: "VOICE",
        metadata: {
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

      // Aguarda o webhook de callback com resultado da chamada (timeout padrão 120s)
      const result = await waitPromise;

      if (result.answered) {
        await prisma.prospectLead.update({
          where: { id: lead.id },
          data: {
            status: ProspectStatus.ATENDEU,
            notes: "Lead atendeu a chamada de voz.",
          },
        });
        await addSystemLog({
          level: "info",
          source: "prospecting",
          message: `Lead ${lead.phone} (${lead.name}) ATENDEU a chamada de voz.`,
          phone: lead.phone,
        });
      } else {
        const reason = result.timeout
          ? "Timeout (não atendeu em 120s)"
          : "Não atendeu / falha na chamada";

        await prisma.prospectLead.update({
          where: { id: lead.id },
          data: {
            status: ProspectStatus.NAO_ATENDEU,
            notes: reason,
          },
        });

        await addSystemLog({
          level: "warn",
          source: "prospecting",
          message: `Lead ${lead.phone} (${lead.name}) NÃO atendeu (${reason}). Disparando texto...`,
          phone: lead.phone,
        });

        // Dispara mensagem de texto (fire-and-forget) e avança imediatamente
        try {
          await sendProspectingWebhook({
            leadId: lead.id,
            clientId: client.id,
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

          await prisma.prospectLead.update({
            where: { id: lead.id },
            data: {
              status: ProspectStatus.TEXTO_ENVIADO,
              lastAction: "TEXT",
              textSentAt: new Date(),
            },
          });
        } catch (textErr) {
          console.error(`[prospecting] Falha ao disparar webhook de TEXT para ${lead.phone}:`, textErr);
          await addSystemLog({
            level: "error",
            source: "prospecting",
            message: `Falha ao disparar webhook de TEXT para ${lead.phone}: ${textErr instanceof Error ? textErr.message : String(textErr)}`,
            phone: lead.phone,
          });
        }
      }
    } catch (err) {
      console.error(`[prospecting] Erro ao processar lead ${lead.phone}:`, err);
      await prisma.prospectLead.update({
        where: { id: lead.id },
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
  },
  {
    connection: redisConnection,
    concurrency: 1, // Exclusividade: apenas 1 chamada de voz por vez
    lockDuration: 180_000, // 3 min (evita job stall durante o timeout de 120s da chamada)
    stalledInterval: 180_000,
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

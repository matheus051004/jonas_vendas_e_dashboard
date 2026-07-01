import { Worker } from "bullmq";
import { prisma, SaleStage } from "@jonas/db";
import {
  QUEUE_NAMES,
  redisConnection,
  scheduleFollowUp,
  cancelFollowUp,
  transcribeAudioBase64,
  upsertClientByPhone,
  runAgent,
  saveMessage,
  sendOutboundMessage,
  type IncomingMessageJob,
  type FollowUpJob,
} from "@jonas/shared";

const FOLLOW_UP_NUDGES: Record<1 | 2 | 3, string> = {
  1: "Oi! Ainda por aí? Fico à disposição pra continuar te ajudando a encontrar o plano ideal 🙂",
  2: "Passando só pra lembrar que ainda posso te ajudar com a internet. Quer continuar de onde paramos?",
  3: "Essa é minha última tentativa de contato por aqui. Se quiser retomar, é só me chamar quando puder!",
};

// Fila "messages": recebe cada mensagem inbound (texto ou áudio) do webhook e roda o agente.
const messagesWorker = new Worker<IncomingMessageJob>(
  QUEUE_NAMES.messages,
  async (job) => {
    const { phone, type, text, audioBase64, mimeType } = job.data;

    const client = await upsertClientByPhone(phone);

    const userText = type === "audio" ? await transcribeAudioBase64(audioBase64!, mimeType) : text!;
    await saveMessage(client.id, "user", userText, type);

    // Qualquer inbound cancela o follow-up pendente e reseta a contagem de tentativas.
    await cancelFollowUp(phone);
    await prisma.client.update({
      where: { id: client.id },
      data: { lastInboundAt: new Date(), followUpCount: 0 },
    });

    const reply = await runAgent(client, userText);
    await saveMessage(client.id, "assistant", reply);
    await sendOutboundMessage({ phone, text: reply });

    // Agenda o 1º follow-up; se o cliente já fechou ou desistiu nesta mesma mensagem, não faz sentido.
    const updated = await prisma.client.findUniqueOrThrow({ where: { id: client.id } });
    if (updated.stage !== SaleStage.FECHOU_VENDA && updated.stage !== SaleStage.DESISTIU) {
      await scheduleFollowUp(phone, 1);
    }
  },
  { connection: redisConnection }
);

// Fila "followups": dispara os nudges de 1h/2h/3h e marca desistência se o lead não responder.
const followUpsWorker = new Worker<FollowUpJob>(
  QUEUE_NAMES.followups,
  async (job) => {
    const { phone, attempt } = job.data;
    const client = await prisma.client.findUnique({ where: { phone } });
    if (!client) return;
    if (client.stage === SaleStage.FECHOU_VENDA || client.stage === SaleStage.DESISTIU) return;

    await prisma.client.update({ where: { id: client.id }, data: { followUpCount: attempt } });
    await saveMessage(client.id, "assistant", FOLLOW_UP_NUDGES[attempt]);
    await sendOutboundMessage({ phone, text: FOLLOW_UP_NUDGES[attempt] });

    if (attempt < 3) {
      await scheduleFollowUp(phone, (attempt + 1) as 2 | 3);
    } else {
      await prisma.client.update({ where: { id: client.id }, data: { stage: SaleStage.DESISTIU } });
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

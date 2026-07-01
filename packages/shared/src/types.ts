import { z } from "zod";
import { SaleStage } from "@jonas/db";

export { SaleStage };

// Payload aceito pelo webhook de entrada (apps/web/app/api/webhooks/inbound).
export const InboundWebhookSchema = z.object({
  phone: z.string().min(1),
  type: z.enum(["text", "audio"]),
  text: z.string().optional(),
  audioBase64: z.string().optional(),
  mimeType: z.string().optional(),
}).refine(
  (data) => (data.type === "text" ? !!data.text : !!data.audioBase64),
  { message: "text é obrigatório quando type=text; audioBase64 quando type=audio" }
);

export type InboundWebhookPayload = z.infer<typeof InboundWebhookSchema>;

// Payload enviado ao webhook de saída (resposta da IA) e ao webhook de contrato.
export interface OutboundMessagePayload {
  phone: string;
  text: string;
}

export interface ContractWebhookPayload {
  phone: string;
  fullName: string;
  cpf: string;
  phonePrimary: string;
  phoneSecondary: string;
  email: string;
  gender: string;
  observation?: string;
  planId?: string;
}

// Job enfileirado na fila "messages" (ver queue.ts).
export interface IncomingMessageJob {
  phone: string;
  type: "text" | "audio";
  text?: string;
  audioBase64?: string;
  mimeType?: string;
}

// Job enfileirado na fila "followups".
export interface FollowUpJob {
  phone: string;
  attempt: 1 | 2 | 3;
}

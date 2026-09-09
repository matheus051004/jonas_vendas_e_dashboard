import { z } from "zod";
import { SaleStage } from "@jonas/db";

export { SaleStage };

/** Objeto livre de metadados opacos do chat externo (ecoados nos webhooks). */
export const MetadataSchema = z.record(z.string(), z.unknown());
export type WebhookMetadata = z.infer<typeof MetadataSchema>;

/** Normaliza Json do Prisma / valor desconhecido para o objeto de metadata do webhook. */
export function asWebhookMetadata(value: unknown): WebhookMetadata | undefined {
  if (value === null || value === undefined) return undefined;
  if (typeof value !== "object" || Array.isArray(value)) return undefined;
  return value as WebhookMetadata;
}

// Payload aceito pelo webhook de entrada (apps/web/app/api/webhooks/inbound).
export const InboundWebhookSchema = z
  .object({
    phone: z.string().min(1),
    type: z.enum(["text", "audio"]),
    text: z.string().optional(),
    transcription: z.string().optional(),
    audioBase64: z.string().optional(),
    mimeType: z.string().optional(),
    metadata: MetadataSchema.optional(),
  })
  .refine(
    (data) =>
      data.type === "text"
        ? !!data.text
        : !!(data.audioBase64 || data.transcription || data.text),
    {
      message:
        "text é obrigatório quando type=text; audioBase64, transcription ou text quando type=audio",
    }
  );

export type InboundWebhookPayload = z.infer<typeof InboundWebhookSchema>;

/** Resposta da IA externa → lead (salva Message assistant + envia ao chat). */
export const AgentReplySchema = z.object({
  phone: z.string().min(1),
  text: z.string().min(1),
  metadata: MetadataSchema.optional(),
});
export type AgentReplyPayload = z.infer<typeof AgentReplySchema>;

// Payload enviado ao webhook de saída (chat) e ao webhook de contrato.
export interface OutboundMessagePayload {
  phone: string;
  text: string;
  metadata?: WebhookMetadata;
}

export interface ContractWebhookPayload {
  phone: string;
  personType?: "pf" | "pj";
  fullName?: string | null;
  cpf?: string | null;
  companyName?: string | null;
  tradeName?: string | null;
  cnpj?: string | null;
  stateRegistration?: string | null;
  contactName?: string | null;
  phonePrimary: string;
  phoneSecondary?: string | null;
  email: string;
  gender?: string | null;
  observation?: string;
  planId?: string;
  rg?: string | null;
  rgEmissor?: string | null;
  birthDate?: string | null;
  motherName?: string | null;
  fatherName?: string | null;
  maritalStatus?: string | null;
  profession?: string | null;
  nationality?: string | null;
  cep?: string | null;
  street?: string | null;
  number?: string | null;
  neighborhood?: string | null;
  complement?: string | null;
  reference?: string | null;
  hubsoftClientId?: number | null;
  packages?: Array<{
    id: string;
    name: string;
    price: number;
    hubsoftPackageId?: number | null;
  }>;
  metadata?: WebhookMetadata;
}

/** Eventos enviados ao sistema de IA externo (agentWebhookUrl). */
export type AgentWebhookPayload =
  | {
      event: "message.inbound";
      phone: string;
      clientId: string;
      type: "text" | "audio";
      text?: string;
      transcription?: string;
      audioBase64?: string;
      mimeType?: string;
      metadata?: WebhookMetadata;
      client: Record<string, unknown>;
      history: Array<{
        role: string;
        content: string;
        kind: string;
        createdAt: string;
      }>;
    }
  | {
      event: "followup.due";
      phone: string;
      clientId: string;
      attempt: 1 | 2 | 3;
      metadata?: WebhookMetadata;
      client: Record<string, unknown>;
      history?: Array<{
        role: string;
        content: string;
        kind: string;
        createdAt: string;
      }>;
    };

// Job enfileirado na fila "messages".
export interface IncomingMessageJob {
  phone: string;
  type: "text" | "audio";
  text?: string;
  transcription?: string;
  audioBase64?: string;
  mimeType?: string;
  metadata?: WebhookMetadata;
}

// Job enfileirado na fila "followups".
export interface FollowUpJob {
  phone: string;
  attempt: 1 | 2 | 3;
}

export const UpdateClientBodySchema = z.object({
  name: z.unknown().optional(),
  areaId: z.unknown().optional(),
  originId: z.unknown().optional(),
  currentProvider: z.unknown().optional(),
  currentPrice: z.unknown().optional(),
  hadBadExperience: z.unknown().optional(),
  badExperienceNote: z.unknown().optional(),
});

export const SetStageBodySchema = z.object({
  stage: z.preprocess((val) => {
    if (typeof val === "string") {
      return val.trim().toUpperCase().replace(/\s+/g, "_");
    }
    return val;
  }, z.nativeEnum(SaleStage)),
});

export const RegisterContractBodySchema = z.object({
  hubsoftToken: z.string().min(1, "hubsoftToken é obrigatório"),
  planId: z.unknown().optional(),
  fullName: z.string().min(1, "Nome completo é obrigatório"),
  cpf: z.string().min(1, "CPF é obrigatório"),
  phonePrimary: z.string().min(1, "Telefone principal é obrigatório"),
  phoneSecondary: z.unknown().optional(),
  email: z.string().min(1, "E-mail é obrigatório"),
  gender: z.string().min(1, "Gênero é obrigatório"),
  observation: z.unknown().optional(),
  rg: z.string().min(1, "RG é obrigatório"),
  rgEmissor: z.string().min(1, "Órgão emissor do RG é obrigatório"),
  birthDate: z.string().min(1, "Data de nascimento é obrigatória"),
  motherName: z.string().min(1, "Nome da mãe é obrigatório"),
  fatherName: z.unknown().optional(),
  maritalStatus: z.string().min(1, "Estado civil é obrigatório"),
  profession: z.string().min(1, "Profissão é obrigatória"),
  nationality: z.unknown().optional(),
  cep: z.string().min(1, "CEP é obrigatório"),
  street: z.string().min(1, "Rua/logradouro é obrigatório"),
  number: z.string().min(1, "Número do endereço é obrigatório"),
  neighborhood: z.string().min(1, "Bairro é obrigatório"),
  complement: z.unknown().optional(),
  reference: z.unknown().optional(),
  packageIds: z.preprocess((val) => {
    if (Array.isArray(val)) return val.map((item) => (item != null ? String(item).trim() : "")).filter(Boolean);
    return val;
  }, z.array(z.string()).optional()),
});

export type RegisterContractInput = z.infer<typeof RegisterContractBodySchema>;

export const RegisterContractPJBodySchema = z.object({
  hubsoftToken: z.string().min(1, "hubsoftToken é obrigatório"),
  planId: z.unknown().optional(),
  companyName: z.string().min(1, "Razão social é obrigatória"),
  tradeName: z.unknown().optional(),
  cnpj: z.string().min(1, "CNPJ é obrigatório"),
  stateRegistration: z.unknown().optional(),
  contactName: z.string().min(1, "Nome do responsável é obrigatório"),
  phonePrimary: z.string().min(1, "Telefone principal é obrigatório"),
  phoneSecondary: z.unknown().optional(),
  email: z.string().min(1, "E-mail corporativo é obrigatório"),
  observation: z.unknown().optional(),
  cep: z.string().min(1, "CEP é obrigatório"),
  street: z.string().min(1, "Rua/logradouro é obrigatório"),
  number: z.string().min(1, "Número do endereço é obrigatório"),
  neighborhood: z.string().min(1, "Bairro é obrigatório"),
  complement: z.unknown().optional(),
  reference: z.unknown().optional(),
  packageIds: z.preprocess((val) => {
    if (Array.isArray(val)) return val.map((item) => (item != null ? String(item).trim() : "")).filter(Boolean);
    return val;
  }, z.array(z.string()).optional()),
});

export type RegisterContractPJInput = z.infer<typeof RegisterContractPJBodySchema>;


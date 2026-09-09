import { z } from "zod";

const required = (label: string) => z.string().min(1, `Informe ${label}`);

export const PlanFormSchema = z.object({
  name: required("o nome"),
  price: z.coerce.number().positive("Informe um valor sem fidelidade maior que zero"),
  priceWithLoyalty: z.preprocess((val) => {
    if (val === "" || val === null || val === undefined) return null;
    return val;
  }, z.coerce.number().positive("Informe um valor com fidelidade maior que zero").nullable().optional()),
  loyaltyMonths: z.coerce.number().int().min(0, "Informe meses de fidelidade válidos"),
  description: required("a descrição"),
  hubsoftServiceId: z.coerce.number().int().positive().nullable().optional(),
  active: z.boolean(),
  areaIds: z.array(z.string()).default([]),
  packageIds: z.array(z.string()).default([]),
  promotionIds: z.array(z.string()).default([]),
});

export const PackageFormSchema = z.object({
  name: required("o nome"),
  price: z.coerce.number().nonnegative("Informe um valor válido"),
  description: required("a descrição"),
  hubsoftPackageId: z.coerce.number().int().positive().nullable().optional(),
  active: z.boolean(),
  planIds: z.array(z.string()).default([]),
});

export const PromotionFormSchema = z.object({
  name: required("o nome"),
  description: z.string().optional().default(""),
  hubsoftPromotionId: z.coerce.number().int().positive("Informe um ID válido do Hubsoft").nullable().optional(),
  active: z.boolean(),
  planIds: z.array(z.string()).default([]),
});

export const AreaFormSchema = z.object({
  name: required("o nome da área"),
  observation: z.string(),
  active: z.boolean(),
  planIds: z.array(z.string()),
});

export const OriginFormSchema = z.object({
  name: required("o nome"),
  hubsoftOriginId: z.coerce.number().int().positive().nullable().optional(),
  active: z.boolean(),
});

export const ClientEditSchema = z.object({
  name: z.string().nullable(),
  areaId: z.string().nullable(),
  originId: z.string().nullable(),
  stage: z.string(),
  currentProvider: z.string().nullable(),
  currentPrice: z.number().nonnegative("Informe um valor válido").nullable(),
  hadBadExperience: z.boolean().nullable(),
  badExperienceNote: z.string().nullable(),
});

const emptyOrUrl = z.union([z.string().url("Informe uma URL válida"), z.literal("")]);

const hexColor = z
  .string()
  .regex(/^#([0-9A-Fa-f]{6})$/, "Use uma cor hexadecimal (#RRGGBB)");

export const SettingsBrandingSchema = z.object({
  brandName: required("o nome do sistema").max(80, "Máximo 80 caracteres"),
  brandLogo: z.string().nullable(),
  colorPrimary: hexColor,
  colorSecondary: hexColor,
  colorBackground: hexColor,
});

export const SettingsWebhooksSchema = z.object({
  agentWebhookUrl: emptyOrUrl,
  outboundWebhookUrl: emptyOrUrl,
  contractWebhookUrl: emptyOrUrl,
  outboundWebhookSecret: z.string().nullable(),
});

export const SettingsPromptSchema = z.object({
  aiPrompt: z.string(),
});

export const SettingsHubsoftSchema = z.object({
  hubsoftBaseUrl: z.string().url("Informe uma URL válida"),
  hubsoftVendedorId: z.coerce.number().int().positive("Informe um ID válido"),
  hubsoftVencimentoId: z.coerce.number().int().positive("Informe um ID válido"),
  hubsoftMotivoContratacaoId: z.coerce.number().int().positive("Informe um ID válido"),
  hubsoftGruposClienteIds: z.array(z.coerce.number().int()).default([4]),
  hubsoftGruposServicoIds: z.array(z.coerce.number().int()).default([835]),
  hubsoftFormaCobrancaId: z.coerce.number().int().positive("Informe um ID válido"),
  hubsoftServicoStatusId: z.coerce.number().int().positive("Informe um ID válido"),
});



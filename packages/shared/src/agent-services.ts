import { prisma, SaleStage, type Prisma } from "@jonas/db";
import { asWebhookMetadata, type RegisterContractInput, type RegisterContractPJInput } from "./types";
import { sendContractWebhook, sendAgentWebhook } from "./webhooks";
import { listMessages } from "./messages";
import { scheduleFollowUp, cancelFollowUp } from "./queue";
import { getSettings } from "./settings";
import { addSystemLog } from "./logger";

export class HubsoftApiError extends Error {
  constructor(
    message: string,
    public statusCode: number,
    public details?: unknown
  ) {
    super(message);
    this.name = "HubsoftApiError";
  }
}

export function parseHubsoftResponse(rawJson: unknown, httpStatus: number) {
  const dataItem = (Array.isArray(rawJson) ? rawJson[0] : rawJson) as Record<string, unknown> | null;

  const isHubsoftError =
    httpStatus < 200 ||
    httpStatus >= 300 ||
    dataItem?.status === "error" ||
    (Array.isArray(dataItem?.errors) && dataItem.errors.length > 0);

  if (isHubsoftError) {
    const errorList = Array.isArray(dataItem?.errors)
      ? (dataItem.errors as string[]).join("; ")
      : null;
    const errorDetail =
      errorList ||
      (dataItem?.msg as string) ||
      (dataItem?.message as string) ||
      (dataItem?.error as string) ||
      (typeof dataItem === "string" ? dataItem : null) ||
      (dataItem && typeof dataItem === "object" ? JSON.stringify(dataItem) : null) ||
      `Hubsoft respondeu com status ${httpStatus}`;

    void addSystemLog({
      level: "error",
      source: "hubsoft",
      message: errorDetail,
      details: rawJson,
    });

    throw new HubsoftApiError(errorDetail, httpStatus, rawJson);
  }

  const clienteObj = (dataItem?.cliente ?? dataItem?.data ?? dataItem) as Record<string, unknown> | undefined;

  const hubsoftClientId =
    typeof clienteObj?.id_cliente === "number"
      ? clienteObj.id_cliente
      : typeof dataItem?.id_cliente === "number"
      ? dataItem.id_cliente
      : null;

  const servicos = (clienteObj?.servicos ?? dataItem?.servicos) as Array<Record<string, unknown>> | undefined;
  const firstServico = Array.isArray(servicos) && servicos.length > 0 ? servicos[0] : null;

  const hubsoftProtocol =
    ((dataItem?.protocolo as string) ||
      (dataItem?.numero_protocolo as string) ||
      (firstServico?.id_cliente_servico !== undefined ? String(firstServico.id_cliente_servico) : null) ||
      (clienteObj?.codigo_cliente !== undefined ? String(clienteObj.codigo_cliente) : null)) ??
    null;

  return {
    rawJson,
    hubsoftClientId,
    hubsoftProtocol,
  };
}

export async function getAiPrompt(): Promise<string> {
  const settings = await getSettings();
  return settings.aiPrompt ?? "";
}

export type UpdateClientInput = {
  name?: unknown;
  areaId?: unknown;
  originId?: unknown;
  currentProvider?: unknown;
  currentPrice?: unknown;
  hadBadExperience?: unknown;
  badExperienceNote?: unknown;
};

export function cleanString(val: unknown): string | null {
  if (val === null || val === undefined) return null;
  const s = String(val).trim();
  if (
    !s ||
    s.toLowerCase() === "null" ||
    s.toLowerCase() === "undefined" ||
    s.toLowerCase() === "none" ||
    s.toLowerCase() === "n/a" ||
    s.toLowerCase() === "não informado" ||
    s.toLowerCase() === "nao informado"
  ) {
    return null;
  }
  return s;
}

export function cleanNumber(val: unknown): number | null {
  if (val === null || val === undefined) return null;
  if (typeof val === "number") return isNaN(val) ? null : val;
  const s = String(val).replace(/[^\d.,]/g, "").replace(",", ".");
  const n = parseFloat(s);
  return isNaN(n) ? null : n;
}

export function cleanBoolean(val: unknown): boolean | null {
  if (val === null || val === undefined) return null;
  if (typeof val === "boolean") return val;
  const s = String(val).trim().toLowerCase();
  if (s === "true" || s === "1" || s === "sim" || s === "yes") return true;
  if (s === "false" || s === "0" || s === "nao" || s === "não" || s === "no") return false;
  return null;
}

export async function resolvePlan(rawPlanId: unknown) {
  const clean = cleanString(rawPlanId);
  if (!clean) return null;

  const include = {
    promotions: {
      include: { promotion: true },
    },
  };

  // 1. Por ID CUID
  const byId = await prisma.plan.findUnique({ where: { id: clean }, include });
  if (byId) return byId;

  // 2. Por hubsoftServiceId numérico
  if (!isNaN(Number(clean))) {
    const byHubsoft = await prisma.plan.findFirst({
      where: { hubsoftServiceId: Number(clean) },
      include,
    });
    if (byHubsoft) return byHubsoft;
  }

  // 3. Por Nome (case-insensitive)
  const byName = await prisma.plan.findFirst({
    where: { name: { equals: clean, mode: "insensitive" } },
    include,
  });
  if (byName) return byName;

  return null;
}

export async function resolvePackage(rawPackageId: unknown) {
  const clean = cleanString(rawPackageId);
  if (!clean) return null;

  // 1. Por ID CUID
  const byId = await prisma.package.findUnique({ where: { id: clean } });
  if (byId) return byId;

  // 2. Por hubsoftPackageId numérico
  if (!isNaN(Number(clean))) {
    const byHubsoft = await prisma.package.findFirst({
      where: { hubsoftPackageId: Number(clean) },
    });
    if (byHubsoft) return byHubsoft;
  }

  // 3. Por Nome (case-insensitive)
  const byName = await prisma.package.findFirst({
    where: { name: { equals: clean, mode: "insensitive" } },
  });
  if (byName) return byName;

  return null;
}

export async function resolveAndValidatePackages(
  rawPackageIds: unknown[] | undefined,
  plan: { id: string; name: string } | null
) {
  if (!rawPackageIds || !Array.isArray(rawPackageIds) || rawPackageIds.length === 0) {
    return [];
  }

  if (!plan) {
    throw new Error("É necessário selecionar um plano válido para incluir pacotes adicionais.");
  }

  const rawStringIds = rawPackageIds
    .map((item) => cleanString(item))
    .filter((x): x is string => x !== null);

  // Validação: não pode haver repetido na entrada
  if (new Set(rawStringIds).size !== rawStringIds.length) {
    throw new Error("Não é permitido selecionar pacotes repetidos.");
  }

  const resolved = await Promise.all(
    rawStringIds.map(async (rawId) => {
      const pkg = await resolvePackage(rawId);
      if (!pkg) {
        throw new Error(`Pacote não encontrado: "${rawId}"`);
      }
      if (!pkg.active) {
        throw new Error(`O pacote "${pkg.name}" está inativo no momento.`);
      }
      return pkg;
    })
  );

  // Validação: não pode haver ID repetido após resolução
  const uniqueIds = new Set(resolved.map((p) => p.id));
  if (uniqueIds.size !== resolved.length) {
    throw new Error("Não é permitido selecionar pacotes repetidos.");
  }

  // Validação: verificar se o plano aceita os pacotes
  const allowedPlanPackages = await prisma.planPackage.findMany({
    where: { planId: plan.id },
  });
  const allowedPackageIds = new Set(allowedPlanPackages.map((pp) => pp.packageId));

  for (const pkg of resolved) {
    if (!allowedPackageIds.has(pkg.id)) {
      throw new Error(`O pacote "${pkg.name}" não está disponível para o plano "${plan.name}".`);
    }
  }

  return resolved;
}

/** Só aplica campos com valor real válido (null/undefined/vazio não quebram nem apagam). */
export async function updateClientFields(clientId: string, input: UpdateClientInput) {
  const data: Record<string, unknown> = {};

  const name = cleanString(input.name);
  if (name !== null) data.name = name;

  const currentProvider = cleanString(input.currentProvider);
  if (currentProvider !== null) data.currentProvider = currentProvider;

  const badExperienceNote = cleanString(input.badExperienceNote);
  if (badExperienceNote !== null) data.badExperienceNote = badExperienceNote;

  const currentPrice = cleanNumber(input.currentPrice);
  if (currentPrice !== null) data.currentPrice = currentPrice;

  const hadBadExperience = cleanBoolean(input.hadBadExperience);
  if (hadBadExperience !== null) data.hadBadExperience = hadBadExperience;

  // Se originId foi enviado, resolver se é id, hubsoftOriginId ou nome da origem
  const rawOrigin = cleanString(input.originId);
  if (rawOrigin !== null) {
    const origin =
      (await prisma.origin.findUnique({ where: { id: rawOrigin } })) ||
      (!isNaN(Number(rawOrigin))
        ? await prisma.origin.findFirst({ where: { hubsoftOriginId: Number(rawOrigin) } })
        : null) ||
      (await prisma.origin.findFirst({
        where: { name: { equals: rawOrigin, mode: "insensitive" } },
      }));

    if (origin) {
      data.originId = origin.id;
    }
  }

  // Se areaId foi enviado, resolver se é id ou nome da área
  const rawArea = cleanString(input.areaId);
  if (rawArea !== null) {
    const area =
      (await prisma.area.findUnique({ where: { id: rawArea } })) ||
      (await prisma.area.findFirst({
        where: { name: { equals: rawArea, mode: "insensitive" } },
      }));

    if (area) {
      data.areaId = area.id;
    }
  }

  if (Object.keys(data).length === 0) {
    return prisma.client.findUniqueOrThrow({ where: { id: clientId } });
  }

  return prisma.client.update({ where: { id: clientId }, data });
}

export async function listActiveOrigins() {
  return prisma.origin.findMany({
    where: { active: true },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
}

export async function listActiveAreas() {
  return prisma.area.findMany({
    where: { active: true },
    select: { id: true, name: true, observation: true },
    orderBy: { name: "asc" },
  });
}

export async function listPlansByAreaId(rawAreaId: string) {
  const clean = decodeURIComponent(rawAreaId).trim();
  const area =
    (await prisma.area.findUnique({
      where: { id: clean },
      include: {
        plans: {
          include: {
            plan: {
              include: {
                packages: {
                  include: { package: true },
                },
              },
            },
          },
        },
      },
    })) ||
    (await prisma.area.findFirst({
      where: { name: { equals: clean, mode: "insensitive" } },
      include: {
        plans: {
          include: {
            plan: {
              include: {
                packages: {
                  include: { package: true },
                },
              },
            },
          },
        },
      },
    }));

  if (!area) return { error: "not_found" as const };
  if (!area.active) return { error: "inactive" as const };

  const plans = area.plans
    .map((ap) => ap.plan)
    .filter((p) => p.active)
    .map((p) => ({
      id: p.id,
      name: p.name,
      price: p.price,
      priceWithLoyalty: p.priceWithLoyalty,
      loyaltyMonths: p.loyaltyMonths,
      description: p.description,
      packages: p.packages
        .map((pp) => pp.package)
        .filter((pkg) => pkg.active)
        .map((pkg) => ({
          id: pkg.id,
          name: pkg.name,
          price: pkg.price,
          description: pkg.description,
        })),
    }));

  return {
    areaId: area.id,
    areaName: area.name,
    observation: area.observation,
    plans,
  };
}

export async function setClientStage(clientId: string, stage: SaleStage) {
  return prisma.client.update({ where: { id: clientId }, data: { stage } });
}

export async function registerClientContract(clientId: string, input: RegisterContractInput) {
  const client = await prisma.client.findUniqueOrThrow({
    where: { id: clientId },
    include: { origin: true },
  });

  const plan = await resolvePlan(input.planId);
  const resolvedPackages = await resolveAndValidatePackages(input.packageIds, plan);
  const settings = await getSettings();

  const cleanCpf = input.cpf.replace(/\D/g, "");
  const tipoPessoa = cleanCpf.length === 14 ? "pj" : "pf";
  const cleanPhonePrimary = input.phonePrimary.replace(/\D/g, "");
  const phoneSecondary = cleanString(input.phoneSecondary);
  const rawSec = phoneSecondary ? phoneSecondary.replace(/\D/g, "") : null;
  // O Hubsoft proíbe telefones duplicados (Telefone 1, 2 e 3 devem ser distintos ou nulos)
  const cleanPhoneSecondary = rawSec && rawSec !== cleanPhonePrimary ? rawSec : null;
  const cleanPhoneTertiary = null;

  const fatherName = cleanString(input.fatherName);
  const complement = cleanString(input.complement);
  const reference = cleanString(input.reference);
  const observation = cleanString(input.observation);
  const nationality = cleanString(input.nationality) || "brasileiro";

  const nomeFantasia = input.fullName.trim().split(" ")[0] || input.fullName;
  const genero =
    input.gender.toLowerCase() === "f" || input.gender.toLowerCase() === "feminino"
      ? "feminino"
      : "masculino";

  const promotionIds: number[] = plan?.promotions
    ? plan.promotions
        .map((pp) => pp.promotion)
        .filter((promo) => promo.active && typeof promo.hubsoftPromotionId === "number")
        .map((promo) => promo.hubsoftPromotionId as number)
    : [];

  const hubsoftPayload = {
    nome_razaosocial: input.fullName,
    nome_fantasia: nomeFantasia,
    tipo_pessoa: tipoPessoa,
    cpf_cnpj: cleanCpf,
    telefone_primario: cleanPhonePrimary,
    telefone_secundario: cleanPhoneSecondary,
    telefone_terciario: cleanPhoneTertiary,
    email_principal: input.email,
    id_origem_cliente: client.origin?.hubsoftOriginId ?? 55,
    id_motivo_contratacao: settings.hubsoftMotivoContratacaoId ?? 48,
    ids_grupos_cliente: settings.hubsoftGruposClienteIds?.length
      ? settings.hubsoftGruposClienteIds
      : [4],
    id_prospecto: null,
    data_nascimento: input.birthDate,
    rg: input.rg,
    rg_emissor: input.rgEmissor,
    nome_pai: fatherName || "",
    nome_mae: input.motherName,
    estado_civil: input.maritalStatus.toLowerCase(),
    genero: genero,
    nacionalidade: nationality,
    profissao: input.profession,
    endereco: {
      cep: input.cep.replace(/\D/g, ""),
      bairro: input.neighborhood,
      endereco: input.street,
      numero: input.number,
      complemento: complement || "",
      referencia: reference || "",
      id_condominio: null,
      atualizar_coords_auto: true,
    },
    id_servico: plan?.hubsoftServiceId ?? 947,
    id_vencimento: settings.hubsoftVencimentoId ?? 9,
    id_usuario_vendedor: settings.hubsoftVendedorId ?? 636,
    id_servico_status: settings.hubsoftServicoStatusId ?? 6,
    valor: plan?.price ? Number(plan.price) : 199.9,
    data_venda: new Date().toISOString().split("T")[0],
    validade: plan?.loyaltyMonths ?? 12,
    anotacoes: observation || "Cliente gerado via API",
    referencia: "*",
    ids_grupos_cliente_servico: settings.hubsoftGruposServicoIds?.length
      ? settings.hubsoftGruposServicoIds
      : [835],
    id_forma_cobranca: settings.hubsoftFormaCobrancaId ?? 94,
    carne: false,
    tipo_cobranca: "postecipada",
    emite_contrato: false,
    gerar_carne: "nao_gerar_carne",
    taxa_instalacao_tipo: "nao_cobrar_taxa",
    contratos: [],
    ids_pacotes: resolvedPackages.map((pkg) => ({
      id_pacote: pkg.hubsoftPackageId ?? 0,
      valor: Number(pkg.price),
    })),
    ids_promocoes: promotionIds,
  };

  const hubsoftBase = settings.hubsoftBaseUrl?.trim() || "https://api.ligtop.hubsoft.com.br";
  const hubsoftUrl = `${hubsoftBase.replace(/\/+$/, "")}/api/v1/integracao/cliente`;

  const res = await fetch(hubsoftUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${input.hubsoftToken.trim()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(hubsoftPayload),
  });

  const rawJson = await res.json().catch(() => null);
  const { hubsoftClientId, hubsoftProtocol } = parseHubsoftResponse(rawJson, res.status);

  const data = {
    planId: plan ? plan.id : null,
    personType: "pf",
    fullName: input.fullName,
    cpf: cleanCpf,
    phonePrimary: cleanPhonePrimary,
    phoneSecondary: phoneSecondary,
    email: input.email,
    gender: genero,
    observation: observation,
    rg: input.rg,
    rgEmissor: input.rgEmissor,
    birthDate: input.birthDate,
    motherName: input.motherName,
    fatherName: fatherName,
    maritalStatus: input.maritalStatus,
    profession: input.profession,
    nationality: nationality,
    cep: input.cep.replace(/\D/g, ""),
    street: input.street,
    number: input.number,
    neighborhood: input.neighborhood,
    complement: complement,
    reference: reference,
    hubsoftClientId: hubsoftClientId,
    hubsoftProtocol: hubsoftProtocol,
    hubsoftRawResponse: rawJson ? (rawJson as Prisma.InputJsonValue) : undefined,
  };

  const contract = await prisma.$transaction(async (tx) => {
    const existing = await tx.contract.findUnique({ where: { clientId } });
    const created = existing
      ? await tx.contract.update({ where: { clientId }, data })
      : await tx.contract.create({ data: { clientId, ...data } });

    await tx.contractPackage.deleteMany({ where: { contractId: created.id } });
    if (resolvedPackages.length > 0) {
      await tx.contractPackage.createMany({
        data: resolvedPackages.map((pkg) => ({
          contractId: created.id,
          packageId: pkg.id,
        })),
      });
    }

    await tx.client.update({
      where: { id: clientId },
      data: {
        hubsoftData: rawJson ? (rawJson as Prisma.InputJsonValue) : undefined,
      },
    });
    return created;
  });

  const metadata = asWebhookMetadata(client.metadata);
  await sendContractWebhook({
    phone: client.phone,
    personType: "pf",
    fullName: input.fullName,
    cpf: cleanCpf,
    phonePrimary: cleanPhonePrimary,
    phoneSecondary: phoneSecondary ?? undefined,
    email: input.email,
    gender: genero,
    observation: observation ?? undefined,
    planId: plan ? plan.id : undefined,
    packages: resolvedPackages.map((pkg) => ({
      id: pkg.id,
      name: pkg.name,
      price: Number(pkg.price),
      hubsoftPackageId: pkg.hubsoftPackageId,
    })),
    rg: input.rg,
    rgEmissor: input.rgEmissor,
    birthDate: input.birthDate,
    motherName: input.motherName,
    fatherName: fatherName ?? undefined,
    maritalStatus: input.maritalStatus,
    profession: input.profession,
    nationality: nationality,
    cep: input.cep.replace(/\D/g, ""),
    street: input.street,
    number: input.number,
    neighborhood: input.neighborhood,
    complement: complement ?? undefined,
    reference: reference ?? undefined,
    hubsoftClientId: hubsoftClientId,
    metadata,
  });

  return contract;
}

export async function registerClientContractPJ(
  clientId: string,
  input: RegisterContractPJInput
) {
  const client = await prisma.client.findUnique({
    where: { id: clientId },
    include: { origin: true },
  });
  if (!client) throw new Error("Cliente não encontrado");

  const [settings, plan] = await Promise.all([
    getSettings(),
    resolvePlan(input.planId),
  ]);
  const resolvedPackages = await resolveAndValidatePackages(input.packageIds, plan);

  const cleanCnpj = input.cnpj.replace(/\D/g, "");
  const cleanPhonePrimary = input.phonePrimary.replace(/\D/g, "");
  const phoneSecondary = cleanString(input.phoneSecondary);
  const rawSec = phoneSecondary ? phoneSecondary.replace(/\D/g, "") : null;
  // O Hubsoft proíbe telefones duplicados (Telefone 1, 2 e 3 devem ser distintos ou nulos)
  const cleanPhoneSecondary = rawSec && rawSec !== cleanPhonePrimary ? rawSec : null;
  const cleanPhoneTertiary = null;

  const tradeName = cleanString(input.tradeName) || input.companyName;
  const stateRegistration = cleanString(input.stateRegistration) || "ISENTO";
  const complement = cleanString(input.complement);
  const reference = cleanString(input.reference);
  const observation = cleanString(input.observation);

  const promotionIds: number[] = plan?.promotions
    ? plan.promotions
        .map((pp) => pp.promotion)
        .filter((promo) => promo.active && typeof promo.hubsoftPromotionId === "number")
        .map((promo) => promo.hubsoftPromotionId as number)
    : [];

  const hubsoftPayload: Record<string, unknown> = {
    nome_razaosocial: input.companyName,
    nome_fantasia: tradeName,
    tipo_pessoa: "pj",
    cpf_cnpj: cleanCnpj,
    inscricao_estadual: stateRegistration,
    telefone_primario: cleanPhonePrimary,
    telefone_secundario: cleanPhoneSecondary,
    telefone_terciario: cleanPhoneTertiary,
    email_principal: input.email,
    id_origem_cliente: client.origin?.hubsoftOriginId ?? 55,
    id_motivo_contratacao: settings.hubsoftMotivoContratacaoId ?? 48,
    ids_grupos_cliente: settings.hubsoftGruposClienteIds?.length
      ? settings.hubsoftGruposClienteIds
      : [4],
    id_prospecto: null,
    endereco: {
      cep: input.cep.replace(/\D/g, ""),
      bairro: input.neighborhood,
      endereco: input.street,
      numero: input.number,
      complemento: complement || "",
      referencia: reference || "",
      id_condominio: null,
      atualizar_coords_auto: true,
    },
    id_servico: plan?.hubsoftServiceId ?? 947,
    id_vencimento: settings.hubsoftVencimentoId ?? 9,
    id_usuario_vendedor: settings.hubsoftVendedorId ?? 636,
    id_servico_status: settings.hubsoftServicoStatusId ?? 6,
    valor: plan?.price ? Number(plan.price) : 199.9,
    data_venda: new Date().toISOString().split("T")[0],
    validade: plan?.loyaltyMonths ?? 12,
    anotacoes: observation
      ? `${observation} | Resp: ${input.contactName}`
      : `Resp: ${input.contactName} | Contrato PJ gerado via API`,
    referencia: "*",
    ids_grupos_cliente_servico: settings.hubsoftGruposServicoIds?.length
      ? settings.hubsoftGruposServicoIds
      : [835],
    id_forma_cobranca: settings.hubsoftFormaCobrancaId ?? 94,
    carne: false,
    tipo_cobranca: "postecipada",
    emite_contrato: false,
    gerar_carne: "nao_gerar_carne",
    taxa_instalacao_tipo: "nao_cobrar_taxa",
    contratos: [],
    ids_pacotes: resolvedPackages.map((pkg) => ({
      id_pacote: pkg.hubsoftPackageId ?? 0,
      valor: Number(pkg.price),
    })),
    ids_promocoes: promotionIds,
  };

  const hubsoftBase = settings.hubsoftBaseUrl?.trim() || "https://api.ligtop.hubsoft.com.br";
  const hubsoftUrl = `${hubsoftBase.replace(/\/+$/, "")}/api/v1/integracao/cliente`;

  let hubsoftResponse: Record<string, unknown> | null = null;
  const res = await fetch(hubsoftUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${input.hubsoftToken.trim()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(hubsoftPayload),
  });

  const rawJson = await res.json().catch(() => null);
  const { hubsoftClientId, hubsoftProtocol } = parseHubsoftResponse(rawJson, res.status);

  const data = {
    planId: plan ? plan.id : null,
    personType: "pj",
    fullName: input.companyName,
    companyName: input.companyName,
    tradeName: tradeName,
    cnpj: cleanCnpj,
    stateRegistration: stateRegistration,
    contactName: input.contactName,
    phonePrimary: cleanPhonePrimary,
    phoneSecondary: phoneSecondary,
    email: input.email,
    observation: observation,
    cep: input.cep.replace(/\D/g, ""),
    street: input.street,
    number: input.number,
    neighborhood: input.neighborhood,
    complement: complement,
    reference: reference,
    hubsoftClientId: hubsoftClientId,
    hubsoftProtocol: hubsoftProtocol,
    hubsoftRawResponse: rawJson ? (rawJson as Prisma.InputJsonValue) : undefined,
  };

  const contract = await prisma.$transaction(async (tx) => {
    const existing = await tx.contract.findUnique({ where: { clientId } });
    const created = existing
      ? await tx.contract.update({ where: { clientId }, data })
      : await tx.contract.create({ data: { clientId, ...data } });

    await tx.contractPackage.deleteMany({ where: { contractId: created.id } });
    if (resolvedPackages.length > 0) {
      await tx.contractPackage.createMany({
        data: resolvedPackages.map((pkg) => ({
          contractId: created.id,
          packageId: pkg.id,
        })),
      });
    }

    await tx.client.update({
      where: { id: clientId },
      data: {
        hubsoftData: rawJson ? (rawJson as Prisma.InputJsonValue) : undefined,
      },
    });
    return created;
  });

  const metadata = asWebhookMetadata(client.metadata);
  await sendContractWebhook({
    phone: client.phone,
    personType: "pj",
    fullName: input.companyName,
    companyName: input.companyName,
    tradeName: tradeName ?? undefined,
    cnpj: cleanCnpj,
    stateRegistration: stateRegistration ?? undefined,
    contactName: input.contactName,
    phonePrimary: cleanPhonePrimary,
    phoneSecondary: phoneSecondary ?? undefined,
    email: input.email,
    observation: observation ?? undefined,
    planId: plan ? plan.id : undefined,
    packages: resolvedPackages.map((pkg) => ({
      id: pkg.id,
      name: pkg.name,
      price: Number(pkg.price),
      hubsoftPackageId: pkg.hubsoftPackageId,
    })),
    cep: input.cep.replace(/\D/g, ""),
    street: input.street,
    number: input.number,
    neighborhood: input.neighborhood,
    complement: complement ?? undefined,
    reference: reference ?? undefined,
    hubsoftClientId: hubsoftClientId,
    metadata,
  });

  return contract;
}

export async function confirmContractSigned(
  clientId: string,
  options?: { observation?: string }
) {
  const client = await prisma.client.findUnique({
    where: { id: clientId },
  });
  if (!client) throw new Error("Cliente não encontrado");

  const updated = await prisma.client.update({
    where: { id: clientId },
    data: {
      stage: SaleStage.FECHOU_VENDA,
    },
    include: {
      area: { select: { id: true, name: true, observation: true } },
      origin: { select: { id: true, name: true } },
      contract: true,
    },
  });

  await addSystemLog({
    level: "info",
    source: "agent",
    message: "Assinatura do contrato confirmada pelo lead. Venda marcada como FECHOU_VENDA.",
    phone: client.phone,
    details: {
      previousStage: client.stage,
      newStage: SaleStage.FECHOU_VENDA,
      observation: options?.observation,
    },
  });

  return updated;
}

/** Serializa o client para payloads de webhook / API do agente. */
export function serializeClientForAgent(client: {
  id: string;
  phone: string;
  name: string | null;
  stage: SaleStage;
  areaId: string | null;
  originId: string | null;
  currentProvider: string | null;
  currentPrice: { toString(): string } | null;
  hadBadExperience: boolean | null;
  badExperienceNote: string | null;
  followUpCount: number;
  lastInboundAt: Date | null;
  metadata: unknown;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: client.id,
    phone: client.phone,
    name: client.name,
    stage: client.stage,
    areaId: client.areaId,
    originId: client.originId,
    currentProvider: client.currentProvider,
    currentPrice: client.currentPrice != null ? Number(client.currentPrice) : null,
    hadBadExperience: client.hadBadExperience,
    badExperienceNote: client.badExperienceNote,
    followUpCount: client.followUpCount,
    lastInboundAt: client.lastInboundAt?.toISOString() ?? null,
    metadata: asWebhookMetadata(client.metadata) ?? null,
    createdAt: client.createdAt.toISOString(),
    updatedAt: client.updatedAt.toISOString(),
  };
}

/**
 * Dispara manualmente um follow-up para um lead/cliente.
 * Envia o webhook `followup.due` imediatamente para o agente IA, atualiza o estágio se necessário,
 * incrementa a tentativa e atualiza o agendamento na fila.
 */
export async function triggerFollowUp(
  clientIdOrPhone: string,
  forcedAttempt?: 1 | 2 | 3
) {
  const client = await prisma.client.findFirst({
    where: {
      OR: [{ id: clientIdOrPhone }, { phone: clientIdOrPhone }],
    },
  });

  if (!client) {
    throw new Error(`Cliente não encontrado para follow-up: ${clientIdOrPhone}`);
  }

  if (client.stage === SaleStage.FECHOU_VENDA) {
    throw new Error("Não é possível enviar follow-up para cliente que já fechou a venda.");
  }

  const attempt: 1 | 2 | 3 =
    forcedAttempt ??
    ((Math.min(Math.max((client.followUpCount || 0) + 1, 1), 3)) as 1 | 2 | 3);

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
    phone: client.phone,
    clientId: client.id,
    attempt,
    history,
    ...(followUpMetadata ? { metadata: followUpMetadata } : {}),
    client: serializeClientForAgent(fresh),
  });

  await addSystemLog({
    level: "info",
    source: "panel",
    message: `Follow-up forçado manualmente (tentativa ${attempt}/3).`,
    phone: client.phone,
    details: {
      clientId: client.id,
      attempt,
      previousStage: client.stage,
      newStage: fresh.stage,
    },
  });

  if (attempt < 3) {
    await scheduleFollowUp(client.phone, (attempt + 1) as 2 | 3);
  } else {
    await cancelFollowUp(client.phone);
  }

  return {
    success: true,
    clientId: client.id,
    phone: client.phone,
    attempt,
    stage: fresh.stage,
    followUpCount: fresh.followUpCount,
  };
}


import { z } from "zod";
import { tool } from "@langchain/core/tools";
import { prisma, SaleStage } from "@jonas/db";

// Todas as tools operam sobre um único cliente (telefone fixo por conversa),
// por isso `clientId` é fechado no closure em vez de vir do modelo — evita a IA
// tentar editar outro lead por engano.
export function buildTools(clientId: string) {
  const updateClient = tool(
    async (input) => {
      const client = await prisma.client.update({ where: { id: clientId }, data: input });
      return `Cliente atualizado: ${JSON.stringify({ name: client.name, cep: client.cep, originId: client.originId })}`;
    },
    {
      name: "updateClient",
      description: "Atualiza dados do lead atual (nome, cep, origem, plano atual, experiência anterior).",
      schema: z.object({
        name: z.string().optional().describe("Nome do lead"),
        cep: z.string().optional().describe("CEP informado pelo lead"),
        originId: z.string().optional().describe("id da origem retornado por listOrigins"),
        currentProvider: z.string().optional().describe("Provedor de internet atual do lead"),
        currentPrice: z.number().optional().describe("Quanto o lead paga hoje"),
        hadBadExperience: z.boolean().optional(),
        badExperienceNote: z.string().optional(),
      }),
    }
  );

  const listOrigins = tool(
    async () => {
      const origins = await prisma.origin.findMany({ where: { active: true }, select: { id: true, name: true } });
      return JSON.stringify(origins);
    },
    {
      name: "listOrigins",
      description: "Lista as origens de lead ativas cadastradas (id e nome), para perguntar onde o lead nos conheceu.",
      schema: z.object({}),
    }
  );

  const listPlansByCep = tool(
    async ({ cep }) => {
      const cepRow = await prisma.cep.findUnique({
        where: { code: cep },
        include: { plans: { include: { plan: true } } },
      });
      if (!cepRow) return "CEP não atendido ou não cadastrado.";

      const plans = cepRow.plans
        .map((cp) => cp.plan)
        .filter((p) => p.active)
        .map((p) => ({ id: p.id, name: p.name, price: p.price, loyaltyMonths: p.loyaltyMonths, description: p.description }));

      return JSON.stringify(plans);
    },
    {
      name: "listPlansByCep",
      description: "Lista os planos de internet disponíveis para um CEP.",
      schema: z.object({ cep: z.string().describe("CEP do lead") }),
    }
  );

  const setStage = tool(
    async ({ stage }) => {
      await prisma.client.update({ where: { id: clientId }, data: { stage } });
      return `Etapa atualizada para ${stage}.`;
    },
    {
      name: "setStage",
      description: "Move o lead para outra etapa do funil/kanban.",
      schema: z.object({ stage: z.nativeEnum(SaleStage) }),
    }
  );

  const registerContract = tool(
    async (input) => {
      const contract = await prisma.$transaction(async (tx) => {
        const created = await tx.contract.create({ data: { clientId, ...input } });
        await tx.client.update({ where: { id: clientId }, data: { stage: SaleStage.FECHOU_VENDA } });
        return created;
      });
      return `Contrato registrado (id ${contract.id}). Venda fechada.`;
    },
    {
      name: "registerContract",
      description: "Grava os dados finais do contrato depois que o lead aceitar a venda e enviar todos os dados pedidos.",
      schema: z.object({
        planId: z.string().optional().describe("id do plano escolhido"),
        fullName: z.string(),
        cpf: z.string(),
        phonePrimary: z.string(),
        phoneSecondary: z.string(),
        email: z.string(),
        gender: z.string(),
        observation: z.string().optional(),
      }),
    }
  );

  return [updateClient, listOrigins, listPlansByCep, setStage, registerContract];
}

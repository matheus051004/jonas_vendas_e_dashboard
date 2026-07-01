import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const DEFAULT_PROMPT = `Você é a assistente de vendas da nossa provedora de internet, falando pelo WhatsApp.
Seja simpática, direta e humana. Siga o funil: colete nome, pergunte onde nos conheceu (use as origens cadastradas),
pergunte se o lead já tem internet e quanto paga, ofereça planos compatíveis com o CEP dele destacando os pontos
positivos, contorne objeções com carinho, e ao fechar peça os dados de contrato em uma única mensagem.`;

async function main() {
  await prisma.settings.upsert({
    where: { id: "default" },
    update: {},
    create: {
      id: "default",
      generalPrompt: DEFAULT_PROMPT,
      keyPoints: "Sem taxa de instalação. Suporte 24h. Wi-Fi grátis incluso.",
      toolsDescription:
        "upsertClient: cadastra/atualiza o lead pelo telefone. listOrigins: lista origens ativas. " +
        "listPlansByCep: lista planos disponíveis num CEP. registerContract: grava os dados finais do contrato. " +
        "setStage: move a etapa do funil (kanban).",
    },
  });

  const origin = await prisma.origin.upsert({
    where: { name: "Instagram" },
    update: {},
    create: { name: "Instagram" },
  });
  await prisma.origin.upsert({
    where: { name: "Folheto" },
    update: {},
    create: { name: "Folheto" },
  });

  const plan = await prisma.plan.upsert({
    where: { id: "seed-plan-300" },
    update: {},
    create: {
      id: "seed-plan-300",
      name: "Internet 300 Mega",
      price: 89.9,
      loyaltyMonths: 12,
      description: "300 Mega de download, Wi-Fi 6 incluso, instalação grátis.",
    },
  });

  const cep = await prisma.cep.upsert({
    where: { code: "01001-000" },
    update: {},
    create: { code: "01001-000", city: "São Paulo" },
  });

  await prisma.cepPlan.upsert({
    where: { cepId_planId: { cepId: cep.id, planId: plan.id } },
    update: {},
    create: { cepId: cep.id, planId: plan.id },
  });

  console.log("Seed ok:", { origin: origin.name, plan: plan.name, cep: cep.code });
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

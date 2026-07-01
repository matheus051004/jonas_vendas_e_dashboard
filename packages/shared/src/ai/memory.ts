import { AIMessage, HumanMessage, type BaseMessage } from "@langchain/core/messages";
import { prisma } from "@jonas/db";

const HISTORY_LIMIT = 30; // últimas N mensagens bastam de contexto pro funil.

// Memória do agente é a própria tabela Message — sem tabela extra do Langchain,
// uma única fonte de verdade também usada pela tela de histórico do cliente no painel.
export async function loadHistory(clientId: string): Promise<BaseMessage[]> {
  const rows = await prisma.message.findMany({
    where: { clientId, role: { in: ["user", "assistant"] } },
    orderBy: { createdAt: "desc" },
    take: HISTORY_LIMIT,
  });

  return rows.reverse().map((row) =>
    row.role === "user" ? new HumanMessage(row.content) : new AIMessage(row.content)
  );
}

export async function saveMessage(
  clientId: string,
  role: "user" | "assistant" | "system",
  content: string,
  kind: "text" | "audio" = "text"
) {
  await prisma.message.create({ data: { clientId, role, content, kind } });
}

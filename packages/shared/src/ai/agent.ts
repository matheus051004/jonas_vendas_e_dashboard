import { ChatOpenAI } from "@langchain/openai";
import { ChatPromptTemplate, MessagesPlaceholder } from "@langchain/core/prompts";
import { AgentExecutor, createToolCallingAgent } from "langchain/agents";
import { prisma, type Client } from "@jonas/db";
import { getSettings } from "../settings";
import { buildSystemPrompt } from "./prompt";
import { buildTools } from "./tools";
import { loadHistory } from "./memory";

// Garante que o lead existe antes de rodar o agente (1ª mensagem de um telefone novo).
export async function upsertClientByPhone(phone: string): Promise<Client> {
  return prisma.client.upsert({
    where: { phone },
    update: {},
    create: { phone },
  });
}

export async function runAgent(client: Client, userMessage: string): Promise<string> {
  const settings = await getSettings();

  const llm = new ChatOpenAI({
    apiKey: settings.openAiApiKey || process.env.OPENAI_API_KEY,
    modelName: settings.aiModel,
    maxTokens: settings.maxTokens,
    temperature: settings.temperature,
  });

  const tools = buildTools(client.id);
  const systemPrompt = buildSystemPrompt(settings, client);
  const history = await loadHistory(client.id);

  const promptTemplate = ChatPromptTemplate.fromMessages([
    ["system", "{systemPrompt}"],
    new MessagesPlaceholder("history"),
    ["human", "{input}"],
    new MessagesPlaceholder("agent_scratchpad"),
  ]);

  const agent = createToolCallingAgent({ llm, tools, prompt: promptTemplate });
  const executor = new AgentExecutor({ agent, tools });

  const result = await executor.invoke({ systemPrompt, history, input: userMessage });
  return result.output as string;
}

import { getAgentApiToken } from "./agent-auth";
import { addSystemLog } from "./logger";
import { getSettings, updateSettings } from "./settings";

const ELEVENLABS_API_BASE = "https://api.elevenlabs.io";
const ELEVENLABS_TIMEOUT_MS = 30_000;
export const MASKED_SECRET_SENTINEL = "••••••••";
const DEFAULT_RESOURCE_PREFIX = "painel_vendas";
const DEFAULT_VOICE_PROMPT =
  "Você é um consultor de vendas por voz em português do Brasil. Seja objetivo, cordial e natural ao telefone. Utilize as ferramentas disponíveis para consultar dados do cliente, verificar áreas, apresentar planos, atualizar o cadastro e registrar contratos quando o cliente demonstrar interesse.";
const DEFAULT_FIRST_MESSAGE =
  "Olá {{name}}, tudo bem? Estou ligando da equipe de atendimento para apresentar uma condição especial de internet fibra para o seu endereço.";

const SALE_STAGE_VALUES = [
  "NOVO_LEAD",
  "INTERESSADO",
  "PAROU_DE_RESPONDER",
  "ACHOU_CARO",
  "FECHOU_VENDA",
  "DESISTIU",
] as const;

export interface ElevenLabsPhoneNumberItem {
  phoneNumberId: string;
  phoneNumber: string;
  label: string;
  provider: string;
  supportsInbound: boolean;
  supportsOutbound: boolean;
  assignedAgentId: string | null;
  assignedAgentName: string | null;
}

export interface ElevenLabsVoiceItem {
  voiceId: string;
  name: string;
  category: string | null;
  labels: Record<string, string>;
}

export interface ElevenLabsAgentSummary {
  agentId: string;
  name: string;
  voiceId: string | null;
  tags: string[];
}

export interface ElevenLabsWebhookSummary {
  webhookId: string;
  name: string;
  webhookUrl: string;
  authType: string;
  isDisabled: boolean;
  isAutoDisabled: boolean;
}

export interface ElevenLabsAccountResources {
  phoneNumbers: ElevenLabsPhoneNumberItem[];
  sipPhoneNumbers: ElevenLabsPhoneNumberItem[];
  voices: ElevenLabsVoiceItem[];
  agents: ElevenLabsAgentSummary[];
  prefixedToolsCount: number;
  prefixedToolNames: string[];
  activeAgentWebhookId: string | null;
  activeAgentWebhookEvents: string[];
  activeWorkspaceWebhookId: string | null;
  webhooks: ElevenLabsWebhookSummary[];
  currentPrefix: string;
  configuredAgentId: string;
  configuredPhoneNumberId: string;
  configuredWebhookId: string;
  hasWebhookSecret: boolean;
}

export interface ProvisionElevenLabsInput {
  apiKey?: string;
  publicBaseUrl: string;
  prefix?: string;
  voiceId?: string;
  phoneNumberId?: string;
  agentId?: string;
  recreateWebhook?: boolean;
}

export interface ProvisionElevenLabsResult {
  prefix: string;
  publicBaseUrl: string;
  secret: {
    secretId: string;
    name: string;
    action: "created" | "updated";
  };
  tools: {
    total: number;
    created: number;
    updated: number;
    names: string[];
    ids: string[];
  };
  agent: {
    agentId: string;
    name: string;
    action: "created" | "updated";
    voiceId: string | null;
  };
  webhook: {
    webhookId: string;
    name: string;
    url: string;
    action: "created" | "reused";
    secretRotated: boolean;
    scope: "agent";
  };
  phoneNumber: {
    phoneNumberId: string;
    assigned: boolean;
  } | null;
  warnings: string[];
}

type JsonSchemaProperty =
  | {
      type: "string" | "number" | "integer" | "boolean";
      description?: string;
      dynamic_variable?: string;
      enum?: string[];
    }
  | {
      type: "array";
      description: string;
      items: {
        type: "string";
        description: string;
      };
    };

export interface ElevenLabsWebhookToolDefinition {
  key: string;
  name: string;
  description: string;
  apiSchema: {
    url: string;
    method: "GET" | "POST" | "PATCH";
    request_headers: Record<string, string | { secret_id: string }>;
    path_params_schema?: Record<string, JsonSchemaProperty>;
    request_body_schema?: {
      type: "object";
      description: string;
      properties: Record<string, JsonSchemaProperty>;
      required?: string[];
    };
    content_type?: "application/json";
  };
}

/**
 * Normaliza o prefixo usado para identificar recursos criados por este painel na ElevenLabs.
 * Garante compatibilidade com o padrão `^[a-zA-Z0-9_-]{1,64}$` das tools.
 */
export function normalizeElevenLabsPrefix(raw?: string | null): string {
  const cleaned = (raw ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 24);

  return cleaned.length >= 2 ? cleaned : DEFAULT_RESOURCE_PREFIX;
}

function isPrivateOrReservedIpv4(ip: string): boolean {
  const match = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(ip);
  if (!match) return false;
  const a = Number(match[1]);
  const b = Number(match[2]);
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168)
  );
}

function isPrivateOrLocalHost(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (
    !host ||
    host === "localhost" ||
    host === "0.0.0.0" ||
    host === "::1" ||
    host === "::" ||
    host.endsWith(".localhost") ||
    host.endsWith(".local") ||
    host.endsWith(".internal")
  ) {
    return true;
  }

  // Hostnames de rótulo único (ex.: "web", "app" em Docker Compose) não são domínios públicos
  if (!host.includes(".") && !host.includes(":")) {
    return true;
  }

  if (isPrivateOrReservedIpv4(host)) {
    return true;
  }

  // IPv6 loopback, link-local, ULA (fc00::/7, fe80::/10) ou IPv4-mapped (::ffff:...)
  if (host.includes(":")) {
    if (
      host === "::1" ||
      host === "::" ||
      host.startsWith("::ffff:") ||
      /^(fc|fd|fe8|fe9|fea|feb)/i.test(host)
    ) {
      return true;
    }
  }

  return false;
}

/**
 * Valida e normaliza a URL pública HTTPS do painel para registro nas tools e webhook da ElevenLabs.
 */
export function validatePublicBaseUrl(rawUrl: string): string {
  const trimmed = rawUrl.trim();
  if (!trimmed) {
    throw new Error("Informe a URL pública HTTPS do painel (ex.: https://painel.seudominio.com.br).");
  }

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    throw new Error("URL pública do painel inválida. Use o formato https://seudominio.com.br.");
  }

  if (parsed.protocol !== "https:") {
    throw new Error("A URL pública do painel precisa usar HTTPS (https://...) para a ElevenLabs conseguir acessar.");
  }

  if (parsed.username || parsed.password) {
    throw new Error("A URL pública do painel não deve conter usuário ou senha embutidos.");
  }

  if (isPrivateOrLocalHost(parsed.hostname)) {
    throw new Error(
      `O host "${parsed.hostname}" é local/privado. Informe o domínio público HTTPS acessível pela internet.`
    );
  }

  const normalizedPath = parsed.pathname.replace(/\/+$/, "");
  return `${parsed.origin}${normalizedPath}`;
}

function sanitizeUpstreamErrorDetail(
  data: unknown,
  rawText: string,
  status: number,
  redactValues: string[]
): string {
  const obj = data && typeof data === "object" ? (data as Record<string, unknown>) : null;
  let detail: string;

  if (typeof obj?.detail === "string") {
    detail = obj.detail;
  } else if (Array.isArray(obj?.detail)) {
    // Pydantic v2 retorna "input" com o body original — removemos para nunca vazar tokens/secrets
    const safeItems = obj.detail.map((item) => {
      if (item && typeof item === "object") {
        const rec = item as Record<string, unknown>;
        const loc = Array.isArray(rec.loc) ? rec.loc.join(".") : "";
        const msg = typeof rec.msg === "string" ? rec.msg : "erro de validação";
        return loc ? `${loc}: ${msg}` : msg;
      }
      return String(item);
    });
    detail = safeItems.join("; ");
  } else if (obj?.detail && typeof obj.detail === "object") {
    const rec = obj.detail as Record<string, unknown>;
    detail =
      typeof rec.message === "string"
        ? rec.message
        : typeof rec.status === "string"
          ? rec.status
          : `HTTP ${status}`;
  } else if (typeof obj?.message === "string") {
    detail = obj.message;
  } else {
    detail = rawText ? rawText.slice(0, 300) : `HTTP ${status}`;
  }

  for (const secret of redactValues) {
    if (secret && secret.length >= 4) {
      detail = detail.split(secret).join("[REDACTED]");
    }
  }

  return detail.length > 400 ? `${detail.slice(0, 400)}...` : detail;
}

async function resolveElevenLabsApiKey(overrideApiKey?: string): Promise<string> {
  const candidate = (overrideApiKey ?? "").trim();
  if (candidate && candidate !== MASKED_SECRET_SENTINEL) {
    return candidate;
  }

  const settings = await getSettings();
  const resolved = (settings.elevenLabsApiKey || process.env.ELEVENLABS_API_KEY || "").trim();
  if (!resolved) {
    throw new Error("Informe e salve a ElevenLabs API Key (xi-api-key) antes de conectar.");
  }
  return resolved;
}

async function elevenLabsRequest<T>(
  apiKey: string,
  path: string,
  options: {
    method?: "GET" | "POST" | "PATCH" | "DELETE";
    body?: unknown;
    redactValues?: string[];
  } = {}
): Promise<T> {
  const method = options.method ?? "GET";
  const headers: Record<string, string> = {
    "xi-api-key": apiKey,
    Accept: "application/json",
  };
  if (options.body !== undefined) {
    headers["Content-Type"] = "application/json";
  }

  const res = await fetch(`${ELEVENLABS_API_BASE}${path}`, {
    method,
    headers,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    signal: AbortSignal.timeout(ELEVENLABS_TIMEOUT_MS),
  });

  const rawText = await res.text();
  let data: unknown = null;
  try {
    data = rawText ? JSON.parse(rawText) : null;
  } catch {
    data = null;
  }

  if (!res.ok) {
    const detail = sanitizeUpstreamErrorDetail(data, rawText, res.status, [
      apiKey,
      ...(options.redactValues ?? []),
    ]);
    throw new Error(`ElevenLabs API ${method} ${path} falhou (${res.status}): ${detail}`);
  }

  return data as T;
}

/**
 * Monta o catálogo de webhook tools da API `/api/agent/*` com o prefixo configurado.
 */
export function buildPanelElevenLabsTools(
  publicBaseUrl: string,
  prefix: string,
  secretId: string
): ElevenLabsWebhookToolDefinition[] {
  const normalizedBase = publicBaseUrl.replace(/\/+$/, "");
  const authHeaders: Record<string, string | { secret_id: string }> = {
    "x-webhook-token": { secret_id: secretId },
  };
  const phonePathParam = {
    phone: {
      type: "string" as const,
      dynamic_variable: "phone",
    },
  };

  const makeName = (key: string) => `${prefix}_${key}`;

  return [
    {
      key: "buscar_cliente",
      name: makeName("buscar_cliente"),
      description:
        "Consulta os dados cadastrais, etapa atual, origem, área e contrato do cliente desta ligação.",
      apiSchema: {
        url: `${normalizedBase}/api/agent/clients/{phone}`,
        method: "GET",
        request_headers: { ...authHeaders },
        path_params_schema: { ...phonePathParam },
      },
    },
    {
      key: "atualizar_cliente",
      name: makeName("atualizar_cliente"),
      description:
        "Atualiza informações coletadas do cliente durante a ligação (nome, área/bairro, origem, operadora atual, valor pago e experiência anterior).",
      apiSchema: {
        url: `${normalizedBase}/api/agent/clients/{phone}`,
        method: "PATCH",
        content_type: "application/json",
        request_headers: { ...authHeaders },
        path_params_schema: { ...phonePathParam },
        request_body_schema: {
          type: "object",
          description: "Campos opcionais para atualizar o cadastro do cliente. Envie apenas os dados confirmados na conversa.",
          properties: {
            name: { type: "string", description: "Nome completo ou razão social do cliente." },
            areaId: { type: "string", description: "ID ou nome da área/região de cobertura do cliente." },
            originId: { type: "string", description: "ID ou nome da origem do lead." },
            currentProvider: { type: "string", description: "Nome da operadora de internet atual do cliente." },
            currentPrice: { type: "number", description: "Valor mensal em reais pago atualmente pelo cliente." },
            hadBadExperience: {
              type: "boolean",
              description: "Indica se o cliente relatou experiência ruim com a operadora atual.",
            },
            badExperienceNote: {
              type: "string",
              description: "Resumo breve da reclamação ou problema relatado com a operadora atual.",
            },
          },
        },
      },
    },
    {
      key: "definir_estagio",
      name: makeName("definir_estagio"),
      description:
        "Move o cliente no funil de vendas conforme o andamento da ligação (ex.: INTERESSADO, ACHOU_CARO, DESISTIU). Não use FECHOU_VENDA sem assinatura confirmada.",
      apiSchema: {
        url: `${normalizedBase}/api/agent/clients/{phone}/stage`,
        method: "POST",
        content_type: "application/json",
        request_headers: { ...authHeaders },
        path_params_schema: { ...phonePathParam },
        request_body_schema: {
          type: "object",
          description: "Novo estágio comercial do cliente no funil.",
          properties: {
            stage: {
              type: "string",
              enum: [...SALE_STAGE_VALUES],
              description: "Estágio no funil: NOVO_LEAD, INTERESSADO, PAROU_DE_RESPONDER, ACHOU_CARO, FECHOU_VENDA ou DESISTIU.",
            },
          },
          required: ["stage"],
        },
      },
    },
    {
      key: "listar_origens",
      name: makeName("listar_origens"),
      description: "Lista as origens de lead ativas cadastradas no painel.",
      apiSchema: {
        url: `${normalizedBase}/api/agent/origins`,
        method: "GET",
        request_headers: { ...authHeaders },
      },
    },
    {
      key: "listar_areas",
      name: makeName("listar_areas"),
      description:
        "Lista todas as áreas/regiões de cobertura ativas para confirmar se atendemos o endereço do cliente.",
      apiSchema: {
        url: `${normalizedBase}/api/agent/areas`,
        method: "GET",
        request_headers: { ...authHeaders },
      },
    },
    {
      key: "listar_planos_area",
      name: makeName("listar_planos_area"),
      description:
        "Lista os planos de internet e pacotes adicionais disponíveis para uma área específica.",
      apiSchema: {
        url: `${normalizedBase}/api/agent/areas/{areaId}/plans`,
        method: "GET",
        request_headers: { ...authHeaders },
        path_params_schema: {
          areaId: {
            type: "string",
            description: "ID ou nome exato da área obtida pela ferramenta listar_areas.",
          },
        },
      },
    },
    {
      key: "detalhes_plano",
      name: makeName("detalhes_plano"),
      description:
        "Obtém detalhes completos de um plano (velocidade, fidelidade, promoções, forma de pagamento e benefícios).",
      apiSchema: {
        url: `${normalizedBase}/api/agent/plans/{planId}`,
        method: "GET",
        request_headers: { ...authHeaders },
        path_params_schema: {
          planId: {
            type: "string",
            description: "ID ou nome do plano obtido em listar_planos_area.",
          },
        },
      },
    },
    {
      key: "listar_vencimentos",
      name: makeName("listar_vencimentos"),
      description:
        "Lista os dias de vencimento de fatura ativos (1 a 31) e seus IDs para cadastro de contrato.",
      apiSchema: {
        url: `${normalizedBase}/api/agent/due-dates`,
        method: "GET",
        request_headers: { ...authHeaders },
      },
    },
    {
      key: "registrar_contrato_pf",
      name: makeName("registrar_contrato_pf"),
      description:
        "Registra um novo contrato Pessoa Física (PF) no sistema e no Hubsoft após coletar e confirmar todos os dados obrigatórios do cliente.",
      apiSchema: {
        url: `${normalizedBase}/api/agent/clients/{phone}/contract`,
        method: "POST",
        content_type: "application/json",
        request_headers: { ...authHeaders },
        path_params_schema: { ...phonePathParam },
        request_body_schema: {
          type: "object",
          description: "Dados completos do contrato Pessoa Física.",
          properties: {
            hubsoftToken: { type: "string", description: "Token de autenticação Hubsoft para emissão do contrato." },
            planId: { type: "string", description: "ID ou nome do plano escolhido." },
            dueDateId: { type: "string", description: "ID ou dia de vencimento escolhido em listar_vencimentos." },
            fullName: { type: "string", description: "Nome completo do titular." },
            cpf: { type: "string", description: "CPF do titular (somente números ou formatado)." },
            phonePrimary: { type: "string", description: "Telefone principal com DDD." },
            phoneSecondary: { type: "string", description: "Telefone secundário opcional." },
            email: { type: "string", description: "E-mail do titular." },
            gender: { type: "string", description: "Gênero do titular (ex.: M ou F)." },
            rg: { type: "string", description: "Número do RG." },
            rgEmissor: { type: "string", description: "Órgão emissor do RG (ex.: SSP/DF)." },
            birthDate: { type: "string", description: "Data de nascimento (DD/MM/AAAA ou AAAA-MM-DD)." },
            motherName: { type: "string", description: "Nome completo da mãe." },
            fatherName: { type: "string", description: "Nome do pai (opcional)." },
            maritalStatus: { type: "string", description: "Estado civil do titular." },
            profession: { type: "string", description: "Profissão do titular." },
            nationality: { type: "string", description: "Nacionalidade (opcional, padrão Brasileira)." },
            cep: { type: "string", description: "CEP do endereço de instalação." },
            street: { type: "string", description: "Rua/logradouro do endereço." },
            number: { type: "string", description: "Número do imóvel." },
            neighborhood: { type: "string", description: "Bairro/setor." },
            complement: { type: "string", description: "Complemento do endereço (opcional)." },
            reference: { type: "string", description: "Ponto de referência (opcional)." },
            observation: { type: "string", description: "Observações adicionais para instalação (opcional)." },
            packageIds: {
              type: "array",
              description: "Lista opcional de IDs ou nomes de pacotes adicionais compatíveis com o plano.",
              items: { type: "string", description: "ID ou nome do pacote adicional." },
            },
          },
          required: [
            "hubsoftToken",
            "dueDateId",
            "fullName",
            "cpf",
            "phonePrimary",
            "email",
            "gender",
            "rg",
            "rgEmissor",
            "birthDate",
            "motherName",
            "maritalStatus",
            "profession",
            "cep",
            "street",
            "number",
            "neighborhood",
          ],
        },
      },
    },
    {
      key: "registrar_contrato_pj",
      name: makeName("registrar_contrato_pj"),
      description:
        "Registra um novo contrato Pessoa Jurídica (PJ) no sistema e no Hubsoft após coletar e confirmar todos os dados obrigatórios da empresa.",
      apiSchema: {
        url: `${normalizedBase}/api/agent/clients/{phone}/contract-pj`,
        method: "POST",
        content_type: "application/json",
        request_headers: { ...authHeaders },
        path_params_schema: { ...phonePathParam },
        request_body_schema: {
          type: "object",
          description: "Dados completos do contrato Pessoa Jurídica.",
          properties: {
            hubsoftToken: { type: "string", description: "Token de autenticação Hubsoft para emissão do contrato." },
            planId: { type: "string", description: "ID ou nome do plano escolhido." },
            dueDateId: { type: "string", description: "ID ou dia de vencimento escolhido em listar_vencimentos." },
            companyName: { type: "string", description: "Razão social da empresa." },
            tradeName: { type: "string", description: "Nome fantasia (opcional)." },
            cnpj: { type: "string", description: "CNPJ da empresa." },
            stateRegistration: { type: "string", description: "Inscrição estadual (opcional)." },
            contactName: { type: "string", description: "Nome do responsável legal ou contato." },
            phonePrimary: { type: "string", description: "Telefone principal com DDD." },
            phoneSecondary: { type: "string", description: "Telefone secundário opcional." },
            email: { type: "string", description: "E-mail corporativo." },
            cep: { type: "string", description: "CEP do endereço de instalação." },
            street: { type: "string", description: "Rua/logradouro." },
            number: { type: "string", description: "Número do imóvel." },
            neighborhood: { type: "string", description: "Bairro/setor." },
            complement: { type: "string", description: "Complemento (opcional)." },
            reference: { type: "string", description: "Ponto de referência (opcional)." },
            observation: { type: "string", description: "Observações adicionais (opcional)." },
            packageIds: {
              type: "array",
              description: "Lista opcional de IDs ou nomes de pacotes adicionais compatíveis com o plano.",
              items: { type: "string", description: "ID ou nome do pacote adicional." },
            },
          },
          required: [
            "hubsoftToken",
            "dueDateId",
            "companyName",
            "cnpj",
            "contactName",
            "phonePrimary",
            "email",
            "cep",
            "street",
            "number",
            "neighborhood",
          ],
        },
      },
    },
    {
      key: "confirmar_assinatura",
      name: makeName("confirmar_assinatura"),
      description:
        "Confirma que o cliente assinou o contrato e avança o lead para FECHOU_VENDA.",
      apiSchema: {
        url: `${normalizedBase}/api/agent/clients/{phone}/contract-signed`,
        method: "POST",
        content_type: "application/json",
        request_headers: { ...authHeaders },
        path_params_schema: { ...phonePathParam },
        request_body_schema: {
          type: "object",
          description: "Observação opcional sobre a confirmação da assinatura.",
          properties: {
            observation: { type: "string", description: "Nota opcional sobre a assinatura." },
          },
        },
      },
    },
    {
      key: "pausar_followup",
      name: makeName("pausar_followup"),
      description:
        "Pausa os follow-ups automáticos para este cliente quando ele pedir para não receber novas mensagens ou ligações.",
      apiSchema: {
        url: `${normalizedBase}/api/agent/clients/{phone}/pause-followup`,
        method: "POST",
        request_headers: { ...authHeaders },
        path_params_schema: { ...phonePathParam },
      },
    },
  ];
}

async function listAllSecrets(apiKey: string): Promise<Array<{ secret_id: string; name: string }>> {
  const results: Array<{ secret_id: string; name: string }> = [];
  let cursor: string | null = null;

  for (let page = 0; page < 20; page++) {
    const qs = new URLSearchParams({ page_size: "100" });
    if (cursor) qs.set("cursor", cursor);
    const data = await elevenLabsRequest<{
      secrets?: Array<{ secret_id: string; name: string }>;
      next_cursor?: string | null;
    }>(apiKey, `/v1/convai/secrets?${qs.toString()}`);

    if (Array.isArray(data.secrets)) {
      results.push(...data.secrets);
    }
    if (!data.next_cursor) break;
    cursor = data.next_cursor;
  }

  return results;
}

async function listAllTools(
  apiKey: string
): Promise<Array<{ id: string; tool_config?: { name?: string; type?: string } }>> {
  const results: Array<{ id: string; tool_config?: { name?: string; type?: string } }> = [];
  let cursor: string | null = null;

  for (let page = 0; page < 20; page++) {
    const qs = new URLSearchParams({ page_size: "100" });
    if (cursor) qs.set("cursor", cursor);
    const data = await elevenLabsRequest<{
      tools?: Array<{ id: string; tool_config?: { name?: string; type?: string } }>;
      has_more?: boolean;
      next_cursor?: string | null;
    }>(apiKey, `/v1/convai/tools?${qs.toString()}`);

    if (Array.isArray(data.tools)) {
      results.push(...data.tools);
    }
    if (!data.has_more || !data.next_cursor) break;
    cursor = data.next_cursor;
  }

  return results;
}

async function listAllAgents(apiKey: string): Promise<ElevenLabsAgentSummary[]> {
  const results: ElevenLabsAgentSummary[] = [];
  let cursor: string | null = null;

  for (let page = 0; page < 10; page++) {
    const qs = new URLSearchParams({ page_size: "100" });
    if (cursor) qs.set("cursor", cursor);
    const data = await elevenLabsRequest<{
      agents?: Array<{
        agent_id: string;
        name: string;
        voice_id?: string | null;
        tags?: string[] | null;
      }>;
      has_more?: boolean;
      next_cursor?: string | null;
    }>(apiKey, `/v1/convai/agents?${qs.toString()}`);

    if (Array.isArray(data.agents)) {
      for (const a of data.agents) {
        results.push({
          agentId: a.agent_id,
          name: a.name,
          voiceId: a.voice_id ?? null,
          tags: Array.isArray(a.tags) ? a.tags : [],
        });
      }
    }
    if (!data.has_more || !data.next_cursor) break;
    cursor = data.next_cursor;
  }

  return results;
}

interface AgentDetailResponse {
  agent_id: string;
  conversation_config?: {
    agent?: {
      prompt?: {
        tool_ids?: string[] | null;
      } | null;
    } | null;
  } | null;
  platform_settings?: {
    workspace_overrides?: {
      webhooks?: {
        post_call_webhook_id?: string | null;
        events?: string[] | null;
      } | null;
    } | null;
  } | null;
}

/**
 * Consulta recursos existentes na conta ElevenLabs (números SIP, vozes, agentes, tools e webhooks)
 * para exibir nos seletores do painel sem precisar copiar IDs manualmente.
 */
export async function listElevenLabsAccountResources(
  overrideApiKey?: string,
  overridePrefix?: string
): Promise<ElevenLabsAccountResources> {
  const apiKey = await resolveElevenLabsApiKey(overrideApiKey);
  const settings = await getSettings();
  const currentPrefix = normalizeElevenLabsPrefix(overridePrefix ?? settings.elevenLabsResourcePrefix);
  const configuredAgentId = settings.elevenLabsAgentId.trim();

  const [rawPhoneNumbers, rawVoices, agents, tools, rawWebhooksRes, convaiSettings, agentDetail] =
    await Promise.all([
      elevenLabsRequest<
        Array<{
          phone_number_id: string;
          phone_number: string;
          label?: string;
          provider?: string;
          supports_inbound?: boolean;
          supports_outbound?: boolean;
          assigned_agent?: { agent_id?: string; agent_name?: string } | null;
        }>
      >(apiKey, "/v1/convai/phone-numbers"),
      elevenLabsRequest<{
        voices?: Array<{
          voice_id: string;
          name: string;
          category?: string | null;
          labels?: Record<string, string> | null;
        }>;
      }>(apiKey, "/v1/voices"),
      listAllAgents(apiKey),
      listAllTools(apiKey),
      elevenLabsRequest<{
        webhooks?: Array<{
          webhook_id: string;
          name: string;
          webhook_url: string;
          auth_type: string;
          is_disabled?: boolean;
          is_auto_disabled?: boolean;
        }>;
      }>(apiKey, "/v1/workspace/webhooks").catch(() => ({ webhooks: [] })),
      elevenLabsRequest<{
        webhooks?: {
          post_call_webhook_id?: string | null;
          events?: string[] | null;
        } | null;
      }>(apiKey, "/v1/convai/settings").catch(() => ({ webhooks: null })),
      configuredAgentId
        ? elevenLabsRequest<AgentDetailResponse>(
            apiKey,
            `/v1/convai/agents/${encodeURIComponent(configuredAgentId)}`
          ).catch(() => null)
        : Promise.resolve(null),
    ]);

  const phoneNumbers: ElevenLabsPhoneNumberItem[] = (Array.isArray(rawPhoneNumbers) ? rawPhoneNumbers : []).map(
    (item) => ({
      phoneNumberId: item.phone_number_id,
      phoneNumber: item.phone_number,
      label: item.label ?? "",
      provider: item.provider ?? "unknown",
      supportsInbound: Boolean(item.supports_inbound),
      supportsOutbound: item.supports_outbound !== false,
      assignedAgentId: item.assigned_agent?.agent_id ?? null,
      assignedAgentName: item.assigned_agent?.agent_name ?? null,
    })
  );

  const sipPhoneNumbers = phoneNumbers.filter((p) => p.provider === "sip_trunk");

  const voices: ElevenLabsVoiceItem[] = (Array.isArray(rawVoices.voices) ? rawVoices.voices : []).map((v) => ({
    voiceId: v.voice_id,
    name: v.name,
    category: v.category ?? null,
    labels: v.labels ?? {},
  }));

  const prefixWithSep = `${currentPrefix}_`;
  const prefixedToolNames = tools
    .map((t) => t.tool_config?.name ?? "")
    .filter((name) => name.startsWith(prefixWithSep))
    .sort();

  const webhooks: ElevenLabsWebhookSummary[] = (
    Array.isArray(rawWebhooksRes.webhooks) ? rawWebhooksRes.webhooks : []
  ).map((w) => ({
    webhookId: w.webhook_id,
    name: w.name,
    webhookUrl: w.webhook_url,
    authType: w.auth_type,
    isDisabled: Boolean(w.is_disabled),
    isAutoDisabled: Boolean(w.is_auto_disabled),
  }));

  const agentWebhookOverride = agentDetail?.platform_settings?.workspace_overrides?.webhooks;

  return {
    phoneNumbers,
    sipPhoneNumbers,
    voices,
    agents,
    prefixedToolsCount: prefixedToolNames.length,
    prefixedToolNames,
    activeAgentWebhookId: agentWebhookOverride?.post_call_webhook_id ?? null,
    activeAgentWebhookEvents: Array.isArray(agentWebhookOverride?.events)
      ? agentWebhookOverride.events
      : [],
    activeWorkspaceWebhookId: convaiSettings.webhooks?.post_call_webhook_id ?? null,
    webhooks,
    currentPrefix,
    configuredAgentId,
    configuredPhoneNumberId: settings.elevenLabsPhoneNumberId,
    configuredWebhookId: settings.elevenLabsWebhookId,
    hasWebhookSecret: Boolean(settings.elevenLabsWebhookSecret.trim()),
  };
}

/**
 * Provisiona ou sincroniza todos os recursos do painel na ElevenLabs em 1 clique, com isolamento por prefixo:
 * 1. Secret de autenticação (`<prefix>_agent_api_token`)
 * 2. 12 Webhook Tools prefixadas apontando para `/api/agent/*`
 * 3. Webhook pós-chamada HMAC (`/api/webhooks/elevenlabs`) — persistido imediatamente para nunca perder o secret
 * 4. Agente de voz prefixado com overrides + `workspace_overrides.webhooks` (sem sobrescrever o webhook global da conta)
 * 5. Vínculo do número SIP Trunk selecionado ao agente
 */
export async function provisionElevenLabsResources(
  input: ProvisionElevenLabsInput
): Promise<ProvisionElevenLabsResult> {
  const apiKey = await resolveElevenLabsApiKey(input.apiKey);
  const publicBaseUrl = validatePublicBaseUrl(input.publicBaseUrl);
  const settings = await getSettings();
  const prefix = normalizeElevenLabsPrefix(input.prefix ?? settings.elevenLabsResourcePrefix);
  const agentApiToken = getAgentApiToken();
  const warnings: string[] = [];

  if (!agentApiToken) {
    throw new Error(
      "AGENT_API_TOKEN (ou INBOUND_WEBHOOK_TOKEN) não está configurado nas variáveis de ambiente do servidor."
    );
  }

  const basePersistPatch: Record<string, unknown> = {
    elevenLabsResourcePrefix: prefix,
  };
  if (input.apiKey && input.apiKey.trim() && input.apiKey.trim() !== MASKED_SECRET_SENTINEL) {
    basePersistPatch.elevenLabsApiKey = input.apiKey.trim();
  }

  // 1. Secret do workspace para o header x-webhook-token das tools
  const secretName = `${prefix}_agent_api_token`;
  const existingSecrets = await listAllSecrets(apiKey);
  const existingSecret = existingSecrets.find((s) => s.name === secretName);
  let secretId: string;
  let secretAction: "created" | "updated";

  if (existingSecret) {
    await elevenLabsRequest(apiKey, `/v1/convai/secrets/${encodeURIComponent(existingSecret.secret_id)}`, {
      method: "PATCH",
      body: {
        type: "update",
        name: secretName,
        value: agentApiToken,
      },
      redactValues: [agentApiToken],
    });
    secretId = existingSecret.secret_id;
    secretAction = "updated";
  } else {
    const createdSecret = await elevenLabsRequest<{ secret_id: string }>(apiKey, "/v1/convai/secrets", {
      method: "POST",
      body: {
        type: "new",
        name: secretName,
        value: agentApiToken,
      },
      redactValues: [agentApiToken],
    });
    secretId = createdSecret.secret_id;
    secretAction = "created";
  }

  // 2. Sincronização das 12 webhook tools prefixadas
  const toolDefs = buildPanelElevenLabsTools(publicBaseUrl, prefix, secretId);
  const existingTools = await listAllTools(apiKey);
  const existingByName = new Map<string, string>();
  const existingNameById = new Map<string, string>();
  for (const tool of existingTools) {
    const name = tool.tool_config?.name;
    if (name) {
      existingByName.set(name, tool.id);
      existingNameById.set(tool.id, name);
    }
  }

  const syncedToolIds: string[] = [];
  const syncedToolNames: string[] = [];
  let toolsCreated = 0;
  let toolsUpdated = 0;

  for (const def of toolDefs) {
    const toolBody = {
      tool_config: {
        type: "webhook",
        name: def.name,
        description: def.description,
        response_timeout_secs: 20,
        api_schema: def.apiSchema,
      },
    };

    const existingId = existingByName.get(def.name);
    if (existingId) {
      await elevenLabsRequest(apiKey, `/v1/convai/tools/${encodeURIComponent(existingId)}`, {
        method: "PATCH",
        body: toolBody,
      });
      syncedToolIds.push(existingId);
      toolsUpdated += 1;
    } else {
      const created = await elevenLabsRequest<{ id: string }>(apiKey, "/v1/convai/tools", {
        method: "POST",
        body: toolBody,
      });
      syncedToolIds.push(created.id);
      toolsCreated += 1;
    }
    syncedToolNames.push(def.name);
  }

  // 3. Registro ou reutilização do Webhook Pós-Chamada HMAC (antes do agente para isolar via workspace_overrides)
  const webhookUrl = `${publicBaseUrl}/api/webhooks/elevenlabs`;
  const webhookName = `[${prefix}] Webhook Pós-Chamada`;
  const webhooksListRes = await elevenLabsRequest<{
    webhooks?: Array<{
      webhook_id: string;
      name: string;
      webhook_url: string;
      auth_type: string;
      is_disabled?: boolean;
      is_auto_disabled?: boolean;
    }>;
  }>(apiKey, "/v1/workspace/webhooks");

  const existingWebhooks = Array.isArray(webhooksListRes.webhooks) ? webhooksListRes.webhooks : [];
  const savedWebhookId = settings.elevenLabsWebhookId.trim();
  const hasSavedSecret = Boolean(settings.elevenLabsWebhookSecret.trim());

  const reusableWebhook =
    !input.recreateWebhook && hasSavedSecret
      ? existingWebhooks.find((w) => {
          if (w.is_disabled || w.is_auto_disabled || w.auth_type !== "hmac") return false;
          if (w.webhook_url.replace(/\/+$/, "") !== webhookUrl) return false;
          // Se já temos webhookId salvo, só reutiliza o MESMO ID para nunca descasar o signing secret
          return savedWebhookId ? w.webhook_id === savedWebhookId : w.name === webhookName;
        })
      : undefined;

  let webhookId: string;
  let newWebhookSecret: string | null = null;
  let webhookAction: "created" | "reused";

  if (reusableWebhook) {
    webhookId = reusableWebhook.webhook_id;
    webhookAction = "reused";
  } else {
    const createdWebhook = await elevenLabsRequest<{
      webhook_id: string;
      webhook_secret?: string | null;
    }>(apiKey, "/v1/workspace/webhooks", {
      method: "POST",
      body: {
        settings: {
          auth_type: "hmac",
          name: webhookName,
          webhook_url: webhookUrl,
        },
      },
    });
    webhookId = createdWebhook.webhook_id;
    newWebhookSecret = createdWebhook.webhook_secret?.trim() || null;
    webhookAction = "created";

    if (!newWebhookSecret) {
      warnings.push(
        "A ElevenLabs criou o webhook mas não retornou webhook_secret; confira o signing secret no painel da ElevenLabs."
      );
    }

    // Persiste imediatamente o webhook_id e o one-time webhook_secret para nunca perdê-lo se um passo posterior falhar
    await updateSettings({
      ...basePersistPatch,
      elevenLabsWebhookId: webhookId,
      ...(newWebhookSecret ? { elevenLabsWebhookSecret: newWebhookSecret } : {}),
    });
  }

  // 4. Criação ou atualização do Agente de Voz prefixado (com webhook pós-chamada isolado no próprio agente)
  const brandLabel = (settings.brandName || "Painel de Vendas").trim();
  const agentName = `[${prefix}] ${brandLabel} — Prospecção de Voz`;
  const savedVoicePrompt = settings.voiceAiPrompt.trim();
  const savedFirstMessage = settings.voiceFirstMessage.trim();
  const requestedVoiceId = input.voiceId?.trim() || "";

  const existingAgents = await listAllAgents(apiKey);
  const preferredAgentId = (input.agentId ?? settings.elevenLabsAgentId ?? "").trim();
  const matchedExistingAgent =
    (preferredAgentId ? existingAgents.find((a) => a.agentId === preferredAgentId) : undefined) ??
    existingAgents.find((a) => a.name === agentName);

  const platformSettings = {
    overrides: {
      conversation_config_override: {
        agent: {
          first_message: true,
          language: true,
          prompt: {
            prompt: true,
          },
        },
      },
    },
    workspace_overrides: {
      webhooks: {
        post_call_webhook_id: webhookId,
        events: ["transcript", "call_initiation_failure"],
      },
    },
  };

  let agentId: string;
  let agentAction: "created" | "updated";
  let effectiveVoiceId: string | null = requestedVoiceId || matchedExistingAgent?.voiceId || null;

  if (matchedExistingAgent) {
    // Preserva tools extras/system tools já vinculadas manualmente ao agente (fora do nosso prefixo)
    const currentAgentDetail = await elevenLabsRequest<AgentDetailResponse>(
      apiKey,
      `/v1/convai/agents/${encodeURIComponent(matchedExistingAgent.agentId)}`
    ).catch(() => null);

    const existingToolIds = currentAgentDetail?.conversation_config?.agent?.prompt?.tool_ids ?? [];
    const prefixWithSep = `${prefix}_`;
    const preservedToolIds = existingToolIds.filter((id) => {
      const name = existingNameById.get(id);
      return !name || !name.startsWith(prefixWithSep);
    });
    const mergedToolIds = Array.from(new Set([...preservedToolIds, ...syncedToolIds]));

    const promptPatch: Record<string, unknown> = {
      tool_ids: mergedToolIds,
    };
    if (savedVoicePrompt) {
      promptPatch.prompt = savedVoicePrompt;
    }

    const agentPatch: Record<string, unknown> = {
      language: "pt",
      prompt: promptPatch,
    };
    if (savedFirstMessage) {
      agentPatch.first_message = savedFirstMessage;
    }

    const conversationConfigPatch: Record<string, unknown> = {
      agent: agentPatch,
    };
    if (requestedVoiceId) {
      conversationConfigPatch.tts = { voice_id: requestedVoiceId };
    }

    await elevenLabsRequest(apiKey, `/v1/convai/agents/${encodeURIComponent(matchedExistingAgent.agentId)}`, {
      method: "PATCH",
      body: {
        name: agentName,
        tags: [prefix, "prospeccao-voz"],
        conversation_config: conversationConfigPatch,
        platform_settings: platformSettings,
      },
    });
    agentId = matchedExistingAgent.agentId;
    agentAction = "updated";
  } else {
    const ttsCreate: Record<string, unknown> = {
      model_id: "eleven_flash_v2_5",
    };
    if (requestedVoiceId) {
      ttsCreate.voice_id = requestedVoiceId;
    }

    const createdAgent = await elevenLabsRequest<{ agent_id: string }>(apiKey, "/v1/convai/agents/create", {
      method: "POST",
      body: {
        name: agentName,
        tags: [prefix, "prospeccao-voz"],
        conversation_config: {
          agent: {
            language: "pt",
            first_message: savedFirstMessage || DEFAULT_FIRST_MESSAGE,
            prompt: {
              prompt: savedVoicePrompt || DEFAULT_VOICE_PROMPT,
              tool_ids: syncedToolIds,
            },
          },
          tts: ttsCreate,
        },
        platform_settings: platformSettings,
      },
    });
    agentId = createdAgent.agent_id;
    agentAction = "created";
  }

  // Persiste agente + webhook antes do vínculo de número SIP para garantir consistência mesmo se o SIP falhar
  await updateSettings({
    ...basePersistPatch,
    elevenLabsAgentId: agentId,
    elevenLabsWebhookId: webhookId,
  });

  // 5. Vínculo do número SIP Trunk selecionado ao agente
  const targetPhoneNumberId = (input.phoneNumberId ?? settings.elevenLabsPhoneNumberId ?? "").trim();
  let phoneResult: ProvisionElevenLabsResult["phoneNumber"] = null;

  if (targetPhoneNumberId) {
    await elevenLabsRequest(
      apiKey,
      `/v1/convai/phone-numbers/${encodeURIComponent(targetPhoneNumberId)}`,
      {
        method: "PATCH",
        body: {
          agent_id: agentId,
        },
      }
    );
    await updateSettings({
      elevenLabsPhoneNumberId: targetPhoneNumberId,
    });
    phoneResult = {
      phoneNumberId: targetPhoneNumberId,
      assigned: true,
    };
  } else {
    warnings.push(
      "Nenhum número SIP Trunk selecionado ainda. Selecione um número na lista e sincronize novamente para vinculá-lo ao agente."
    );
  }

  void addSystemLog({
    level: "info",
    source: "elevenlabs-sync",
    message: `Provisionamento ElevenLabs concluído com prefixo "${prefix}" (${agentAction === "created" ? "agente criado" : "agente atualizado"}, ${syncedToolIds.length} tools).`,
    details: {
      prefix,
      agentId,
      agentAction,
      secretAction,
      toolsCreated,
      toolsUpdated,
      webhookId,
      webhookAction,
      webhookScope: "agent",
      phoneNumberId: targetPhoneNumberId || null,
    },
  });

  return {
    prefix,
    publicBaseUrl,
    secret: {
      secretId,
      name: secretName,
      action: secretAction,
    },
    tools: {
      total: syncedToolIds.length,
      created: toolsCreated,
      updated: toolsUpdated,
      names: syncedToolNames,
      ids: syncedToolIds,
    },
    agent: {
      agentId,
      name: agentName,
      action: agentAction,
      voiceId: effectiveVoiceId,
    },
    webhook: {
      webhookId,
      name: webhookName,
      url: webhookUrl,
      action: webhookAction,
      secretRotated: Boolean(newWebhookSecret),
      scope: "agent",
    },
    phoneNumber: phoneResult,
    warnings,
  };
}

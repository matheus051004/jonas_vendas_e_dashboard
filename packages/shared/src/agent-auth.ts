/**
 * Token para a IA externa chamar /api/agent/* e /api/webhooks/agent/reply.
 * Prefere AGENT_API_TOKEN; se vazio, reutiliza INBOUND_WEBHOOK_TOKEN (dev simples).
 */
export function getAgentApiToken(): string | undefined {
  return process.env.AGENT_API_TOKEN || process.env.INBOUND_WEBHOOK_TOKEN || undefined;
}

export function isValidAgentToken(headerValue: string | null): boolean {
  const expected = getAgentApiToken();
  if (!expected || !headerValue) return false;
  return headerValue === expected;
}

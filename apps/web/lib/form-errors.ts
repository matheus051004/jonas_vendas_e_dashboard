import { z } from "zod";

export type FieldErrors = Partial<Record<string, string>>;

export function zodFieldErrors(error: z.ZodError): FieldErrors {
  const flat = error.flatten();
  const out: FieldErrors = {};
  for (const [field, messages] of Object.entries(flat.fieldErrors)) {
    if (messages?.[0]) out[field] = messages[0];
  }
  return out;
}

export function parseApiFieldErrors(body: unknown): FieldErrors {
  if (!body || typeof body !== "object" || !("error" in body)) return {};
  const err = (body as { error: unknown }).error;
  if (!err || typeof err !== "object" || !("fieldErrors" in err)) return {};
  const fieldErrors = (err as { fieldErrors: Record<string, string[]> }).fieldErrors;
  const out: FieldErrors = {};
  for (const [field, messages] of Object.entries(fieldErrors)) {
    if (messages?.[0]) out[field] = messages[0];
  }
  return out;
}

type SubmitResult =
  | { ok: true }
  | { ok: false; fieldErrors: FieldErrors; formError?: string };

export function firstFieldError(errors: FieldErrors): string | undefined {
  return Object.values(errors)[0];
}

export async function submitJson(
  url: string,
  options: { method: string; body?: unknown },
): Promise<SubmitResult> {
  const init: RequestInit = { method: options.method };
  if (options.body !== undefined) {
    init.headers = { "Content-Type": "application/json" };
    init.body = JSON.stringify(options.body);
  }

  const res = await fetch(url, init);
  if (res.ok) return { ok: true };

  const data = await res.json().catch(() => null);
  const fieldErrors = parseApiFieldErrors(data);
  const formErrors = data?.error?.formErrors as string[] | undefined;
  const formError =
    formErrors?.[0] ??
    (Object.keys(fieldErrors).length === 0 ? `Erro ${res.status}: ${res.statusText}` : undefined);

  return { ok: false, fieldErrors, formError };
}
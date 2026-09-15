import { NextResponse, type NextRequest } from "next/server";
import { getPlanDetails } from "@jonas/shared";
import { requireAgentToken } from "@/lib/agent-api";

function resolveBaseUrl(req: NextRequest): string {
  const forwardedHost = req.headers.get("x-forwarded-host");
  if (forwardedHost) {
    const proto = req.headers.get("x-forwarded-proto") || "https";
    return `${proto}://${forwardedHost}`;
  }
  if (process.env.NEXTAUTH_URL) {
    return process.env.NEXTAUTH_URL.replace(/\/+$/, "");
  }
  const host = req.headers.get("host");
  if (host) {
    const proto = req.headers.get("x-forwarded-proto") || (req.nextUrl?.protocol ? req.nextUrl.protocol.replace(":", "") : "http");
    return `${proto}://${host}`;
  }
  if (req.nextUrl?.origin && req.nextUrl.origin !== "null") {
    return req.nextUrl.origin;
  }
  return "";
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ planId: string }> }
) {
  const authError = requireAgentToken(req);
  if (authError) return authError;

  const { planId } = await params;
  const baseUrl = resolveBaseUrl(req);

  const plan = await getPlanDetails(planId, baseUrl);
  if (!plan) {
    return NextResponse.json({ error: "plano não encontrado" }, { status: 404 });
  }

  return NextResponse.json({ ok: true, plan });
}

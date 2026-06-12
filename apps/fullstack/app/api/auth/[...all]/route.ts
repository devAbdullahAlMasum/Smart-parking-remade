import { auth } from "@/lib/auth";
import { toNextJsHandler } from "better-auth/next-js";
import { NextRequest, NextResponse } from "next/server";

const authHandler = toNextJsHandler(auth);

function isAllowedCorsOrigin(origin: string | null) {
  return Boolean(origin);
}

function logAuthRequest(request: NextRequest, type: "request" | "response", extra: Record<string, unknown> = {}) {
  console.log(`[auth] ${type}`, {
    method: request.method,
    path: request.nextUrl.pathname,
    origin: request.headers.get("origin"),
    referer: request.headers.get("referer"),
    userAgent: request.headers.get("user-agent"),
    allowedOrigin: isAllowedCorsOrigin(request.headers.get("origin")),
    ...extra,
    at: new Date().toISOString(),
  });
}

function withCors(response: Response, request: NextRequest) {
  const origin = request.headers.get("origin");
  if (!origin || !isAllowedCorsOrigin(origin)) {
    return response;
  }

  const headers = new Headers(response.headers);
  headers.set("Access-Control-Allow-Origin", origin);
  headers.set("Access-Control-Allow-Credentials", "true");
  headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With");
  headers.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  headers.append("Vary", "Origin");

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

export function OPTIONS(request: NextRequest) {
  logAuthRequest(request, "request", { preflight: true });
  const origin = request.headers.get("origin");
  const headers = new Headers({
    "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Requested-With",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    Vary: "Origin",
  });

  if (origin && isAllowedCorsOrigin(origin)) {
    headers.set("Access-Control-Allow-Origin", origin);
    headers.set("Access-Control-Allow-Credentials", "true");
  }
  logAuthRequest(request, "response", { status: 204, corsHeaders: Object.fromEntries(headers.entries()) });
  return new NextResponse(null, { status: 204, headers });
}

export async function GET(request: NextRequest) {
  logAuthRequest(request, "request");
  const response = withCors(await authHandler.GET(request), request);
  logAuthRequest(request, "response", { status: response.status, corsOrigin: response.headers.get("Access-Control-Allow-Origin") });
  return response;
}

export async function POST(request: NextRequest) {
  logAuthRequest(request, "request");
  const response = withCors(await authHandler.POST(request), request);
  logAuthRequest(request, "response", { status: response.status, corsOrigin: response.headers.get("Access-Control-Allow-Origin") });
  return response;
}

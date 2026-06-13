import { auth } from "@/lib/auth";
import { toNextJsHandler } from "better-auth/next-js";
import { NextRequest, NextResponse } from "next/server";

const authHandler = toNextJsHandler(auth);

function getCorsHeaders(request: NextRequest) {
  const origin = request.headers.get("origin");

  return {
    "Access-Control-Allow-Origin": origin || "*",
    "Access-Control-Allow-Credentials": "true",
    "Access-Control-Allow-Headers":
      request.headers.get("access-control-request-headers") || "Content-Type, Authorization, X-Requested-With, x-device-key",
    "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
    Vary: "Origin",
  };
}

function patchCors(request: NextRequest, response: Response) {
  const headers = new Headers(response.headers);
  for (const [key, value] of Object.entries(getCorsHeaders(request))) {
    headers.set(key, value);
  }
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

export function OPTIONS(request: NextRequest) {
  const headers = new Headers(getCorsHeaders(request));
  return new NextResponse(null, { status: 204, headers });
}

export async function GET(request: NextRequest) {
  return patchCors(request, await authHandler.GET(request));
}

export async function POST(request: NextRequest) {
  return patchCors(request, await authHandler.POST(request));
}

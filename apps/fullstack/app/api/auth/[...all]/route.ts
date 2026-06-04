import { auth } from "@/lib/auth";
import { toNextJsHandler } from "better-auth/next-js";
import { NextRequest, NextResponse } from "next/server";

const authHandler = toNextJsHandler(auth);

function isAllowedCorsOrigin(origin: string | null) {
  if (!origin) {
    return false;
  }

  if (process.env.NODE_ENV !== "production") {
    return /^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin);
  }

  return origin === process.env.BETTER_AUTH_URL;
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

  return new NextResponse(null, { status: 204, headers });
}

export async function GET(request: NextRequest) {
  return withCors(await authHandler.GET(request), request);
}

export async function POST(request: NextRequest) {
  return withCors(await authHandler.POST(request), request);
}

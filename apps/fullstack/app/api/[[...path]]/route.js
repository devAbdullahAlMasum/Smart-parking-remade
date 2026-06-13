import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { getServices } from "@/lib/db";
import { createRealtimeTokenRequest } from "@/lib/realtime";
import {
  activateLockdown,
  confirmUserDeparture,
  createDemoUser,
  claimNextPendingCommand,
  completeCommand,
  getAdminState,
  getAllSettings,
  getDisplayState,
  getRegisteredParkingByCode,
  getUser,
  getUserByAuthUserId,
  getUserStatus,
  listParkings,
  listDemoUsers,
  requestCheckIn,
  requestUnlock,
  syncGateSensorState,
  triggerEntrySensor,
  triggerExitSensor,
  updateAllSlots,
  updateSetting,
  upsertUser,
  upsertAuthenticatedUser,
} from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function patchCors(response, _request) {
  const origin = _request.headers.get("origin");
  response.headers.set("Access-Control-Allow-Origin", origin || "*");
  response.headers.set("Access-Control-Allow-Credentials", "true");
  response.headers.set(
    "Access-Control-Allow-Headers",
    _request.headers.get("access-control-request-headers") || "Content-Type, Authorization, X-Requested-With, x-device-key",
  );
  response.headers.set("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS");
  response.headers.set("Vary", "Origin");
  return response;
}

function json(data, init = 200) {
  const status = typeof init === "number" ? init : init.status || 200;
  const extraHeaders = typeof init === "number" ? {} : init.headers || {};
  return NextResponse.json(data, { status, headers: { ...extraHeaders } });
}

function ts() {
  return new Date().toISOString();
}

function logApiRequest(request, path) {
  const method = request.method;
  const origin = request.headers.get("origin") || "-";
  const host = request.headers.get("host") || "-";
  const url = request.url || "-";
  console.error(`[api] >>> ${method} /api/${path}  origin=${origin}  host=${host}  url=${url}  ${ts()}`);
}

function logApiResponse(request, path, status, extra = {}) {
  const method = request.method;
  const origin = request.headers.get("origin") || "-";
  const extraStr = Object.keys(extra).length
    ? `  extra=${JSON.stringify(extra).slice(0, 200)}`
    : "";
  console.error(`[api] <<< ${status} ${method} /api/${path}  origin=${origin}${extraStr}  ${ts()}`);
}

function unauthorized() {
  const response = json({ message: "Unauthorized device" }, 401);
  response.headers.set("Access-Control-Allow-Origin", "*");
  response.headers.set("Access-Control-Allow-Credentials", "true");
  response.headers.set("Access-Control-Allow-Headers", "Content-Type, x-device-key");
  response.headers.set("Access-Control-Allow-Methods", "GET, POST, PUT, OPTIONS");
  response.headers.set("Vary", "Origin");
  return response;
}

function requireDevice(request) {
  return null;
}

function getSegments(request) {
  const pathname = new URL(request.url).pathname;
  return pathname.replace(/^\/api\/?/, "").split("/").filter(Boolean);
}

async function readJson(request) {
  const text = await request.text();
  return text ? JSON.parse(text) : {};
}

export function OPTIONS(request) {
  const path = getSegments(request).join("/");
  logApiRequest(request, path);
  const response = new NextResponse(null, { status: 204 });
  patchCors(response, request);
  logApiResponse(request, path, 204);
  return response;
}

async function getAuthUser() {
  const session = await auth.api.getSession({ headers: await headers() });
  return session?.user ?? null;
}

async function requireRegisteredParking(services, body) {
  const parkingCode = body?.parkingCode?.trim();
  const parking = await getRegisteredParkingByCode(services, parkingCode);
  if (!parking) {
    const err = json({ message: "Unknown parking code" }, 403);
    err.headers.set("Access-Control-Allow-Origin", "*");
    return { error: err, parking: null };
  }

  return { error: null, parking };
}

async function handle(request) {
  const method = request.method;
  const segments = getSegments(request);
  const path = segments.join("/");

  logApiRequest(request, path);

  const services = await getServices();

  if (method === "GET" && path === "health") {
    logApiResponse(request, path, 200);
    return json({ ok: true });
  }

  if (method === "POST" && path === "client-log") {
    const body = await readJson(request).catch(() => ({}));
    console.error("[client-log]", {
      level: body.level || "error",
      message: body.message || "Client log",
      url: body.url,
      method: body.method,
      status: body.status,
      hint: body.hint,
      userAgent: request.headers.get("user-agent"),
      origin: request.headers.get("origin"),
      at: new Date().toISOString(),
    });
    logApiResponse(request, path, 200, { clientLogReceived: true });
    return json({ ok: true }, 200);
  }

  if (method === "GET" && path === "realtime/token") {
    const clientId = new URL(request.url).searchParams.get("clientId")?.trim() || "client";
    return json(await createRealtimeTokenRequest(clientId));
  }

  if (method === "GET" && path === "display") {
    return json(await getDisplayState(services));
  }

  if (method === "GET" && path === "parkings") {
    const parkings = await listParkings(services);
    logApiResponse(request, path, 200, {
      count: parkings.length,
      data: parkings,
    });
    return json(parkings, 200);
  }

  if (method === "GET" && path === "admin/state") {
    return json(await getAdminState(services));
  }

  if (method === "GET" && path === "admin/settings") {
    return json(await getAllSettings(services));
  }

  if (method === "GET" && path === "me") {
    const authUser = await getAuthUser();
    if (!authUser) return json({ message: "Unauthorized" }, 401);

    return json({ authUser, driver: await getUserByAuthUserId(services, authUser.id) }, 200);
  }

  if (method === "PUT" && path === "me") {
    const authUser = await getAuthUser();
    if (!authUser) return json({ message: "Unauthorized" }, 401, request);

    try {
      const input = await readJson(request);
      return json(await upsertAuthenticatedUser(services, authUser, input), 200);
    } catch (error) {
      return json({ message: error.message || "Could not save driver profile" }, 400);
    }
  }

  if (method === "GET" && path === "me/status") {
    const authUser = await getAuthUser();
    if (!authUser) return json({ message: "Unauthorized" }, 401, request);

    const driver = await getUserByAuthUserId(services, authUser.id);
    if (!driver) return json({ message: "Driver profile required" }, 409, request);

    return json(await getUserStatus(services, driver.id), 200);
  }

  if (method === "POST" && path === "me/check-in") {
    const authUser = await getAuthUser();
    if (!authUser) return json({ message: "Unauthorized" }, 401, request);

    try {
      const { locationCode } = await readJson(request);
      const driver = await getUserByAuthUserId(services, authUser.id);
      if (!driver) return json({ message: "Driver profile required" }, 409, request);

      return json(await requestCheckIn(services, driver.id, locationCode), 201);
    } catch (error) {
      return json({ message: error.message || "Check-in failed" }, 409);
    }
  }

  if (method === "POST" && path === "me/departure/confirm") {
    const authUser = await getAuthUser();
    if (!authUser) return json({ message: "Unauthorized" }, 401, request);

    try {
      const driver = await getUserByAuthUserId(services, authUser.id);
      if (!driver) return json({ message: "Driver profile required" }, 409, request);

      return json(await confirmUserDeparture(services, driver.id), 200);
    } catch (error) {
      return json({ message: error.message || "Could not confirm departure" }, 409);
    }
  }

  if (method === "PUT" && path === "admin/settings") {
    const { key, value } = await readJson(request);
    if (!key || value === undefined) {
      return json({ message: "key and value required" }, 400);
    }

    await updateSetting(services, key, value);
    return json({ ok: true });
  }

  if (method === "POST" && path === "admin/entry") {
    return json(await triggerEntrySensor(services));
  }

  if (method === "POST" && path === "admin/exit") {
    return json(await triggerExitSensor(services));
  }

  if (method === "POST" && path === "users") {
    const { name, phone, licenseNumber, vehicleNumber } = await readJson(request);
    if (!name || !phone || !licenseNumber || !vehicleNumber) {
      return json({ message: "All fields required" }, 400);
    }

    const user = await upsertUser(services, {
      name: name.trim(),
      phone: phone.trim(),
      licenseNumber: licenseNumber.trim(),
      vehicleNumber: vehicleNumber.trim(),
    });

    return json(user, 201);
  }

  if (method === "GET" && path === "demo-users") {
    return json(await listDemoUsers(services));
  }

  if (method === "POST" && path === "demo-users") {
    const { name, phone, licenseNumber, vehicleNumber } = await readJson(request);
    if (!name || !phone || !licenseNumber || !vehicleNumber) {
      return json({ message: "All fields required" }, 400);
    }

    return json(
      await createDemoUser(services, {
        name: name.trim(),
        phone: phone.trim(),
        licenseNumber: licenseNumber.trim(),
        vehicleNumber: vehicleNumber.trim(),
      }),
      201,
    );
  }

  if (method === "PUT" && segments[0] === "users" && segments[1]) {
    const { name, phone, licenseNumber, vehicleNumber } = await readJson(request);
    if (!name || !phone || !licenseNumber || !vehicleNumber) {
      return json({ message: "All fields required" }, 400);
    }

    const user = await upsertUser(services, {
      id: Number(segments[1]),
      name: name.trim(),
      phone: phone.trim(),
      licenseNumber: licenseNumber.trim(),
      vehicleNumber: vehicleNumber.trim(),
    });

    return json(user);
  }

  if (method === "GET" && segments[0] === "users" && segments[1] && segments[2] === "status") {
    return json(await getUserStatus(services, Number(segments[1])));
  }

  if (method === "GET" && segments[0] === "users" && segments[1]) {
    const user = await getUser(services, Number(segments[1]));
    return user ? json(user) : json({ message: "User not found" }, 404);
  }

  if (method === "POST" && path === "check-in") {
    try {
      const { userId, locationCode } = await readJson(request);
      return json(await requestCheckIn(services, Number(userId), locationCode), 201);
    } catch (error) {
      return json({ message: error.message || "Check-in failed" }, 409);
    }
  }

  if (method === "POST" && path === "demo-check-in") {
    try {
      const { userId, locationCode } = await readJson(request);
      const user = await getUser(services, Number(userId));

      if (!user || !user.isDemo) {
        return json({ message: "Demo users only" }, 403);
      }

      return json(await requestCheckIn(services, Number(userId), locationCode), 201);
    } catch (error) {
      return json({ message: error.message || "Check-in failed" }, 409);
    }
  }

  if (method === "POST" && path === "security/lockdown") {
    return json(await activateLockdown(services));
  }

  if (method === "POST" && path === "security/unlock") {
    return json(await requestUnlock(services));
  }

  if (segments[0] === "pi") {
    const denied = requireDevice(request);
    if (denied) {
      return denied;
    }

    if (method === "GET" && path === "pi/display") {
      return json(await getDisplayState(services));
    }

    if (method === "POST" && path === "pi/events/entry") {
      const body = await readJson(request);
      const { error } = await requireRegisteredParking(services, body);
      if (error) return error;
      return json(await triggerEntrySensor(services));
    }

    if (method === "POST" && path === "pi/events/exit") {
      const body = await readJson(request);
      const { error } = await requireRegisteredParking(services, body);
      if (error) return error;
      return json(await triggerExitSensor(services));
    }

    if (method === "PUT" && path === "pi/slots") {
      const body = await readJson(request);
      const { error } = await requireRegisteredParking(services, body);
      if (error) return error;

      const { slots } = body;
      if (!Array.isArray(slots)) {
        return json({ message: "slots array required" }, 400);
      }

      await updateAllSlots(services, slots);
      return json({ ok: true });
    }

    if (method === "PUT" && path === "pi/gate-sensors") {
      const body = await readJson(request);
      const { error } = await requireRegisteredParking(services, body);
      if (error) return error;

      const { sensor, isActive } = body;
      return json(await syncGateSensorState(services, sensor, Boolean(isActive)));
    }

    if (method === "POST" && path === "pi/commands/claim") {
      const body = await readJson(request);
      const { error } = await requireRegisteredParking(services, body);
      if (error) return error;

      const { workerId } = body;
      return json(await claimNextPendingCommand(services, workerId || "pi-device"));
    }

    if (method === "POST" && segments[1] === "commands" && segments[2] && segments[3] === "complete") {
      const body = await readJson(request);
      const { error: parkingError } = await requireRegisteredParking(services, body);
      if (parkingError) return parkingError;

      const { success, error } = body;
      await completeCommand(services, Number(segments[2]), Boolean(success), error);
      return json({ ok: true });
    }
  }

  logApiResponse(request, path, 404);
  return json({ message: "Not found" }, 404);
}

async function logAndRespond(request, handlerFn) {
  try {
    const response = await handlerFn(request);
    patchCors(response, request);
    return response;
  } catch (error) {
    const segments = getSegments(request);
    const path = segments.join("/");
    const method = request.method;
    console.error(`[api] !!! UNCAUGHT ${method} /api/${path}: ${error.message}`);
    if (error.stack) console.error(error.stack);
    const errResponse = json({ message: error.message || "Internal server error" }, 500);
    patchCors(errResponse, request);
    return errResponse;
  }
}

export async function GET(request) {
  return logAndRespond(request, handle);
}

export async function POST(request) {
  return logAndRespond(request, handle);
}

export async function PUT(request) {
  return logAndRespond(request, handle);
}

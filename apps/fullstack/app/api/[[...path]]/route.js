import { NextResponse } from "next/server";
import { getServices } from "@/lib/db";
import { createRealtimeTokenRequest } from "@/lib/realtime";
import {
  activateLockdown,
  createDemoUser,
  claimNextPendingCommand,
  completeCommand,
  getAdminState,
  getAllSettings,
  getDisplayState,
  getUser,
  getUserStatus,
  listDemoUsers,
  requestCheckIn,
  requestUnlock,
  syncGateSensorState,
  triggerEntrySensor,
  triggerExitSensor,
  updateAllSlots,
  updateSetting,
  upsertUser,
} from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type, x-device-key",
  "Access-Control-Allow-Methods": "GET, POST, PUT, OPTIONS",
};

function json(data, init = 200) {
  const status = typeof init === "number" ? init : init.status || 200;
  const headers = typeof init === "number" ? {} : init.headers || {};
  return NextResponse.json(data, { status, headers: { ...corsHeaders, ...headers } });
}

function unauthorized() {
  return json({ message: "Unauthorized device" }, 401);
}

function requireDevice(request) {
  const expectedKey = process.env.DEVICE_API_KEY;
  if (!expectedKey) {
    return null;
  }

  if (request.headers.get("x-device-key") !== expectedKey) {
    return unauthorized();
  }

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

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders });
}

async function handle(request) {
  const services = await getServices();
  const method = request.method;
  const segments = getSegments(request);
  const path = segments.join("/");

  if (method === "GET" && path === "health") {
    return json({ ok: true });
  }

  if (method === "GET" && path === "realtime/token") {
    const clientId = new URL(request.url).searchParams.get("clientId")?.trim() || "client";
    return json(await createRealtimeTokenRequest(clientId));
  }

  if (method === "GET" && path === "display") {
    return json(await getDisplayState(services));
  }

  if (method === "GET" && path === "admin/state") {
    return json(await getAdminState(services));
  }

  if (method === "GET" && path === "admin/settings") {
    return json(await getAllSettings(services));
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
      return json(await triggerEntrySensor(services));
    }

    if (method === "POST" && path === "pi/events/exit") {
      return json(await triggerExitSensor(services));
    }

    if (method === "PUT" && path === "pi/slots") {
      const { slots } = await readJson(request);
      if (!Array.isArray(slots)) {
        return json({ message: "slots array required" }, 400);
      }

      await updateAllSlots(services, slots);
      return json({ ok: true });
    }

    if (method === "PUT" && path === "pi/gate-sensors") {
      const { sensor, isActive } = await readJson(request);
      return json(await syncGateSensorState(services, sensor, Boolean(isActive)));
    }

    if (method === "POST" && path === "pi/commands/claim") {
      const { workerId } = await readJson(request);
      return json(await claimNextPendingCommand(services, workerId || "pi-device"));
    }

    if (method === "POST" && segments[1] === "commands" && segments[2] && segments[3] === "complete") {
      const { success, error } = await readJson(request);
      await completeCommand(services, Number(segments[2]), Boolean(success), error);
      return json({ ok: true });
    }
  }

  return json({ message: "Not found" }, 404);
}

export async function GET(request) {
  try {
    return await handle(request);
  } catch (error) {
    console.error(error);
    return json({ message: error.message || "Internal server error" }, 500);
  }
}

export async function POST(request) {
  try {
    return await handle(request);
  } catch (error) {
    console.error(error);
    return json({ message: error.message || "Internal server error" }, 500);
  }
}

export async function PUT(request) {
  try {
    return await handle(request);
  } catch (error) {
    console.error(error);
    return json({ message: error.message || "Internal server error" }, 500);
  }
}

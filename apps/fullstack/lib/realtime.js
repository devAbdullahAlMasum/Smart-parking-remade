import * as Ably from "ably";

export const REALTIME_CHANNEL = "smart-parking";

function getAbly() {
  if (!process.env.ABLY_API_KEY) {
    throw new Error("ABLY_API_KEY is required.");
  }

  return new Ably.Rest({
    key: process.env.ABLY_API_KEY,
    queryTime: true,
  });
}

export async function createRealtimeTokenRequest(clientId) {
  return getAbly().auth.createTokenRequest({
    clientId,
    capability: JSON.stringify({ [REALTIME_CHANNEL]: ["subscribe"] }),
    ttl: 60 * 60 * 1000,
  });
}

export async function publishRefresh(source) {
  if (!process.env.ABLY_API_KEY) {
    return;
  }

  const ably = getAbly();
  await ably.channels.get(REALTIME_CHANNEL).publish("refresh", {
    source,
    publishedAt: new Date().toISOString(),
  });
}

export async function publishVehicleMovementAlert(payload) {
  if (!process.env.ABLY_API_KEY) {
    return;
  }

  const ably = getAbly();
  await ably.channels.get(REALTIME_CHANNEL).publish("vehicle_movement", {
    ...payload,
    publishedAt: new Date().toISOString(),
  });
}

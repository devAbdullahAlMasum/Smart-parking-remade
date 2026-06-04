"use client";

import * as Ably from "ably";
import { QRCodeSVG } from "qrcode.react";
import Link from "next/link";
import { useEffect, useState } from "react";

async function requestJson(path, options) {
  const response = await fetch(path, options);
  const text = await response.text();
  const data = text ? JSON.parse(text) : {};

  if (!response.ok) {
    throw new Error(data.message || `Request failed (${response.status})`);
  }

  return data;
}

export function DisplayScreen() {
  const [display, setDisplay] = useState(null);

  useEffect(() => {
    let active = true;

    async function loadDisplay() {
      const data = await requestJson("/api/display", { cache: "no-store" });
      if (active) {
        setDisplay(data);
      }
    }

    loadDisplay().catch(console.error);

    const client = new Ably.Realtime({
      authUrl: "/api/realtime/token?clientId=fullstack-display",
      clientId: "fullstack-display",
    });
    const channel = client.channels.get("smart-parking");
    const refresh = () => loadDisplay().catch(console.error);

    channel.subscribe("refresh", refresh).catch(console.error);

    return () => {
      active = false;
      channel.unsubscribe("refresh", refresh);
      client.close();
    };
  }, []);

  const mode = display?.mode || "idle";

  return (
    <main className="min-h-screen bg-base-300 text-base-content">
      <div className="navbar border-b border-base-content/10 bg-base-200/70 backdrop-blur">
        <div className="flex-1">
          <span className="text-lg font-semibold">Smart Parking</span>
        </div>
        <div className="flex-none gap-2">
          <Link href="/scan" className="btn btn-ghost btn-sm">
            Scan
          </Link>
          <Link href="/admin" className="btn btn-primary btn-sm">
            Dashboard
          </Link>
        </div>
      </div>

      <section className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-6xl items-center justify-center p-6">
        {mode === "show_qr" && display?.qrValue ? (
          <div className="card w-full max-w-xl border border-primary/20 bg-base-100 shadow-2xl">
            <div className="card-body items-center gap-6 text-center">
              <div className="badge badge-primary badge-outline">Entry Active</div>
              <h1 className="text-4xl font-black tracking-tight">Scan to Enter</h1>
              <p className="max-w-md text-base-content/70">Open the app and scan this code to get an available parking slot.</p>
              <div className="rounded-box bg-white p-6 shadow-inner">
                <QRCodeSVG value={display.qrValue} size={280} includeMargin />
              </div>
              <div className="rounded-box border border-primary/20 bg-base-200 px-4 py-3">
                <div className="text-xs uppercase tracking-[0.25em] text-base-content/50">Parking Code</div>
                <div className="mt-2 font-mono text-2xl font-bold tracking-wider">{display.qrValue}</div>
              </div>
            </div>
          </div>
        ) : null}

        {mode === "assigned" ? (
          <div className="card w-full max-w-3xl bg-primary text-primary-content shadow-2xl">
            <div className="card-body items-center gap-4 py-16 text-center">
              <div className="badge badge-secondary badge-lg">Gate Open</div>
              <div className="text-8xl font-black tracking-tight">{display?.assignedSlotCode || "P1"}</div>
              <p className="max-w-xl text-xl opacity-90">{display?.subtitle}</p>
            </div>
          </div>
        ) : null}

        {mode === "full" ? (
          <div className="card w-full max-w-2xl border border-warning/30 bg-base-100 shadow-xl">
            <div className="card-body items-center gap-3 py-14 text-center">
              <div className="badge badge-warning badge-outline">Capacity Reached</div>
              <h1 className="text-5xl font-black">Parking Full</h1>
              <p className="text-lg text-base-content/70">No parking slots are currently available.</p>
            </div>
          </div>
        ) : null}

        {mode === "error" ? (
          <div className="card w-full max-w-2xl border border-error/30 bg-base-100 shadow-xl">
            <div className="card-body items-center gap-3 py-14 text-center">
              <div className="badge badge-error badge-outline">Setup Problem</div>
              <h1 className="text-5xl font-black">System Error</h1>
              <p className="text-lg text-base-content/70">No parking location is configured correctly.</p>
            </div>
          </div>
        ) : null}

        {mode === "idle" || !display ? (
          <div className="hero rounded-box border border-base-content/10 bg-base-200 shadow-xl">
            <div className="hero-content py-20 text-center">
              <div className="max-w-2xl">
                <div className="badge badge-neutral badge-outline">Standby</div>
                <h1 className="mt-4 text-5xl font-black">Waiting for the Next Car</h1>
                <p className="mt-4 text-lg text-base-content/70">The gate screen is idle. Trigger the entry sensor to start a new check-in flow.</p>
              </div>
            </div>
          </div>
        ) : null}
      </section>
    </main>
  );
}

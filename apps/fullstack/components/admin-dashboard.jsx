"use client";

import * as Ably from "ably";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { SignOutButton } from "./sign-out-button";

const SETTING_LABELS = {
  display_timeout_seconds: "Display QR Timeout",
  gate_open_seconds: "Gate Open Duration",
  parked_delay_seconds: "Parked Delay",
};

async function requestJson(path, options) {
  const response = await fetch(path, options);
  const text = await response.text();
  const data = text ? JSON.parse(text) : {};

  if (!response.ok) {
    throw new Error(data.message || `Request failed (${response.status})`);
  }

  return data;
}

export function AdminDashboard() {
  const [display, setDisplay] = useState(null);
  const [slots, setSlots] = useState([]);
  const [settings, setSettings] = useState({});
  const [editingKey, setEditingKey] = useState(null);
  const [editingValue, setEditingValue] = useState("");

  useEffect(() => {
    let active = true;

    async function loadState() {
      const data = await requestJson("/api/admin/state", { cache: "no-store" });
      if (!active) {
        return;
      }

      setDisplay(data.display);
      setSlots(data.slots || []);
      setSettings(data.settings || {});
    }

    loadState().catch(console.error);

    const client = new Ably.Realtime({
      authUrl: "/api/realtime/token?clientId=fullstack-admin",
      clientId: "fullstack-admin",
    });
    const channel = client.channels.get("smart-parking");
    const refresh = () => loadState().catch(console.error);

    channel.subscribe("refresh", refresh).catch(console.error);

    return () => {
      active = false;
      channel.unsubscribe("refresh", refresh);
      client.close();
    };
  }, []);

  const stats = useMemo(() => {
    const occupied = slots.filter((slot) => slot.isOccupied).length;
    const free = slots.length - occupied;
    return { occupied, free };
  }, [slots]);

  async function saveSetting(key) {
    await requestJson("/api/admin/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key, value: editingValue }),
    });

    setSettings((current) => ({ ...current, [key]: String(editingValue) }));
    setEditingKey(null);
    setEditingValue("");
  }

  return (
    <main className="min-h-screen bg-base-300 text-base-content">
      <div className="navbar border-b border-base-content/10 bg-base-200/70 backdrop-blur">
        <div className="flex-1">
          <div>
            <div className="text-sm uppercase tracking-[0.3em] text-base-content/50">Control Plane</div>
            <div className="text-xl font-bold">Smart Parking Dashboard</div>
          </div>
        </div>
        <div className="flex-none gap-2">
          <Link href="/scan" className="btn btn-ghost btn-sm">
            Scan
          </Link>
          <Link href="/" className="btn btn-primary btn-sm">
            Display View
          </Link>
          <SignOutButton />
        </div>
      </div>

      <div className="mx-auto flex max-w-7xl flex-col gap-6 p-6">
        <div className="stats stats-vertical border border-base-content/10 bg-base-100 shadow lg:stats-horizontal">
          <div className="stat">
            <div className="stat-title">Display Mode</div>
            <div className="stat-value text-primary">{display?.mode || "idle"}</div>
            <div className="stat-desc">Live state from the fullstack backend</div>
          </div>
          <div className="stat">
            <div className="stat-title">Occupied Slots</div>
            <div className="stat-value text-secondary">{stats.occupied}</div>
            <div className="stat-desc">Cars currently detected in slots</div>
          </div>
          <div className="stat">
            <div className="stat-title">Free Slots</div>
            <div className="stat-value text-accent">{stats.free}</div>
            <div className="stat-desc">Remaining available capacity</div>
          </div>
        </div>

        <div className="grid gap-6 xl:grid-cols-[1.3fr_0.7fr]">
          <div className="card border border-base-content/10 bg-base-100 shadow-xl">
            <div className="card-body gap-5">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="card-title text-2xl">Parking Slots</h2>
                  <p className="text-base-content/60">Realtime slot status and occupancy overview.</p>
                </div>
                <div className="join">
                  <button className="btn btn-outline join-item" onClick={() => requestJson("/api/admin/entry", { method: "POST" }).catch(console.error)}>
                    Trigger Entry
                  </button>
                  <button className="btn btn-outline join-item" onClick={() => requestJson("/api/admin/exit", { method: "POST" }).catch(console.error)}>
                    Trigger Exit
                  </button>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {slots.map((slot) => (
                  <div key={slot.slotId} className={`card border ${slot.isOccupied ? "border-error/40 bg-error/10" : "border-success/30 bg-success/10"}`}>
                    <div className="card-body gap-2 p-5">
                      <div className="flex items-center justify-between">
                        <h3 className="card-title text-xl">{slot.slotCode}</h3>
                        <div className={`badge ${slot.isOccupied ? "badge-error" : "badge-success"}`}>{slot.isOccupied ? "Occupied" : "Free"}</div>
                      </div>
                      <p className="text-sm text-base-content/60">Sensor #{slot.sensorIndex}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="card border border-base-content/10 bg-base-100 shadow-xl">
            <div className="card-body gap-5">
              <div>
                <h2 className="card-title text-2xl">System Settings</h2>
                <p className="text-base-content/60">Small, direct controls with no extra layers.</p>
              </div>

              <div className="flex flex-col gap-4">
                {Object.entries(SETTING_LABELS).map(([key, label]) => (
                  <div key={key} className="rounded-box border border-base-content/10 bg-base-200/60 p-4">
                    <div className="mb-2 text-sm font-semibold uppercase tracking-wide text-base-content/60">{label}</div>

                    {editingKey === key ? (
                      <div className="join w-full">
                        <input
                          type="number"
                          className="input input-bordered join-item w-full"
                          value={editingValue}
                          onChange={(event) => setEditingValue(event.target.value)}
                          onKeyDown={(event) => {
                            if (event.key === "Enter") {
                              saveSetting(key).catch(console.error);
                            }
                            if (event.key === "Escape") {
                              setEditingKey(null);
                              setEditingValue("");
                            }
                          }}
                          autoFocus
                        />
                        <button className="btn btn-primary join-item" onClick={() => saveSetting(key).catch(console.error)}>
                          Save
                        </button>
                        <button className="btn join-item" onClick={() => { setEditingKey(null); setEditingValue(""); }}>
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        className="btn btn-block justify-between bg-base-100"
                        onClick={() => {
                          setEditingKey(key);
                          setEditingValue(settings[key] || "");
                        }}
                      >
                        <span>{settings[key] || "-"}</span>
                        <span className="text-xs uppercase text-base-content/50">Edit</span>
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}

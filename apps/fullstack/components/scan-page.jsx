"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

async function requestJson(path, options) {
  const response = await fetch(path, options);
  const text = await response.text();
  const data = text ? JSON.parse(text) : {};

  if (!response.ok) {
    throw new Error(data.message || `Request failed (${response.status})`);
  }

  return data;
}

export function ScanPage() {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const frameRef = useRef(0);
  const scanningRef = useRef(false);
  const [demoUsers, setDemoUsers] = useState([]);
  const [selectedDemoUserId, setSelectedDemoUserId] = useState("");
  const [newDemoUser, setNewDemoUser] = useState({
    name: "",
    phone: "",
    licenseNumber: "",
    vehicleNumber: "",
  });
  const [parkingCode, setParkingCode] = useState("");
  const [activeCode, setActiveCode] = useState("");
  const [lastCode, setLastCode] = useState("");
  const [status, setStatus] = useState("Idle");
  const [error, setError] = useState("");
  const [scanning, setScanning] = useState(false);

  useEffect(() => {
    async function loadDemoState() {
      const [display, users] = await Promise.all([
        requestJson("/api/display", { cache: "no-store" }),
        requestJson("/api/demo-users", { cache: "no-store" }),
      ]);

      const code = display?.qrValue || "";
      setActiveCode(code);
      setParkingCode(code);
      setDemoUsers(users || []);
      if (!selectedDemoUserId && users?.[0]?.id) {
        setSelectedDemoUserId(String(users[0].id));
      }
    }

    loadDemoState().catch((err) => setError(err.message));

    return () => {
      scanningRef.current = false;
      cancelAnimationFrame(frameRef.current);
      streamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  useEffect(() => {
    if (!selectedDemoUserId && demoUsers[0]?.id) {
      setSelectedDemoUserId(String(demoUsers[0].id));
    }
  }, [demoUsers, selectedDemoUserId]);

  async function submitCheckIn(code) {
    if (!selectedDemoUserId) {
      throw new Error("Pick a demo user first.");
    }

    if (!code.trim()) {
      throw new Error("Enter or scan the parking code first.");
    }

    setStatus(`Detected ${code}. Sending check-in...`);
    const result = await requestJson("/api/demo-check-in", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: Number(selectedDemoUserId), locationCode: code }),
    });

    setStatus(`Success. Assigned ${result.assignedSlotCode}.`);
    setScanning(false);
    scanningRef.current = false;
    streamRef.current?.getTracks().forEach((track) => track.stop());
  }

  async function startScanner() {
    setError("");
    cancelAnimationFrame(frameRef.current);
    streamRef.current?.getTracks().forEach((track) => track.stop());

    if (!("BarcodeDetector" in window)) {
      setError("This browser does not support BarcodeDetector. Use Chrome on Android or scan with the native app.");
      return;
    }

    const detector = new window.BarcodeDetector({ formats: ["qr_code"] });
    const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
    streamRef.current = stream;

    if (videoRef.current) {
      videoRef.current.srcObject = stream;
      await videoRef.current.play();
    }

    setScanning(true);
    scanningRef.current = true;
    setStatus("Scanning for QR code...");

    const tick = async () => {
      if (!videoRef.current || !scanningRef.current) {
        return;
      }

      try {
        const barcodes = await detector.detect(videoRef.current);
        const match = barcodes.find((item) => item.rawValue);

        if (match?.rawValue) {
          setLastCode(match.rawValue);
          await submitCheckIn(match.rawValue);
          return;
        }
      } catch (scanError) {
        setError(scanError.message);
      }

      frameRef.current = requestAnimationFrame(tick);
    };

    frameRef.current = requestAnimationFrame(tick);
  }

  async function createDemoUser() {
    if (!newDemoUser.name.trim() || !newDemoUser.phone.trim() || !newDemoUser.licenseNumber.trim() || !newDemoUser.vehicleNumber.trim()) {
      setError("Fill in all demo user fields first.");
      return;
    }

    const created = await requestJson("/api/demo-users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(newDemoUser),
    });

    setDemoUsers((current) => [created, ...current]);
    setSelectedDemoUserId(String(created.id));
    setNewDemoUser({ name: "", phone: "", licenseNumber: "", vehicleNumber: "" });
    setError("");
  }

  return (
    <main className="min-h-screen bg-base-300 text-base-content">
      <div className="navbar border-b border-base-content/10 bg-base-200/70 backdrop-blur">
        <div className="flex-1">
          <div>
            <div className="text-sm uppercase tracking-[0.3em] text-base-content/50">Web Scanner</div>
            <div className="text-xl font-bold">Smart Parking Check-In</div>
          </div>
        </div>
        <div className="flex-none gap-2">
          <Link href="/" className="btn btn-ghost btn-sm">
            Display
          </Link>
          <Link href="/admin" className="btn btn-primary btn-sm">
            Dashboard
          </Link>
        </div>
      </div>

      <div className="mx-auto grid min-h-[calc(100vh-4rem)] max-w-6xl gap-6 p-6 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="card border border-base-content/10 bg-base-100 shadow-xl">
          <div className="card-body gap-4">
            <h1 className="card-title text-3xl">Demo Check-In</h1>
            <p className="text-base-content/65">Create demo users once, reuse them forever, and check in with the typed parking code or a camera scan.</p>

            <div className="grid gap-3 rounded-box border border-base-content/10 bg-base-200/60 p-4 md:grid-cols-2">
              <input
                className="input input-bordered"
                placeholder="Demo name"
                value={newDemoUser.name}
                onChange={(event) => setNewDemoUser((current) => ({ ...current, name: event.target.value }))}
              />
              <input
                className="input input-bordered"
                placeholder="Phone"
                value={newDemoUser.phone}
                onChange={(event) => setNewDemoUser((current) => ({ ...current, phone: event.target.value }))}
              />
              <input
                className="input input-bordered"
                placeholder="License number"
                value={newDemoUser.licenseNumber}
                onChange={(event) => setNewDemoUser((current) => ({ ...current, licenseNumber: event.target.value }))}
              />
              <input
                className="input input-bordered"
                placeholder="Vehicle plate"
                value={newDemoUser.vehicleNumber}
                onChange={(event) => setNewDemoUser((current) => ({ ...current, vehicleNumber: event.target.value }))}
              />
              <button className="btn btn-primary md:col-span-2" onClick={() => createDemoUser().catch((err) => setError(err.message))}>
                Save Demo User
              </button>
            </div>

            <div className="grid gap-3">
              <div className="text-sm uppercase tracking-wide text-base-content/50">Saved Demo Users</div>
              <div className="grid gap-3 md:grid-cols-2">
                {demoUsers.map((demoUser) => (
                  <button
                    key={demoUser.id}
                    className={`card border text-left ${String(demoUser.id) === selectedDemoUserId ? "border-primary bg-primary/10" : "border-base-content/10 bg-base-200/60"}`}
                    onClick={() => setSelectedDemoUserId(String(demoUser.id))}
                  >
                    <div className="card-body gap-2 p-4">
                      <div className="flex items-center justify-between gap-2">
                        <div className="font-semibold">{demoUser.name}</div>
                        <div className="badge badge-outline">Demo</div>
                      </div>
                      <div className="text-sm text-base-content/70">{demoUser.vehicleNumber}</div>
                      <div className="text-xs text-base-content/50">ID {demoUser.id} · {demoUser.licenseNumber}</div>
                    </div>
                  </button>
                ))}
              </div>
              {!demoUsers.length ? <div className="text-sm text-base-content/60">No demo users yet. Create one above.</div> : null}
            </div>

            <label className="form-control gap-2">
              <span className="label-text">Parking Code</span>
              <input
                type="text"
                className="input input-bordered font-mono"
                value={parkingCode}
                onChange={(event) => setParkingCode(event.target.value)}
                placeholder="Example: LOCATION:1"
              />
            </label>

            {activeCode ? (
              <div className="alert alert-info">
                <span>Current display code: <span className="font-mono font-semibold">{activeCode}</span></span>
              </div>
            ) : null}

            <div className="rounded-box overflow-hidden border border-base-content/10 bg-black">
              <video ref={videoRef} className="aspect-video w-full object-cover" muted playsInline />
            </div>

            <div className="flex flex-wrap gap-3">
              <button className="btn btn-secondary" onClick={() => submitCheckIn(parkingCode).catch((err) => setError(err.message))}>
                Check In With Code
              </button>
              <button className="btn btn-primary" onClick={() => startScanner().catch((err) => setError(err.message))}>
                Start Camera Scan
              </button>
              <button
                className="btn"
                onClick={() => {
                  setScanning(false);
                  scanningRef.current = false;
                  cancelAnimationFrame(frameRef.current);
                  streamRef.current?.getTracks().forEach((track) => track.stop());
                  setStatus("Stopped");
                }}
              >
                Stop
              </button>
            </div>
          </div>
        </div>

        <div className="card border border-base-content/10 bg-base-100 shadow-xl">
          <div className="card-body gap-4">
            <h2 className="card-title text-2xl">Scan Status</h2>
            <div className="rounded-box border border-base-content/10 bg-base-200 p-4">
              <div className="text-xs uppercase tracking-wide text-base-content/50">Selected Demo User</div>
              <div className="mt-2 text-lg font-semibold">
                {demoUsers.find((user) => String(user.id) === selectedDemoUserId)?.name || "None selected"}
              </div>
            </div>
            <div className="rounded-box border border-base-content/10 bg-base-200 p-4">
              <div className="text-xs uppercase tracking-wide text-base-content/50">State</div>
              <div className="mt-2 text-lg font-semibold">{status}</div>
            </div>
            <div className="rounded-box border border-base-content/10 bg-base-200 p-4">
              <div className="text-xs uppercase tracking-wide text-base-content/50">Last Code</div>
              <div className="mt-2 break-all font-mono text-sm">{lastCode || "No code detected yet"}</div>
            </div>
            {error ? <div className="alert alert-error"><span>{error}</span></div> : null}
            <div className="alert alert-info">
              <span>If browser camera scanning is unavailable on this device, use the native app instead.</span>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}

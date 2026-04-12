import { useMutation, useQuery } from "convex/react";
import { useEffect, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { api } from "@smart-parking/convex/api";
import "./App.css";

export default function App() {
  const display = useQuery(api.display.getDisplayState);
  const slots = useQuery(api.sensors.getAllSlots) ?? [];
  const settings = useQuery(api.settings.getAllSettings);
  const updateSetting = useMutation(api.settings.updateSetting);

  const [showAdmin, setShowAdmin] = useState(false);
  const [editingKey, setEditingKey] = useState(null);
  const [editingValue, setEditingValue] = useState("");

  useEffect(() => {
    function handleKeyDown(e) {
      if (e.key === "a" || e.key === "A") {
        setShowAdmin((prev) => !prev);
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const saveSetting = async (key, value) => {
    await updateSetting({ key, value });
    setEditingKey(null);
    setEditingValue("");
  };

  // Loading
  if (!display) {
    return <main className="screen idle-screen" />;
  }

  // ─── Admin panel ─────────────────────────────────────────────────
  if (showAdmin) {
    const freeCount = slots.filter((s) => !s.isOccupied).length;
    const occCount = slots.filter((s) => s.isOccupied).length;

    return (
      <main className="screen admin-screen">
        <div className="admin-container">
          <div className="admin-header">
            <h2>Admin Panel</h2>
            <button className="admin-close" onClick={() => setShowAdmin(false)}>✕ Close</button>
          </div>

          <div className="admin-status">
            <span className="admin-dot">{occCount} occ / {freeCount} free</span>
          </div>

          <div className="admin-settings">
            <h3>Settings</h3>
            {settings && Object.entries({
              display_timeout_seconds: "Display QR Timeout (s)",
              gate_open_seconds: "Gate Open Duration (s)",
              parked_delay_seconds: "Parked Delay (s)",
            }).map(([key, label]) => (
              <div key={key} className="setting-row">
                <label>{label}</label>
                {editingKey === key ? (
                  <div className="setting-edit">
                    <input
                      type="number"
                      value={editingValue}
                      onChange={(e) => setEditingValue(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") saveSetting(key, editingValue);
                        if (e.key === "Escape") { setEditingKey(null); setEditingValue(""); }
                      }}
                      autoFocus
                    />
                    <button onClick={() => saveSetting(key, editingValue)}>✓</button>
                    <button onClick={() => { setEditingKey(null); setEditingValue(""); }}>✕</button>
                  </div>
                ) : (
                  <div className="setting-view" onClick={() => { setEditingKey(key); setEditingValue(settings[key] || ""); }}>
                    <span>{settings[key]}</span>
                    <button className="edit-btn">✎</button>
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="admin-slots">
            <h3>Parking Slots</h3>
            <div className="admin-slots-grid">
              {slots.map((slot) => (
                <div key={slot.slotId} className={`admin-slot ${slot.isOccupied ? "occupied" : "free"}`}>
                  <strong>{slot.slotCode}</strong>
                  <span>{slot.isOccupied ? "Occupied" : "Available"}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>
    );
  }

  // ─── Display modes ───────────────────────────────────────────────

  // Idle → black screen
  if (display.mode === "idle") {
    return <main className="screen idle-screen" />;
  }

  // Show QR → only QR code, nothing else
  if (display.mode === "show_qr" && display.qrValue) {
    return (
      <main className="screen qr-screen">
        <div className="qr-center">
          <QRCodeSVG value={display.qrValue} size={400} includeMargin />
        </div>
      </main>
    );
  }

  // Assigned slot
  if (display.mode === "assigned") {
    return (
      <main className="screen assigned-screen">
        <div className="assigned-center">
          <h1 className="assigned-slot">{display.assignedSlotCode || "P1"}</h1>
          <p className="assigned-subtitle">{display.subtitle}</p>
        </div>
      </main>
    );
  }

  // Parking full
  if (display.mode === "full") {
    return (
      <main className="screen center-msg">
        <h1>Parking Full</h1>
        <p>No slots available</p>
      </main>
    );
  }

  // Error
  if (display.mode === "error") {
    return (
      <main className="screen center-msg">
        <h1>Setup Error</h1>
        <p>No parking location configured</p>
      </main>
    );
  }

  // Fallback
  return <main className="screen idle-screen" />;
}

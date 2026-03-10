"use client";

import React, { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { User, Pencil, X, CheckCircle, ArrowLeft } from "lucide-react";

export default function ProfilePage() {
  const { data: session } = useSession();
  const router = useRouter();

  const [dispatchTargetId, setDispatchTargetId] = useState<string | null>(null);
  const [qrBase64, setQrBase64] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState("");
  const [qrPopupOpen, setQrPopupOpen] = useState(false);

  const [formData, setFormData] = useState({
    name: session?.user?.name || "",
    given_name: session?.user?.given_name || "",
    family_name: session?.user?.family_name || "",
    email: session?.user?.email || "",
    phone: (session?.user as any)?.phone_number || "",
    sub: session?.user?.sub || "",
  });

  // Keep form in sync when session loads
  useEffect(() => {
    if (session?.user) {
      setFormData({
        name: session.user.name || "",
        given_name: session.user.given_name || "",
        family_name: session.user.family_name || "",
        email: session.user.email || "",
        phone: (session.user as any)?.phone_number || "",
        sub: session.user.sub || "",
      });
    }
  }, [session?.user?.sub]);

  useEffect(() => {
    if (!session?.user?.sub) return;
    fetch(`/api/dispatch/target?username=${session.user.sub}`)
      .then((r) => r.json())
      .then((d) => setDispatchTargetId(d.dispatchTargets?.[0]?.id ?? null))
      .catch(() => {});
  }, [session?.user?.sub]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!editing) return;
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleCancel = () => {
    setEditing(false);
    setSaveMsg("");
    setFormData({
      name: session?.user?.name || "",
      given_name: session?.user?.given_name || "",
      family_name: session?.user?.family_name || "",
      email: session?.user?.email || "",
      phone: (session?.user as any)?.phone_number || "",
      sub: session?.user?.sub || "",
    });
  };

  const handleSave = async () => {
    if (!dispatchTargetId) {
      setSaveMsg("Dispatch target not loaded yet. Please try again.");
      return;
    }
    // Validate phone format before sending (NevisIDM requires: +/00 prefix for international, or 0 prefix for local)
    if (formData.phone && formData.phone.trim()) {
      const phoneRegex = /^(\+|00)(\d ?(\d ?){0,14}|\d{2} ?(\d ?){0,13}|\d{3} ?(\d ?){0,12})$|^0(\d ?){0,13}$/;
      if (!phoneRegex.test(formData.phone.trim())) {
        setSaveMsg("Invalid phone format. Use international format (e.g. +41 44 123 45 67) or local format starting with 0.");
        return;
      }
    }
    setSaving(true);
    setSaveMsg("");
    try {
      const qrRes = await fetch("/api/dispatch-qr-token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: session?.user?.sub,
          attributeName: `Authentication for ${session?.user?.sub}`,
        }),
      });
      if (!qrRes.ok) throw new Error(await qrRes.text());
      const qrData = await qrRes.json();
      if (qrData.dispatcherInformation?.response) {
        setQrBase64(qrData.dispatcherInformation.response);
        setQrPopupOpen(true);
      } else {
        throw new Error("No QR payload returned from server");
      }

      const updateRes = await fetch("/api/profile/update/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sub: session?.user?.sub,
          sessionId: qrData.sessionId, // QR sessionId for QR scan
          pushSessionId: qrData.pushSessionId, // Push sessionId for push approval
          dispatchTargetId,
          name: formData.name,
          given_name: formData.given_name,
          family_name: formData.family_name,
          email: formData.email,
          phone: formData.phone,
        }),
      });
      const updateData = await updateRes.json();
      if (!updateRes.ok) throw new Error(updateData.error || "Profile update failed");
      
      // Close QR modal on success
      setQrPopupOpen(false);
      setQrBase64(null);
      
      setEditing(false);
      setSaveMsg("Profile updated successfully ✓");
    } catch (err: any) {
      setSaveMsg("Failed to save: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  const username =
    session?.user?.name ||
    `${session?.user?.given_name ?? ""} ${session?.user?.family_name ?? ""}`.trim() ||
    session?.user?.sub ||
    "User";

  const fields: { label: string; name: keyof typeof formData; type?: string }[] = [
    { label: "Display Name", name: "name" },
    { label: "Given Name", name: "given_name" },
    { label: "Family Name", name: "family_name" },
    { label: "Email", name: "email", type: "email" },
    { label: "Phone", name: "phone", type: "tel" },
  ];

  return (
    <div style={{ background: "#F3F4F6", minHeight: "100vh", padding: "2rem 1rem" }}>
      <div style={{ maxWidth: 680, margin: "0 auto", display: "flex", flexDirection: "column", gap: "1.5rem" }}>

        {/* ── Header banner ── */}
        <div style={{
          background: "#0B1220",
          borderRadius: 12,
          padding: "1.5rem 2rem",
          color: "#fff",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: "1rem",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
            <div style={{
              width: 44, height: 44, borderRadius: "50%",
              background: "#1F2A40",
              display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
            }}>
              <User size={22} color="#9CA3AF" />
            </div>
            <div>
              <p style={{ fontSize: 13, color: "#9CA3AF", marginBottom: 2 }}>Account Profile</p>
              <h1 style={{ fontSize: "1.25rem", fontWeight: 700 }}>{username}</h1>
              {session?.user?.sub && (
                <p style={{ fontSize: 11, color: "#6B7280", marginTop: 2, fontFamily: "monospace" }}>
                  {session.user.sub}
                </p>
              )}
            </div>
          </div>
          <button
            onClick={() => router.push("/dashboard")}
            style={{
              background: "#1F2A40",
              border: "none",
              borderRadius: 8,
              padding: "0.5rem 1rem",
              fontSize: 12,
              color: "#9CA3AF",
              cursor: "pointer",
              display: "flex", alignItems: "center", gap: 6,
            }}
          >
            <ArrowLeft size={13} />
            Dashboard
          </button>
        </div>

        {/* ── Profile fields card ── */}
        <div style={{
          background: "#fff",
          border: "1px solid #E5E7EB",
          borderRadius: 12,
          padding: "1.5rem",
        }}>
          {/* Card header */}
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            marginBottom: "1.5rem",
          }}>
            <div>
              <h2 style={{ fontSize: 16, fontWeight: 700, color: "#111827" }}>Personal Information</h2>
              <p style={{ fontSize: 12, color: "#6B7280", marginTop: 2 }}>
                {editing ? "Make your changes and save below." : "Your account details as stored in the system."}
              </p>
            </div>
            {!editing && (
              <button
                onClick={() => { setEditing(true); setSaveMsg(""); }}
                style={{
                  background: "#0B1220",
                  color: "#fff",
                  border: "none",
                  borderRadius: 8,
                  padding: "0.5rem 1.1rem",
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: "pointer",
                  display: "flex", alignItems: "center", gap: 6,
                }}
              >
                <Pencil size={13} />
                Edit
              </button>
            )}
          </div>

          {/* Fields */}
          <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            {fields.map(({ label, name, type }) => (
              <div key={name} style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: "#374151" }}>{label}</label>
                <input
                  type={type ?? "text"}
                  name={name}
                  value={formData[name]}
                  onChange={handleChange}
                  disabled={!editing}
                  style={{
                    height: 42,
                    padding: "0 14px",
                    border: `1px solid ${editing ? "#93C5FD" : "#E5E7EB"}`,
                    borderRadius: 8,
                    fontSize: 13,
                    color: "#111827",
                    background: editing ? "#F0F9FF" : "#F9FAFB",
                    outline: "none",
                    transition: "border-color .2s, background .2s",
                  }}
                />
              </div>
            ))}

            {/* Read-only sub */}
            <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: "#374151" }}>User ID (sub)</label>
              <input
                type="text"
                value={formData.sub}
                disabled
                style={{
                  height: 42,
                  padding: "0 14px",
                  border: "1px solid #E5E7EB",
                  borderRadius: 8,
                  fontSize: 12,
                  color: "#9CA3AF",
                  background: "#F9FAFB",
                  fontFamily: "monospace",
                  outline: "none",
                }}
              />
            </div>
          </div>

          {/* Status message */}
          {saveMsg && (
            <p style={{
              marginTop: "1rem",
              fontSize: 13,
              color: saveMsg.includes("✓") ? "#047857" : "#B91C1C",
              display: "flex", alignItems: "center", gap: 5,
            }}>
              {saveMsg.includes("✓") && <CheckCircle size={14} />}
              {saveMsg}
            </p>
          )}

          {/* Action buttons */}
          {editing && (
            <div style={{ display: "flex", gap: 10, marginTop: "1.5rem" }}>
              <button
                onClick={handleSave}
                disabled={saving}
                style={{
                  background: "#0B1220",
                  color: "#fff",
                  border: "none",
                  borderRadius: 8,
                  padding: "0.55rem 1.4rem",
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: saving ? "not-allowed" : "pointer",
                  opacity: saving ? 0.6 : 1,
                }}
              >
                {saving ? "Saving…" : "Save & Confirm"}
              </button>
              <button
                onClick={handleCancel}
                style={{
                  background: "#F9FAFB",
                  color: "#374151",
                  border: "1px solid #E5E7EB",
                  borderRadius: 8,
                  padding: "0.55rem 1.2rem",
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: "pointer",
                  display: "flex", alignItems: "center", gap: 5,
                }}
              >
                <X size={13} />
                Cancel
              </button>
            </div>
          )}
        </div>

      </div>

      {/* ── QR Popup ── */}
      {qrPopupOpen && qrBase64 && (
        <div
          style={{
            position: "fixed", inset: 0,
            background: "rgba(0,0,0,0.55)",
            display: "flex", alignItems: "center", justifyContent: "center",
            zIndex: 100,
          }}
        >
          <div style={{
            background: "#fff",
            borderRadius: 12,
            padding: "2rem",
            display: "flex", flexDirection: "column", alignItems: "center", gap: 16,
            border: "1px solid #E5E7EB",
            maxWidth: 340,
            width: "100%",
            position: "relative",
          }}>
            <button
              onClick={() => setQrPopupOpen(false)}
              style={{
                position: "absolute", top: 14, right: 14,
                background: "none", border: "none", cursor: "pointer", color: "#9CA3AF",
              }}
            >
              <X size={18} />
            </button>
            <h2 style={{ fontSize: 18, fontWeight: 700, color: "#0B1220" }}>Scan to Confirm</h2>
            <p style={{ fontSize: 13, color: "#6B7280", textAlign: "center" }}>
              Open your authenticator app and scan the QR code to authorise this profile update.
            </p>
            <img
              src={`data:image/png;base64,${qrBase64}`}
              alt="QR Code"
              style={{ width: 220, height: 220 }}
            />
            <span style={{ fontSize: 12, color: "#9CA3AF" }}>Waiting for confirmation…</span>
            <button
              onClick={() => setQrPopupOpen(false)}
              style={{
                fontSize: 13, color: "#6B7280",
                textDecoration: "underline",
                background: "none", border: "none", cursor: "pointer",
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

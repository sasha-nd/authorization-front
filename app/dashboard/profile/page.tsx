"use client";

import React, { useState, useEffect } from "react";
import { useSession } from "next-auth/react";

export default function ProfilePage() {
  const [dispatchTargetId, setDispatchTargetId] = useState<string | null>(null);
  const [qrBase64, setQrBase64] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [qrPopupOpen, setQrPopupOpen] = useState(false);

  const { data: session } = useSession();
  const [formData, setFormData] = useState({
    name: session?.user?.name || "",
    given_name: session?.user?.given_name || "",
    family_name: session?.user?.family_name || "",
    email: session?.user?.email || "",
    phone: (session?.user as any)?.phone_number || "",
    sub: session?.user?.sub || "",
  });

  useEffect(() => {
    if (!session?.user?.sub) return;

    const fetchDispatchTarget = async () => {
      try {
        const res = await fetch(`/api/dispatch/target?username=${session.user.sub}`);
        if (!res.ok) throw Error(`HTTP error! status: ${res.status}`);
        const data = await res.json();
        const targetId = data.dispatchTargets?.[0]?.id || null;
        setDispatchTargetId(targetId);
      } catch (err) {
        console.error("Failed to fetch dispatch target:", err);
        setDispatchTargetId(null);
      }
    };

    fetchDispatchTarget();
  }, [session?.user?.sub]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!editing) return;
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleCancel = () => {
    setEditing(false);
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
      alert("Dispatch target not loaded yet.");
      return;
    }

    setSaving(true);

    try {
      // 1. Generate QR code and wait for confirmation
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

      // 2. Send profile update to NevisIDM after QR confirmation
      // (simulate confirmation for now, or add polling if needed)
      const updateRes = await fetch("/api/profile/update/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sub: session?.user?.sub,
          dispatchTargetId,
          name: formData.name,
          given_name: formData.given_name,
          family_name: formData.family_name,
          email: formData.email,
          phone: formData.phone,
        }),
      });
      const updateData = await updateRes.json();
      if (!updateRes.ok) {
        throw new Error(updateData.error || "Profile update failed");
      }
      // Show NevisIDM PATCH response for debugging
      alert("NevisIDM PATCH response: " + JSON.stringify(updateData.patchResponse));
    } catch (err) {
      console.error("Failed to save profile:", err);
      alert("Failed to save profile: " + (err as any).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ padding: "1.5rem", maxWidth: "600px", margin: "0 auto", display: "flex", flexDirection: "column", gap: "1.5rem" }}>
      <h1 style={{ fontSize: "1.5rem", fontWeight: "bold" }}>Profile</h1>
      <div>User ID: {session?.user?.sub}</div>
      <div>Dispatch Target ID: {dispatchTargetId ?? "Not found"}</div>

      <form style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
        <label>
          Name:
          <input
            type="text"
            name="name"
            value={formData.name}
            onChange={handleChange}
            disabled={!editing}
            style={{ marginLeft: "0.5rem", backgroundColor: editing ? '#e6f7ff' : '#f7fafc' }}
          />
        </label>
        <label>
          Given Name:
          <input
            type="text"
            name="given_name"
            value={formData.given_name}
            onChange={handleChange}
            disabled={!editing}
            style={{ marginLeft: "0.5rem", backgroundColor: editing ? '#e6f7ff' : '#f7fafc' }}
          />
        </label>
        <label>
          Family Name:
          <input
            type="text"
            name="family_name"
            value={formData.family_name}
            onChange={handleChange}
            disabled={!editing}
            style={{ marginLeft: "0.5rem", backgroundColor: editing ? '#e6f7ff' : '#f7fafc' }}
          />
        </label>
        <label>
          Email:
          <input
            type="email"
            name="email"
            value={formData.email}
            onChange={handleChange}
            disabled={!editing}
            style={{ marginLeft: "0.5rem", backgroundColor: editing ? '#e6f7ff' : '#f7fafc' }}
          />
        </label>
        <label>
          Phone:
          <input
            type="text"
            name="phone"
            value={formData.phone}
            onChange={handleChange}
            disabled={!editing}
            style={{ marginLeft: "0.5rem", backgroundColor: editing ? '#e6f7ff' : '#f7fafc' }}
          />
        </label>
        <div style={{ display: "flex", gap: "1rem", marginTop: "1rem" }}>
          {!editing ? (
            <button
              type="button"
              onClick={() => setEditing(true)}
              style={{ padding: "0.5rem 1rem", backgroundColor: "#38a169", color: "#fff", borderRadius: "4px" }}
            >
              Edit
            </button>
          ) : (
            <>
              <button
                type="button"
                onClick={handleSave}
                style={{ padding: "0.5rem 1rem", backgroundColor: "#3182ce", color: "#fff", borderRadius: "4px" }}
                disabled={saving}
              >
                {saving ? "Saving..." : "Save & Generate QR"}
              </button>
              <button
                type="button"
                onClick={handleCancel}
                style={{ padding: "0.5rem 1rem", backgroundColor: "#a0aec0", color: "#fff", borderRadius: "4px" }}
              >
                Cancel
              </button>
            </>
          )}
        </div>
      </form>

      {/* QR Code Popup */}
      {qrPopupOpen && qrBase64 && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-8 rounded shadow-lg relative flex flex-col items-center">
            <button
              className="absolute top-2 right-2 text-gray-500 hover:text-gray-700"
              onClick={() => setQrPopupOpen(false)}
            >
              &times;
            </button>
            <h2>Scan this QR</h2>
            <img src={`data:image/png;base64,${qrBase64}`} alt="QR Code" style={{ width: 250, height: 250 }} />
            <button
              className="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
              onClick={() => setQrPopupOpen(false)}
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
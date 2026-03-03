"use client";

import { useState, useEffect } from "react";
import { QRCode } from "qrcode.react";
import { useSession } from "next-auth/react";

export default function DashboardPage() {
  const { data: session } = useSession();
  const [dispatchTargetId, setDispatchTargetId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [qrBase64, setQrBase64] = useState<string | null>(null);
  const [otpauthUri, setOtpauthUri] = useState<string | null>(null);
  const [qrPopupOpen, setQrPopupOpen] = useState(false);
  const [pendingConfirmation, setPendingConfirmation] = useState(false);
  interface ProfileType {
    name: string;
    given_name: string;
    family_name: string;
    email: string;
    phone: string;
    address: string;
  }

  const [profileData, setProfileData] = useState<ProfileType>({
    name: session?.user?.name || "",
    given_name: session?.user?.given_name || "",
    family_name: session?.user?.family_name || "",
    email: session?.user?.email || "",
    phone: (session?.user as any)?.phone_number || (session?.user as any)?.phone || "",
    address: (session?.user as any)?.address || "",
  });
  const [editData, setEditData] = useState<ProfileType>(profileData);

  useEffect(() => {
    if (!session?.user?.sub) return;
    const fetchDispatchTarget = async () => {
      try {
        const res = await fetch(`/api/dispatch/target?username=${session.user.sub}`);
        const data = await res.json();
        setDispatchTargetId(data.dispatchTargets?.[0]?.id || null);
      } catch (err) {
        console.error("Failed to fetch dispatch target:", err);
      }
    };
    fetchDispatchTarget();
  }, [session?.user?.sub]);

  const handleEdit = () => {
    setEditData(profileData);
    setPendingConfirmation(false);
  };

  const handleFieldChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setEditData({ ...editData, [e.target.name]: e.target.value });
  };

  const handleGenerateQR = async () => {
    if (!dispatchTargetId) {
      alert("Dispatch target not loaded yet. Try again.");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/dispatch-qr-token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: session?.user?.sub,
          attributeName: `Authentication for ${session?.user?.sub}`,
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      if (data.otpauth) {
        setOtpauthUri(data.otpauth);
        setQrBase64(null);
      } else if (data.dispatcherInformation?.response) {
        setQrBase64(data.dispatcherInformation.response);
        setOtpauthUri(null);
      } else {
        setQrBase64(null);
        setOtpauthUri(null);
      }
      setQrPopupOpen(true);
      setPendingConfirmation(true);

      // Start polling for confirmation status
      let pollCount = 0;
      const pollInterval = setInterval(async () => {
        pollCount++;
        if (pollCount > 20) {
          clearInterval(pollInterval);
          return;
        }
        try {
          const res = await fetch(`/api/profile/update/confirm-status?username=${session?.user?.sub}&targetId=${dispatchTargetId}`);
          const data = await res.json();
          if (data.status === "approved") {
            clearInterval(pollInterval);
            // Now call the profile update API once
            try {
              const updateRes = await fetch("/api/profile/update/save", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ sub: session?.user?.sub, dispatchTargetId, ...editData }),
              });
              const updateData = await updateRes.json();
              if (updateData.success) {
                setProfileData(editData);
                setPendingConfirmation(false);
                setQrPopupOpen(false);
                alert("Profile changes saved.");
              }
            } catch (err) {
              // Ignore errors during update
            }
          }
        } catch (err) {
          // Ignore errors during polling
        }
      }, 2000);
    } catch (err) {
      console.error("Failed to generate QR:", err);
      alert("Failed to generate QR: " + (err as any).message);
    } finally {
      setSaving(false);
    }
  };

  const handleConfirm = async () => {
    try {
      const res = await fetch("/api/profile/update/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sub: session?.user?.sub,
          dispatchTargetId,
          ...editData,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Unknown error");
      setProfileData(editData);
      setPendingConfirmation(false);
      setQrPopupOpen(false);
      alert("Profile changes saved.");
    } catch (err: any) {
      alert("Failed to save profile: " + err.message);
    }
  };

  const handleCancel = () => {
    setEditData(profileData);
    setPendingConfirmation(false);
    setQrPopupOpen(false);
    alert("Profile changes discarded.");
  };

  return (
    <div style={{ padding: "1.5rem", maxWidth: "600px", margin: "0 auto", display: "flex", flexDirection: "column", gap: "1.5rem" }}>
      <pre style={{ background: '#f6f8fa', padding: '1rem', borderRadius: '6px', fontSize: '0.9rem', color: '#333' }}>
        <strong>Session User Debug:</strong> {JSON.stringify(session?.user, null, 2)}
      </pre>
      <h1 style={{ fontSize: "1.5rem", fontWeight: "bold" }}>Profile</h1>
      <div>User ID: {session?.user?.sub}</div>
      <div>Dispatch Target ID: {dispatchTargetId ?? "Not found"}</div>

      <form style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
        <label>
          Name:
          <input type="text" name="name" value={editData.name} onChange={handleFieldChange} disabled={pendingConfirmation} />
        </label>
        <label>
          Given Name:
          <input type="text" name="given_name" value={editData.given_name} onChange={handleFieldChange} disabled={pendingConfirmation} />
        </label>
        <label>
          Family Name:
          <input type="text" name="family_name" value={editData.family_name} onChange={handleFieldChange} disabled={pendingConfirmation} />
        </label>
        <label>
          Email:
          <input type="email" name="email" value={editData.email} onChange={handleFieldChange} disabled={pendingConfirmation} />
        </label>
        <label>
          Phone:
          <input type="text" name="phone" value={editData.phone} onChange={handleFieldChange} disabled={pendingConfirmation} />
        </label>
        <label>
          Address:
          <input type="text" name="address" value={editData.address} onChange={handleFieldChange} disabled={pendingConfirmation} />
        </label>
        <div style={{ display: "flex", gap: "1rem", marginTop: "1rem" }}>
          <button type="button" onClick={handleEdit} style={{ padding: "0.5rem 1rem", backgroundColor: "#38a169", color: "#fff", borderRadius: "4px" }} disabled={pendingConfirmation}>Edit</button>
          <button type="button" onClick={handleGenerateQR} style={{ padding: "0.5rem 1rem", backgroundColor: "#3182ce", color: "#fff", borderRadius: "4px" }} disabled={saving || pendingConfirmation}>{saving ? "Generating..." : "Save & Confirm via QR"}</button>
        </div>
      </form>

      {/* QR Code Popup */}
      {qrPopupOpen && (
        <div
          style={{
            position: "fixed",
            top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: "rgba(0,0,0,0.6)",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            zIndex: 9999,
          }}
          onClick={() => setQrPopupOpen(false)}
        >
          <div
            style={{ backgroundColor: "#fff", padding: "1.5rem", borderRadius: "8px" }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2>Scan this QR</h2>
            {otpauthUri ? (
              <QRCode value={otpauthUri} size={250} />
            ) : qrBase64 ? (
              <img src={`data:image/png;base64,${qrBase64}`} alt="QR Code" style={{ maxWidth: "250px", maxHeight: "250px" }} />
            ) : (
              <div style={{ color: 'red' }}>No QR code available</div>
            )}
            {pendingConfirmation && (
              <div style={{ marginTop: '1rem', display: 'flex', gap: '1rem' }}>
                <button onClick={handleConfirm} style={{ padding: '0.5rem 1rem', backgroundColor: '#38a169', color: '#fff', borderRadius: '4px' }}>Confirm</button>
                <button onClick={handleCancel} style={{ padding: '0.5rem 1rem', backgroundColor: '#a0aec0', color: '#fff', borderRadius: '4px' }}>Cancel</button>
              </div>
            )}
            {otpauthUri && (
              <div style={{ marginTop: '1rem', wordBreak: 'break-all', fontSize: '0.9rem', color: '#555' }}>
                <strong>otpauth URI:</strong> {otpauthUri}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
// End of file
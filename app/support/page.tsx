"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState, useRef } from "react";
import { ArrowLeft, Search, X, ChevronRight, RefreshCw } from "lucide-react";
import LogoutButton from "@/app/components/LogoutButton";

type NevisUser = {
  extId: string;
  loginId?: string;
  name?: string;
  email?: string;
  given_name?: string;
  family_name?: string;
  phone_number?: string;
  address?: string;
  userState?: string;
  [key: string]: any;
};

type ActionMode = null | "profile" | "transfer";

function Field({
  label,
  name,
  value,
  editing,
  onChange,
}: {
  label: string;
  name: string;
  value: string;
  editing: boolean;
  onChange: (name: string, val: string) => void;
}) {
  return (
    <div className="flex flex-col" style={{ gap: 5 }}>
      <span className="font-semibold" style={{ fontSize: 11, color: "#6B7280" }}>
        {label}
      </span>
      <input
        type="text"
        value={value}
        disabled={!editing}
        onChange={(e) => onChange(name, e.target.value)}
        className="outline-none bg-white font-inter"
        style={{
          height: 38,
          padding: "0 12px",
          border: "1px solid #D1D5DB",
          fontSize: 13,
          color: "#111827",
          backgroundColor: editing ? "#F0F9FF" : "#F9FAFB",
        }}
      />
    </div>
  );
}

export default function SupportPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [users, setUsers] = useState<NevisUser[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");

  // Selected user
  const [selected, setSelected] = useState<NevisUser | null>(null);
  const [loadingUser, setLoadingUser] = useState(false);
  const [editData, setEditData] = useState<Record<string, string>>({});

  // Action mode: null = view, "profile" = edit profile, "transfer" = initiate transfer
  const [actionMode, setActionMode] = useState<ActionMode>(null);

  // Transfer form
  const [txRecipient, setTxRecipient] = useState("");
  const [txAmount, setTxAmount] = useState("");
  const [txRemarks, setTxRemarks] = useState("");

  // Push/QR confirmation state
  const [acting, setActing] = useState(false);
  const [qrBase64, setQrBase64] = useState<string | null>(null);
  const [qrOpen, setQrOpen] = useState(false);
  const [pendingConfirm, setPendingConfirm] = useState(false);
  const [dispatchTargetId, setDispatchTargetId] = useState<string | null>(null);
  const [actionMsg, setActionMsg] = useState("");
  const [pollStatus, setPollStatus] = useState<string>("");   // live status from Nevis
  const [pollCount, setPollCount] = useState(0);              // visible poll tick counter
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Guard: redirect if not support
  useEffect(() => {
    if (status === "loading") return;
    if (!session || !(session as any).scopes?.includes("support")) {
      router.replace("/");
    }
  }, [session, status, router]);

  // Load user list
  const loadUsers = () => {
    setLoadingUsers(true);
    setError("");
    fetch("/api/support/users")
      .then((r) => r.json())
      .then((data) => {
        const list: NevisUser[] = Array.isArray(data)
          ? data
          : data.items ?? data.users ?? data.data ?? [];
        setUsers(list);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoadingUsers(false));
  };

  useEffect(() => {
    loadUsers();
  }, []);

  // Cleanup poll on unmount
  useEffect(() => () => { if (pollRef.current) clearInterval(pollRef.current); }, []);

  async function handleSelectUser(user: NevisUser) {
    if (pollRef.current) clearInterval(pollRef.current);
    setSelected(null);
    setActionMode(null);
    setActionMsg("");
    setQrOpen(false);
    setPendingConfirm(false);
    setDispatchTargetId(null);
    setLoadingUser(true);
    try {
      const res = await fetch(`/api/support/users/${user.extId}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to load user");
      setSelected(data);
      setEditData({
        loginId: data.loginId ?? "",
        name: data.name ?? "",
        given_name: data.given_name ?? data.firstName ?? "",
        family_name: data.family_name ?? data.lastName ?? "",
        email: data.email ?? "",
        phone_number: data.phone_number ?? data.phoneNumber ?? "",
        address: data.address ?? "",
        userState: data.userState ?? "",
      });
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoadingUser(false);
    }
  }

  function handleFieldChange(name: string, val: string) {
    setEditData((prev) => {
      const updated = { ...prev, [name]: val };
      
      // Auto-update the display name when given_name or family_name changes
      if (name === "given_name" || name === "family_name") {
        const firstName = name === "given_name" ? val : prev.given_name || "";
        const lastName = name === "family_name" ? val : prev.family_name || "";
        updated.name = `${firstName} ${lastName}`.trim();
      }
      
      return updated;
    });
  }

  function resetAction() {
    if (pollRef.current) clearInterval(pollRef.current);
    setActing(false);
    setQrBase64(null);
    setQrOpen(false);
    setPendingConfirm(false);
    setDispatchTargetId(null);
    setActionMsg("");
    setPollStatus("");
    setPollCount(0);
    setTxRecipient("");
    setTxAmount("");
    setTxRemarks("");
  }

  /**
   * Step 1: Check user has granted support access (60s window).
   * Step 2: Call /api/support/users/[sub]/initiate to get QR + push to user.
   * Step 3: Poll confirm-status until approved (or grant expires).
   * Step 4: On approval, re-check access, then execute the action.
   */
  async function handleInitiateAction(mode: "profile" | "transfer") {
    if (!selected) return;

    // ── Gate: verify the user has an active support-access grant ──
    const accessRes = await fetch(`/api/profile/grant-access?sub=${encodeURIComponent(selected.extId)}`);
    const accessData = await accessRes.json();
    if (!accessData.active) {
      setActionMsg(
        "⛔ This user has not granted support access, or the 60-second window has expired. " +
        "Ask them to press \"Grant Support Access\" on their dashboard and try again."
      );
      return;
    }

    // ── For transfers: check if user has sufficient balance ──
    if (mode === "transfer") {
      const amountCents = Math.round(parseFloat(txAmount) * 100);
      if (isNaN(amountCents) || amountCents <= 0) {
        setActionMsg("⛔ Please enter a valid amount.");
        return;
      }

      try {
        const balanceRes = await fetch(`/api/support/balance?sub=${encodeURIComponent(selected.extId)}`);
        const balanceData = await balanceRes.json();
        
        if (!balanceRes.ok) {
          setActionMsg("⛔ Failed to check user balance.");
          return;
        }

        const balanceCents = balanceData.balanceCents || 0;
        if (balanceCents < amountCents) {
          const balanceDollars = (balanceCents / 100).toFixed(2);
          setActionMsg(`⛔ Insufficient funds. User has $${balanceDollars} but transfer requires $${txAmount}.`);
          return;
        }
      } catch (e: any) {
        setActionMsg("⛔ Error checking balance: " + e.message);
        return;
      }
    }

    const message =
      mode === "profile"
        ? `Support request: approve modification of your profile properties`
        : `Support request: Transfer $${txAmount} to ${txRecipient}${txRemarks ? ` for reason ${txRemarks}` : ""}`;

    setActing(true);
    setActionMsg("");

    try {
      // 1. Get QR + push sent to the USER
      const res = await fetch(`/api/support/users/${selected.extId}/initiate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to initiate");

      setQrBase64(data.qrBase64);
      setDispatchTargetId(data.dispatchTargetId);
      setQrOpen(true);
      setPendingConfirm(true);
      setPollStatus("");
      setPollCount(0);

      const txSessionId: string = data.sessionId; // QR session
      const txPushSessionId: string = data.pushSessionId; // Push session

      // 2. Poll both QR and push sessions in parallel (QR and push create separate sessions)
      let count = 0;
      pollRef.current = setInterval(async () => {
        count++;
        setPollCount(count);

        if (count > 60) {
          clearInterval(pollRef.current!);
          setPendingConfirm(false);
          setQrOpen(false);
          setActing(false);
          setActionMsg("Confirmation timed out (2 min). Please try again.");
          return;
        }
        try {
          // Poll both sessions in parallel
          const checks = [
            fetch(`/api/profile/pushconfirmation?sessionId=${encodeURIComponent(txSessionId)}`).then(r => r.json())
          ];
          if (txPushSessionId) {
            checks.push(
              fetch(`/api/profile/pushconfirmation?sessionId=${encodeURIComponent(txPushSessionId)}`).then(r => r.json())
            );
          }
          const results = await Promise.all(checks);

          console.log(`[poll #${count}] pushconfirmation:`, results);
          
          // Check if either QR or push was confirmed
          if (results.some(data => data.confirmed === true)) {
            clearInterval(pollRef.current!);
            setPendingConfirm(false);
            setQrOpen(false);
            setPollStatus("confirmed");

            // 3. Execute action after user confirmed (via QR scan OR push approval)
            if (mode === "profile") {
              await executeProfileSave();
            } else {
              await executeTransfer();
            }
          } else {
            // Set status from first result for display
            const firstResult = results[0];
            setPollStatus(firstResult.confirmed ? "confirmed" : (firstResult.error ?? "waiting"));
          }
        } catch (pollErr) {
          console.warn(`[poll #${count}] fetch error:`, pollErr);
        }
      }, 2000);
    } catch (e: any) {
      setActionMsg("Error: " + e.message);
      setActing(false);
    }
  }

  async function executeProfileSave() {
    if (!selected) return;
    // Re-check access has not expired between QR confirmation and write
    const accessRes = await fetch(`/api/profile/grant-access?sub=${encodeURIComponent(selected.extId)}`);
    const accessData = await accessRes.json();
    if (!accessData.active) {
      setActionMsg("⛔ Support access window expired before the action could complete. No changes were saved.");
      setActing(false);
      return;
    }
    try {
      const res = await fetch(`/api/support/users/${selected.extId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editData),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Save failed");
      setSelected((prev) => (prev ? { ...prev, ...editData } : prev));
      setActionMode(null);
      setActionMsg("Profile updated successfully ✓");
    } catch (e: any) {
      setActionMsg("Save failed: " + e.message);
    } finally {
      setActing(false);
    }
  }

  async function executeTransfer() {
    if (!selected) return;
    // Re-check access has not expired between QR confirmation and write
    const accessRes = await fetch(`/api/profile/grant-access?sub=${encodeURIComponent(selected.extId)}`);
    const accessData = await accessRes.json();
    if (!accessData.active) {
      setActionMsg("⛔ Support access window expired before the transfer could complete. No transfer was made.");
      setActing(false);
      return;
    }
    // Record / log the transfer — extend this to call your transfers API as needed.
    setActionMode(null);
    setTxRecipient("");
    setTxAmount("");
    setTxRemarks("");
    setActionMsg("Transfer authorised by user ✓");
    setActing(false);
  }

  const filtered = users.filter((u) => {
    const q = search.toLowerCase();
    return (
      (u.extId ?? "").toLowerCase().includes(q) ||
      (u.loginId ?? "").toLowerCase().includes(q) ||
      (u.name ?? "").toLowerCase().includes(q) ||
      (u.email ?? "").toLowerCase().includes(q)
    );
  });

  if (status === "loading") return null;

  return (
    <div className="flex min-h-screen flex-col font-inter" style={{ backgroundColor: "#F7F8FA" }}>
      {/* Header */}
      <header
        className="flex items-center justify-between bg-black px-6 shrink-0"
        style={{ height: 64 }}
      >
        <button
          onClick={() => router.push("/")}
          className="flex items-center gap-2 text-white hover:opacity-80 transition-opacity"
        >
          <ArrowLeft size={14} strokeWidth={2} />
          <span className="font-semibold text-[16px]">National Digital Bank</span>
        </button>
        <div className="flex items-center gap-3">
          <span style={{ fontSize: 12, color: "#9CA3AF" }}>Support Portal</span>
          <LogoutButton />
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* ── User list sidebar ─────────────────────────── */}
        <div
          className="flex flex-col shrink-0"
          style={{ width: 300, borderRight: "1px solid #E6E8EC", backgroundColor: "#FFFFFF" }}
        >
          <div
            className="flex items-center gap-2 px-4"
            style={{ height: 52, borderBottom: "1px solid #E6E8EC" }}
          >
            <Search size={14} color="#9CA3AF" />
            <input
              type="text"
              placeholder="Search users…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="flex-1 outline-none bg-white"
              style={{ fontSize: 13, color: "#111827" }}
            />
            {search && (
              <button onClick={() => setSearch("")}>
                <X size={12} color="#9CA3AF" />
              </button>
            )}
            <button
              onClick={loadUsers}
              disabled={loadingUsers}
              className="p-1 hover:bg-gray-100 rounded transition-colors disabled:opacity-50"
              title="Refresh user list"
            >
              <RefreshCw 
                size={14} 
                color="#9CA3AF" 
                className={loadingUsers ? "animate-spin" : ""}
              />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto">
            {error && (
              <p className="p-4 text-[13px]" style={{ color: "#B91C1C" }}>{error}</p>
            )}
            {loadingUsers ? (
              <p className="p-4 text-[13px]" style={{ color: "#9CA3AF" }}>Loading users…</p>
            ) : filtered.length === 0 ? (
              <p className="p-4 text-[13px]" style={{ color: "#9CA3AF" }}>No users found.</p>
            ) : (
              filtered.map((u) => (
                <button
                  key={u.extId}
                  onClick={() => handleSelectUser(u)}
                  className="w-full flex items-center justify-between px-4 hover:bg-[#F7F8FA] transition-colors"
                  style={{
                    height: 60,
                    borderBottom: "1px solid #E6E8EC",
                    backgroundColor: selected?.extId === u.extId ? "#F0F9FF" : undefined,
                  }}
                >
                  <div className="flex flex-col items-start" style={{ gap: 2 }}>
                    <span className="font-bold" style={{ fontSize: 14, color: "#000000" }}>
                      {u.name ?? u.loginId ?? u.extId}
                    </span>
                    <span style={{ fontSize: 11, color: "#6B7280" }}>
                      {u.email ?? u.extId}
                    </span>
                  </div>
                  <ChevronRight size={14} color="#D1D5DB" />
                </button>
              ))
            )}
          </div>
        </div>

        {/* ── User detail panel ─────────────────────────── */}
        <div className="flex flex-1 flex-col overflow-y-auto">
          {!selected && !loadingUser && (
            <div className="flex flex-1 items-center justify-center h-full">
              <span style={{ fontSize: 14, color: "#9CA3AF" }}>
                Select a user to view their profile.
              </span>
            </div>
          )}
          {loadingUser && (
            <div className="flex flex-1 items-center justify-center h-full">
              <span style={{ fontSize: 14, color: "#9CA3AF" }}>Loading…</span>
            </div>
          )}

          {selected && !loadingUser && (
            <div className="flex flex-col" style={{ maxWidth: 700, padding: 32, gap: 24 }}>

              {/* User header */}
              <div className="flex flex-col" style={{ gap: 4 }}>
                <span className="font-semibold" style={{ fontSize: 22, color: "#0B1220" }}>
                  {selected.name ?? selected.loginId ?? selected.extId}
                </span>
                <span style={{ fontSize: 12, color: "#6B7280" }}>ID: {selected.extId}</span>
                {selected.userState && (
                  <span
                    className="inline-flex items-center self-start px-2 py-0.5 mt-1"
                    style={{
                      fontSize: 11,
                      backgroundColor: selected.userState === "ACTIVE" ? "#DCFCE7" : "#FEF3C7",
                      color: selected.userState === "ACTIVE" ? "#166534" : "#92400E",
                    }}
                  >
                    {selected.userState}
                  </span>
                )}
              </div>

              {/* Action buttons — only visible when not in an active action */}
              {actionMode === null && (
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => { resetAction(); setActionMode("profile"); setActionMsg(""); }}
                    className="flex items-center justify-center hover:opacity-80 transition-opacity"
                    style={{ backgroundColor: "#0B1220", height: 36, padding: "0 20px", fontSize: 13, color: "#FFFFFF" }}
                  >
                    Modify Profile
                  </button>
                  <button
                    onClick={() => { resetAction(); setActionMode("transfer"); setActionMsg(""); }}
                    className="flex items-center justify-center hover:opacity-80 transition-opacity"
                    style={{ backgroundColor: "#D92D20", height: 36, padding: "0 20px", fontSize: 13, color: "#FFFFFF" }}
                  >
                    Initiate Transfer
                  </button>
                </div>
              )}

              {/* Feedback message */}
              {actionMsg && (
                <span style={{ fontSize: 13, color: actionMsg.includes("✓") ? "#047857" : "#B91C1C" }}>
                  {actionMsg}
                </span>
              )}

              {/* ── Modify Profile panel ─────────────── */}
              {actionMode === "profile" && (
                <div
                  className="flex flex-col"
                  style={{ gap: 16, padding: 20, border: "1px solid #E6E8EC", backgroundColor: "#FFFFFF" }}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold" style={{ fontSize: 15, color: "#0B1220" }}>
                      Modify Profile
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => { setActionMode(null); resetAction(); }}
                        disabled={acting}
                        className="hover:opacity-70 transition-opacity"
                        style={{ height: 34, padding: "0 14px", border: "1px solid #D1D5DB", fontSize: 13, color: "#374151" }}
                      >
                        Cancel
                      </button>
                      <button
                        onClick={() => handleInitiateAction("profile")}
                        disabled={acting || pendingConfirm}
                        className="hover:opacity-80 transition-opacity"
                        style={{
                          backgroundColor: "#0B1220",
                          height: 34,
                          padding: "0 18px",
                          fontSize: 13,
                          color: "#FFFFFF",
                          opacity: acting || pendingConfirm ? 0.6 : 1,
                        }}
                      >
                        {acting ? "Awaiting user confirmation…" : "Save & Send to User"}
                      </button>
                    </div>
                  </div>

                  <p style={{ fontSize: 12, color: "#6B7280" }}>
                    A push notification and QR code will be sent to the user's device for confirmation before saving.
                  </p>

                  <div className="grid grid-cols-2" style={{ gap: 14 }}>
                    <Field label="Login ID" name="loginId" value={editData.loginId} editing={false} onChange={handleFieldChange} />
                    <Field label="Full Name (auto)" name="name" value={editData.name} editing={false} onChange={handleFieldChange} />
                    <Field label="Given Name" name="given_name" value={editData.given_name} editing={!acting} onChange={handleFieldChange} />
                    <Field label="Family Name" name="family_name" value={editData.family_name} editing={!acting} onChange={handleFieldChange} />
                    <Field label="Email" name="email" value={editData.email} editing={!acting} onChange={handleFieldChange} />
                    <Field label="Phone Number" name="phone_number" value={editData.phone_number} editing={!acting} onChange={handleFieldChange} />
                    <div className="col-span-2">
                      <Field label="Address" name="address" value={editData.address} editing={!acting} onChange={handleFieldChange} />
                    </div>
                    <Field label="User State" name="userState" value={editData.userState} editing={!acting} onChange={handleFieldChange} />
                  </div>
                </div>
              )}

              {/* ── Initiate Transfer panel ──────────── */}
              {actionMode === "transfer" && (
                <div
                  className="flex flex-col"
                  style={{ gap: 16, padding: 20, border: "1px solid #E6E8EC", backgroundColor: "#FFFFFF" }}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold" style={{ fontSize: 15, color: "#0B1220" }}>
                      Initiate Transfer on Behalf of User
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => { setActionMode(null); resetAction(); }}
                        disabled={acting}
                        className="hover:opacity-70 transition-opacity"
                        style={{ height: 34, padding: "0 14px", border: "1px solid #D1D5DB", fontSize: 13, color: "#374151" }}
                      >
                        Cancel
                      </button>
                      <button
                        onClick={() => handleInitiateAction("transfer")}
                        disabled={acting || pendingConfirm || !txRecipient.trim() || !txAmount.trim()}
                        className="hover:opacity-80 transition-opacity"
                        style={{
                          backgroundColor: "#D92D20",
                          height: 34,
                          padding: "0 18px",
                          fontSize: 13,
                          color: "#FFFFFF",
                          opacity: acting || pendingConfirm || !txRecipient.trim() || !txAmount.trim() ? 0.6 : 1,
                        }}
                      >
                        {acting ? "Awaiting user confirmation…" : "Send to User for Approval"}
                      </button>
                    </div>
                  </div>

                  <p style={{ fontSize: 12, color: "#6B7280" }}>
                    A push notification and QR code will be sent to the user's device. The transfer will only proceed after the user confirms.
                  </p>

                  <div className="flex flex-col" style={{ gap: 14 }}>
                    {/* Recipient */}
                    <div className="flex flex-col" style={{ gap: 5 }}>
                      <span className="font-semibold" style={{ fontSize: 11, color: "#6B7280" }}>Recipient</span>
                      <input
                        type="text"
                        placeholder="Account ID or name"
                        value={txRecipient}
                        onChange={(e) => setTxRecipient(e.target.value)}
                        disabled={acting}
                        className="outline-none bg-white font-inter"
                        style={{ height: 38, padding: "0 12px", border: "1px solid #D1D5DB", fontSize: 13, color: "#111827" }}
                      />
                    </div>

                    {/* Amount */}
                    <div className="flex flex-col" style={{ gap: 5 }}>
                      <span className="font-semibold" style={{ fontSize: 11, color: "#6B7280" }}>Amount ($)</span>
                      <div
                        className="flex items-center gap-2 bg-white"
                        style={{ height: 38, padding: "0 12px", border: "1px solid #D1D5DB" }}
                      >
                        <span className="font-mono-jetbrains font-medium" style={{ fontSize: 14, color: "#111827" }}>$</span>
                        <input
                          type="text"
                          inputMode="decimal"
                          placeholder="0.00"
                          value={txAmount}
                          onChange={(e) => {
                            const value = e.target.value;
                            // Allow only numbers with up to 2 decimal places
                            if (value === "" || /^\d+(\.\d{0,2})?$/.test(value)) {
                              setTxAmount(value);
                            }
                          }}
                          disabled={acting}
                          className="flex-1 bg-white outline-none font-mono-jetbrains"
                          style={{ fontSize: 13, color: "#111827" }}
                        />
                      </div>
                    </div>

                    {/* Remarks */}
                    <div className="flex flex-col" style={{ gap: 5 }}>
                      <span className="font-semibold" style={{ fontSize: 11, color: "#6B7280" }}>
                        Remarks <span style={{ color: "#9CA3AF", fontWeight: 400 }}>(optional)</span>
                      </span>
                      <input
                        type="text"
                        placeholder="e.g. Rent payment"
                        value={txRemarks}
                        onChange={(e) => setTxRemarks(e.target.value)}
                        disabled={acting}
                        className="outline-none bg-white font-inter"
                        style={{ height: 38, padding: "0 12px", border: "1px solid #D1D5DB", fontSize: 13, color: "#111827" }}
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Read-only profile view when no action is open */}
              {actionMode === null && (
                <div className="grid grid-cols-2" style={{ gap: 14 }}>
                  <Field label="Login ID" name="loginId" value={editData.loginId} editing={false} onChange={() => {}} />
                  <Field label="Full Name" name="name" value={editData.name} editing={false} onChange={() => {}} />
                  <Field label="Given Name" name="given_name" value={editData.given_name} editing={false} onChange={() => {}} />
                  <Field label="Family Name" name="family_name" value={editData.family_name} editing={false} onChange={() => {}} />
                  <Field label="Email" name="email" value={editData.email} editing={false} onChange={() => {}} />
                  <Field label="Phone Number" name="phone_number" value={editData.phone_number} editing={false} onChange={() => {}} />
                  <div className="col-span-2">
                    <Field label="Address" name="address" value={editData.address} editing={false} onChange={() => {}} />
                  </div>
                  <Field label="User State" name="userState" value={editData.userState} editing={false} onChange={() => {}} />
                </div>
              )}

              {/* Raw JSON */}
              <details>
                <summary className="cursor-pointer select-none" style={{ fontSize: 12, color: "#6B7280" }}>
                  Raw user object
                </summary>
                <pre style={{ marginTop: 8, padding: 12, backgroundColor: "#F6F8FA", fontSize: 11, color: "#374151", overflowX: "auto", border: "1px solid #E6E8EC" }}>
                  {JSON.stringify(selected, null, 2)}
                </pre>
              </details>
            </div>
          )}
        </div>
      </div>

      {/* ── QR Popup (shown to support, scanned by user) ─── */}
      {qrOpen && qrBase64 && (
        <div
          className="fixed inset-0 flex items-center justify-center"
          style={{ backgroundColor: "rgba(0,0,0,0.6)", zIndex: 100 }}
        >
          <div
            className="bg-white flex flex-col items-center"
            style={{ padding: 28, gap: 16, border: "1px solid #E6E8EC", maxWidth: 360 }}
          >
            <span className="font-semibold" style={{ fontSize: 18, color: "#0B1220" }}>
              Waiting for User Confirmation
            </span>
            <p style={{ fontSize: 13, color: "#6B7280", textAlign: "center" }}>
              Show this QR code to the user, or ask them to check their authenticator app for the push notification.
            </p>
            <img
              src={`data:image/png;base64,${qrBase64}`}
              alt="QR Code"
              style={{ width: 220, height: 220 }}
            />
            {/* Live debug info */}
            <div style={{ fontSize: 12, color: "#6B7280", textAlign: "center" }}>
              <span>Poll #{pollCount} · status: </span>
              <span
                style={{
                  fontWeight: 600,
                  color:
                    pollStatus === "confirmed" ? "#047857"
                    : pollStatus === "waiting" || pollStatus === "" ? "#0B1220"
                    : "#B91C1C",
                }}
              >
                {pollStatus || "waiting…"}
              </span>
            </div>
            <button
              onClick={() => { resetAction(); setActionMode(null); }}
              style={{ fontSize: 13, color: "#6B7280", textDecoration: "underline", background: "none", border: "none", cursor: "pointer" }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

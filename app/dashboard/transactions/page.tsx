"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { ArrowLeft, X, ArrowRight } from "lucide-react";
import { useState, useEffect } from "react";

type Transfer = {
  transfer_id: string;
  type: string;
  transfer_date: string;
  amount: number; // cents
  status: string;
  from_account_id?: string;
  to_account_id?: string;
};

type Account = {
  account_id: string;
  account_name: string;
  current_balance: number; // cents
};

function formatCents(cents: number): string {
  return (Math.abs(cents) / 100).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
  });
}

export default function TransactionsPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const apiUrl = process.env.NEXT_PUBLIC_API_URL;

  // Account + transfer data
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [transfers, setTransfers] = useState<Transfer[]>([]);
  const [loadingData, setLoadingData] = useState(true);

  // Balance in cents — sourced from /api/balance (our own backend)
  const [localBalanceCents, setLocalBalanceCents] = useState<number | null>(null);

  // ── Fetch balance from our backend on mount ──
  useEffect(() => {
    if (!session?.user?.sub) return;
    fetch("/api/balance")
      .then((r) => r.json())
      .then((d) => {
        if (typeof d.balanceCents === "number") setLocalBalanceCents(d.balanceCents);
      })
      .catch(() => {});
  }, [session?.user?.sub]);

  // ── Persist balance change to backend ──
  async function saveBalance(cents: number) {
    setLocalBalanceCents(cents);
    await fetch("/api/balance", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ balanceCents: cents }),
    }).catch(() => {});
  }

  // Transfer modal
  const [showModal, setShowModal] = useState(false);
  const [recipient, setRecipient] = useState("");
  const [amount, setAmount] = useState("");
  const [remarks, setRemarks] = useState("");

  // Nevis auth state
  const [dispatchTargetId, setDispatchTargetId] = useState<string | null>(null);
  const [qrBase64, setQrBase64] = useState<string | null>(null);
  const [qrPopupOpen, setQrPopupOpen] = useState(false);
  const [pendingConfirmation, setPendingConfirmation] = useState(false);
  const [sending, setSending] = useState(false);
  const [statusMsg, setStatusMsg] = useState("");
  const [sessionId, setSessionId] = useState<string | null>(null);

  // Fetch dispatch target
  useEffect(() => {
    if (!session?.user?.sub) return;
    fetch(`/api/dispatch/target?username=${session.user.sub}`)
      .then((r) => r.json())
      .then((d) => setDispatchTargetId(d.dispatchTargets?.[0]?.id ?? null))
      .catch(() => {});
  }, [session?.user?.sub]);

  // Fetch accounts + all transfers (merges local and external API)
  useEffect(() => {
    const userId = session?.user?.sub ?? sessionStorage.getItem("user_id");
    if (!userId) return;

    setLoadingData(true);
    
    // Always fetch local transactions first
    fetch("/api/transactions")
      .then((r) => r.json())
      .then((data) => {
        const localTxs: Transfer[] = data.transactions ?? [];
        setTransfers(localTxs);
      })
      .catch(() => {});

    // Then try external API if configured
    if (apiUrl) {
      fetch(`${apiUrl}/users/${userId}/accounts`)
        .then((r) => r.json())
        .then(async (accs: Account[]) => {
          setAccounts(accs);
          const apiTotal = accs.reduce((s, a) => s + a.current_balance, 0);
          // Only override the persisted balance if the API returns a real positive value
          if (apiTotal > 0) {
            setLocalBalanceCents(apiTotal);
          }
          // Collect transfers from all accounts
          const allTransfers = await Promise.all(
            accs.map((acc) =>
              fetch(`${apiUrl}/users/${userId}/accounts/${acc.account_id}/transfers`)
                .then((r) => r.json())
                .catch(() => [])
            )
          );
          const externalTxs: Transfer[] = allTransfers.flat();
          
          // Merge external with local transactions (avoid duplicates by ID)
          setTransfers((localTxs) => {
            const existingIds = new Set(localTxs.map(t => t.transfer_id));
            const newExternalTxs = externalTxs.filter(t => !existingIds.has(t.transfer_id));
            const merged = [...localTxs, ...newExternalTxs];
            merged.sort(
              (a, b) =>
                new Date(b.transfer_date).getTime() - new Date(a.transfer_date).getTime()
            );
            return merged;
          });
        })
        .catch(() => {})
        .finally(() => setLoadingData(false));
    } else {
      setLoadingData(false);
    }
  }, [session?.user?.sub, apiUrl]);

  const totalBalance =
    localBalanceCents !== null
      ? localBalanceCents
      : accounts.reduce((sum, a) => sum + a.current_balance, 0);

  function resetModal() {
    setRecipient("");
    setAmount("");
    setRemarks("");
    setQrBase64(null);
    setSessionId(null);
    setPendingConfirmation(false);
    setQrPopupOpen(false);
    setStatusMsg("");
  }

  async function handleSend() {
    if (!recipient.trim() || !amount.trim()) {
      setStatusMsg("Recipient and amount are required.");
      return;
    }

    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      setStatusMsg("Please enter a valid amount.");
      return;
    }
    const amountCents = Math.round(parsedAmount * 100);
    if (amountCents > totalBalance) {
      setStatusMsg("Insufficient balance.");
      return;
    }

    if (!dispatchTargetId) {
      setStatusMsg("Dispatch target not loaded yet. Please try again.");
      return;
    }

    setSending(true);
    setStatusMsg("");

    // Build the human-readable transaction message
    const txMessage = `Transfer $${amount} to ${recipient}${remarks ? ` for reason ${remarks}` : ""}`;

    try {
      // 1. Request QR + push notification from Nevis
      const qrRes = await fetch("/api/dispatch-qr-token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: session?.user?.sub,
          message: txMessage,
        }),
      });
      if (!qrRes.ok) throw new Error(await qrRes.text());
      const qrData = await qrRes.json();

      if (qrData.dispatcherInformation?.response) {
        setQrBase64(qrData.dispatcherInformation.response);
        setQrPopupOpen(true);
      } else {
        throw new Error("No QR code returned from server.");
      }

      const txSessionId: string = qrData.sessionId;
      const txPushSessionId: string = qrData.pushSessionId;
      const txTargetId: string = qrData.dispatchTargetId ?? dispatchTargetId;
      setSessionId(txSessionId);
      setPendingConfirmation(true);

      // 3. Poll both QR and push sessionIds - user can approve via either method
      const pollUsername = session?.user?.sub ?? "";
      let pollCount = 0;
      const pollInterval = setInterval(async () => {
        pollCount++;
        if (pollCount > 60) {
          clearInterval(pollInterval);
          setStatusMsg("Confirmation timed out. Please try again.");
          setPendingConfirmation(false);
          setSending(false);
          return;
        }
        try {
          // Check both QR session and push session in parallel
          const checks = [
            fetch(`/api/profile/pushconfirmation?sessionId=${encodeURIComponent(txSessionId)}`).then(r => r.json()),
          ];
          
          if (txPushSessionId) {
            checks.push(
              fetch(`/api/profile/pushconfirmation?sessionId=${encodeURIComponent(txPushSessionId)}`).then(r => r.json())
            );
          }

          const results = await Promise.all(checks);
          console.log(`[poll #${pollCount}] pushconfirmation:`, results);

          // If either session is confirmed, proceed
          if (results.some(data => data.confirmed === true)) {
            clearInterval(pollInterval);
            setQrPopupOpen(false);
            setPendingConfirmation(false);
            setSending(false);
            setStatusMsg("Transfer authorised! ✓");

            // Deduct the amount and persist to backend
            const amountCents = Math.round(parseFloat(amount) * 100);
            saveBalance((localBalanceCents ?? 0) - amountCents);

            // Add a local transfer row and persist to backend
            const newTx: Transfer = {
              transfer_id: `local-${Date.now()}`,
              type: `Transfer to ${recipient}`,
              transfer_date: new Date().toISOString(),
              amount: -amountCents,
              status: "completed",
            };
            
            // Persist transaction to backend
            await fetch("/api/transactions", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                type: `Transfer to ${recipient}`,
                amount: -amountCents,
                status: "completed",
                remarks: remarks || undefined,
              }),
            }).catch(() => {});
            
            setTransfers((prev) => [newTx, ...prev]);

            // Try to refresh from API in background (best-effort)
            const userId = session?.user?.sub ?? sessionStorage.getItem("user_id");
            if (userId && apiUrl) {
              fetch(`${apiUrl}/users/${userId}/accounts`)
                .then((r) => r.json())
                .then(async (accs: Account[]) => {
                  const apiTotal = accs.reduce((s, a) => s + a.current_balance, 0);
                  if (apiTotal > 0) saveBalance(apiTotal);
                  setAccounts(accs);
                  const allTransfers = await Promise.all(
                    accs.map((acc) =>
                      fetch(`${apiUrl}/users/${userId}/accounts/${acc.account_id}/transfers`)
                        .then((r) => r.json())
                        .catch(() => [])
                    )
                  );
                  const flat: Transfer[] = allTransfers.flat();
                  flat.sort(
                    (a, b) =>
                      new Date(b.transfer_date).getTime() - new Date(a.transfer_date).getTime()
                  );
                  setTransfers(flat);
                })
                .catch(() => {});
            }

            resetModal();
            setShowModal(false);
          }
        } catch {
          // ignore individual poll errors
        }
      }, 2000);
    } catch (err: any) {
      setStatusMsg("Failed: " + err.message);
      setSending(false);
    }
  }

  return (
    <div className="max-w-[820px] mx-auto py-8 px-4">

      {/* Back link */}
      <button
        onClick={() => router.push("/dashboard")}
        style={{
          display: "inline-flex", alignItems: "center", gap: 6,
          fontSize: 12, color: "#6B7280", background: "none", border: "none",
          cursor: "pointer", marginBottom: "1.25rem", padding: 0,
        }}
      >
        <ArrowLeft size={13} />
        Dashboard
      </button>

      {/* Balance card */}
      <div
        className="flex flex-col mb-6"
        style={{ backgroundColor: "#0B1220", padding: 24, gap: 6 }}
      >
        <span style={{ fontSize: 12, color: "#9CA3AF" }}>Total available balance</span>
        <span
          className="font-mono-jetbrains font-semibold"
          style={{ fontSize: 42, color: "#FFFFFF", lineHeight: 1 }}
        >
          {formatCents(totalBalance)}
        </span>
        <div className="flex items-center justify-between" style={{ marginTop: 4 }}>
          <span style={{ fontSize: 12, color: "#6B7280" }}>
            Across {accounts.length} account{accounts.length !== 1 ? "s" : ""}
          </span>
          <button
            onClick={() => saveBalance((localBalanceCents ?? 0) + 100_000)}
            className="flex items-center gap-1 hover:opacity-80 transition-opacity"
            style={{
              backgroundColor: "#1E2D40",
              border: "1px solid #334155",
              height: 28,
              padding: "0 12px",
              fontSize: 12,
              color: "#93C5FD",
            }}
          >
            + Top up $1,000
          </button>
        </div>
      </div>

      {/* Main card */}
      <div
        className="flex flex-col bg-white"
        style={{ border: "1px solid #E6E8EC", padding: 24, gap: 20 }}
      >
        {/* Header row */}
        <div className="flex items-center justify-between">
          <div className="flex flex-col" style={{ gap: 4 }}>
            <span className="font-semibold" style={{ fontSize: 24, color: "#0B1220" }}>
              Past Transfers
            </span>
            <span style={{ fontSize: 13, color: "#6B7280" }}>
              All transactions across your accounts
            </span>
          </div>
          <button
            onClick={() => { resetModal(); setShowModal(true); }}
            className="flex items-center gap-2 hover:opacity-80 transition-opacity"
            style={{ backgroundColor: "#0B1220", height: 38, padding: "0 18px" }}
          >
            <ArrowRight size={13} color="#fff" strokeWidth={2} />
            <span className="font-medium" style={{ fontSize: 13, color: "#FFFFFF" }}>
              Initiate Transfer
            </span>
          </button>
        </div>

        {/* Table header */}
        <div
          className="flex items-center"
          style={{ height: 36, padding: "0 12px", borderBottom: "1px solid #E6E8EC" }}
        >
          <span className="font-semibold" style={{ fontSize: 12, color: "#6B7280", flex: 1 }}>Type</span>
          <span className="font-semibold" style={{ fontSize: 12, color: "#6B7280", width: 160 }}>Date</span>
          <span className="font-semibold" style={{ fontSize: 12, color: "#6B7280", width: 120 }}>Status</span>
          <span
            className="font-semibold text-right"
            style={{ fontSize: 12, color: "#6B7280", width: 120 }}
          >
            Amount
          </span>
        </div>

        {/* Rows */}
        {loadingData ? (
          <span style={{ fontSize: 13, color: "#9CA3AF", padding: "12px 12px" }}>Loading…</span>
        ) : transfers.length === 0 ? (
          <span style={{ fontSize: 13, color: "#9CA3AF", padding: "12px 12px" }}>
            No transactions found.
          </span>
        ) : (
          transfers.map((tx) => {
            const positive = tx.amount >= 0;
            return (
              <div
                key={tx.transfer_id}
                className="flex items-center"
                style={{ height: 44, padding: "0 12px", borderBottom: "1px solid #E6E8EC" }}
              >
                <span style={{ fontSize: 13, color: "#0B1220", flex: 1 }}>{tx.type}</span>
                <span
                  className="font-mono-jetbrains"
                  style={{ fontSize: 12, color: "#6B7280", width: 160 }}
                >
                  {tx.transfer_date?.slice(0, 10)}
                </span>
                <span style={{ fontSize: 12, color: "#6B7280", width: 120 }}>{tx.status}</span>
                <span
                  className="font-mono-jetbrains font-medium text-right"
                  style={{ fontSize: 13, color: positive ? "#047857" : "#B91C1C", width: 120 }}
                >
                  {positive ? "+" : "−"}{formatCents(tx.amount)}
                </span>
              </div>
            );
          })
        )}
      </div>

      {/* ── Transfer Modal ─────────────────────────────────────── */}
      {showModal && (
        <div
          className="fixed inset-0 flex items-center justify-center"
          style={{ backgroundColor: "rgba(0,0,0,0.45)", zIndex: 50 }}
          onClick={() => { if (!pendingConfirmation) setShowModal(false); }}
        >
          <div
            className="relative bg-white flex flex-col"
            style={{ width: 480, padding: 28, gap: 18, border: "1px solid #E6E8EC" }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close */}
            {!pendingConfirmation && (
              <button
                onClick={() => setShowModal(false)}
                className="absolute top-5 right-5 hover:opacity-60 transition-opacity"
                style={{ color: "#6B7280" }}
              >
                <X size={18} />
              </button>
            )}

            <span className="font-semibold" style={{ fontSize: 24, color: "#0B1220" }}>
              Initiate Transfer
            </span>
            <span style={{ fontSize: 13, color: "#6B7280", marginTop: -10 }}>
              Fill in the details and confirm with your authenticator.
            </span>

            {/* Fields */}
            <div className="flex flex-col" style={{ gap: 14 }}>

              {/* Recipient */}
              <div className="flex flex-col" style={{ gap: 6 }}>
                <span className="font-semibold" style={{ fontSize: 12, color: "#374151" }}>
                  Recipient
                </span>
                <input
                  type="text"
                  placeholder="Account ID or name"
                  value={recipient}
                  onChange={(e) => setRecipient(e.target.value)}
                  disabled={pendingConfirmation}
                  className="outline-none font-inter bg-white"
                  style={{
                    height: 42,
                    padding: "0 14px",
                    border: "1px solid #D1D5DB",
                    fontSize: 13,
                    color: "#111827",
                    opacity: pendingConfirmation ? 0.6 : 1,
                  }}
                />
              </div>

              {/* Amount */}
              <div className="flex flex-col" style={{ gap: 6 }}>
                <span className="font-semibold" style={{ fontSize: 12, color: "#374151" }}>
                  Amount ($)
                </span>
                <div
                  className="flex items-center gap-2 bg-white"
                  style={{
                    height: 42,
                    padding: "0 14px",
                    border: `1px solid ${amount && parseFloat(amount) * 100 > totalBalance ? "#E53935" : "#D1D5DB"}`,
                    opacity: pendingConfirmation ? 0.6 : 1,
                  }}
                >
                  <span
                    className="font-mono-jetbrains font-medium"
                    style={{ fontSize: 14, color: "#111827" }}
                  >
                    $
                  </span>
                  <input
                    type="text"
                    inputMode="decimal"
                    placeholder="0.00"
                    value={amount}
                    onChange={(e) => {
                      // Allow digits with optional single decimal point and up to 2 decimal places
                      const val = e.target.value;
                      if (val === "" || /^\d+(\.\d{0,2})?$/.test(val)) {
                        setAmount(val);
                      }
                    }}
                    disabled={pendingConfirmation}
                    className="flex-1 bg-white outline-none font-mono-jetbrains"
                    style={{ fontSize: 13, color: "#111827" }}
                  />
                </div>
                {amount && parseFloat(amount) * 100 > totalBalance && (
                  <span style={{ fontSize: 11, color: "#E53935" }}>
                    Exceeds available balance ({formatCents(totalBalance)})
                  </span>
                )}
              </div>

              {/* Remarks */}
              <div className="flex flex-col" style={{ gap: 6 }}>
                <span className="font-semibold" style={{ fontSize: 12, color: "#374151" }}>
                  Remarks <span style={{ color: "#9CA3AF", fontWeight: 400 }}>(optional)</span>
                </span>
                <input
                  type="text"
                  placeholder="e.g. Rent payment"
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  disabled={pendingConfirmation}
                  className="outline-none font-inter bg-white"
                  style={{
                    height: 42,
                    padding: "0 14px",
                    border: "1px solid #D1D5DB",
                    fontSize: 13,
                    color: "#111827",
                    opacity: pendingConfirmation ? 0.6 : 1,
                  }}
                />
              </div>
            </div>

            {/* Status message */}
            {statusMsg && (
              <span style={{ fontSize: 13, color: statusMsg.includes("✓") ? "#047857" : "#B91C1C" }}>
                {statusMsg}
              </span>
            )}

            {/* Action buttons */}
            <div className="flex items-center gap-3" style={{ marginTop: 4 }}>
              <button
                onClick={() => { resetModal(); setShowModal(false); }}
                disabled={sending}
                className="flex items-center justify-center hover:opacity-70 transition-opacity"
                style={{
                  height: 40,
                  padding: "0 20px",
                  border: "1px solid #D1D5DB",
                  fontSize: 13,
                  color: "#374151",
                  opacity: sending ? 0.5 : 1,
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleSend}
                disabled={sending || pendingConfirmation || !!(amount && parseFloat(amount) * 100 > totalBalance)}
                className="flex items-center justify-center hover:opacity-80 transition-opacity"
                style={{
                  backgroundColor: "#0B1220",
                  height: 40,
                  padding: "0 24px",
                  fontSize: 13,
                  color: "#FFFFFF",
                  opacity: sending || pendingConfirmation || !!(amount && parseFloat(amount) * 100 > totalBalance) ? 0.6 : 1,
                }}
              >
                {sending ? "Awaiting confirmation…" : "Send"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── QR Popup ───────────────────────────────────────────── */}
      {qrPopupOpen && qrBase64 && (
        <div
          className="fixed inset-0 flex items-center justify-center"
          style={{ backgroundColor: "rgba(0,0,0,0.6)", zIndex: 100 }}
        >
          <div
            className="bg-white flex flex-col items-center"
            style={{ padding: 28, gap: 16, border: "1px solid #E6E8EC", maxWidth: 340 }}
          >
            <span className="font-semibold" style={{ fontSize: 18, color: "#0B1220" }}>
              Scan to Confirm
            </span>
            <span style={{ fontSize: 13, color: "#6B7280", textAlign: "center" }}>
              Open your authenticator app and scan the QR code to authorise this transfer.
            </span>
            <img
              src={`data:image/png;base64,${qrBase64}`}
              alt="QR Code"
              style={{ width: 220, height: 220 }}
            />
            <span style={{ fontSize: 12, color: "#9CA3AF" }}>
              Waiting for confirmation…
            </span>
            <button
              onClick={() => {
                setQrPopupOpen(false);
                setPendingConfirmation(false);
                setSending(false);
                setStatusMsg("Cancelled.");
              }}
              style={{
                fontSize: 13,
                color: "#6B7280",
                textDecoration: "underline",
                background: "none",
                border: "none",
                cursor: "pointer",
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

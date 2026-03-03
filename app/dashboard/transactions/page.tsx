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

  // Fetch dispatch target
  useEffect(() => {
    if (!session?.user?.sub) return;
    fetch(`/api/dispatch/target?username=${session.user.sub}`)
      .then((r) => r.json())
      .then((d) => setDispatchTargetId(d.dispatchTargets?.[0]?.id ?? null))
      .catch(() => {});
  }, [session?.user?.sub]);

  // Fetch accounts + all transfers
  useEffect(() => {
    const userId = session?.user?.sub ?? sessionStorage.getItem("user_id");
    if (!userId || !apiUrl) return;

    setLoadingData(true);
    fetch(`${apiUrl}/users/${userId}/accounts`)
      .then((r) => r.json())
      .then(async (accs: Account[]) => {
        setAccounts(accs);
        // Collect transfers from all accounts
        const allTransfers = await Promise.all(
          accs.map((acc) =>
            fetch(`${apiUrl}/users/${userId}/accounts/${acc.account_id}/transfers`)
              .then((r) => r.json())
              .catch(() => [])
          )
        );
        const flat: Transfer[] = allTransfers.flat();
        // Sort newest first by date
        flat.sort(
          (a, b) =>
            new Date(b.transfer_date).getTime() - new Date(a.transfer_date).getTime()
        );
        setTransfers(flat);
      })
      .catch(() => {})
      .finally(() => setLoadingData(false));
  }, [session?.user?.sub, apiUrl]);

  const totalBalance = accounts.reduce((sum, a) => sum + a.current_balance, 0);

  function resetModal() {
    setRecipient("");
    setAmount("");
    setRemarks("");
    setQrBase64(null);
    setPendingConfirmation(false);
    setQrPopupOpen(false);
    setStatusMsg("");
  }

  async function handleSend() {
    if (!recipient.trim() || !amount.trim()) {
      setStatusMsg("Recipient and amount are required.");
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

      setPendingConfirmation(true);

      // 2. Also send push notification with the transaction message
      if (session?.user?.sub) {
        await fetch("/api/profile/pushnotification", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            username: session.user.sub,
            transaction: txMessage,
            dispatchTargetId,
          }),
        });
      }

      // 3. Poll for approval
      let pollCount = 0;
      const pollInterval = setInterval(async () => {
        pollCount++;
        if (pollCount > 30) {
          clearInterval(pollInterval);
          setStatusMsg("Confirmation timed out. Please try again.");
          setPendingConfirmation(false);
          setSending(false);
          return;
        }
        try {
          const statusRes = await fetch(
            `/api/profile/update/confirm-status?username=${session?.user?.sub}&targetId=${dispatchTargetId}`
          );
          const statusData = await statusRes.json();
          if (statusData.status === "approved") {
            clearInterval(pollInterval);
            setQrPopupOpen(false);
            setPendingConfirmation(false);
            setSending(false);
            setStatusMsg("Transfer authorised! ✓");
            // Refresh transfers
            const userId = session?.user?.sub ?? sessionStorage.getItem("user_id");
            if (userId && apiUrl) {
              const accs: Account[] = await fetch(`${apiUrl}/users/${userId}/accounts`)
                .then((r) => r.json())
                .catch(() => []);
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
              setAccounts(accs);
              setTransfers(flat);
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
        <span style={{ fontSize: 12, color: "#6B7280", marginTop: 4 }}>
          Across {accounts.length} account{accounts.length !== 1 ? "s" : ""}
        </span>
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
                    border: "1px solid #D1D5DB",
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
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="0.00"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    disabled={pendingConfirmation}
                    className="flex-1 bg-white outline-none font-mono-jetbrains"
                    style={{ fontSize: 13, color: "#111827" }}
                  />
                </div>
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
                disabled={sending || pendingConfirmation}
                className="flex items-center justify-center hover:opacity-80 transition-opacity"
                style={{
                  backgroundColor: "#0B1220",
                  height: 40,
                  padding: "0 24px",
                  fontSize: 13,
                  color: "#FFFFFF",
                  opacity: sending || pendingConfirmation ? 0.6 : 1,
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

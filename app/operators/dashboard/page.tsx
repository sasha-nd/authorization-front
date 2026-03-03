"use client";

import { useEffect, useState } from "react";

type Transaction = {
  transfer_id: string;
  from_account_id: string;
  to_account_id: string;
  amount: number; // cents
  type: string;
  requested_at: string;
  transfer_date: string;
};

function maskAccount(id: string): string {
  if (!id) return "••••";
  const s = String(id);
  return "•••• " + s.slice(-4);
}

function formatAmount(cents: number): string {
  return (cents / 100).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
  });
}

export default function OperatorsDashboard() {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL;
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState<string | null>(null);

  useEffect(() => {
    const operatorId = sessionStorage.getItem("operator_id");
    fetch(`${apiUrl}/operators/${operatorId}/pending-transfers`)
      .then((res) => res.json())
      .then((data) => setTransactions(Array.isArray(data?.data) ? data.data : []))
      .catch(() => setTransactions([]))
      .finally(() => setLoading(false));
  }, [apiUrl]);

  async function handleAction(txnId: string, action: "approve" | "decline") {
    setActing(txnId);
    const operatorId = sessionStorage.getItem("operator_id");
    try {
      await fetch(`${apiUrl}/operators/${operatorId}/pending-transfers/${txnId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          control: { user_id: operatorId, date: new Date().toISOString() },
          body: { approve: action === "approve" },
        }),
      });
      setTransactions((prev) => prev.filter((t) => t.transfer_id !== txnId));
    } finally {
      setActing(null);
    }
  }

  return (
    <div className="flex flex-1 items-center justify-center py-10">
      <div
        className="flex flex-col"
        style={{
          width: 920,
          padding: 24,
          gap: 18,
          backgroundColor: "#FFFFFF",
          border: "1px solid #E6E8EC",
        }}
      >
        {/* Header */}
        <div className="flex flex-col" style={{ gap: 4 }}>
          <h1
            className="font-semibold"
            style={{ fontSize: 30, color: "#0B1220", lineHeight: 1 }}
          >
            Operators Dashboard
          </h1>
          <p style={{ fontSize: 13, color: "#6B7280" }}>
            Pending transactions requiring approval
          </p>
        </div>

        {/* Transaction list */}
        <div className="flex flex-col" style={{ gap: 12 }}>
          {loading && (
            <p style={{ fontSize: 13, color: "#6B7280" }}>Loading…</p>
          )}

          {!loading && transactions.length === 0 && (
            <p style={{ fontSize: 13, color: "#6B7280" }}>
              No pending transactions.
            </p>
          )}

          {transactions.map((txn) => (
            <div
              key={txn.transfer_id}
              className="flex flex-col"
              style={{
                padding: "12px 14px",
                gap: 8,
                backgroundColor: "#FFFFFF",
                border: "1px solid #E6E8EC",
              }}
            >
              {/* Top row: description + amount */}
              <div className="flex items-center justify-between">
                <span
                  className="font-medium"
                  style={{ fontSize: 13, color: "#0B1220" }}
                >
                  {txn.transfer_id} · from Acct {maskAccount(txn.from_account_id)} to Acct{" "}
                  {maskAccount(txn.to_account_id)}
                </span>
                <span
                  className="font-mono-jetbrains font-semibold shrink-0"
                  style={{ fontSize: 13, color: "#0B1220", width: 120, textAlign: "right" }}
                >
                  {formatAmount(txn.amount)}
                </span>
              </div>

              {/* Bottom row: action buttons */}
              <div className="flex items-center justify-end" style={{ gap: 8 }}>
                <button
                  onClick={() => handleAction(txn.transfer_id, "decline")}
                  disabled={acting === txn.transfer_id}
                  className="flex items-center justify-center transition-colors hover:bg-zinc-50 disabled:opacity-50"
                  style={{
                    width: 84,
                    height: 32,
                    backgroundColor: "#FFFFFF",
                    border: "1px solid #D1D5DB",
                    fontSize: 11,
                    fontWeight: 500,
                    color: "#111827",
                  }}
                >
                  Decline
                </button>
                <button
                  onClick={() => handleAction(txn.transfer_id, "approve")}
                  disabled={acting === txn.transfer_id}
                  className="flex items-center justify-center transition-opacity hover:opacity-80 disabled:opacity-50"
                  style={{
                    width: 88,
                    height: 32,
                    backgroundColor: "#0B1220",
                    fontSize: 11,
                    fontWeight: 500,
                    color: "#FFFFFF",
                  }}
                >
                  Approve
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

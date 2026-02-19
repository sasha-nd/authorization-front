"use client";

import { useRouter } from "next/navigation";
import { useSearchParams } from "next/navigation";
import { ArrowLeft, ChevronDown, X } from "lucide-react";
import { useState, Suspense } from "react";

const accounts = [
  { name: "Everyday Checking", number: "•••• 1024", balance: "$12,840.19" },
  { name: "High Yield Savings", number: "•••• 7781", balance: "$46,100.00" },
  { name: "Business Reserve", number: "•••• 9043", balance: "$25,350.25" },
];

const transactions = [
  { type: "Coffee Shop", date: "Feb 18, 2026", amount: "-$18.45", positive: false },
  { type: "Payroll Deposit", date: "Feb 17, 2026", amount: "+$3,150.00", positive: true },
  { type: "Electric Utility", date: "Feb 15, 2026", amount: "-$126.09", positive: false },
  { type: "Transfer to Savings", date: "Feb 13, 2026", amount: "-$500.00", positive: false },
];

function accountKey(acc: { name: string; number: string }) {
  return `${acc.name} ${acc.number}`;
}

function AccountPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const fromParam = searchParams.get("from") || accountKey(accounts[0]);
  const currentAccount = accounts.find((a) => accountKey(a) === fromParam) ?? accounts[0];

  const defaultTo = accounts.find((a) => accountKey(a) !== fromParam) ?? accounts[1];

  const [showModal, setShowModal] = useState(false);
  const [transferFrom, setTransferFrom] = useState(fromParam);
  const [transferTo, setTransferTo] = useState(accountKey(defaultTo));
  const [transferDate, setTransferDate] = useState("2026-02-20");
  const [amount, setAmount] = useState("500.00");

  function handleTransferFromChange(value: string) {
    setTransferFrom(value);
    if (transferTo === value) {
      const alt = accounts.find((a) => accountKey(a) !== value);
      setTransferTo(alt ? accountKey(alt) : "");
    }
  }

  const transferToOptions = accounts.filter((a) => accountKey(a) !== transferFrom);

  return (
    <div className="min-h-screen font-inter" style={{ backgroundColor: "#F7F8FA" }}>
      <div className="max-w-[820px] mx-auto py-8 px-4">

        {/* Back link */}
        <button
          onClick={() => router.back()}
          className="flex items-center gap-1.5 mb-5 text-[13px] font-medium hover:opacity-70 transition-opacity"
          style={{ color: "#6B7280" }}
        >
          <ArrowLeft size={14} strokeWidth={2} />
          Back to accounts
        </button>

        {/* Main card */}
        <div
          className="flex flex-col bg-white"
          style={{ border: "1px solid #E6E8EC", padding: 24, gap: 20 }}
        >
          {/* Header */}
          <div className="flex items-center justify-between" style={{ height: 64 }}>
            <div className="flex flex-col justify-center" style={{ gap: 6 }}>
              <span className="font-semibold" style={{ fontSize: 24, color: "#0B1220" }}>
                Account details
              </span>
              <span style={{ fontSize: 13, color: "#6B7280" }}>
                Recent transactions and quick money actions
              </span>
            </div>
            <div
              className="flex items-center justify-center"
              style={{ backgroundColor: "#EEF2FF", height: 28, width: 122 }}
            >
              <span
                className="font-medium text-center"
                style={{ fontSize: 12, color: "#1D4ED8", width: 90 }}
              >
                Active account
              </span>
            </div>
          </div>

          {/* Account card */}
          <div
            className="flex flex-col"
            style={{ backgroundColor: "#0B1220", padding: 16, gap: 8 }}
          >
            {/* Top row */}
            <div className="flex items-center justify-between">
              <span className="font-semibold" style={{ fontSize: 14, color: "#FFFFFF", width: 220 }}>
                {currentAccount.name}
              </span>
              <span
                className="font-mono-jetbrains text-right"
                style={{ fontSize: 12, color: "#9CA3AF", width: 140 }}
              >
                {currentAccount.number}
              </span>
            </div>

            {/* Balance label */}
            <span style={{ fontSize: 12, color: "#9CA3AF" }}>Available balance</span>

            {/* Balance + transfer */}
            <div className="flex items-center justify-between" style={{ height: 44 }}>
              <span
                className="font-mono-jetbrains font-semibold"
                style={{ fontSize: 36, color: "#FFFFFF" }}
              >
                {currentAccount.balance}
              </span>
              <button
                onClick={() => setShowModal(true)}
                className="flex items-center justify-center"
                style={{ backgroundColor: "#D92D20", height: 36, width: 140 }}
              >
                <span
                  className="font-medium text-center"
                  style={{ fontSize: 13, color: "#FFFFFF", width: 110 }}
                >
                  Transfer money
                </span>
              </button>
            </div>
          </div>

          {/* Transactions section */}
          <div className="flex flex-col" style={{ gap: 10 }}>
            <span className="font-semibold" style={{ fontSize: 18, color: "#0B1220" }}>
              Recent transactions
            </span>

            {/* Table header */}
            <div
              className="flex items-center"
              style={{
                height: 36,
                padding: "0 12px",
                borderBottom: "1px solid #E6E8EC",
              }}
            >
              <span className="font-semibold" style={{ fontSize: 12, color: "#6B7280", width: 220 }}>
                Type
              </span>
              <span className="font-semibold" style={{ fontSize: 12, color: "#6B7280", width: 180 }}>
                Date
              </span>
              <span
                className="font-semibold text-right flex-1"
                style={{ fontSize: 12, color: "#6B7280" }}
              >
                Amount
              </span>
            </div>

            {/* Rows */}
            {transactions.map((tx) => (
              <div
                key={tx.type}
                className="flex items-center"
                style={{
                  height: 44,
                  padding: "0 12px",
                  borderBottom: "1px solid #E6E8EC",
                }}
              >
                <span style={{ fontSize: 13, color: "#0B1220", width: 220 }}>
                  {tx.type}
                </span>
                <span
                  className="font-mono-jetbrains"
                  style={{ fontSize: 12, color: "#6B7280", width: 180 }}
                >
                  {tx.date}
                </span>
                <span
                  className="font-mono-jetbrains font-medium text-right flex-1"
                  style={{ fontSize: 13, color: tx.positive ? "#047857" : "#0B1220" }}
                >
                  {tx.amount}
                </span>
              </div>
            ))}
          </div>
        </div>

      </div>

      {/* Transfer Money Modal */}
      {showModal && (
        <div
          className="fixed inset-0 flex items-center justify-center"
          style={{ backgroundColor: "rgba(0,0,0,0.45)", zIndex: 50 }}
          onClick={() => setShowModal(false)}
        >
          <div
            className="relative bg-white flex flex-col"
            style={{
              width: 760,
              padding: 24,
              gap: 18,
              border: "1px solid #E6E8EC",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close button */}
            <button
              onClick={() => setShowModal(false)}
              className="absolute top-5 right-5 hover:opacity-60 transition-opacity"
              style={{ color: "#6B7280" }}
            >
              <X size={18} />
            </button>

            {/* Header */}
            <span className="font-semibold" style={{ fontSize: 30, color: "#0B1220" }}>
              Transfer Money
            </span>
            <span style={{ fontSize: 13, color: "#6B7280", marginTop: -10 }}>
              Move funds between your accounts
            </span>

            {/* Form */}
            <div className="flex flex-col" style={{ gap: 14 }}>

              {/* Transfer from */}
              <div className="flex flex-col" style={{ gap: 8 }}>
                <span className="font-semibold" style={{ fontSize: 12, color: "#374151" }}>
                  Transfer from
                </span>
                <div className="relative" style={{ height: 46, border: "1px solid #D1D5DB" }}>
                  <select
                    value={transferFrom}
                    onChange={(e) => handleTransferFromChange(e.target.value)}
                    className="appearance-none w-full h-full bg-white outline-none font-inter"
                    style={{ padding: "0 36px 0 14px", fontSize: 13, color: "#111827" }}
                  >
                    {accounts.map((acc) => (
                      <option key={acc.number} value={accountKey(acc)}>
                        {acc.name} {acc.number}
                      </option>
                    ))}
                  </select>
                  <ChevronDown
                    size={14}
                    color="#6B7280"
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
                  />
                </div>
              </div>

              {/* Transfer to */}
              <div className="flex flex-col" style={{ gap: 8 }}>
                <span className="font-semibold" style={{ fontSize: 12, color: "#374151" }}>
                  Transfer to
                </span>
                <div className="relative" style={{ height: 46, border: "1px solid #D1D5DB" }}>
                  <select
                    value={transferTo}
                    onChange={(e) => setTransferTo(e.target.value)}
                    className="appearance-none w-full h-full bg-white outline-none font-inter"
                    style={{ padding: "0 36px 0 14px", fontSize: 13, color: "#111827" }}
                  >
                    {transferToOptions.map((acc) => (
                      <option key={acc.number} value={accountKey(acc)}>
                        {acc.name} {acc.number}
                      </option>
                    ))}
                  </select>
                  <ChevronDown
                    size={14}
                    color="#6B7280"
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
                  />
                </div>
              </div>

              {/* Frequency */}
              <div className="flex flex-col" style={{ gap: 8 }}>
                <span className="font-semibold" style={{ fontSize: 12, color: "#374151" }}>
                  Frequency
                </span>
                <div
                  className="flex items-center justify-between bg-white"
                  style={{ height: 46, padding: "0 14px", border: "1px solid #D1D5DB" }}
                >
                  <span style={{ fontSize: 13, color: "#111827" }}>One time</span>
                  <ChevronDown size={14} color="#6B7280" />
                </div>
              </div>

              {/* Date + Amount row */}
              <div className="flex" style={{ gap: 14 }}>
                {/* Transfer Date */}
                <div className="flex flex-col flex-1" style={{ gap: 8 }}>
                  <span className="font-semibold" style={{ fontSize: 12, color: "#374151" }}>
                    Transfer Date
                  </span>
                  <input
                    type="date"
                    value={transferDate}
                    onChange={(e) => setTransferDate(e.target.value)}
                    className="bg-white outline-none font-mono-jetbrains"
                    style={{
                      height: 46,
                      padding: "0 14px",
                      border: "1px solid #D1D5DB",
                      fontSize: 13,
                      color: "#111827",
                    }}
                  />
                </div>

                {/* Amount */}
                <div className="flex flex-col" style={{ gap: 8, width: 220 }}>
                  <span className="font-semibold" style={{ fontSize: 12, color: "#374151" }}>
                    Amount
                  </span>
                  <div
                    className="flex items-center gap-2 bg-white"
                    style={{ height: 46, padding: "0 14px", border: "1px solid #D1D5DB" }}
                  >
                    <span className="font-mono-jetbrains font-medium" style={{ fontSize: 14, color: "#111827" }}>
                      $
                    </span>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      className="flex-1 bg-white outline-none font-mono-jetbrains"
                      style={{ fontSize: 13, color: "#111827" }}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Send button */}
            <div
              className="flex items-center justify-center"
              style={{ backgroundColor: "#0B1220", height: 42, width: 140 }}
            >
              <span className="font-medium" style={{ fontSize: 13, color: "#FFFFFF" }}>
                Send
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function AccountPage() {
  return (
    <Suspense>
      <AccountPageContent />
    </Suspense>
  );
}

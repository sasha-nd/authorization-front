"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { X } from "lucide-react";

export default function DashboardPage() {
  const router = useRouter();
  const [modalOpen, setModalOpen] = useState(false);
  const [accountName, setAccountName] = useState("");
  const [accountType, setAccountType] = useState("Checking");
  const [initialDeposit, setInitialDeposit] = useState("");

  const apiUrl = process.env.NEXT_PUBLIC_API_URL;

  type Account = { account_name: string; account_id: string; current_balance: number };
  const [accounts, setAccounts] = useState<Account[]>([]);

  function fetchAccounts() {
    const userId = sessionStorage.getItem("user_id");
    fetch(`${apiUrl}/users/${userId}/accounts`)
      .then((res) => res.json())
      .then((data) => setAccounts(data))
      .catch(() => {});
  }

  useEffect(() => {
    fetchAccounts();
  }, [apiUrl]); // eslint-disable-line react-hooks/exhaustive-deps

  function formatBalance(cents: number): string {
    return (cents / 100).toLocaleString("en-US", { style: "currency", currency: "USD" });
  }

  async function handleCreateAccount() {
    const userId = sessionStorage.getItem("user_id");
    await fetch(`${apiUrl}/users/${userId}/accounts`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        account_name: accountName,
        account_type: accountType,
        initial_deposit: Math.round((parseFloat(initialDeposit) || 0) * 100),
      }),
    });
    setModalOpen(false);
    fetchAccounts();
  }


  return (
    <div className="bg-white flex flex-col flex-1">

        {/* Hero */}
        <section className="flex items-stretch gap-5 px-6 py-6" style={{ minHeight: 190 }}>
          {/* Left */}
          <div className="flex flex-col justify-center gap-2.5 flex-1">
            <h1
              className="font-semibold"
              style={{ fontSize: 34, lineHeight: 1.05, color: "#0B1220" }}
            >
              Banking that keeps every balance in view
            </h1>
            <p
              className="text-[14px]"
              style={{ lineHeight: 1.35, color: "#6B7280" }}
            >
              Track accounts, monitor spending, and move money in real time.
            </p>
          </div>

          {/* Balance card */}
          <div
            className="flex flex-col justify-center gap-2 shrink-0"
            style={{ minWidth: 250, backgroundColor: "#0B1220", padding: 20 }}
          >
            <span className="text-[12px]" style={{ color: "#9CA3AF" }}>Total available</span>
            <span
              className="font-mono-jetbrains font-semibold whitespace-nowrap"
              style={{ fontSize: 34, color: "#FFFFFF" }}
            >
              {formatBalance(accounts.reduce((sum, a) => sum + a.current_balance, 0))}
            </span>
          </div>
        </section>

        {/* Accounts section */}
        <section className="flex flex-col gap-3 px-6 pb-6">
          <h2 className="font-semibold text-[20px]" style={{ color: "#0B1220" }}>
            Accounts and balances
          </h2>

          <div className="flex flex-col gap-2.5">
            {accounts.map((account) => (
              <div
                key={account.account_id}
                className="flex items-center justify-between bg-white"
                style={{
                  height: 90,
                  padding: "14px 16px",
                  border: "1px solid #E6E8EC",
                }}
              >
                {/* Account info */}
                <div className="flex flex-col gap-2">
                  <span className="font-semibold text-[14px]" style={{ color: "#0B1220" }}>
                    {account.account_name}
                  </span>
                  <span className="font-mono-jetbrains text-[12px]" style={{ color: "#6B7280" }}>
                    Acct {account.account_id}
                  </span>
                  <span className="font-mono-jetbrains font-semibold text-[22px]" style={{ color: "#0B1220" }}>
                    {formatBalance(account.current_balance)}
                  </span>
                </div>

                {/* View Account button */}
                <button
                  onClick={() => router.push(`/dashboard/account?account_id=${account.account_id}&account_name=${encodeURIComponent(account.account_name)}&balance=${account.current_balance}`)}
                  className="flex items-center justify-center shrink-0 hover:opacity-80 transition-opacity"
                  style={{ backgroundColor: "#0B1220", height: 32, width: 110 }}
                >
                  <span className="text-white text-[11px] font-medium">View Account</span>
                </button>
              </div>
            ))}
          </div>
        </section>

        {/* Open Account */}
        <div className="px-6 pb-6">
          <button
            onClick={() => setModalOpen(true)}
            className="flex items-center justify-center hover:opacity-80 transition-opacity"
            style={{ backgroundColor: "#0B1220", height: 40, width: 150 }}
          >
            <span className="text-white text-[13px] font-medium">Open Account</span>
          </button>
        </div>

      {/* Create Account Modal */}
      {modalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ backgroundColor: "rgba(11,18,32,0.6)" }}
          onClick={() => setModalOpen(false)}
        >
          <div
            className="flex flex-col font-inter bg-white"
            style={{
              width: 480,
              padding: 28,
              gap: 20,
              border: "1px solid #E6E8EC",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between" style={{ height: 32 }}>
              <h2
                className="font-semibold"
                style={{ fontSize: 22, color: "#0B1220" }}
              >
                Create Account
              </h2>
              <button
                onClick={() => setModalOpen(false)}
                className="flex items-center justify-center transition-colors hover:bg-[#E5E7EB]"
                style={{ width: 32, height: 32, backgroundColor: "#FFFFFF" }}
              >
                <X size={14} strokeWidth={2} style={{ color: "#6B7280" }} />
              </button>
            </div>

            {/* Subtitle */}
            <p className="font-inter" style={{ fontSize: 13, color: "#6B7280" }}>
              Set up a new account in just a few steps
            </p>

            {/* Account name */}
            <div className="flex flex-col" style={{ gap: 8 }}>
              <label
                className="font-semibold"
                style={{ fontSize: 12, color: "#374151" }}
              >
                Account name
              </label>
              <input
                type="text"
                placeholder="e.g. Primary Checking"
                value={accountName}
                onChange={(e) => setAccountName(e.target.value)}
                className="appearance-none rounded-none outline-none placeholder:text-[#9CA3AF]"
                style={{
                  height: 46,
                  width: "100%",
                  padding: "0 14px",
                  fontSize: 13,
                  color: "#111827",
                  border: "1px solid #D1D5DB",
                  backgroundColor: "#FFFFFF",
                }}
              />
            </div>

            {/* Account type */}
            <div className="flex flex-col" style={{ gap: 8 }}>
              <label
                className="font-semibold"
                style={{ fontSize: 12, color: "#374151" }}
              >
                Account type
              </label>
              <select
                value={accountType}
                onChange={(e) => setAccountType(e.target.value)}
                className="appearance-none rounded-none outline-none"
                style={{
                  height: 46,
                  width: "100%",
                  padding: "0 14px",
                  fontSize: 13,
                  color: "#111827",
                  border: "1px solid #D1D5DB",
                  backgroundColor: "#FFFFFF",
                }}
              >
                <option>Checking</option>
                <option>Savings</option>
                <option>Business Reserve</option>
              </select>
            </div>

            {/* Initial deposit */}
            <div className="flex flex-col" style={{ gap: 8 }}>
              <label
                className="font-semibold"
                style={{ fontSize: 12, color: "#374151" }}
              >
                Initial deposit
              </label>
              <input
                type="text"
                placeholder="$0.00"
                value={initialDeposit}
                onChange={(e) => setInitialDeposit(e.target.value)}
                className="font-mono-jetbrains appearance-none rounded-none outline-none placeholder:text-[#9CA3AF]"
                style={{
                  height: 46,
                  width: "100%",
                  padding: "0 14px",
                  fontSize: 13,
                  color: "#111827",
                  border: "1px solid #D1D5DB",
                  backgroundColor: "#FFFFFF",
                }}
              />
            </div>

            {/* Actions */}
            <div className="flex items-center justify-between" style={{ height: 44 }}>
              <button
                onClick={() => setModalOpen(false)}
                className="font-medium transition-colors hover:text-black"
                style={{ fontSize: 13, color: "#6B7280" }}
              >
                Cancel
              </button>
              <button
                onClick={handleCreateAccount}
                className="flex items-center justify-center hover:opacity-80 transition-opacity"
                style={{
                  width: 160,
                  height: 44,
                  backgroundColor: "#0B1220",
                  color: "#FFFFFF",
                  fontSize: 13,
                  fontWeight: 500,
                }}
              >
                Create Account
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

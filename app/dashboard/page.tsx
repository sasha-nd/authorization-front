"use client";

import { useRouter } from "next/navigation";

export default function DashboardPage() {
  const router = useRouter();
  const accounts = [
    { name: "Everyday Checking", number: "•••• 1024", balance: "$12,840.19" },
    { name: "High Yield Savings", number: "•••• 7781", balance: "$46,100.00" },
    { name: "Business Reserve", number: "•••• 9043", balance: "$25,350.25" },
  ];

  return (
    <div className="min-h-screen font-inter" style={{ backgroundColor: "#F7F8FA" }}>
      {/* White inner card */}
      <div className="bg-white flex flex-col min-h-screen">

        {/* Header */}
        <header
          className="flex items-center justify-between px-6"
          style={{ height: 72, borderBottom: "1px solid #E6E8EC" }}
        >
          {/* Brand */}
          <div className="flex items-center gap-2.5" style={{ width: 220 }}>
            <div className="rounded-sm" style={{ width: 16, height: 16, backgroundColor: "#0B1220" }} />
            <span className="font-semibold text-[18px]" style={{ color: "#0B1220" }}>
              NorthBridge Bank
            </span>
          </div>

          {/* Nav */}
          <nav className="flex items-center gap-6">
            <span className="text-[13px] font-medium" style={{ color: "#0B1220" }}>Accounts</span>
            <span className="text-[13px]" style={{ color: "#6B7280" }}>Payments</span>
            <span className="text-[13px]" style={{ color: "#6B7280" }}>Insights</span>
          </nav>

          {/* CTA */}
          <div
            className="flex items-center justify-center"
            style={{ backgroundColor: "#0B1220", height: 40, width: 150 }}
          >
            <span className="text-white text-[13px] font-medium">Open Account</span>
          </div>
        </header>

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
            style={{ width: 250, backgroundColor: "#0B1220", padding: 20 }}
          >
            <span className="text-[12px]" style={{ color: "#9CA3AF" }}>Total available</span>
            <span
              className="font-mono-jetbrains font-semibold"
              style={{ fontSize: 34, color: "#FFFFFF" }}
            >
              $84,290.44
            </span>
            <span className="font-mono-jetbrains text-[12px]" style={{ color: "#E5E7EB" }}>
              +$2,104.22 this month
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
                key={account.number}
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
                    {account.name}
                  </span>
                  <span className="font-mono-jetbrains text-[12px]" style={{ color: "#6B7280" }}>
                    Acct {account.number}
                  </span>
                  <span className="font-mono-jetbrains font-semibold text-[22px]" style={{ color: "#0B1220" }}>
                    {account.balance}
                  </span>
                </div>

                {/* View Account button */}
                <button
                  onClick={() => router.push(`/dashboard/account?from=${encodeURIComponent(`${account.name} ${account.number}`)}`)}

                  className="flex items-center justify-center shrink-0 hover:opacity-80 transition-opacity"
                  style={{ backgroundColor: "#0B1220", height: 32, width: 110 }}
                >
                  <span className="text-white text-[11px] font-medium">View Account</span>
                </button>
              </div>
            ))}
          </div>
        </section>

      </div>
    </div>
  );
}

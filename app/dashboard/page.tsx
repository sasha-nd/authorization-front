"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useState, useEffect, useRef } from "react";
import { ShieldCheck, Clock, X, ArrowRight, CreditCard, User } from "lucide-react";

const GRANT_TTL = 60; // seconds

export default function DashboardPage() {
  const { data: session } = useSession();
  const router = useRouter();

  // --- Support Access Grant state ---
  const [grantActive, setGrantActive] = useState(false);
  const [grantRemaining, setGrantRemaining] = useState(0); // seconds
  const [grantLoading, setGrantLoading] = useState(false);
  const [grantMsg, setGrantMsg] = useState("");
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Sync grant state on mount (handles page refresh)
  useEffect(() => {
    fetch("/api/profile/grant-access")
      .then((r) => r.json())
      .then((d) => {
        if (d.active && d.remainingMs > 0) {
          startCountdown(Math.ceil(d.remainingMs / 1000));
        }
      })
      .catch(() => {});
  }, []);

  function clearCountdown() {
    if (countdownRef.current) {
      clearInterval(countdownRef.current);
      countdownRef.current = null;
    }
  }

  function startCountdown(seconds: number) {
    clearCountdown();
    setGrantActive(true);
    setGrantRemaining(seconds);
    countdownRef.current = setInterval(() => {
      setGrantRemaining((prev) => {
        if (prev <= 1) {
          clearCountdown();
          setGrantActive(false);
          setGrantMsg("Support access has expired.");
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }

  // Cleanup on unmount
  useEffect(() => () => clearCountdown(), []);

  async function handleGrantAccess() {
    setGrantLoading(true);
    setGrantMsg("");
    try {
      const res = await fetch("/api/profile/grant-access", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to grant access");
      startCountdown(GRANT_TTL);
    } catch (e: any) {
      setGrantMsg("Error: " + e.message);
    } finally {
      setGrantLoading(false);
    }
  }

  async function handleExtendAccess() {
    setGrantLoading(true);
    setGrantMsg("");
    try {
      const res = await fetch("/api/profile/grant-access", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ extend: true }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to extend access");
      // Use the authoritative remaining time returned by the server
      const remainingMs = data.ttlMs ?? GRANT_TTL * 1000;
      startCountdown(Math.ceil(remainingMs / 1000));
    } catch (e: any) {
      setGrantMsg("Error: " + e.message);
    } finally {
      setGrantLoading(false);
    }
  }

  async function handleRevokeAccess() {
    clearCountdown();
    setGrantActive(false);
    setGrantRemaining(0);
    setGrantMsg("Support access revoked.");
    await fetch("/api/profile/grant-access", { method: "DELETE" }).catch(() => {});
  }

  const username =
    session?.user?.name ||
    `${session?.user?.given_name ?? ""} ${session?.user?.family_name ?? ""}`.trim() ||
    session?.user?.sub ||
    "User";

  // countdown ring geometry
  const RADIUS = 22;
  const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
  const strokeDash = CIRCUMFERENCE * (grantRemaining / GRANT_TTL);

  return (
    <div className="min-h-screen" style={{ background: "#F3F4F6", padding: "2rem 1rem" }}>
      <div style={{ maxWidth: 680, margin: "0 auto", display: "flex", flexDirection: "column", gap: "1.5rem" }}>

        {/* Welcome banner */}
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
          <div>
            <p style={{ fontSize: 13, color: "#9CA3AF", marginBottom: 4 }}>Welcome back</p>
            <h1 style={{ fontSize: "1.5rem", fontWeight: 700 }}>{username}</h1>
            {session?.user?.sub && (
              <p style={{ fontSize: 11, color: "#6B7280", marginTop: 4, fontFamily: "monospace" }}>
                {session.user.sub}
              </p>
            )}
          </div>
          <div style={{
            background: "#1F2A40",
            borderRadius: 8,
            padding: "0.5rem 1rem",
            fontSize: 12,
            color: "#9CA3AF",
          }}>
            National Digital Bank
          </div>
        </div>

        {/* Quick-action cards */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
          <button
            onClick={() => router.push("/dashboard/transactions")}
            style={{
              background: "#fff",
              border: "1px solid #E5E7EB",
              borderRadius: 12,
              padding: "1.25rem",
              textAlign: "left",
              cursor: "pointer",
              display: "flex",
              flexDirection: "column",
              gap: 8,
            }}
          >
            <CreditCard size={22} color="#E53935" />
            <span style={{ fontWeight: 600, fontSize: 14, color: "#111827" }}>Transactions</span>
            <span style={{ fontSize: 12, color: "#6B7280" }}>View balance &amp; send money</span>
            <ArrowRight size={14} color="#9CA3AF" />
          </button>

          <button
            onClick={() => router.push("/dashboard/profile")}
            style={{
              background: "#fff",
              border: "1px solid #E5E7EB",
              borderRadius: 12,
              padding: "1.25rem",
              textAlign: "left",
              cursor: "pointer",
              display: "flex",
              flexDirection: "column",
              gap: 8,
            }}
          >
            <User size={22} color="#3B82F6" />
            <span style={{ fontWeight: 600, fontSize: 14, color: "#111827" }}>Profile</span>
            <span style={{ fontSize: 12, color: "#6B7280" }}>Manage your account info</span>
            <ArrowRight size={14} color="#9CA3AF" />
          </button>
        </div>

        {/* ─── Support Access Grant card ─── */}
        <div style={{
          background: "#fff",
          border: `2px solid ${grantActive ? "#16A34A" : "#E5E7EB"}`,
          borderRadius: 12,
          padding: "1.5rem",
          transition: "border-color .3s",
        }}>
          <div style={{ display: "flex", alignItems: "flex-start", gap: "1rem" }}>

            {/* Countdown ring or shield icon */}
            <div style={{ flexShrink: 0, position: "relative", width: 54, height: 54 }}>
              {grantActive ? (
                <>
                  <svg width={54} height={54} style={{ transform: "rotate(-90deg)" }}>
                    <circle cx={27} cy={27} r={RADIUS} fill="none" stroke="#E5E7EB" strokeWidth={4} />
                    <circle
                      cx={27} cy={27} r={RADIUS}
                      fill="none"
                      stroke={grantRemaining > 15 ? "#16A34A" : "#DC2626"}
                      strokeWidth={4}
                      strokeDasharray={`${strokeDash} ${CIRCUMFERENCE}`}
                      strokeLinecap="round"
                      style={{ transition: "stroke-dasharray .9s linear, stroke .3s" }}
                    />
                  </svg>
                  <span style={{
                    position: "absolute", inset: 0,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontWeight: 700,
                    fontSize: 13,
                    color: grantRemaining > 15 ? "#16A34A" : "#DC2626",
                  }}>
                    {grantRemaining}s
                  </span>
                </>
              ) : (
                <div style={{
                  width: 54, height: 54, borderRadius: "50%",
                  background: "#F3F4F6",
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  <ShieldCheck size={26} color="#6B7280" />
                </div>
              )}
            </div>

            {/* Text + buttons */}
            <div style={{ flex: 1 }}>
              <h3 style={{ fontSize: 15, fontWeight: 700, color: "#111827", marginBottom: 4 }}>
                Support Access
              </h3>

              {grantActive ? (
                <p style={{ fontSize: 13, color: "#16A34A", marginBottom: 12 }}>
                  ✓ A support agent can edit your profile and transactions.
                  Window closes in <strong>{grantRemaining}s</strong>.
                  Any action they start after the window closes will be blocked.
                </p>
              ) : (
                <p style={{ fontSize: 13, color: "#6B7280", marginBottom: 12 }}>
                  Temporarily allow a support agent to edit your profile and
                  initiate transfers on your behalf. The permission expires
                  automatically after <strong>60 seconds</strong>. Any action
                  already in progress when the window expires will also be blocked.
                </p>
              )}

              {grantMsg && (
                <p style={{
                  fontSize: 12, marginBottom: 10,
                  color: grantMsg.startsWith("Error") ? "#DC2626" : "#6B7280",
                }}>
                  {grantMsg}
                </p>
              )}

              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                {!grantActive ? (
                  <button
                    onClick={handleGrantAccess}
                    disabled={grantLoading}
                    style={{
                      background: "#0B1220",
                      color: "#fff",
                      border: "none",
                      borderRadius: 8,
                      padding: "0.55rem 1.25rem",
                      fontSize: 13,
                      fontWeight: 600,
                      cursor: grantLoading ? "not-allowed" : "pointer",
                      opacity: grantLoading ? 0.6 : 1,
                      display: "flex", alignItems: "center", gap: 6,
                    }}
                  >
                    <ShieldCheck size={15} />
                    {grantLoading ? "Granting…" : "Grant Support Access"}
                  </button>
                ) : (
                  <>
                    <button
                      onClick={handleExtendAccess}
                      disabled={grantLoading}
                      style={{
                        background: "#166534",
                        color: "#fff",
                        border: "none",
                        borderRadius: 8,
                        padding: "0.55rem 1.25rem",
                        fontSize: 13,
                        fontWeight: 600,
                        cursor: "pointer",
                        display: "flex", alignItems: "center", gap: 6,
                      }}
                    >
                      <Clock size={14} />
                      Extend +60s
                    </button>
                    <button
                      onClick={handleRevokeAccess}
                      style={{
                        background: "#FEF2F2",
                        color: "#DC2626",
                        border: "1px solid #FECACA",
                        borderRadius: 8,
                        padding: "0.55rem 1.25rem",
                        fontSize: 13,
                        fontWeight: 600,
                        cursor: "pointer",
                        display: "flex", alignItems: "center", gap: 6,
                      }}
                    >
                      <X size={14} />
                      Revoke
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
// End of file

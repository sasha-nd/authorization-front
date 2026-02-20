"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function OperatorLogin() {
  const router = useRouter();
  const [operatorId, setOperatorId] = useState("");
  const [password, setPassword] = useState("");

  const apiUrl = process.env.NEXT_PUBLIC_API_URL;

  async function handleLogin() {
    const res = await fetch(`${apiUrl}/operators/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: operatorId, password }),
    });
    const data = await res.json();
    if (data?.id) {
      sessionStorage.setItem("operator_id", data.id);
      sessionStorage.setItem("operator_username", operatorId);
    }
    router.push("/operators/dashboard");
  }

  return (
    <div className="flex h-full w-full items-center justify-center bg-zinc-100 font-inter">
      <div className="flex w-[860px] overflow-hidden rounded-sm border border-[#E6E8EC] bg-white shadow-sm">

        {/* Left panel */}
        <div className="flex w-[320px] shrink-0 flex-col justify-between bg-[#0B1220] py-7 px-6">

          <div className="flex flex-col gap-[14px]">
            {/* Brand row */}
            <div className="flex items-center gap-[10px]">
              <span className="h-[10px] w-[10px] shrink-0 bg-[#D92D20]" />
              <span className="font-mono-jetbrains text-[14px] font-[500] text-white">
                OPS CONSOLE
              </span>
            </div>

            {/* Title */}
            <h1 className="text-[34px] font-semibold leading-[1.05] text-white">
              Operator access portal
            </h1>

            {/* Subtitle */}
            <p className="text-[13px] leading-[1.35] text-[#9CA3AF]">
              Authenticate to manage queues, approve transfers, and monitor system alerts.
            </p>
          </div>

          {/* Feature list */}
          <div className="flex flex-col gap-[10px]">
            <div className="flex items-center gap-[10px]">
              <span className="h-1.5 w-1.5 shrink-0 bg-[#D92D20]" />
              <span className="text-[12px] text-[#E5E7EB]">Role-based session controls</span>
            </div>
            <div className="flex items-center gap-[10px]">
              <span className="h-1.5 w-1.5 shrink-0 bg-[#6B7280]" />
              <span className="text-[12px] text-[#9CA3AF]">Audit logs on each operator action</span>
            </div>
          </div>
        </div>

        {/* Right panel */}
        <div className="flex flex-1 flex-col items-stretch justify-center px-[52px] py-[40px]">
          <div className="flex flex-col gap-[14px]">

            {/* Heading */}
            <div className="flex flex-col gap-2">
              <h2 className="text-[32px] font-semibold leading-none text-[#0B1220]">
                Operator log in
              </h2>
              <p className="text-[13px] text-[#6B7280]">Enter your credentials to continue.</p>
            </div>

            {/* Operator ID group */}
            <div className="flex flex-col gap-2">
              <label htmlFor="operator-id" className="text-[12px] font-semibold text-[#374151]">
                Operator ID
              </label>
              <div className="flex h-[46px] items-center border border-[#D1D5DB] px-[14px] focus-within:border-[#0B1220] transition-colors">
                <input
                  id="operator-id"
                  type="text"
                  placeholder="operator@northbridge.io"
                  value={operatorId}
                  onChange={(e) => setOperatorId(e.target.value)}
                  className="flex-1 text-[13px] text-[#111827] placeholder:text-[#9CA3AF] outline-none bg-transparent"
                />
              </div>
            </div>

            {/* Password group */}
            <div className="flex flex-col gap-2">
              <label htmlFor="operator-password" className="text-[12px] font-semibold text-[#374151]">
                Password
              </label>
              <div className="flex h-[46px] items-center border border-[#D1D5DB] px-[14px] focus-within:border-[#0B1220] transition-colors">
                <input
                  id="operator-password"
                  type="password"
                  placeholder="••••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="font-mono-jetbrains flex-1 text-[13px] text-[#111827] placeholder:text-[#9CA3AF] outline-none bg-transparent"
                />
              </div>
            </div>

            {/* Remember + Forgot row */}
            <div className="flex items-center justify-between">
              <span className="text-[12px] text-[#6B7280]">Remember this device</span>
              <a href="#" className="text-[12px] font-[500] text-[#D92D20]">Forgot password?</a>
            </div>

            {/* Log In button */}
            <button
              onClick={handleLogin}
              className="flex h-[42px] w-full items-center justify-center bg-[#0B1220] text-[13px] font-[500] text-white hover:bg-[#1a2540] transition-colors"
            >
              Log In
            </button>

            {/* Security key button */}
            <button className="flex h-[42px] w-full items-center justify-center border border-[#D1D5DB] text-[13px] font-[500] text-[#0B1220] hover:bg-zinc-50 transition-colors">
              Use security key
            </button>

          </div>
        </div>
      </div>
    </div>
  );
}

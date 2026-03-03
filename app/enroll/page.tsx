"use client";

import { Landmark, Mail, Lock, Check } from "lucide-react";

export default function EnrollPage() {
  return (
    <div className="flex h-full w-full items-center justify-center bg-zinc-100 font-inter">
      {/* Shell */}
      <div className="flex w-[800px] overflow-hidden rounded-sm border border-[var(--color-border)] bg-white shadow-sm">

        {/* Left panel */}
        <div className="flex w-[280px] shrink-0 flex-col gap-4 bg-black p-6">

          {/* Logo row */}
          <div className="flex items-center gap-3">
            <Landmark size={16} color="#E53935" strokeWidth={2} className="shrink-0" />
            <span className="font-mono-jetbrains text-[18px] font-[500] leading-none text-white">
              National Digital Bank
            </span>
          </div>

          {/* Title */}
          <h1 className="text-[28px] font-semibold leading-[1.1] text-white">
            Secure sign-in for your Bank
          </h1>

          {/* Subtitle */}
          <p className="text-[13px] leading-[1.4] text-[#777777]">
            Access accounts, approvals, and session logs with hardened controls.
          </p>

          {/* Trust list */}
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-3">
              <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[#E53935]" />
              <span className="text-[13px] text-white">256-bit encrypted sessions</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[#777777]" />
              <span className="text-[13px] text-[#777777]">Real-time fraud alerts</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[#777777]" />
              <span className="text-[13px] text-[#777777]">FDIC insured up to legal limits</span>
            </div>
          </div>
        </div>

        {/* Right panel */}
        <div className="flex flex-1 flex-col items-stretch justify-center bg-white px-10 py-6">
          <div className="flex flex-col gap-4">

            {/* Heading */}
            <div className="flex flex-col gap-1">
              <h2 className="text-[32px] font-semibold leading-none text-black">Enroll</h2>
              <p className="text-[14px] leading-[1.4] text-[#777777]">Authenticate to continue.</p>
            </div>

            {/* Email group */}
            <div className="flex flex-col gap-2">
              <label htmlFor="email" className="text-[12px] text-[#777777]">Email address</label>
              <div className="flex h-10 items-center gap-2 border border-[var(--color-border)] px-3 focus-within:border-black transition-colors">
                <Mail size={14} color="#999999" strokeWidth={1.5} className="shrink-0" />
                <input
                  id="email"
                  type="email"
                  placeholder="you@example.com"
                  className="font-mono-jetbrains flex-1 text-[13px] text-black placeholder:text-[#999999] outline-none bg-transparent"
                />
              </div>
            </div>

            {/* Password group */}
            <div className="flex flex-col gap-2">
              <label htmlFor="password" className="text-[12px] text-[#777777]">Password</label>
              <div className="flex h-10 items-center gap-2 border border-[var(--color-border)] px-3 focus-within:border-black transition-colors">
                <Lock size={14} color="#999999" strokeWidth={1.5} className="shrink-0" />
                <input
                  id="password"
                  type="password"
                  placeholder="••••••••••"
                  className="font-mono-jetbrains flex-1 text-[13px] text-black placeholder:text-[#999999] outline-none bg-transparent"
                />
              </div>
            </div>

            {/* Remember + Need help row */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="flex h-4 w-4 items-center justify-center border border-black bg-black">
                  <Check size={10} color="#ffffff" strokeWidth={2.5} />
                </div>
                <span className="text-[12px] text-[#777777]">Remember device</span>
              </div>
              <a href="#" className="text-[12px] font-[500] text-[#E53935]">Need help?</a>
            </div>

            {/* Enroll button */}
            <button className="flex h-10 w-full items-center justify-center bg-black text-[13px] font-[500] text-white hover:bg-zinc-800 transition-colors">
              Enroll
            </button>

          </div>
        </div>
      </div>
    </div>
  );
}

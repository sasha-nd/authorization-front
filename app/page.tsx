"use client";

import { useRouter } from "next/navigation";
import { Landmark, Mail, Lock, Check } from "lucide-react";
import { useState } from "react";

export default function Home() {
  const router = useRouter();
  const [view, setView] = useState<"signin" | "enroll">("signin");

  const [signinEmail, setSigninEmail] = useState("");
  const [signinPassword, setSigninPassword] = useState("");

  const [enrollEmail, setEnrollEmail] = useState("");
  const [enrollPassword, setEnrollPassword] = useState("");

  const apiUrl = process.env.NEXT_PUBLIC_API_URL;

  async function handleSignIn() {
    await fetch(`${apiUrl}/users/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: signinEmail, password: signinPassword }),
    });
    router.push("/dashboard");
  }

  async function handleEnroll() {
    await fetch(`${apiUrl}/users`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: enrollEmail, password: enrollPassword }),
    });
  }

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
              AUTH::PORTAL
            </span>
          </div>

          {/* Title */}
          <h1 className="text-[28px] font-semibold leading-[1.1] text-white">
            Secure sign-in for your workspace
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

          {view === "signin" ? (
            <div className="flex flex-col gap-4">

              {/* Heading */}
              <div className="flex flex-col gap-1">
                <h2 className="text-[32px] font-semibold leading-none text-black">Sign in</h2>
                <p className="text-[14px] leading-[1.4] text-[#777777]">Authenticate to continue.</p>
              </div>

              {/* Email group */}
              <div className="flex flex-col gap-2">
                <label htmlFor="signin-email" className="text-[12px] text-[#777777]">Email address</label>
                <div className="flex h-10 items-center gap-2 border border-[var(--color-border)] px-3 focus-within:border-black transition-colors">
                  <Mail size={14} color="#999999" strokeWidth={1.5} className="shrink-0" />
                  <input
                    id="signin-email"
                    type="email"
                    placeholder="you@example.com"
                    value={signinEmail}
                    onChange={(e) => setSigninEmail(e.target.value)}
                    className="font-mono-jetbrains flex-1 text-[13px] text-black placeholder:text-[#999999] outline-none bg-transparent"
                  />
                </div>
              </div>

              {/* Password group */}
              <div className="flex flex-col gap-2">
                <label htmlFor="signin-password" className="text-[12px] text-[#777777]">Password</label>
                <div className="flex h-10 items-center gap-2 border border-[var(--color-border)] px-3 focus-within:border-black transition-colors">
                  <Lock size={14} color="#999999" strokeWidth={1.5} className="shrink-0" />
                  <input
                    id="signin-password"
                    type="password"
                    placeholder="••••••••••"
                    value={signinPassword}
                    onChange={(e) => setSigninPassword(e.target.value)}
                    className="font-mono-jetbrains flex-1 text-[13px] text-black placeholder:text-[#999999] outline-none bg-transparent"
                  />
                </div>
              </div>

              {/* Forgot password */}
              <div className="flex justify-end">
                <a href="#" className="text-[12px] font-[500] text-[var(--color-accent)]">Forgot password?</a>
              </div>

              {/* Remember + Need help row */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="flex h-4 w-4 items-center justify-center border border-black bg-black">
                    <Check size={10} color="#ffffff" strokeWidth={2.5} />
                  </div>
                  <span className="text-[12px] text-[#777777]">Remember device</span>
                </div>
                <a href="#" className="text-[12px] font-[500] text-[var(--color-accent)]">Need help?</a>
              </div>

              {/* Sign In button */}
              <button
                onClick={handleSignIn}
                className="flex h-10 w-full items-center justify-center bg-black text-[13px] font-[500] text-white hover:bg-zinc-800 transition-colors"
              >
                Sign In
              </button>

              {/* Biometric button */}
              <button className="flex h-10 w-full items-center justify-center border border-[var(--color-border)] text-[13px] font-[500] text-black hover:bg-zinc-50 transition-colors">
                Use biometric sign in
              </button>

              {/* Signup row */}
              <div className="flex items-center justify-center gap-1.5">
                <span className="text-[12px] text-[#777777]">New customer?</span>
                <button
                  onClick={() => setView("enroll")}
                  className="text-[12px] font-semibold text-[var(--color-accent)]"
                >
                  Enroll now
                </button>
              </div>

            </div>
          ) : (
            <div className="flex flex-col gap-4">

              {/* Heading */}
              <div className="flex flex-col gap-1">
                <h2 className="text-[32px] font-semibold leading-none text-black">Enroll</h2>
                <p className="text-[14px] leading-[1.4] text-[#777777]">Authenticate to continue.</p>
              </div>

              {/* Email group */}
              <div className="flex flex-col gap-2">
                <label htmlFor="enroll-email" className="text-[12px] text-[#777777]">Email address</label>
                <div className="flex h-10 items-center gap-2 border border-[var(--color-border)] px-3 focus-within:border-black transition-colors">
                  <Mail size={14} color="#999999" strokeWidth={1.5} className="shrink-0" />
                  <input
                    id="enroll-email"
                    type="email"
                    placeholder="you@example.com"
                    value={enrollEmail}
                    onChange={(e) => setEnrollEmail(e.target.value)}
                    className="font-mono-jetbrains flex-1 text-[13px] text-black placeholder:text-[#999999] outline-none bg-transparent"
                  />
                </div>
              </div>

              {/* Password group */}
              <div className="flex flex-col gap-2">
                <label htmlFor="enroll-password" className="text-[12px] text-[#777777]">Password</label>
                <div className="flex h-10 items-center gap-2 border border-[var(--color-border)] px-3 focus-within:border-black transition-colors">
                  <Lock size={14} color="#999999" strokeWidth={1.5} className="shrink-0" />
                  <input
                    id="enroll-password"
                    type="password"
                    placeholder="••••••••••"
                    value={enrollPassword}
                    onChange={(e) => setEnrollPassword(e.target.value)}
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
                <a href="#" className="text-[12px] font-[500] text-[var(--color-accent)]">Need help?</a>
              </div>

              {/* Enroll button */}
              <button
                onClick={handleEnroll}
                className="flex h-10 w-full items-center justify-center bg-black text-[13px] font-[500] text-white hover:bg-zinc-800 transition-colors"
              >
                Enroll
              </button>

              {/* Back to sign in */}
              <div className="flex items-center justify-center gap-1.5">
                <span className="text-[12px] text-[#777777]">Already enrolled?</span>
                <button
                  onClick={() => setView("signin")}
                  className="text-[12px] font-semibold text-[var(--color-accent)]"
                >
                  Sign in
                </button>
              </div>

            </div>
          )}

        </div>
      </div>
    </div>
  );
}

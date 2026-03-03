"use client";

import { useSession, signIn } from "next-auth/react";
import { Landmark } from "lucide-react";
import { useRouter } from "next/navigation";
import LogoutButton from "@/app/components/LogoutButton";

export default function LandingPage() {
  const { data: session } = useSession();
  const router = useRouter();

  const handleLogin = () => signIn("nevis");

  const goToTransactions = () => router.push("/dashboard/transactions");
  const goToProfile = () => router.push("/dashboard/profile");

  return (
    <div className="flex h-screen w-full flex-col bg-zinc-100 font-inter">

      {/* Header — same as dashboard layout */}
      <header className="flex items-center justify-between bg-black p-4 text-white">
        <span className="text-lg font-semibold">National Digital Bank</span>
        {session && (
          <div className="flex items-center gap-3">
            <LogoutButton />
          </div>
        )}
      </header>

      {/* Centred card */}
      <div className="flex flex-1 items-center justify-center">
        <div className="flex w-[800px] overflow-hidden rounded-md border border-[var(--color-border)] bg-white shadow-lg">

          {/* Left panel */}
          <div className="flex w-[280px] flex-col gap-4 bg-black p-6">
            <div className="flex items-center gap-3">
              <Landmark size={16} color="#E53935" strokeWidth={2} />
              <span className="font-mono-jetbrains text-[18px] font-[500] leading-none text-white">
                National Digital Bank
              </span>
            </div>
            <h1 className="text-[28px] font-semibold leading-[1.1] text-white">
              Secure sign-in for your Bank
            </h1>
            <p className="text-[13px] leading-[1.4] text-[#777777]">
              Access accounts, approvals, and session logs with hardened controls.
            </p>
          </div>

          {/* Right panel */}
          <div className="flex flex-1 flex-col items-center justify-center gap-6 bg-white px-10 py-6">
            {!session ? (
              <>
                <h2 className="text-[32px] font-semibold text-black">Sign In</h2>
                <button
                  onClick={handleLogin}
                  className="h-10 w-60 bg-black text-white font-medium hover:bg-zinc-800 transition-colors"
                >
                  Sign In with Nevis
                </button>
              </>
            ) : (
              <>
                <h2 className="text-[32px] font-semibold text-black">
                  Welcome, {session.user?.name || session.user?.email}
                </h2>

                <div className="flex flex-col gap-4 mt-4">
                  <button
                    onClick={goToTransactions}
                    className="h-10 w-60 bg-red-600 text-white font-medium hover:bg-red-500 transition-colors"
                  >
                    Transactions
                  </button>
                  <button
                    onClick={goToProfile}
                    className="h-10 w-60 bg-blue-600 text-white font-medium hover:bg-blue-500 transition-colors"
                  >
                    Profile
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
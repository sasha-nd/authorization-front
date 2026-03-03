// app/dashboard/layout.tsx
"use client";

import { ReactNode } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import LogoutButton from "@/app/components/LogoutButton";

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const { data: session } = useSession();
  const router = useRouter();

  return (
    <div className="flex min-h-screen flex-col">
      {/* Header */}
      <header className="flex items-center justify-between bg-black p-4 text-white">
        <button
          onClick={() => router.push("/")}
          className="text-lg font-semibold hover:opacity-80 transition-opacity"
        >
          National Digital Bank
        </button>
        {session && (
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.back()}
              className="px-3 py-1 text-sm font-medium text-white border border-white/30 hover:bg-white/10 transition-colors"
            >
              ← Back
            </button>
            <LogoutButton />
          </div>
        )}
      </header>

      {/* Page Content */}
      <main className="flex-1 p-6">{children}</main>
    </div>
  );
}
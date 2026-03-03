// app/dashboard/layout.tsx
"use client";

import { ReactNode } from "react";
import { useSession, signOut } from "next-auth/react";

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const { data: session } = useSession();

  return (
    <div className="flex min-h-screen flex-col">
      {/* Header */}
      <header className="flex items-center justify-between bg-black p-4 text-white">
        <h1 className="text-lg font-semibold">National Digital Bank</h1>
        {session && (
          <button
            onClick={() => signOut({ callbackUrl: "/" })}
            className="bg-red-600 px-3 py-1 rounded hover:bg-red-700"
          >
            Logout
          </button>
        )}
      </header>

      {/* Page Content */}
      <main className="flex-1 p-6">{children}</main>
    </div>
  );
}
"use client";

import { signOut } from "next-auth/react";

interface LogoutButtonProps {
  className?: string;
}

export async function handleLogout() {
  await signOut({ callbackUrl: "/", redirect: true });
}

export default function LogoutButton({ className }: LogoutButtonProps) {
  return (
    <button
      onClick={handleLogout}
      className={className ?? "bg-red-600 px-3 py-1 text-sm font-medium text-white hover:bg-red-700 transition-colors"}
    >
      Logout
    </button>
  );
}
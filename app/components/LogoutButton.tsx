"use client";

import { signOut } from "next-auth/react";

interface LogoutButtonProps {
  className?: string;
}

export async function handleLogout() {
  await signOut({ redirect: false });
  const nevisLogoutUrl = process.env.NEXT_PUBLIC_NEVIS_LOGOUT_URL ?? "https://login.national-digital.getnevis.net/?logout";
  const returnUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  window.location.href = `${nevisLogoutUrl}&redirectUrl=${encodeURIComponent(returnUrl)}`;
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
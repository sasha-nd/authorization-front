"use client";

import { signOut } from "next-auth/react";

interface LogoutButtonProps {
  className?: string;
}

export async function handleLogout() {
  try {
    // Clear local storage and session storage first
    if (typeof window !== "undefined") {
      localStorage.clear();
      sessionStorage.clear();
      
      // Clear all cookies (including NextAuth session cookies)
      document.cookie.split(";").forEach((c) => {
        document.cookie = c
          .replace(/^ +/, "")
          .replace(/=.*/, "=;expires=" + new Date().toUTCString() + ";path=/");
      });
    }
    
    // Sign out from NextAuth (this will trigger the signOut event in authOptions)
    // Use redirect: false first, then manually redirect to ensure clean state
    await signOut({ redirect: false });
    
    // Force navigation to home page
    if (typeof window !== "undefined") {
      window.location.href = "/";
    }
  } catch (error) {
    console.error("[logout] Error during logout:", error);
    // Force redirect even on error
    if (typeof window !== "undefined") {
      window.location.href = "/";
    }
  }
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
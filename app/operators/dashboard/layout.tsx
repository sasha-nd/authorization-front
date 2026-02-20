"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

export default function OperatorsDashboardLayout({ children }: { children: React.ReactNode }) {
  const [username, setUsername] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    const stored = sessionStorage.getItem("operator_username") || sessionStorage.getItem("operator_id") || "";
    setUsername(stored);
  }, []);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    if (menuOpen) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [menuOpen]);

  function handleLogout() {
    sessionStorage.clear();
    router.push("/operators/login");
  }

  return (
    <div className="min-h-screen font-inter flex flex-col" style={{ backgroundColor: "#F7F8FA" }}>
      {/* Top bar */}
      <header
        className="flex items-center justify-between px-6 bg-white shrink-0"
        style={{ height: 72, borderBottom: "1px solid #E6E8EC" }}
      >
        {/* Brand */}
        <div className="flex items-center gap-2.5">
          <div className="rounded-sm" style={{ width: 16, height: 16, backgroundColor: "#0B1220" }} />
          <span className="font-semibold text-[18px]" style={{ color: "#0B1220" }}>
            Digital Piggy Bank
          </span>
        </div>

        {/* Username + dropdown */}
        {username && (
          <div className="relative" ref={menuRef}>
            <button
              onClick={() => setMenuOpen((o) => !o)}
              className="text-[13px] hover:opacity-70 transition-opacity"
              style={{ color: "#6B7280" }}
            >
              {username}
            </button>

            {menuOpen && (
              <div
                className="absolute right-0 top-full mt-1 bg-white"
                style={{ border: "1px solid #E6E8EC", minWidth: 120, zIndex: 50 }}
              >
                <button
                  onClick={handleLogout}
                  className="w-full text-left px-4 py-2.5 text-[13px] hover:bg-[#F7F8FA] transition-colors"
                  style={{ color: "#0B1220" }}
                >
                  Logout
                </button>
              </div>
            )}
          </div>
        )}
      </header>

      {children}
    </div>
  );
}

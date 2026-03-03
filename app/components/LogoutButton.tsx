"use client";

import { signOut } from "next-auth/react";

export default function LogoutButton() {
  const handleLogout = async () => {
    await signOut({ redirect: false });

    const nevisLogoutUrl =
      "https://login.national-digital.getnevis.net/?logout";

    const returnUrl = "http://localhost:3000";

    window.location.href =
      `${nevisLogoutUrl}&redirectUrl=${encodeURIComponent(returnUrl)}`;
  };

  return (
    <button
      onClick={handleLogout}
      className="mt-2 bg-red-500 text-white px-4 py-2 rounded"
    >
      Logout
    </button>
  );
}
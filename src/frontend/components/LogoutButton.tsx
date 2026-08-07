"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { apiClient } from "@/frontend/lib/api-client";

export function LogoutButton() {
  const router = useRouter();
  const [loggingOut, setLoggingOut] = useState(false);

  return (
    <button
      onClick={async () => {
        setLoggingOut(true);
        try {
          await apiClient.post("/auth/logout", {});
        } finally {
          router.push("/giris");
          router.refresh();
        }
      }}
      disabled={loggingOut}
      className="rounded-md border border-rule px-3 py-1 text-xs transition-colors hover:bg-paper focus-visible:ring-2 focus-visible:ring-ledger focus-visible:outline-none disabled:opacity-50"
    >
      {loggingOut ? "Çıkış yapılıyor…" : "Çıkış Yap"}
    </button>
  );
}

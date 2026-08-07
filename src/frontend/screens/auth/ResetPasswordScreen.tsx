"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

import { apiClient, ApiError } from "@/frontend/lib/api-client";

const INPUT_CLASS =
  "mt-1 w-full rounded-md border border-rule bg-surface px-3 py-1.5 text-sm focus-visible:ring-2 focus-visible:ring-ledger focus-visible:outline-none";
const PRIMARY_BUTTON =
  "w-full rounded-md bg-ledger px-4 py-2 text-sm font-medium text-white transition-colors hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-ledger focus-visible:ring-offset-2 focus-visible:outline-none";

/** /sifre-sifirla?token=... bağlantısıyla açılır — bkz. auth.service.ts requestPasswordReset. */
export function ResetPasswordScreen() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      setError("Şifreler eşleşmiyor.");
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      await apiClient.post("/auth/reset-password", { token, newPassword });
      setDone(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Şifre güncellenemedi.");
    } finally {
      setSubmitting(false);
    }
  };

  if (!token) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-paper px-6 py-10">
        <div className="w-full max-w-sm rounded-lg border border-rule bg-surface p-6 text-sm">
          <p className="text-brick">Geçersiz bağlantı — token eksik.</p>
          <p className="mt-4">
            <Link href="/sifremi-unuttum" className="text-ledger hover:underline">
              Yeniden sıfırlama iste
            </Link>
          </p>
        </div>
      </div>
    );
  }

  if (done) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-paper px-6 py-10">
        <div className="w-full max-w-sm rounded-lg border border-rule bg-surface p-6 text-sm">
          <p>Şifreniz güncellendi.</p>
          <button
            onClick={() => router.push("/giris")}
            className={`${PRIMARY_BUTTON} mt-4`}
          >
            Girişe dön
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-dvh items-center justify-center bg-paper px-6 py-10">
      <div className="w-full max-w-sm rounded-lg border border-rule bg-surface p-6">
        <h1 className="text-lg font-semibold tracking-tight">Yeni Şifre Belirle</h1>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div>
            <label htmlFor="newPassword" className="block text-sm font-medium text-ink">
              Yeni Şifre
            </label>
            <input
              id="newPassword"
              type="password"
              required
              minLength={8}
              autoComplete="new-password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className={INPUT_CLASS}
            />
          </div>

          <div>
            <label
              htmlFor="confirmPassword"
              className="block text-sm font-medium text-ink"
            >
              Yeni Şifre (Tekrar)
            </label>
            <input
              id="confirmPassword"
              type="password"
              required
              minLength={8}
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className={INPUT_CLASS}
            />
          </div>

          {error ? <p className="text-sm text-brick">{error}</p> : null}

          <button type="submit" disabled={submitting} className={PRIMARY_BUTTON}>
            {submitting ? "Güncelleniyor…" : "Şifreyi Güncelle"}
          </button>
        </form>
      </div>
    </div>
  );
}

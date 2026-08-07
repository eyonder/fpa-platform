"use client";

import Link from "next/link";
import { useState } from "react";

import { apiClient, ApiError } from "@/frontend/lib/api-client";

const INPUT_CLASS =
  "mt-1 w-full rounded-md border border-rule bg-surface px-3 py-1.5 text-sm focus-visible:ring-2 focus-visible:ring-ledger focus-visible:outline-none";
const PRIMARY_BUTTON =
  "w-full rounded-md bg-ledger px-4 py-2 text-sm font-medium text-white transition-colors hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-ledger focus-visible:ring-offset-2 focus-visible:outline-none";

/**
 * İki adım: (1) e-posta gir, (2) onay. Backend, e-posta kayıtlı olsun ya da
 * olmasın AYNI genel mesajı döner (bkz. auth.service.ts) — bu yüzden burada
 * da "e-posta bulunamadı" gibi bir dallanma YOKTUR, kasıtlı olarak.
 */
export function ForgotPasswordScreen() {
  const [step, setStep] = useState<"email" | "sent">("email");
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      await apiClient.post("/auth/forgot-password", { email });
      setStep("sent");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "İstek gönderilemedi.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-dvh items-center justify-center bg-paper px-6 py-10">
      <div className="w-full max-w-sm rounded-lg border border-rule bg-surface p-6">
        <h1 className="text-lg font-semibold tracking-tight">Şifremi Unuttum</h1>

        {step === "email" ? (
          <>
            <p className="mt-1 text-sm text-muted">
              Hesabınıza kayıtlı e-posta adresini girin, sıfırlama bağlantısı
              gönderelim.
            </p>

            <form onSubmit={handleSubmit} className="mt-4 space-y-4">
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-ink">
                  E-posta
                </label>
                <input
                  id="email"
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className={INPUT_CLASS}
                />
              </div>

              {error ? <p className="text-sm text-brick">{error}</p> : null}

              <button type="submit" disabled={submitting} className={PRIMARY_BUTTON}>
                {submitting ? "Gönderiliyor…" : "Sıfırlama Bağlantısı Gönder"}
              </button>
            </form>
          </>
        ) : (
          <div className="mt-4 space-y-3 text-sm">
            <p>
              Bu e-posta adresi sistemde kayıtlıysa, şifre sıfırlama bağlantısı
              gönderildi.
            </p>
            <p className="text-xs text-muted">
              Demo ortamı: gerçek e-posta gönderilmez; bağlantı sunucu logunda (konsol)
              görünür.
            </p>
          </div>
        )}

        <p className="mt-4 text-sm">
          <Link href="/giris" className="text-ledger hover:underline">
            ← Girişe dön
          </Link>
        </p>
      </div>
    </div>
  );
}

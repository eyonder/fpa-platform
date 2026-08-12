"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

import { apiClient, ApiError } from "@/frontend/lib/api-client";
import type { LoginResponse } from "@/shared/types";

const DEMO_ACCOUNTS = [
  "aylin@demo-tenant.test — Admin",
  "baris@demo-tenant.test — Bütçe Yöneticisi",
  "deniz@demo-tenant.test — Veri Giriş Uzmanı",
  "hale@org-holding.test — Admin (Holding)",
];
const DEMO_PASSWORD = "Demo1234!";

const INPUT_CLASS =
  "mt-1 w-full rounded-md border border-rule bg-surface px-3 py-1.5 text-sm focus-visible:ring-2 focus-visible:ring-ledger focus-visible:outline-none";
const PRIMARY_BUTTON =
  "w-full rounded-md bg-ledger px-4 py-2 text-sm font-medium text-white transition-colors hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-ledger focus-visible:ring-offset-2 focus-visible:outline-none";

/** `ImportScreen`'deki sihirbaz deseniyle aynı: adım + o adımın taşıdığı veri. */
type Step =
  { name: "credentials" } | { name: "mfa"; challengeId: string; rememberMe: boolean };

/**
 * Giriş ekranı. Başarılı girişte backend httpOnly bir oturum çerezi set eder
 * (bkz. app/api/auth/login/route.ts); burası sadece o çereze güvenip
 * `?next=`e (ya da "/"e) yönlendirir — çerezin kendisiyle hiç ilgilenmez.
 *
 * MFA'sı aktif bir kullanıcı için `/api/auth/login`, çerez set ETMEDEN
 * `{status:"MFA_REQUIRED", challengeId}` döner; bu ekran o durumda `step`i
 * `"mfa"`ya çevirip tek bir doğrulama kodu (TOTP ya da yedek kod — backend
 * ikisini de dener) ister. Asıl oturum sadece `/api/auth/mfa/verify`
 * başarılı olunca kurulur.
 */
export function LoginScreen() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") ?? "/";

  const [step, setStep] = useState<Step>({ name: "credentials" });
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [code, setCode] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCredentialsSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const result = await apiClient.post<LoginResponse>("/auth/login", {
        email,
        password,
        rememberMe,
      });
      if (result.status === "MFA_REQUIRED") {
        setStep({ name: "mfa", challengeId: result.challengeId, rememberMe });
        return;
      }
      router.push(next);
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Giriş yapılamadı.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleMfaSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (step.name !== "mfa") return;
    setSubmitting(true);
    setError(null);

    try {
      await apiClient.post<LoginResponse>("/auth/mfa/verify", {
        challengeId: step.challengeId,
        code,
        rememberMe: step.rememberMe,
      });
      router.push(next);
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Kod doğrulanamadı.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-dvh items-center justify-center bg-paper px-6 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <span className="tabular text-lg font-semibold tracking-tight text-ledger">
            FP&amp;A
          </span>
          <span className="ml-2 text-sm text-muted">Planlama Platformu</span>
        </div>

        <div className="rounded-lg border border-rule bg-surface p-6">
          {step.name === "credentials" ? (
            <>
              <h1 className="text-lg font-semibold tracking-tight">Giriş Yap</h1>

              <form onSubmit={handleCredentialsSubmit} className="mt-4 space-y-4">
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

                <div>
                  <label
                    htmlFor="password"
                    className="block text-sm font-medium text-ink"
                  >
                    Şifre
                  </label>
                  <input
                    id="password"
                    type="password"
                    required
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className={INPUT_CLASS}
                  />
                </div>

                <div className="flex items-center justify-between text-sm">
                  <label className="flex items-center gap-2 text-ink">
                    <input
                      type="checkbox"
                      checked={rememberMe}
                      onChange={(e) => setRememberMe(e.target.checked)}
                      className="rounded border-rule"
                    />
                    Beni hatırla
                  </label>
                  <Link href="/sifremi-unuttum" className="text-ledger hover:underline">
                    Şifremi unuttum?
                  </Link>
                </div>

                {error ? <p className="text-sm text-brick">{error}</p> : null}

                <button type="submit" disabled={submitting} className={PRIMARY_BUTTON}>
                  {submitting ? "Giriş yapılıyor…" : "Giriş Yap"}
                </button>
              </form>

              <div className="mt-4 rounded-md bg-paper px-3 py-2 text-xs text-muted">
                <p className="font-medium text-ink">
                  Demo hesapları (yalnızca geliştirme ortamı)
                </p>
                <ul className="mt-1 space-y-0.5">
                  {DEMO_ACCOUNTS.map((account) => (
                    <li key={account}>{account}</li>
                  ))}
                </ul>
                <p className="mt-1">
                  Şifre: <span className="tabular">{DEMO_PASSWORD}</span>
                </p>
              </div>
            </>
          ) : (
            <>
              <h1 className="text-lg font-semibold tracking-tight">Doğrulama Kodu</h1>
              <p className="mt-1 text-sm text-muted">
                Kimlik doğrulama uygulamanızdaki 6 haneli kodu ya da bir yedek kodu
                girin.
              </p>

              <form onSubmit={handleMfaSubmit} className="mt-4 space-y-4">
                <div>
                  <label htmlFor="code" className="block text-sm font-medium text-ink">
                    Doğrulama kodu
                  </label>
                  <input
                    id="code"
                    type="text"
                    required
                    autoFocus
                    autoComplete="one-time-code"
                    inputMode="text"
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    className={INPUT_CLASS}
                  />
                </div>

                {error ? <p className="text-sm text-brick">{error}</p> : null}

                <button type="submit" disabled={submitting} className={PRIMARY_BUTTON}>
                  {submitting ? "Doğrulanıyor…" : "Doğrula"}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setStep({ name: "credentials" });
                    setCode("");
                    setError(null);
                  }}
                  className="w-full text-center text-sm text-muted hover:text-ink"
                >
                  Geri
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

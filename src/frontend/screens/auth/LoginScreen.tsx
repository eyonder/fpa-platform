"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

import { AydinlatmaMetni } from "@/frontend/components/AydinlatmaMetni";
import { apiClient, ApiError } from "@/frontend/lib/api-client";

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

/**
 * Giriş ekranı. Başarılı girişte backend httpOnly bir oturum çerezi set eder
 * (bkz. app/api/auth/login/route.ts); burası sadece o çereze güvenip
 * `?next=`e (ya da "/"e) yönlendirir — çerezin kendisiyle hiç ilgilenmez.
 *
 * MFA notu: Şu an `authService.login` her zaman doğrudan oturum kurar. MFA
 * eklendiğinde backend "MFA_REQUIRED" durumu dönmeye başlayacak (bkz.
 * auth.service.ts'teki yorum); burada tek değişecek yer, `handleSubmit`
 * içinde o durumu yakalayıp bir kod-doğrulama adımına geçmek olacaktır —
 * form alanları ve genel akış aynı kalır.
 */
export function LoginScreen() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") ?? "/";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      await apiClient.post("/auth/login", { email, password, rememberMe });
      router.push(next);
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Giriş yapılamadı.");
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
          <h1 className="text-lg font-semibold tracking-tight">Giriş Yap</h1>

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

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-ink">
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

          <AydinlatmaMetni />

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
        </div>
      </div>
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";

import { apiClient, ApiError } from "@/frontend/lib/api-client";

const INPUT_CLASS =
  "mt-1 w-full rounded-md border border-rule bg-surface px-3 py-1.5 text-sm focus-visible:ring-2 focus-visible:ring-ledger focus-visible:outline-none";
const PRIMARY_BUTTON =
  "rounded-md bg-ledger px-4 py-2 text-sm font-medium text-white transition-colors hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-ledger focus-visible:ring-offset-2 focus-visible:outline-none";
const SECONDARY_BUTTON =
  "rounded-md border border-rule px-4 py-2 text-sm font-medium text-ink transition-colors hover:bg-paper disabled:cursor-not-allowed disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-ledger focus-visible:ring-offset-2 focus-visible:outline-none";

interface EnrollmentData {
  otpauthUrl: string;
  qrCodeDataUrl: string;
  secret: string;
}

type ViewState =
  | { name: "loading" }
  | { name: "disabled" }
  | { name: "enrolling"; data: EnrollmentData }
  | { name: "backup-codes"; codes: string[] }
  | { name: "enabled" }
  | { name: "disabling" };

/**
 * Hesap ayarları — şu an sadece MFA (TOTP) enroll/disable. Enroll İKİ adım
 * gerektirir (bkz. backend/modules/auth/mfa.service.ts'teki yorum): önce QR
 * kodu okutup bir kod girerek DOĞRULAMA, sonra (ve SADECE o an) yedek
 * kodların gösterilmesi — bu ekran o sırayı birebir izler.
 */
export function AccountScreen() {
  const [view, setView] = useState<ViewState>({ name: "loading" });
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    apiClient
      .get<{ enabled: boolean }>("/account/mfa")
      .then((status) =>
        setView(status.enabled ? { name: "enabled" } : { name: "disabled" }),
      )
      .catch(() => setView({ name: "disabled" }));
  }, []);

  const startEnrollment = async () => {
    setSubmitting(true);
    setError(null);
    try {
      const data = await apiClient.post<EnrollmentData>("/account/mfa", {});
      setView({ name: "enrolling", data });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Başlatılamadı.");
    } finally {
      setSubmitting(false);
    }
  };

  const confirmEnrollment = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const result = await apiClient.post<{ backupCodes: string[] }>(
        "/account/mfa/confirm",
        {
          code,
        },
      );
      setCode("");
      setView({ name: "backup-codes", codes: result.backupCodes });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Kod doğrulanamadı.");
    } finally {
      setSubmitting(false);
    }
  };

  const disableMfa = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await apiClient.post("/account/mfa/disable", { password });
      setPassword("");
      setView({ name: "disabled" });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Devre dışı bırakılamadı.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-lg">
      <h1 className="text-lg font-semibold tracking-tight">Hesap</h1>
      <p className="mt-1 text-sm text-muted">
        İki faktörlü doğrulama (MFA), şifreniz ele geçirilse bile hesabınıza girişi bir
        doğrulama kodu gerektirerek zorlaştırır.
      </p>

      <div className="mt-6 rounded-lg border border-rule bg-surface p-6">
        {view.name === "loading" ? (
          <p className="text-sm text-muted">Yükleniyor…</p>
        ) : null}

        {view.name === "disabled" ? (
          <>
            <p className="text-sm text-ink">
              İki faktörlü doğrulama şu an{" "}
              <span className="font-medium text-brick">devre dışı</span>.
            </p>
            {error ? <p className="mt-2 text-sm text-brick">{error}</p> : null}
            <button
              type="button"
              onClick={startEnrollment}
              disabled={submitting}
              className={`${PRIMARY_BUTTON} mt-4`}
            >
              {submitting ? "Başlatılıyor…" : "Etkinleştir"}
            </button>
          </>
        ) : null}

        {view.name === "enrolling" ? (
          <>
            <p className="text-sm text-ink">
              Google Authenticator, 1Password gibi bir uygulamayla aşağıdaki kodu
              okutun, sonra uygulamanın gösterdiği 6 haneli kodu girin.
            </p>
            <div className="mt-4 flex justify-center">
              {/* eslint-disable-next-line @next/next/no-img-element -- sunucuda üretilen data: URL, next/image optimizasyonu gerekmez */}
              <img
                src={view.data.qrCodeDataUrl}
                alt="MFA QR kodu"
                width={200}
                height={200}
                className="rounded-md border border-rule"
              />
            </div>
            <p className="mt-3 text-center text-xs text-muted">
              QR okutamıyorsanız elle girin:{" "}
              <span className="tabular font-medium text-ink">{view.data.secret}</span>
            </p>

            <form onSubmit={confirmEnrollment} className="mt-4 space-y-4">
              <div>
                <label
                  htmlFor="enroll-code"
                  className="block text-sm font-medium text-ink"
                >
                  Doğrulama kodu
                </label>
                <input
                  id="enroll-code"
                  type="text"
                  required
                  autoFocus
                  autoComplete="one-time-code"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  className={INPUT_CLASS}
                />
              </div>

              {error ? <p className="text-sm text-brick">{error}</p> : null}

              <div className="flex gap-3">
                <button type="submit" disabled={submitting} className={PRIMARY_BUTTON}>
                  {submitting ? "Onaylanıyor…" : "Onayla"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setView({ name: "disabled" });
                    setCode("");
                    setError(null);
                  }}
                  className={SECONDARY_BUTTON}
                >
                  Vazgeç
                </button>
              </div>
            </form>
          </>
        ) : null}

        {view.name === "backup-codes" ? (
          <>
            <p className="text-sm font-medium text-ink">
              İki faktörlü doğrulama etkinleştirildi.
            </p>
            <p className="mt-1 text-sm text-muted">
              Bu yedek kodları güvenli bir yerde saklayın — cihazınıza erişemediğinizde
              her biri BİR KEZ kullanılabilir. Bu liste bir daha gösterilmeyecek.
            </p>
            <ul className="tabular mt-4 grid grid-cols-2 gap-2 rounded-md bg-paper p-4 text-sm">
              {view.codes.map((backupCode) => (
                <li key={backupCode}>{backupCode}</li>
              ))}
            </ul>
            <button
              type="button"
              onClick={() => setView({ name: "enabled" })}
              className={`${PRIMARY_BUTTON} mt-4`}
            >
              Kaydettim
            </button>
          </>
        ) : null}

        {view.name === "enabled" ? (
          <>
            <p className="text-sm text-ink">
              İki faktörlü doğrulama şu an{" "}
              <span className="font-medium text-ledger">aktif</span>.
            </p>
            <form onSubmit={disableMfa} className="mt-4 space-y-4">
              <div>
                <label
                  htmlFor="disable-password"
                  className="block text-sm font-medium text-ink"
                >
                  Devre dışı bırakmak için şifrenizi girin
                </label>
                <input
                  id="disable-password"
                  type="password"
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={INPUT_CLASS}
                />
              </div>

              {error ? <p className="text-sm text-brick">{error}</p> : null}

              <button type="submit" disabled={submitting} className={SECONDARY_BUTTON}>
                {submitting ? "İşleniyor…" : "Devre dışı bırak"}
              </button>
            </form>
          </>
        ) : null}
      </div>
    </div>
  );
}

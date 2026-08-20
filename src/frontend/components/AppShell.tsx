import Link from "next/link";

import { LogoutButton } from "@/frontend/components/LogoutButton";
import { ROLE_LABELS } from "@/frontend/lib/role-labels";
import type { Role } from "@/shared/types";

const NAV = [
  { href: "/", label: "Genel Bakış" },
  { href: "/rapor", label: "Rapor" },
  { href: "/senaryolar", label: "Senaryolar" },
  { href: "/butce-girisi", label: "Bütçe Girişi" },
  { href: "/gider-merkezleri", label: "Gider Merkezleri" },
  { href: "/sabit-kiymetler", label: "Sabit Kıymetler" },
  { href: "/satis", label: "Satış" },
  { href: "/ice-aktarma", label: "İçe Aktarma" },
  { href: "/denetim-kaydi", label: "Denetim Kaydı" },
  { href: "/hesap", label: "Hesap" },
  // Sadece ADMIN — maaş verisi gizliliği (bkz. backend/core/authorize.ts'teki
  // payroll:read/payroll:write notu). Bu SADECE UX içindir; asıl güvenlik
  // sınırı backend'de zorunlu kılınır — bu satır olmasa bile BUDGET_MANAGER/
  // DATA_ENTRY /api/personnel/* uçlarında 403 alır.
  { href: "/personel", label: "Personel", roles: ["ADMIN"] as Role[] },
];

interface AppShellUser {
  name: string;
  role: Role;
  tenantId: string;
}

export function AppShell({
  user,
  children,
}: {
  user: AppShellUser;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-dvh">
      <header className="border-b border-rule bg-surface">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-8 gap-y-3 px-6 py-4">
          <Link href="/" className="flex items-baseline gap-2">
            <span className="tabular text-sm font-semibold tracking-tight text-ledger">
              FP&amp;A
            </span>
            <span className="text-sm text-muted">Planlama Platformu</span>
          </Link>

          <nav className="flex items-center gap-6">
            {NAV.filter((item) => !item.roles || item.roles.includes(user.role)).map(
              (item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="rounded-sm text-sm text-muted transition-colors hover:text-ink focus-visible:ring-2 focus-visible:ring-ledger focus-visible:ring-offset-2 focus-visible:outline-none"
                >
                  {item.label}
                </Link>
              ),
            )}
          </nav>

          <div className="ml-auto flex items-center gap-3">
            <span className="tabular rounded-full bg-ledger-soft px-3 py-1 text-xs text-ledger">
              {user.name} · {ROLE_LABELS[user.role]} · {user.tenantId}
            </span>
            <LogoutButton />
          </div>
        </div>
        {/* Muhasebe defterlerindeki toplam çizgisi: ince + kalın ikili kural. */}
        <div className="h-px bg-rule" />
      </header>

      <main className="mx-auto max-w-5xl px-6 py-10">{children}</main>
    </div>
  );
}

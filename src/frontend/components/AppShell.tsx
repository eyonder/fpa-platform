import Link from "next/link";

import { ActorSwitcher } from "@/frontend/components/ActorSwitcher";

const NAV = [
  { href: "/", label: "Genel Bakış" },
  { href: "/senaryolar", label: "Senaryolar" },
  { href: "/butce-girisi", label: "Bütçe Girişi" },
  { href: "/ice-aktarma", label: "İçe Aktarma" },
  { href: "/denetim-kaydi", label: "Denetim Kaydı" },
];

export function AppShell({ children }: { children: React.ReactNode }) {
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
            {NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="rounded-sm text-sm text-muted transition-colors hover:text-ink focus-visible:ring-2 focus-visible:ring-ledger focus-visible:ring-offset-2 focus-visible:outline-none"
              >
                {item.label}
              </Link>
            ))}
          </nav>

          <ActorSwitcher />
        </div>
        {/* Muhasebe defterlerindeki toplam çizgisi: ince + kalın ikili kural. */}
        <div className="h-px bg-rule" />
      </header>

      <main className="mx-auto max-w-5xl px-6 py-10">{children}</main>
    </div>
  );
}

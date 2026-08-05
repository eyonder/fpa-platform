import { AppShell } from "@/frontend/components/AppShell";

/**
 * (app) bir "route group"tur — parantezli klasör adı URL'e yansımaz.
 * Yani /senaryolar adresi çalışır, /app/senaryolar değil.
 * İleride /login gibi kabuk istemeyen sayfaları bu grubun dışına koyarsınız.
 */
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return <AppShell>{children}</AppShell>;
}

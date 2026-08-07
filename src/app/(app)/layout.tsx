import { redirect } from "next/navigation";

import { AppShell } from "@/frontend/components/AppShell";

import { getCurrentUser } from "./get-current-user";

/**
 * (app) bir "route group"tur — parantezli klasör adı URL'e yansımaz.
 * Yani /senaryolar adresi çalışır, /app/senaryolar değil. /giris,
 * /sifremi-unuttum, /sifre-sifirla bilerek bu grubun DIŞINDA duruyor —
 * onlar AppShell kabuğu (üst menü, kullanıcı rozeti) istemez.
 *
 * ASIL yetkilendirme kontrolü burada: middleware.ts sadece çerezin VARLIĞINA
 * bakar (Edge, bellek-içi oturum deposuna erişemez); burası server-side,
 * oturumun GERÇEKTEN geçerli olup olmadığını kontrol eder ve değilse
 * `/giris`e yönlendirir.
 */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const context = await getCurrentUser();
  if (!context) redirect("/giris");

  return (
    <AppShell
      user={{ name: context.userName, role: context.role, tenantId: context.tenantId }}
    >
      {children}
    </AppShell>
  );
}

import { redirect } from "next/navigation";

import { FixedAssetsScreen } from "@/frontend/screens/fixed-assets/FixedAssetsScreen";

import { getCurrentUser } from "../get-current-user";

/**
 * `gider-merkezleri/page.tsx` ile AYNI gerekçe: TÜM rollere açık ama
 * içindeki Onay Kuyruğu/Amortismanı Bütçeye Yaz bölümleri role göre koşullu
 * gösteriliyor, bu yüzden `get-current-user.ts` kaçış kapısıyla rolü buradan
 * çözüp prop olarak geçiriyoruz.
 */
export default async function SabitKiymetlerPage() {
  const context = await getCurrentUser();
  if (!context) redirect("/giris");

  return <FixedAssetsScreen role={context.role} />;
}

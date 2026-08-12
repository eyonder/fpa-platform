import { redirect } from "next/navigation";

import { CostCentersScreen } from "@/frontend/screens/cost-centers/CostCentersScreen";

import { getCurrentUser } from "../get-current-user";

/**
 * `personel/page.tsx`teki düz tek satırlık re-export YETERLİ DEĞİL: o ekran
 * TAMAMEN ADMIN'e kapalıydı (nav filtresi + backend izniyle), bu ekran ise
 * TÜM rollere açık ama içindeki Onay Kuyruğu bölümü role göre koşullu
 * gösteriliyor (bkz. CostCentersScreen.tsx'teki CAN_APPROVE_ROLES). Bu yüzden
 * `layout.tsx`'in kullandığı AYNI `get-current-user.ts` kaçış kapısıyla
 * (`.tsx` dosyalarının `@/backend/*` import edememesi kuralını, ESLint sınır
 * kuralını ihlal etmeden aşan tek nokta) rolü buradan çözüp prop olarak geçiriyoruz.
 */
export default async function GiderMerkezleriPage() {
  const context = await getCurrentUser();
  if (!context) redirect("/giris");

  return <CostCentersScreen role={context.role} />;
}

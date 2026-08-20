import { redirect } from "next/navigation";

import { SalesScreen } from "@/frontend/screens/sales/SalesScreen";

import { getCurrentUser } from "../get-current-user";

/**
 * `sabit-kiymetler/page.tsx` ile AYNI gerekçe: TÜM rollere açık ama içindeki
 * bütçeye yazma bölümleri role göre koşullu gösteriliyor, bu yüzden
 * `get-current-user.ts` kaçış kapısıyla rolü buradan çözüp prop olarak geçiriyoruz.
 */
export default async function SatisPage() {
  const context = await getCurrentUser();
  if (!context) redirect("/giris");

  return <SalesScreen role={context.role} />;
}

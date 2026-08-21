import { redirect } from "next/navigation";

import { ReconciliationScreen } from "@/frontend/screens/treasury/ReconciliationScreen";

import { getCurrentUser } from "../../get-current-user";

// UX amaçlıdır — asıl yetki sınırı backend'deki `treasury-bank:write` ve
// `treasury-reconciliation:run` izinleridir (bkz. authorize.ts). Bu satırlar
// olmasa bile DATA_ENTRY ilgili uçlarda 403 alır.
const CAN_MANAGE_BANK_ROLES = ["ADMIN", "BUDGET_MANAGER"];
const CAN_RECONCILE_ROLES = ["ADMIN", "BUDGET_MANAGER"];

/**
 * `hazine/eslestirme/page.tsx` ile AYNI gerekçe: sayfa TÜM rollere açıktır
 * (okuma — `treasury:read` her rolde var), içindeki yazma bölümleri role göre
 * koşullu gösterilir.
 */
export default async function HazineMutabakatPage() {
  const context = await getCurrentUser();
  if (!context) redirect("/giris");

  return (
    <ReconciliationScreen
      canManageBank={CAN_MANAGE_BANK_ROLES.includes(context.role)}
      canReconcile={CAN_RECONCILE_ROLES.includes(context.role)}
    />
  );
}

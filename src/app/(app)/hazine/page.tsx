import { redirect } from "next/navigation";

import { TreasuryScreen } from "@/frontend/screens/treasury/TreasuryScreen";

import { getCurrentUser } from "../get-current-user";

// UX amaçlıdır — asıl yetki sınırı backend'deki `treasury-event:write` ve
// `treasury-simulation:run` izinleridir (bkz. authorize.ts). Bu satırlar
// olmasa bile ilgili uçlar 403 döner.
const CAN_EDIT_LEDGER_ROLES = ["ADMIN", "BUDGET_MANAGER", "DATA_ENTRY"];
const CAN_SIMULATE_ROLES = ["ADMIN", "BUDGET_MANAGER"];

/**
 * Hazine ana sayfası. TÜM rollere açıktır (`treasury:read` her rolde var);
 * defter düzenleme tüm rollerde, simülasyon paneli sadece ADMIN/Bütçe
 * Yöneticisi'nde görünür.
 */
export default async function HazinePage() {
  const context = await getCurrentUser();
  if (!context) redirect("/giris");

  return (
    <TreasuryScreen
      canEditLedger={CAN_EDIT_LEDGER_ROLES.includes(context.role)}
      canSimulate={CAN_SIMULATE_ROLES.includes(context.role)}
    />
  );
}

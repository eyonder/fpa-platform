import { redirect } from "next/navigation";

import { MappingScreen } from "@/frontend/screens/treasury/MappingScreen";

import { getCurrentUser } from "../../get-current-user";

// UX amaçlıdır — asıl yetki sınırı backend'de `treasury-mapping:write` izni
// (bkz. authorize.ts). Bu satır olmasa bile DATA_ENTRY /api/treasury/mappings
// POST/PATCH/DELETE ve /api/treasury/mappings/seed-defaults uçlarında 403 alır.
const CAN_MANAGE_MAPPINGS_ROLES = ["ADMIN", "BUDGET_MANAGER"];

/**
 * `sabit-kiymetler/page.tsx` ile AYNI gerekçe: TÜM rollere açık (okuma) ama
 * içindeki düzenleme/silme/içe aktarım bölümleri role göre koşullu
 * gösteriliyor, bu yüzden `get-current-user.ts` kaçış kapısıyla rolü buradan
 * çözüp prop olarak geçiriyoruz.
 */
export default async function HazineEslestirmePage() {
  const context = await getCurrentUser();
  if (!context) redirect("/giris");

  return (
    <MappingScreen
      canManageMappings={CAN_MANAGE_MAPPINGS_ROLES.includes(context.role)}
    />
  );
}

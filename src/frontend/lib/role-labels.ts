import type { Role } from "@/shared/types";

/** Görüntüleme etiketleri — backend/core/authorize.ts'teki karşılığıyla tutarlı tutun. */
export const ROLE_LABELS: Record<Role, string> = {
  ADMIN: "Admin",
  BUDGET_MANAGER: "Bütçe Yöneticisi",
  DATA_ENTRY: "Veri Giriş Uzmanı",
};

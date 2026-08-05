import type { Role } from "@/shared/types";

import { ForbiddenError } from "./errors";

/**
 * RBAC İZİN TABLOSU.
 *
 * Roller: ADMIN, BUDGET_MANAGER (Bütçe Yöneticisi), DATA_ENTRY (Veri Giriş Uzmanı).
 * İzinler tek bir yerde tanımlanır; route'lar SADECE `assertPermission` çağırır,
 * hiçbir yerde "if (role === 'ADMIN')" gibi dağınık kontrol OLMAZ — rol
 * eklendiğinde/değiştiğinde tek dokunacağınız yer burasıdır.
 */
export type Permission =
  /** Senaryo oluşturma. */
  | "scenario:manage"
  /** Senaryoyu kilitleme/kilit açma — bkz. Scenario.isLocked notu: bu, veri
   *  girişini "onaylama/kapatma" mekanizmasıdır. */
  | "scenario:lock"
  /** Bütçe hücrelerini yazma (manuel düzenleme, forecast/import commit). */
  | "budget-line:write"
  /** Büyüme oranlı forecast üretme (önizleme dahil). */
  | "forecast:run"
  /** Çok şirketli konsolidasyon raporu çalıştırma. */
  | "consolidation:run"
  /** Mizan/Muavin dosyası yükleme, eşleştirme, onaylama. */
  | "import:run"
  /** Denetim (audit) kaydını görüntüleme. */
  | "audit:read";

const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  ADMIN: [
    "scenario:manage",
    "scenario:lock",
    "budget-line:write",
    "forecast:run",
    "consolidation:run",
    "import:run",
    "audit:read",
  ],
  BUDGET_MANAGER: [
    "scenario:manage",
    "scenario:lock",
    "budget-line:write",
    "forecast:run",
    "consolidation:run",
    "import:run",
    "audit:read",
  ],
  // Veri Giriş Uzmanı: sadece veri girer (elle ya da dosyayla). Senaryo
  // yönetemez, kilit açamaz/kapatamaz, forecast/konsolidasyon çalıştıramaz,
  // denetim kaydını göremez (bu, Bütçe Yöneticisi/Admin'in gözetim aracıdır).
  DATA_ENTRY: ["budget-line:write", "import:run"],
};

export function hasPermission(role: Role, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role].includes(permission);
}

const PERMISSION_LABELS: Record<Permission, string> = {
  "scenario:manage": "senaryo yönetimi",
  "scenario:lock": "senaryo kilitleme/açma",
  "budget-line:write": "bütçe verisi girişi",
  "forecast:run": "forecast üretme",
  "consolidation:run": "konsolidasyon çalıştırma",
  "import:run": "dosya içe aktarma",
  "audit:read": "denetim kaydını görüntüleme",
};

const ROLE_LABELS: Record<Role, string> = {
  ADMIN: "Admin",
  BUDGET_MANAGER: "Bütçe Yöneticisi",
  DATA_ENTRY: "Veri Giriş Uzmanı",
};

/** Yetkisizse ForbiddenError fırlatır. Route handler'larda getRequestContext'ten hemen sonra çağrılır. */
export function assertPermission(role: Role, permission: Permission): void {
  if (!hasPermission(role, permission)) {
    throw new ForbiddenError(
      `${ROLE_LABELS[role]} rolü "${PERMISSION_LABELS[permission]}" işlemini yapamaz.`,
    );
  }
}

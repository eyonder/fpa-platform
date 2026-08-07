import type { Role } from "@/shared/types";

/**
 * `tenant.ts`'ten AYRI bir dosyada: hem `tenant.ts` (session cookie'den
 * çözer) hem `modules/auth/auth.service.ts` (session'dan aynı şekli üretir)
 * bu tipi kullanır. İkisi birbirini import etseydi döngüsel bağımlılık
 * oluşurdu; tip tek, nötr bir yerde yaşıyor.
 */
export interface RequestContext {
  tenantId: string;
  userId: string;
  userName: string;
  role: Role;
}

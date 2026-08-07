import { AsyncLocalStorage } from "node:async_hooks";

import { getGlobalStore } from "./global-store";
import type { RequestContext } from "./request-context";

/**
 * İstek bazlı tenant/kullanıcı bağlamını, senkron olmayan çağrı zinciri
 * boyunca (route handler → service → repository → Prisma) taşır. Bu,
 * `backend/core/prisma-client.ts`'teki Client Extension'ın hangi tenant için
 * `SET LOCAL app.current_tenant_id` çalıştıracağını bilmesini sağlar.
 *
 * ÖNEMLİ: `AsyncLocalStorage` örneği `getGlobalStore` ile sarmalanmıştır —
 * çıplak bir modül-seviyesi `new AsyncLocalStorage()` KULLANILMAMALIDIR. Bu
 * proje Turbopack'in Route Handler'lar ile Server Component'leri FARKLI modül
 * paketlerinde derlediği, gerçek ve yaşanmış bir hatayı zaten `global-store.ts`
 * ile çözdü (bkz. o dosyadaki yorum); sarmalanmamış bir ALS örneği aynı
 * hataya açıktır.
 *
 * ÖNEMLİ (deneyle doğrulanmış bir gotcha): `.enterWith()` İLK planda tercih
 * edilmişti (route dosyalarına hiç dokunmadan tek noktadan bağlam kurmak
 * için) ama izole testlerle şu kanıtlandı: bir async fonksiyon `enterWith`'i
 * çağırmadan ÖNCE herhangi bir `await` yapmışsa (ki `resolveSessionContext`
 * tam olarak bunu yapar — session/user/membership'i DB'den okumak için
 * await gerekir), `enterWith` sonrası kurulan bağlam SADECE o fonksiyonun
 * kendi senkron devamında görünür kalır; fonksiyonu ÇAĞIRANIN (`await
 * resolveSessionContext(...)` sonrası route handler'ın geri kalanı) bunu
 * ASLA göremediği tekrar tekrar doğrulandı. Bu yüzden `.run(context,
 * callback)` kullanılır — `callback` VE onun döndürdüğü her şey (iç içe
 * `await`ler dahil) baştan itibaren doğru bağlamda çalışır, önceki
 * `await`lerden etkilenmez.
 */
const tenantStorage = getGlobalStore(
  "tenant-context-als",
  () => new AsyncLocalStorage<RequestContext>(),
);

export const TenantContext = {
  /**
   * `callback`'i (ve onun `await` ettiği her şeyi) verilen bağlamda
   * çalıştırır. Çağıran, tenant'a bağlı işini (repository/Prisma çağrıları)
   * BUNUN İÇİNE almalıdır — bkz. `backend/core/tenant.ts`teki
   * `withTenantContext` (route handler'ların kullandığı sarmalayıcı).
   */
  run<T>(context: RequestContext, callback: () => Promise<T> | T): Promise<T> | T {
    return tenantStorage.run(context, callback);
  },

  /** Aktif bağlamı döner, yoksa `undefined` (örn. login öncesi). */
  get(): RequestContext | undefined {
    return tenantStorage.getStore();
  },
};

/**
 * Next.js dev sunucusunda (Turbopack) Route Handler'lar (`app/api/**\/route.ts`)
 * ve Server Component'ler (`app/**\/*.tsx`, ör. layout.tsx) FARKLI modül
 * paketlerinde (bundle) derlenebilir. Sonuç: bir dosyanın modül-seviyesi
 * state'i (`const store = new Map()`) her paket için AYRI AYRI oluşabilir —
 * bir route'ta yazılan veri, bir server component'te "yokmuş" gibi görünür.
 *
 * Bunu canlı olarak yaşadık: login route'u bir oturum yazıyordu, ama
 * (app)/layout.tsx'in server-side session kontrolü onu bulamıyordu — ikisi
 * session.repository.ts'in FARKLI kopyalarına bakıyordu.
 *
 * Çözüm: gerçekten TEK bir Node.js process'i içinde paylaşılan `globalThis`
 * üzerinde saklamak.
 *
 * GÜNCELLEME (PostgreSQL/Prisma geçişi sonrası): Bellek-içi repository'lerin
 * (users/sessions/scenarios/budget-lines/audit/imports) TAMAMI artık Prisma
 * kullanıyor, bu dosyayı KULLANMIYOR — mock veri katmanı olarak görevi
 * bitti. Ancak `getGlobalStore` yardımcı fonksiyonu HÂLÂ canlı ve gerekli:
 * aynı Turbopack dual-bundle riski, tek bir `PrismaClient` bağlantı havuzunu
 * (`backend/core/prisma-client.ts`) ve tek bir `AsyncLocalStorage` örneğini
 * (`backend/core/tenant-context.ts`) `globalThis` üzerinde gerçek birer
 * singleton olarak tutmak için de geçerli — bu yüzden dosya SİLİNMEDİ, genel
 * amaçlı bir "Turbopack-güvenli singleton" yardımcısına dönüştü.
 */
export function getGlobalStore<T>(key: string, create: () => T): T {
  const globalKey = `__fpa_store_${key}`;
  const globalRecord = globalThis as unknown as Record<string, T | undefined>;

  if (!globalRecord[globalKey]) {
    globalRecord[globalKey] = create();
  }

  return globalRecord[globalKey] as T;
}

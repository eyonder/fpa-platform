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
 * üzerinde saklamak. Bellek-içi repository'lerin HEPSİ bunu kullanır — bu,
 * gerçek bir veritabanına (Prisma) geçilince zaten anlamsızlaşacak, geçici
 * bir demo-katmanı önlemidir.
 */
export function getGlobalStore<T>(key: string, create: () => T): T {
  const globalKey = `__fpa_store_${key}`;
  const globalRecord = globalThis as unknown as Record<string, T | undefined>;

  if (!globalRecord[globalKey]) {
    globalRecord[globalKey] = create();
  }

  return globalRecord[globalKey] as T;
}

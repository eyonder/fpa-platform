import { AppError } from "./errors";

/**
 * Basit, bellek-içi kayan pencere (sliding window) hız sınırlayıcı.
 * Şu an sadece login/forgot-password gibi kimlik doğrulama uçlarında,
 * kaba kuvvet (brute force) denemesini zorlaştırmak için kullanılıyor.
 * Prisma/Redis'e geçilince bu, paylaşımlı (birden çok sunucu örneği
 * arasında tutarlı) bir sayaç deposuna dönüşür.
 */

interface Bucket {
  failures: number;
  firstFailureAt: number;
}

const WINDOW_MS = 15 * 60 * 1000; // 15 dakika
const MAX_ATTEMPTS = 5;

const buckets = new Map<string, Bucket>();

function getActiveBucket(key: string): Bucket | null {
  const bucket = buckets.get(key);
  if (!bucket) return null;
  if (Date.now() - bucket.firstFailureAt > WINDOW_MS) {
    buckets.delete(key);
    return null;
  }
  return bucket;
}

/** Çok fazla başarısız denemeyse 429 fırlatır. Başarılı/başarısız çağrılmadan ÖNCE kontrol edin. */
export function assertNotRateLimited(key: string): void {
  const bucket = getActiveBucket(key);
  if (!bucket || bucket.failures < MAX_ATTEMPTS) return;

  const remainingMs = WINDOW_MS - (Date.now() - bucket.firstFailureAt);
  const remainingMinutes = Math.max(1, Math.ceil(remainingMs / 60000));
  throw new AppError(
    "TOO_MANY_ATTEMPTS",
    `Çok fazla başarısız deneme. Lütfen ${remainingMinutes} dakika sonra tekrar deneyin.`,
    429,
  );
}

export function recordFailure(key: string): void {
  const bucket = getActiveBucket(key);
  if (!bucket) {
    buckets.set(key, { failures: 1, firstFailureAt: Date.now() });
  } else {
    bucket.failures += 1;
  }
}

export function recordSuccess(key: string): void {
  buckets.delete(key);
}

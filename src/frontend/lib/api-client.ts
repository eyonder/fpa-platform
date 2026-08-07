import type { ApiResponse } from "@/shared/types";

export class ApiError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly fields?: Record<string, string[]>,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

/**
 * Frontend'in backend ile konuştuğu TEK kapı.
 *
 * Bileşenlerin içine dağılmış `fetch` çağrıları yerine burayı kullanırız.
 * Yarın backend ayrı bir sunucuya (api.sirket.com) taşınırsa değişecek tek yer burasıdır.
 *
 * Kimlik artık httpOnly bir oturum ÇEREZİYLE taşınır (bkz. backend/core/tenant.ts) —
 * aynı-origin `fetch` istekleri çerezleri otomatik gönderdiği için burada
 * elle bir şey eklemeye gerek YOK (eskiden burada x-user-id/x-tenant-id
 * header'ları enjekte edilirdi; gerçek girişle birlikte kaldırıldı, çünkü
 * istemcinin kendi kimliğini header'la iddia etmesine izin vermek bir
 * yetki yükseltme açığıydı).
 */
const BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "/api";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  // FormData gövdesinde Content-Type'ı BİZ set etmemeliyiz — tarayıcı,
  // multipart sınırını (boundary) kendisi ekler; elle "application/json"
  // koyarsak dosya yükleme sunucuda parse edilemez.
  const isFormData = typeof FormData !== "undefined" && init?.body instanceof FormData;

  const response = await fetch(`${BASE_URL}${path}`, {
    ...init,
    headers: {
      ...(isFormData ? {} : { "Content-Type": "application/json" }),
      ...init?.headers,
    },
  });

  const payload = (await response.json()) as ApiResponse<T>;

  if (!payload.ok) {
    throw new ApiError(payload.error.code, payload.error.message, payload.error.fields);
  }

  return payload.data;
}

export const apiClient = {
  get: <T>(path: string, init?: RequestInit) => request<T>(path, init),
  post: <T>(path: string, body: unknown, init?: RequestInit) =>
    request<T>(path, { ...init, method: "POST", body: JSON.stringify(body) }),
  patch: <T>(path: string, body: unknown, init?: RequestInit) =>
    request<T>(path, { ...init, method: "PATCH", body: JSON.stringify(body) }),
  /** multipart/form-data gönderimi (dosya yükleme) için. */
  postForm: <T>(path: string, formData: FormData, init?: RequestInit) =>
    request<T>(path, { ...init, method: "POST", body: formData }),
};

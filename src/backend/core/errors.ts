/** Uygulama genelinde tek tip hata sınıfı. Route handler'lar bunu yakalar. */
export class AppError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status: number = 400,
    public readonly fields?: Record<string, string[]>,
  ) {
    super(message);
    this.name = "AppError";
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string) {
    super("NOT_FOUND", `${resource} bulunamadı.`, 404);
  }
}

export class ValidationError extends AppError {
  constructor(fields: Record<string, string[]>) {
    super("VALIDATION_FAILED", "Gönderilen veri geçersiz.", 422, fields);
  }
}

export class ForbiddenError extends AppError {
  constructor(message = "Bu kayda erişim yetkiniz yok.") {
    super("FORBIDDEN", message, 403);
  }
}

/** "Kimsin" bilinmiyor (401) — ForbiddenError'dan (403, "kimsin ama yetkin yok") farklı. */
export class UnauthorizedError extends AppError {
  constructor(message = "Oturum bulunamadı. Lütfen giriş yapın.") {
    super("UNAUTHORIZED", message, 401);
  }
}

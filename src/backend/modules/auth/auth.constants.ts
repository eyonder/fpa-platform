export const SESSION_COOKIE_NAME = "fpa_session";

/** Varsayılan oturum ömrü ("Beni hatırla" işaretlenmemişse). */
export const SESSION_TTL_MS = 12 * 60 * 60 * 1000; // 12 saat

/** "Beni hatırla" işaretlenmişse. */
export const SESSION_TTL_REMEMBER_MS = 30 * 24 * 60 * 60 * 1000; // 30 gün

/** Şifre sıfırlama bağlantısının geçerlilik süresi. */
export const PASSWORD_RESET_TTL_MS = 30 * 60 * 1000; // 30 dakika

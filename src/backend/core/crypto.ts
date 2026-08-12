import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

import { env } from "../config/env";

/**
 * AES-256-GCM simetrik şifreleme — SADECE TOTP MFA sırlarını (secret) DB'de
 * düz metin tutmamak için (bkz. mfa.service.ts). Anahtar `MFA_ENCRYPTION_KEY`
 * ortam değişkeninden (32 byte, base64) gelir, ASLA DB'de saklanmaz — bu
 * yüzden bir DB sızıntısı tek başına MFA sırlarını açığa çıkarmaz.
 *
 * Format: `<iv-base64>:<authTag-base64>:<ciphertext-base64>` — her şifreleme
 * kendi rastgele IV'sini üretir (GCM'de IV'nin tekrar etmemesi ZORUNLUDUR).
 */

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12; // GCM için önerilen (96 bit)

function getKey(): Buffer {
  const key = Buffer.from(env.MFA_ENCRYPTION_KEY, "base64");
  if (key.length !== 32) {
    throw new Error(
      `MFA_ENCRYPTION_KEY 32 byte olmalı (base64 çözümü sonrası), ${key.length} byte geldi.`,
    );
  }
  return key;
}

export function encrypt(plaintext: string): string {
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, getKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return `${iv.toString("base64")}:${authTag.toString("base64")}:${ciphertext.toString("base64")}`;
}

export function decrypt(payload: string): string {
  const [ivB64, authTagB64, ciphertextB64] = payload.split(":");
  if (!ivB64 || !authTagB64 || !ciphertextB64) {
    throw new Error("Geçersiz şifreli veri biçimi.");
  }

  const decipher = createDecipheriv(ALGORITHM, getKey(), Buffer.from(ivB64, "base64"));
  decipher.setAuthTag(Buffer.from(authTagB64, "base64"));

  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(ciphertextB64, "base64")),
    decipher.final(),
  ]);
  return plaintext.toString("utf8");
}

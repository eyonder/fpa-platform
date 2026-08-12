import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().email("Geçerli bir e-posta adresi girin."),
  password: z.string().min(1, "Şifre zorunludur."),
  rememberMe: z.boolean().optional().default(false),
});

export type LoginInput = z.infer<typeof loginSchema>;

export const forgotPasswordSchema = z.object({
  email: z.string().email("Geçerli bir e-posta adresi girin."),
});

export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;

export const resetPasswordSchema = z.object({
  token: z.string().min(1, "token zorunludur."),
  newPassword: z.string().min(8, "Şifre en az 8 karakter olmalı."),
});

export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;

export const mfaVerifySchema = z.object({
  challengeId: z.string().min(1, "challengeId zorunludur."),
  // TOTP (6 hane) veya yedek kod ("XXXXX-XXXXX") — servis katmanı ikisini de
  // dener, burada sadece boş olmadığı doğrulanır.
  code: z.string().min(1, "Kod zorunludur."),
  rememberMe: z.boolean().optional().default(false),
});

export type MfaVerifyInput = z.infer<typeof mfaVerifySchema>;

export const mfaEnrollConfirmSchema = z.object({
  code: z.string().min(1, "Kod zorunludur."),
});

export type MfaEnrollConfirmInput = z.infer<typeof mfaEnrollConfirmSchema>;

export const mfaDisableSchema = z.object({
  password: z.string().min(1, "Şifre zorunludur."),
});

export type MfaDisableInput = z.infer<typeof mfaDisableSchema>;

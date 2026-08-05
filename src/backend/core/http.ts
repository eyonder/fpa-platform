import { NextResponse } from "next/server";
import { ZodError } from "zod";

import type { ApiResponse } from "@/shared/types";

import { AppError } from "./errors";
import { logger } from "./logger";

export function ok<T>(data: T, status = 200) {
  return NextResponse.json<ApiResponse<T>>({ ok: true, data }, { status });
}

export function fail(
  code: string,
  message: string,
  status = 400,
  fields?: Record<string, string[]>,
) {
  return NextResponse.json<ApiResponse<never>>(
    { ok: false, error: { code, message, fields } },
    { status },
  );
}

/**
 * Route handler'ları sarmalar. İş katmanından gelen her hatayı
 * istemciye tek tip JSON olarak çevirir; iç detayları sızdırmaz.
 */
export function handleRoute<Args extends unknown[]>(
  fn: (...args: Args) => Promise<Response>,
) {
  return async (...args: Args): Promise<Response> => {
    try {
      return await fn(...args);
    } catch (error) {
      if (error instanceof ZodError) {
        const fields: Record<string, string[]> = {};
        for (const issue of error.issues) {
          const key = issue.path.join(".") || "_";
          (fields[key] ??= []).push(issue.message);
        }
        return fail("VALIDATION_FAILED", "Gönderilen veri geçersiz.", 422, fields);
      }

      if (error instanceof AppError) {
        return fail(error.code, error.message, error.status, error.fields);
      }

      logger.error("Beklenmeyen hata", error);
      return fail("INTERNAL_ERROR", "İşlem tamamlanamadı. Lütfen tekrar deneyin.", 500);
    }
  };
}

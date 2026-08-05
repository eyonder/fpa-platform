/** Tüm API uçlarının döndüğü tek tip zarf (envelope). */

export interface ApiSuccess<T> {
  ok: true;
  data: T;
}

export interface ApiFailure {
  ok: false;
  error: {
    code: string;
    message: string;
    /** Alan bazlı doğrulama hataları: { "fiscalYear": ["Zorunlu alan"] } */
    fields?: Record<string, string[]>;
  };
}

export type ApiResponse<T> = ApiSuccess<T> | ApiFailure;

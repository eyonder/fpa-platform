export const SUPPORTED_CURRENCIES = ["TRY", "USD", "EUR", "GBP", "AED"] as const;

export type Currency = (typeof SUPPORTED_CURRENCIES)[number];

/** Finansal tutarlarda ondalık hassasiyeti (DECIMAL(18,4) ile hizalı). */
export const AMOUNT_SCALE = 4;

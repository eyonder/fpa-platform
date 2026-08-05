import { z } from "zod";

export const generateForecastSchema = z.object({
  /** Tahminin geçmiş verisini okuyacağı ACTUAL senaryo. */
  actualScenarioId: z.string().min(1, "actualScenarioId zorunludur."),
  /** Sonucun yazılacağı (veya persist=false ise sadece hesaplanacağı) FORECAST senaryo. */
  forecastScenarioId: z.string().min(1, "forecastScenarioId zorunludur."),
  /** Gerçekleşenin bilindiği son ay (1-11); sonraki aylar projekte edilir. */
  asOfMonth: z.number().int().min(1).max(11),
  /** Boş bırakılırsa tüm kategoriler için üretilir. */
  categoryIds: z.array(z.string().min(1)).optional(),
  /** false ise sonucu forecastScenarioId'ye YAZMADAN sadece önizleme döner. */
  persist: z.boolean().optional().default(true),
});

export type GenerateForecastInput = z.infer<typeof generateForecastSchema>;

import { z } from "zod";

import { SUPPORTED_CURRENCIES } from "@/shared/constants/currency";

export const createScenarioSchema = z.object({
  name: z.string().min(3, "Senaryo adı en az 3 karakter olmalı."),
  kind: z.enum(["BUDGET", "ACTUAL", "FORECAST"]),
  fiscalYear: z
    .number()
    .int()
    .min(2000, "Mali yıl 2000'den küçük olamaz.")
    .max(2100, "Mali yıl 2100'den büyük olamaz."),
  baseCurrency: z.enum(SUPPORTED_CURRENCIES),
});

export type CreateScenarioInput = z.infer<typeof createScenarioSchema>;

export const listScenariosSchema = z.object({
  fiscalYear: z.coerce.number().int().optional(),
  kind: z.enum(["BUDGET", "ACTUAL", "FORECAST"]).optional(),
});

export type ListScenariosQuery = z.infer<typeof listScenariosSchema>;

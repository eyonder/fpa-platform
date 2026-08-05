import { z } from "zod";

export const listAuditLogsSchema = z.object({
  scenarioId: z.string().min(1).optional(),
});

export type ListAuditLogsQuery = z.infer<typeof listAuditLogsSchema>;

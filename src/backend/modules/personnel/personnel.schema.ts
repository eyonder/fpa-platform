import { z } from "zod";

const disabilityDegreeSchema = z.enum(["NONE", "DEGREE_1", "DEGREE_2", "DEGREE_3"]);
const dateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Tarih YYYY-MM-DD biçiminde olmalı.");

export const createEmployeeSchema = z.object({
  fullName: z.string().min(2, "Ad soyad en az 2 karakter olmalı."),
  position: z.string().min(1, "Unvan zorunludur."),
  department: z.string().optional(),
  hireDate: dateSchema,
  isRetired: z.boolean().optional().default(false),
  isConcierge: z.boolean().optional().default(false),
  disabilityDegree: disabilityDegreeSchema.optional().default("NONE"),
});

export type CreateEmployeeInput = z.infer<typeof createEmployeeSchema>;

export const updateEmployeeSchema = z.object({
  fullName: z.string().min(2).optional(),
  position: z.string().min(1).optional(),
  department: z.string().nullable().optional(),
  isRetired: z.boolean().optional(),
  isConcierge: z.boolean().optional(),
  disabilityDegree: disabilityDegreeSchema.optional(),
  isActive: z.boolean().optional(),
  terminationDate: dateSchema.nullable().optional(),
});

export type UpdateEmployeeInput = z.infer<typeof updateEmployeeSchema>;

export const createCompensationSchema = z.object({
  effectiveFrom: dateSchema,
  inputMode: z.enum(["GROSS_FIXED", "NET_FIXED"]),
  amount: z.number().positive("Tutar 0'dan büyük olmalı."),
  mealAllowanceDays: z.number().int().min(0).max(31).optional().default(0),
  transportAllowanceDays: z.number().int().min(0).max(31).optional().default(0),
  plannedOvertimeHoursPerMonth: z.number().min(0).max(300).optional().default(0),
  applyEmployerIncentive: z.boolean().optional().default(false),
});

export type CreateCompensationInput = z.infer<typeof createCompensationSchema>;

export const payrollRunSchema = z.object({
  scenarioId: z.string().min(1, "scenarioId zorunludur."),
});

export type PayrollRunInput = z.infer<typeof payrollRunSchema>;

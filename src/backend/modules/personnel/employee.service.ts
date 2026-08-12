import { AppError, NotFoundError } from "@/backend/core/errors";
import type {
  CreateCompensationInput,
  CreateEmployeeInput,
  Employee,
  EmployeeCompensation,
} from "@/shared/types";

import { compensationRepository } from "./compensation.repository";
import type { UpdateEmployeeInput } from "./employee.repository";
import { employeeRepository } from "./employee.repository";

/**
 * İŞ MANTIĞI KATMANI (Service).
 *
 * Kural: Bu dosya HTTP'yi, Next.js'i veya React'i bilmez. Sadece iş kurallarını bilir.
 */
export const employeeService = {
  async list(tenantId: string): Promise<Employee[]> {
    return employeeRepository.findMany(tenantId);
  },

  async get(tenantId: string, id: string): Promise<Employee> {
    const employee = await employeeRepository.findById(tenantId, id);
    if (!employee) throw new NotFoundError("Personel");
    return employee;
  },

  async create(tenantId: string, input: CreateEmployeeInput): Promise<Employee> {
    return employeeRepository.create(tenantId, input);
  },

  async update(
    tenantId: string,
    id: string,
    input: UpdateEmployeeInput,
  ): Promise<Employee> {
    if (input.terminationDate) {
      const employee = await this.get(tenantId, id);
      if (input.terminationDate < employee.hireDate) {
        throw new AppError(
          "INVALID_TERMINATION_DATE",
          "İşten çıkış tarihi işe giriş tarihinden önce olamaz.",
          422,
        );
      }
    }

    const updated = await employeeRepository.update(tenantId, id, input);
    if (!updated) throw new NotFoundError("Personel");
    return updated;
  },

  async listCompensations(
    tenantId: string,
    employeeId: string,
  ): Promise<EmployeeCompensation[]> {
    await this.get(tenantId, employeeId); // yoksa 404
    return compensationRepository.findByEmployee(tenantId, employeeId);
  },

  async addCompensation(
    tenantId: string,
    employeeId: string,
    input: CreateCompensationInput,
  ): Promise<EmployeeCompensation> {
    await this.get(tenantId, employeeId);
    if (input.amount <= 0) {
      throw new AppError(
        "INVALID_COMPENSATION_AMOUNT",
        "Tutar 0'dan büyük olmalı.",
        422,
      );
    }
    return compensationRepository.create(tenantId, employeeId, input);
  },
};

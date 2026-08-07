import { prisma } from "@/backend/core/prisma-client";
import type { Organization } from "@/shared/types";
import type { Tenant } from "@prisma/client";

/**
 * VERİ ERİŞİM KATMANI (Repository) — Prisma/PostgreSQL.
 *
 * ÖNEMLİ: Bu uygulamada `Organization.id`, aynı zamanda o şirketin
 * `Scenario.tenantId` değeridir — yani her alt şirket kendi tenant'ıdır
 * (kendi Scenario/BudgetLine kayıtları). Bu yüzden ayrı bir "Organization"
 * tablosu YOK — `prisma/schema.prisma`'daki `Tenant` modeli bu domain
 * tipinin karşılığıdır (`parentTenantId` ↔ `parentOrganizationId`).
 * `Tenant` RLS'e TABİ DEĞİLDİR (holding ağacının ve login'in tenant
 * bilinmeden ÖNCE gezilebilmesi gerekir).
 *
 * Konsolidasyon, holding'in KENDİ isteğiyle tenant sınırlarını bilinçli
 * biçimde aşan tek yerdir — bkz. `consolidation.service.ts`'teki yetki
 * kontrolü ve `backend/core/prisma-client.ts`'teki `prismaBypassRls`.
 */

function toOrganization(tenant: Tenant): Organization {
  return {
    id: tenant.id,
    name: tenant.name,
    parentOrganizationId: tenant.parentTenantId,
    baseCurrency: tenant.baseCurrency,
  };
}

export const organizationRepository = {
  async findById(id: string): Promise<Organization | null> {
    const tenant = await prisma.tenant.findUnique({ where: { id } });
    return tenant ? toOrganization(tenant) : null;
  },

  /** Sadece bir alt kademe (doğrudan çocuklar). */
  async findChildren(parentOrganizationId: string): Promise<Organization[]> {
    const tenants = await prisma.tenant.findMany({
      where: { parentTenantId: parentOrganizationId },
    });
    return tenants.map(toOrganization);
  },

  /** Tüm alt ağaç (çocuklar + torunlar + ...), çok kademeli holdingler için. */
  async findDescendants(parentOrganizationId: string): Promise<Organization[]> {
    const result: Organization[] = [];
    const queue = [parentOrganizationId];

    while (queue.length > 0) {
      const currentId = queue.shift()!;
      const children = await prisma.tenant.findMany({
        where: { parentTenantId: currentId },
      });
      for (const child of children) {
        result.push(toOrganization(child));
        queue.push(child.id);
      }
    }

    return result;
  },
};

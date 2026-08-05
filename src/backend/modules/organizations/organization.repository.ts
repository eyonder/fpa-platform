import type { Organization } from "@/shared/types";

/**
 * VERİ ERİŞİM KATMANI (Repository).
 *
 * Şu an bellekte sahte veri döner (bkz. scenario.repository.ts'teki not).
 *
 * ÖNEMLİ: Burada `Organization.id`, aynı zamanda o şirketin `Scenario.tenantId`
 * değeridir — yani her alt şirket kendi tenant'ıdır (kendi Scenario/BudgetLine
 * kayıtları). Konsolidasyon, holding'in KENDİ isteğiyle bu tenant sınırlarını
 * bilinçli biçimde aşan tek yerdir (bkz. consolidation.service.ts'teki yetki
 * kontrolü). Prisma + RLS'e geçilince bu, holding tenant'ının alt org'ları
 * için tanımlı bir view/policy'ye karşılık gelir.
 */

const ORGANIZATIONS: Organization[] = [
  {
    id: "org-holding",
    name: "Acme Holding A.Ş.",
    parentOrganizationId: null,
    baseCurrency: "TRY",
  },
  {
    id: "org-tr",
    name: "Acme Türkiye A.Ş.",
    parentOrganizationId: "org-holding",
    baseCurrency: "TRY",
  },
  {
    id: "org-de",
    name: "Acme Deutschland GmbH",
    parentOrganizationId: "org-holding",
    baseCurrency: "EUR",
  },
  {
    id: "org-us",
    name: "Acme USA Inc.",
    parentOrganizationId: "org-holding",
    baseCurrency: "USD",
  },
];

const store = new Map<string, Organization>(ORGANIZATIONS.map((o) => [o.id, o]));

export const organizationRepository = {
  async findById(id: string): Promise<Organization | null> {
    return store.get(id) ?? null;
  },

  /** Sadece bir alt kademe (doğrudan çocuklar). */
  async findChildren(parentOrganizationId: string): Promise<Organization[]> {
    return [...store.values()].filter(
      (o) => o.parentOrganizationId === parentOrganizationId,
    );
  },

  /** Tüm alt ağaç (çocuklar + torunlar + ...), çok kademeli holdingler için. */
  async findDescendants(parentOrganizationId: string): Promise<Organization[]> {
    const result: Organization[] = [];
    const queue = [parentOrganizationId];

    while (queue.length > 0) {
      const currentId = queue.shift()!;
      const children = [...store.values()].filter(
        (o) => o.parentOrganizationId === currentId,
      );
      for (const child of children) {
        result.push(child);
        queue.push(child.id);
      }
    }

    return result;
  },
};

import { handleRoute, ok } from "@/backend/core/http";
import { withTenantContext } from "@/backend/core/tenant";
import { budgetLineRepository } from "@/backend/modules/budget-lines/budget-line.repository";

/**
 * İNCE CONTROLLER.
 * GET /api/budget-categories — küresel bütçe kategori listesi (RLS yok).
 * `vuk-amortisman-config/route.ts` ile AYNI gerekçe: bir seçim listesini
 * (THP eşleştirme kuralı formu, bkz. MappingScreen.tsx) doldurmak için
 * bilerek bir GET route eklendi — daha önce sadece `BudgetSheet`in bir
 * parçası olarak (bir senaryo bağlamında) geliyordu, bu ekranın senaryodan
 * BAĞIMSIZ bir kategori listesine ihtiyacı var.
 */
export const GET = handleRoute((request: Request) =>
  withTenantContext(request, async () => {
    return ok(await budgetLineRepository.findCategories());
  }),
);

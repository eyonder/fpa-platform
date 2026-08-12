"use client";

import { Card } from "@/frontend/components/ui/Card";
import { useExpenseAllocationReport } from "@/frontend/hooks/useExpenseAllocationReport";
import { formatAmount } from "@/frontend/lib/format";
import type { BudgetCategory, CostCenter } from "@/shared/types";

/**
 * Salt okunur: sadece BÜTÇEYE YAZILMIŞ (COMMITTED) gider kayıtlarının, tahsis
 * anahtarları uygulandıktan sonra gider merkezleri arasındaki dağılımını
 * gösterir. Bu, "Onay Kuyruğu"ndaki "Bütçeye Yaz" adımıyla yazılan
 * kategori/ay TOPLAMINI DEĞİŞTİRMEZ — sadece o toplamın hangi gider
 * merkezine ne kadar İÇ YÜK olarak atfedildiğini gösterir (bkz.
 * expense-allocation.ts'teki tasarım notu).
 */
export function ExpenseAllocationReportPanel({
  scenarioId,
  costCenters,
  categories,
}: {
  scenarioId: string;
  costCenters: CostCenter[];
  categories: BudgetCategory[];
}) {
  const { state } = useExpenseAllocationReport(scenarioId);
  const costCenterById = new Map(costCenters.map((cc) => [cc.id, cc]));
  const categoryById = new Map(categories.map((c) => [c.id, c]));

  return (
    <Card
      title="Tahsis Raporu"
      hint="Sadece bütçeye yazılmış kayıtlar — kategori/ay toplamını değiştirmez, sadece iç dağılımı gösterir."
    >
      {state.status === "loading" ? (
        <p className="text-sm text-muted">Yükleniyor…</p>
      ) : null}
      {state.status === "error" ? (
        <p className="text-sm text-brick">{state.message}</p>
      ) : null}

      {state.status === "ready" ? (
        state.rows.length === 0 ? (
          <p className="text-sm text-muted">
            Henüz bütçeye yazılmış gider kaydı yok — Onay Kuyruğu&apos;ndan
            &quot;Bütçeye Yaz&quot; adımı sonrası burada görünür.
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-rule text-left text-xs text-muted">
                <th className="py-2 pr-3">Gider Merkezi</th>
                <th className="py-2 pr-3">Gider Türü</th>
                <th className="py-2 pr-3">Ay</th>
                <th className="py-2 pr-3">Tutar</th>
              </tr>
            </thead>
            <tbody>
              {state.rows.map((row, i) => (
                <tr key={i} className="tabular border-b border-rule last:border-0">
                  <td className="py-2 pr-3">
                    {costCenterById.get(row.costCenterId)?.name ?? row.costCenterId}
                  </td>
                  <td className="py-2 pr-3">
                    {categoryById.get(row.categoryId)?.name ?? row.categoryId}
                  </td>
                  <td className="py-2 pr-3">{row.month}</td>
                  <td className="py-2 pr-3">{formatAmount(row.amount, "TRY")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )
      ) : null}
    </Card>
  );
}

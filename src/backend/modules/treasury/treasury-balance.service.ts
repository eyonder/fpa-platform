import { NotFoundError } from "@/backend/core/errors";
import { scenarioRepository } from "@/backend/modules/scenarios/scenario.repository";
import { fromMinorUnits, toMinorUnits } from "@/shared/lib/money";
import type {
  BankTransactionEntry,
  CashFlowEvent,
  TreasuryPosition,
  TreasuryPositionDay,
  UnreconciledOverdue,
} from "@/shared/types";

import { bankBalanceRepository } from "./bank-balance.repository";
import { bankTransactionRepository } from "./bank-transaction.repository";
import { cashFlowEventRepository } from "./cash-flow-event.repository";
import { addDays, dateRange, todayIso } from "./treasury.dates";

/**
 * İŞ MANTIĞI KATMANI (Service) — NAKİT POZİSYONU.
 *
 * Faz 4.3 kapsamı: SADECE KALICI veriden (top bakiye + gerçek banka
 * hareketleri + PLANNED nakit olayları) türetilen bakiye eğrisi.
 * Satış/Capex/Bordro'dan TÜRETİLEN satırlar ve what-if simülasyonu Faz
 * 4.4'ün konusudur — bu servis onların da üzerine kurulacağı ÇEKİRDEK
 * formüldür.
 *
 * FORMÜL (plan §3.2):
 *   B0 = asOfDate <= startDate olan EN GÜNCEL BankBalance
 *   openingBalance = B0 + Σ BankTransaction(B0.asOfDate < valueDate <= startDate)
 *   closingBalance(d) = openingBalance
 *                     + Σ BankTransaction(startDate < valueDate <= d)
 *                     + Σ CashFlowEvent PLANNED(startDate < dueDate <= d)
 *
 * ÜÇ KURAL, üçü de kasıtlı:
 *  1. SADECE B0'dan SONRAKİ banka hareketleri sayılır — elle girilen top
 *     bakiye kendi gününe kadar olan her şeyi ZATEN içerir; öncekileri de
 *     saymak ÇİFT SAYMAKTIR.
 *  2. NEUTRALIZED olaylar tahmin toplamından ÇIKARILIR, çünkü karşılıkları
 *     artık gerçek banka toplamındadır. MEKANİZMANIN TAMAMI BUDUR.
 *     CANCELLED olaylar ise HİÇBİR toplama girmez.
 *  3. Vadesi `startDate`ten ÖNCE olup hâlâ PLANNED olan olaylar SESSİZCE
 *     DÜŞÜRÜLMEZ — ayrı bir `unreconciledOverdue` kovasında döner. Sessizce
 *     düşürmek, bir tahmini yavaşça iyimserleştirmenin en kolay yoludur.
 *
 * Tüm ara aritmetik KURUŞ (integer) üzerinden yapılır — 90 günlük kümülatif
 * toplamda float kayması gerçek bir risktir (bkz. shared/lib/money.ts).
 */

const DEFAULT_HORIZON_DAYS = 90;

export const treasuryBalanceService = {
  async position(
    tenantId: string,
    query: { scenarioId: string; startDate?: string; days?: number },
  ): Promise<TreasuryPosition> {
    const scenario = await scenarioRepository.findById(tenantId, query.scenarioId);
    if (!scenario) throw new NotFoundError("Senaryo");

    const startDate = query.startDate ?? todayIso();
    const horizon = query.days ?? DEFAULT_HORIZON_DAYS;
    // Pencere startDate'in ERTESİ gününde başlar (startDate'in kendisi açılış
    // bakiyesine dahildir), bu yüzden son gün startDate + horizon'dur.
    const endDate = addDays(startDate, horizon);

    const [anchor, transactions, plannedEvents] = await Promise.all([
      bankBalanceRepository.findAnchor(tenantId, startDate),
      // Çıpadan itibaren pencerenin sonuna kadar TÜM hareketler gerekir:
      // çıpa ile startDate arası açılış bakiyesini, sonrası günlük eğriyi kurar.
      bankTransactionRepository.findMany(tenantId, { toDate: endDate }),
      cashFlowEventRepository.findPlanned(tenantId, query.scenarioId),
    ]);

    const anchorDate = anchor?.asOfDate ?? null;
    const anchorMinor = anchor ? toMinorUnits(anchor.balance) : 0;

    // --- AÇILIŞ: çıpa + (çıpa < valör <= startDate) ---
    let openingMinor = anchorMinor;
    for (const txn of transactions) {
      if (anchorDate !== null && txn.valueDate <= anchorDate) continue; // kural 1
      if (txn.valueDate > startDate) continue;
      openingMinor += signedMinor(txn);
    }

    // --- GÜNLÜK KOVALAR: startDate < d <= endDate ---
    const bankByDay = new Map<string, number>();
    for (const txn of transactions) {
      if (anchorDate !== null && txn.valueDate <= anchorDate) continue;
      if (txn.valueDate <= startDate || txn.valueDate > endDate) continue;
      bankByDay.set(
        txn.valueDate,
        (bankByDay.get(txn.valueDate) ?? 0) + signedMinor(txn),
      );
    }

    const plannedByDay = new Map<string, number>();
    const overdue: UnreconciledOverdue = { count: 0, inflowTotal: 0, outflowTotal: 0 };
    let overdueInflowMinor = 0;
    let overdueOutflowMinor = 0;

    for (const event of plannedEvents) {
      if (event.dueDate <= startDate) {
        // kural 3 — gün-0 toplamına KATILMAZ, ayrı kovada raporlanır.
        overdue.count++;
        if (event.direction === "INFLOW")
          overdueInflowMinor += toMinorUnits(event.amount);
        else overdueOutflowMinor += toMinorUnits(event.amount);
        continue;
      }
      if (event.dueDate > endDate) continue;
      plannedByDay.set(
        event.dueDate,
        (plannedByDay.get(event.dueDate) ?? 0) + signedEventMinor(event),
      );
    }

    overdue.inflowTotal = fromMinorUnits(overdueInflowMinor);
    overdue.outflowTotal = fromMinorUnits(overdueOutflowMinor);

    let runningMinor = openingMinor;
    const days: TreasuryPositionDay[] = [];

    for (const date of dateRange(addDays(startDate, 1), horizon)) {
      const bankMinor = bankByDay.get(date) ?? 0;
      const plannedMinor = plannedByDay.get(date) ?? 0;
      runningMinor += bankMinor + plannedMinor;
      days.push({
        date,
        bankActualNet: fromMinorUnits(bankMinor),
        plannedNet: fromMinorUnits(plannedMinor),
        closingBalance: fromMinorUnits(runningMinor),
      });
    }

    const firstNegativeDate = days.find((d) => d.closingBalance < 0)?.date ?? null;

    return {
      scenarioId: query.scenarioId,
      startDate,
      endDate,
      anchor: anchor ? { asOfDate: anchor.asOfDate, balance: anchor.balance } : null,
      openingBalance: fromMinorUnits(openingMinor),
      days,
      unreconciledOverdue: overdue,
      firstNegativeDate,
    };
  },
};

function signedMinor(transaction: BankTransactionEntry): number {
  const minor = toMinorUnits(transaction.amount);
  return transaction.direction === "INFLOW" ? minor : -minor;
}

function signedEventMinor(event: CashFlowEvent): number {
  const minor = toMinorUnits(event.amount);
  return event.direction === "INFLOW" ? minor : -minor;
}

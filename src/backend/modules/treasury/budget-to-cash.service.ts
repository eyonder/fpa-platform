import { AppError, NotFoundError } from "@/backend/core/errors";
import { withTenantTransaction } from "@/backend/core/prisma-client";
import type { RequestContext } from "@/backend/core/tenant";
import { budgetLineRepository } from "@/backend/modules/budget-lines/budget-line.repository";
import { scenarioRepository } from "@/backend/modules/scenarios/scenario.repository";

import { rollForwardOffWeekend } from "./treasury-derivations";
import { addDays } from "./treasury.dates";

/**
 * İŞ MANTIĞI KATMANI (Service) — TAHAKKUK -> NAKİT ÜRETİMİ.
 *
 * Kural: Bu dosya HTTP'yi, Next.js'i veya React'i bilmez.
 *
 * NEDEN VAR: `BudgetLine` AY bazlı ve TAHAKKUK esaslıdır; nakit defteri GÜN
 * bazlı ve NAKİT esaslıdır. Gerçek bir şirketin bütçesi sisteme yüklendiğinde
 * (156 hesap × 12 ay) nakit defteri BOŞ kalıyordu — projeksiyonun üzerine
 * çalışacağı hiçbir yükümlülük yoktu. Bu servis o boşluğu, AÇIKÇA BEYAN
 * EDİLMİŞ bir ödeme vadesi konvansiyonuyla doldurur.
 *
 * KONVANSİYON (varsayılan, çağıran değiştirebilir): bir ayın tahakkuku ayın
 * SON GÜNÜNDE faturalanmış sayılır ve
 *   - GELİR  hesapları  +45 gün sonra TAHSİL edilir (tipik AR vadesi)
 *   - GİDER  hesapları  +30 gün sonra ÖDENİR      (tipik AP vadesi)
 * Hafta sonuna denk gelen gün bir sonraki iş gününe kaydırılır (resmî tatil
 * takvimi MODELLENMEMİŞTİR — bkz. treasury-derivations.ts'teki aynı not).
 *
 * BU BİR TAHMİNDİR, GERÇEK VADE DEĞİLDİR. Gerçek vadeler THP içe aktarımından
 * (120/320 hesaplarının kendi vade tarihleriyle) gelir; bu servis o veri
 * yokken makul bir başlangıç noktası üretir ve ürettiği her satır
 * `BUDGET_DERIVED` olarak işaretlenir — kullanıcı tek tek düzenleyebilir.
 *
 * YENİDEN ÜRETİLEBİLİR: sadece `BUDGET_DERIVED` satırları silinip yeniden
 * yazılır; elle girilmiş (MANUAL) ve içe aktarılmış (THP_IMPORT) satırlara
 * DOKUNULMAZ. Aksi halde kullanıcının elle düzelttiği her şey ikinci
 * çalıştırmada sessizce yok olurdu.
 */

export const DEFAULT_REVENUE_TERM_DAYS = 45;
export const DEFAULT_EXPENSE_TERM_DAYS = 30;

export interface GenerateFromBudgetInput {
  /** Nakit olaylarının YAZILACAĞI senaryo. */
  scenarioId: string;
  /** Tahakkukun OKUNACAĞI senaryo — verilmezse aynı senaryo. */
  sourceScenarioId?: string;
  revenueTermDays?: number;
  expenseTermDays?: number;
}

export interface GenerateFromBudgetResult {
  created: number;
  replaced: number;
  skippedZero: number;
  revenueTermDays: number;
  expenseTermDays: number;
  warnings: string[];
}

/** Ayın son günü (YYYY-MM-DD) — tahakkukun fatura günü kabul edilir. */
function monthEnd(fiscalYear: number, month: number): string {
  // Bir sonraki ayın 1'inden bir gün geri: ay uzunluğu/artık yıl elle
  // hesaplanmaz (Şubat tuzağı).
  const nextMonth = month === 12 ? 1 : month + 1;
  const nextYear = month === 12 ? fiscalYear + 1 : fiscalYear;
  const firstOfNext = `${nextYear}-${String(nextMonth).padStart(2, "0")}-01`;
  return addDays(firstOfNext, -1);
}

export const budgetToCashService = {
  async generate(
    context: RequestContext,
    input: GenerateFromBudgetInput,
  ): Promise<GenerateFromBudgetResult> {
    const revenueTermDays = input.revenueTermDays ?? DEFAULT_REVENUE_TERM_DAYS;
    const expenseTermDays = input.expenseTermDays ?? DEFAULT_EXPENSE_TERM_DAYS;
    const sourceScenarioId = input.sourceScenarioId ?? input.scenarioId;

    const [target, source] = await Promise.all([
      scenarioRepository.findById(context.tenantId, input.scenarioId),
      scenarioRepository.findById(context.tenantId, sourceScenarioId),
    ]);
    if (!target) throw new NotFoundError("Hedef senaryo");
    if (!source) throw new NotFoundError("Kaynak senaryo");
    if (target.isLocked) {
      throw new AppError(
        "SCENARIO_LOCKED",
        `"${target.name}" kilitli. Nakit defteri üretmeden önce kilidini açın.`,
        409,
      );
    }

    const [categories, lines] = await Promise.all([
      budgetLineRepository.findCategories(context.tenantId),
      budgetLineRepository.findByScenario(sourceScenarioId),
    ]);
    const categoryById = new Map(categories.map((c) => [c.id, c]));

    const warnings: string[] = [];
    if (target.baseCurrency !== source.baseCurrency) {
      warnings.push(
        `Kaynak senaryo ${source.baseCurrency}, hedef senaryo ` +
          `${target.baseCurrency}. Tutarlar ÇEVRİLMEDEN kopyalandı — iki ` +
          `senaryoyu aynı para birimine getirin ya da sonucu kontrol edin.`,
      );
    }

    let skippedZero = 0;
    const rows: Array<{
      dueDate: string;
      direction: "INFLOW" | "OUTFLOW";
      amount: number;
      categoryId: string;
      accrualStartMonth: number;
      description: string;
    }> = [];

    for (const line of lines) {
      if (line.amount === 0) {
        skippedZero++;
        continue;
      }
      const category = categoryById.get(line.categoryId);
      if (!category) continue;

      const isIncome = category.type === "INCOME";
      const term = isIncome ? revenueTermDays : expenseTermDays;

      // NEGATİF tutar, kendi grubunun TERSİ yönde nakit demektir (ör. satış
      // iskontosu bir gelir hesabında eksi durur -> nakit ÇIKIŞI). İşaret
      // yutulup mutlak değer alınsaydı iskonto gelir gibi görünürdü.
      const positive = line.amount > 0;
      const direction: "INFLOW" | "OUTFLOW" =
        isIncome === positive ? "INFLOW" : "OUTFLOW";

      rows.push({
        dueDate: rollForwardOffWeekend(
          addDays(monthEnd(source.fiscalYear, line.month), term),
        ),
        direction,
        amount: Math.abs(line.amount),
        categoryId: line.categoryId,
        accrualStartMonth: line.month,
        description: `${category.name} — ${source.fiscalYear}/${String(line.month).padStart(2, "0")} tahakkuku (+${term} gün)`,
      });
    }

    const { created, replaced } = await withTenantTransaction(
      context.tenantId,
      async (tx) => {
        // SADECE üretilmiş satırlar silinir — elle girilmiş/içe aktarılmış
        // satırlar korunur (bkz. dosya başı notu).
        const removed = await tx.cashFlowEvent.deleteMany({
          where: {
            tenantId: context.tenantId,
            scenarioId: input.scenarioId,
            source: "BUDGET_DERIVED",
          },
        });

        if (rows.length > 0) {
          await tx.cashFlowEvent.createMany({
            data: rows.map((r) => ({
              id: crypto.randomUUID(),
              tenantId: context.tenantId,
              scenarioId: input.scenarioId,
              dueDate: new Date(r.dueDate),
              direction: r.direction,
              amountMinor: BigInt(Math.round(r.amount * 100)),
              status: "PLANNED" as const,
              source: "BUDGET_DERIVED" as const,
              categoryId: r.categoryId,
              description: r.description,
              // Tahakkuk katmanına YUMUŞAK referans (FK YOK) — bu alanlar tam
              // bu iş için var (bkz. prisma/schema.prisma 14. bölüm notu).
              accrualScenarioId: sourceScenarioId,
              accrualStartMonth: r.accrualStartMonth,
              createdByUserId: context.userId,
            })),
          });
        }

        return { created: rows.length, replaced: removed.count };
      },
    );

    return {
      created,
      replaced,
      skippedZero,
      revenueTermDays,
      expenseTermDays,
      warnings,
    };
  },
};

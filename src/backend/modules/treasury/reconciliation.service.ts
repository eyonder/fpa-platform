import { AppError, NotFoundError } from "@/backend/core/errors";
import { withTenantTransaction } from "@/backend/core/prisma-client";
import type { RequestContext } from "@/backend/core/tenant";
import { scenarioRepository } from "@/backend/modules/scenarios/scenario.repository";
import type {
  BankTransactionEntry,
  CashFlowEvent,
  ReconciliationSuggestions,
  TransactionSuggestion,
} from "@/shared/types";

import { bankTransactionRepository } from "./bank-transaction.repository";
import { cashFlowEventRepository } from "./cash-flow-event.repository";
import {
  DEFAULT_AMOUNT_TOLERANCE_PCT,
  DEFAULT_DATE_WINDOW_DAYS,
  suggestMatches,
} from "./reconciliation.matcher";
import type { MatchableEvent, MatchableTransaction } from "./reconciliation.matcher";
import type {
  ConfirmMatchesInput,
  PromoteTransactionInput,
  ReconciliationSuggestionsQuery,
  UnmatchInput,
} from "./treasury.schema";
import { addDays } from "./treasury.dates";

/**
 * İŞ MANTIĞI KATMANI (Service) — MUTABAKAT & NÖTRLEME.
 *
 * Kural: Bu dosya HTTP'yi, Next.js'i veya React'i bilmez. Sadece iş kurallarını bilir.
 *
 * NÖTRLEME NEDİR: bir tahmin (`CashFlowEvent`, PLANNED) gerçek bir banka
 * hareketiyle eşleştiğinde `NEUTRALIZED` olur ve projeksiyonun TAHMİN
 * toplamından ÇIKAR — çünkü aynı para artık GERÇEK toplamda (BankTransaction)
 * sayılmaktadır. Tüm mekanizma budur (bkz. treasury-balance.service.ts).
 *
 * Puanlama/aday seçimi SAF `reconciliation.matcher.ts`tedir; bu dosya
 * yalnızca veri toplar ve YAZMA işlemlerinin bütünlüğünü korur.
 */
export const reconciliationService = {
  /** ÖNERİR — hiçbir şey yazmaz, hiçbir güven seviyesinde otomatik onay yok. */
  async suggestions(
    tenantId: string,
    query: ReconciliationSuggestionsQuery,
  ): Promise<ReconciliationSuggestions> {
    const scenario = await scenarioRepository.findById(tenantId, query.scenarioId);
    if (!scenario) throw new NotFoundError("Senaryo");

    const dateWindowDays = query.dateWindowDays ?? DEFAULT_DATE_WINDOW_DAYS;
    const amountTolerancePct = query.amountTolerancePct ?? DEFAULT_AMOUNT_TOLERANCE_PCT;

    const transactions = await bankTransactionRepository.findMany(tenantId, {
      fromDate: query.fromDate,
      toDate: query.toDate,
      onlyUnmatched: true,
    });

    if (transactions.length === 0) {
      return {
        scenarioId: query.scenarioId,
        dateWindowDays,
        amountTolerancePct,
        suggestions: [],
      };
    }

    // Aday tahmin aralığı, hareketlerin valör aralığından eşleşme penceresi
    // kadar GENİŞ olmalı — aksi halde sınırdaki bir hareket (ilk günün 5 gün
    // öncesine denk gelen bir vade) hiç aday bulamazdı.
    const valueDates = transactions.map((t) => t.valueDate).sort();
    const events = await cashFlowEventRepository.findMatchCandidates(
      tenantId,
      query.scenarioId,
      addDays(valueDates[0], -dateWindowDays),
      addDays(valueDates[valueDates.length - 1], dateWindowDays),
    );

    const matchable = events.map(toMatchableEvent);
    const raw = suggestMatches(transactions.map(toMatchableTransaction), matchable, {
      dateWindowDays,
      amountTolerancePct,
    });

    const byId = new Map(transactions.map((t) => [t.id, t]));
    const suggestions: TransactionSuggestion[] = raw.map((entry) => ({
      bankTransactionId: entry.bankTransactionId,
      transaction: byId.get(entry.bankTransactionId) as BankTransactionEntry,
      candidates: entry.candidates,
    }));

    return {
      scenarioId: query.scenarioId,
      dateWindowDays,
      amountTolerancePct,
      suggestions,
    };
  },

  /**
   * ONAYLA — HEPSİ YA DA HİÇBİRİ.
   *
   * Tek bir `withTenantTransaction` içinde her çift TEKRAR OKUNUR: öneri
   * listesi kullanıcının ekranında dururken başka biri aynı tahmini
   * eşleştirmiş olabilir. Kısmi başarı KASITLI olarak YOKTUR — kullanıcı
   * 40 çifti onayladığında "31'i oldu, 9'u olmadı" demek, hangilerinin
   * olmadığını takip etmeyi kullanıcıya yıkmaktır; tüm parti reddedilir,
   * liste yenilenir, tekrar denenir.
   */
  async confirm(
    context: RequestContext,
    input: ConfirmMatchesInput,
  ): Promise<{ confirmed: number }> {
    // Aynı tahmini iki KEZ içeren bir parti DB'ye hiç gitmeden reddedilir —
    // `matchedEventId @unique` zaten patlatırdı ama hata mesajı anlaşılmaz olurdu.
    assertNoDuplicates(input);

    return withTenantTransaction(context.tenantId, async (tx) => {
      for (const pair of input.pairs) {
        const transaction = await bankTransactionRepository.findById(
          context.tenantId,
          pair.bankTransactionId,
          tx,
        );
        if (!transaction) throw new NotFoundError("Banka hareketi");
        if (transaction.matchedEventId !== null) {
          throw conflict(
            `Banka hareketi "${transaction.description}" zaten bir tahminle eşleşmiş.`,
          );
        }

        const event = await cashFlowEventRepository.findById(
          context.tenantId,
          pair.cashFlowEventId,
          tx,
        );
        if (!event) throw new NotFoundError("Nakit olayı");
        if (event.status !== "PLANNED") {
          throw conflict(
            `Nakit olayı (${event.dueDate}) artık "PLANNED" değil — liste eskimiş olabilir.`,
          );
        }
        if (event.direction !== transaction.direction) {
          throw conflict("Tahsilat ile ödeme birbiriyle eşleştirilemez.");
        }

        // Optimistik kilit: durum hâlâ PLANNED ise geçir, değilse 0 satır.
        const moved = await cashFlowEventRepository.transitionStatus(
          context.tenantId,
          event.id,
          "PLANNED",
          "NEUTRALIZED",
          tx,
        );
        if (!moved) {
          throw conflict(
            `Nakit olayı (${event.dueDate}) az önce başka bir işlem tarafından değiştirildi.`,
          );
        }

        await bankTransactionRepository.attachMatch(
          context.tenantId,
          transaction.id,
          event.id,
          context.userId,
          tx,
        );
      }

      return { confirmed: input.pairs.length };
    });
  },

  /** GERİ AL — mutabakat geri alınabilir olmak ZORUNDA (yanlış onaylanmış
   * bir eşleşme aksi halde kalıcı olarak yanlış bir projeksiyon üretirdi). */
  async unmatch(context: RequestContext, input: UnmatchInput): Promise<void> {
    await withTenantTransaction(context.tenantId, async (tx) => {
      const transaction = await bankTransactionRepository.findById(
        context.tenantId,
        input.bankTransactionId,
        tx,
      );
      if (!transaction) throw new NotFoundError("Banka hareketi");
      if (!transaction.matchedEventId) {
        throw conflict("Bu banka hareketi zaten eşleşmemiş durumda.");
      }

      await bankTransactionRepository.detachMatch(context.tenantId, transaction.id, tx);

      // Olay silinmiş olabilir (FK `onDelete: SetNull`) — o durumda geri
      // döndürülecek bir şey yoktur, hareketin çözülmesi yeterlidir.
      const event = await cashFlowEventRepository.findById(
        context.tenantId,
        transaction.matchedEventId,
        tx,
      );
      if (event) {
        await cashFlowEventRepository.transitionStatus(
          context.tenantId,
          event.id,
          "NEUTRALIZED",
          "PLANNED",
          tx,
        );
      }
    });
  },

  /** DEFTERE EKLE — hiç tahmin edilmemiş gerçek bir hareket için NEUTRALIZED
   * bir olay yaratıp anında eşleştirir. Defterde "sahipsiz hareket" bırakmak
   * yerine eksik tahmini geriye dönük tamamlar. */
  async promote(
    context: RequestContext,
    input: PromoteTransactionInput,
  ): Promise<CashFlowEvent> {
    return withTenantTransaction(context.tenantId, async (tx) => {
      const scenario = await scenarioRepository.findById(
        context.tenantId,
        input.scenarioId,
        tx,
      );
      if (!scenario) throw new NotFoundError("Senaryo");
      if (scenario.isLocked) {
        throw new AppError(
          "SCENARIO_LOCKED",
          `"${scenario.name}" kilitli. Deftere ekleme yapmadan önce senaryonun kilidini açın.`,
          409,
        );
      }

      const transaction = await bankTransactionRepository.findById(
        context.tenantId,
        input.bankTransactionId,
        tx,
      );
      if (!transaction) throw new NotFoundError("Banka hareketi");
      if (transaction.matchedEventId !== null) {
        throw conflict("Bu banka hareketi zaten bir tahminle eşleşmiş.");
      }

      const event = await cashFlowEventRepository.createFromPromotion(
        context.tenantId,
        context.userId,
        {
          scenarioId: input.scenarioId,
          dueDate: transaction.valueDate,
          direction: transaction.direction,
          amount: transaction.amount,
          categoryId: input.categoryId,
          counterparty: transaction.counterparty,
          description: input.description ?? transaction.description,
        },
        tx,
      );

      await bankTransactionRepository.attachMatch(
        context.tenantId,
        transaction.id,
        event.id,
        context.userId,
        tx,
      );

      return event;
    });
  },
};

function toMatchableEvent(event: CashFlowEvent): MatchableEvent {
  return {
    id: event.id,
    dueDate: event.dueDate,
    direction: event.direction,
    amount: event.amount,
    categoryId: event.categoryId,
    counterparty: event.counterparty,
    description: event.description,
  };
}

function toMatchableTransaction(
  transaction: BankTransactionEntry,
): MatchableTransaction {
  return {
    id: transaction.id,
    valueDate: transaction.valueDate,
    direction: transaction.direction,
    amount: transaction.amount,
    description: transaction.description,
    counterparty: transaction.counterparty,
  };
}

function assertNoDuplicates(input: ConfirmMatchesInput): void {
  const events = new Set<string>();
  const transactions = new Set<string>();
  for (const pair of input.pairs) {
    if (events.has(pair.cashFlowEventId) || transactions.has(pair.bankTransactionId)) {
      throw conflict(
        "Aynı tahmin ya da aynı banka hareketi partide birden fazla kez var.",
      );
    }
    events.add(pair.cashFlowEventId);
    transactions.add(pair.bankTransactionId);
  }
}

function conflict(message: string): AppError {
  return new AppError("RECONCILIATION_CONFLICT", message, 409);
}

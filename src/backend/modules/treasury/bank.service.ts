import { AppError } from "@/backend/core/errors";
import type { RequestContext } from "@/backend/core/tenant";
import type { BankBalanceSnapshot, BankTransactionEntry } from "@/shared/types";

import { bankBalanceRepository } from "./bank-balance.repository";
import { bankTransactionRepository } from "./bank-transaction.repository";
import type { BankTransactionFilters } from "./bank-transaction.repository";
import { todayIso } from "./treasury.dates";
import type {
  CreateBankTransactionInput,
  UpsertBankBalanceInput,
} from "./treasury.schema";

/**
 * İŞ MANTIĞI KATMANI (Service) — GERÇEKLEŞEN taraf (top bakiye + banka
 * hareketleri). Mutabakat/eşleştirme AYRI dosyadadır
 * (`reconciliation.service.ts`): burası OLGU KAYDI, orası YARGI —
 * `treasury-bank:write` ile `treasury-reconciliation:run` izinlerinin ayrı
 * tutulmasının da gerekçesi budur (bkz. authorize.ts).
 *
 * Kural: Bu dosya HTTP'yi, Next.js'i veya React'i bilmez.
 *
 * `scenario.isLocked` kontrolü BURADA YOKTUR ve bu KASITLIDIR: banka
 * hareketi ve top bakiye SENARYOYA AİT DEĞİLDİR (tenant düzeyinde tek bir
 * gerçeklik), kilitli bir senaryo gerçeğin kaydedilmesini engellememelidir.
 * Kilit, senaryoya YAZAN tarafta (promote / THP commit) uygulanır.
 */
export const bankService = {
  async getBalance(tenantId: string): Promise<{
    latest: BankBalanceSnapshot | null;
    history: BankBalanceSnapshot[];
  }> {
    const history = await bankBalanceRepository.listRecent(tenantId);
    return { latest: history[0] ?? null, history };
  },

  async upsertBalance(
    context: RequestContext,
    input: UpsertBankBalanceInput,
  ): Promise<BankBalanceSnapshot> {
    // İLERİ TARİHLİ top bakiye REDDEDİLİR: bakiye fotoğrafı GEÇMİŞİN
    // özetidir ve projeksiyonun çıpasıdır — gelecekteki bir tarihe çıpa
    // atmak, o tarihe kadar olan tüm tahminleri sessizce anlamsızlaştırırdı.
    if (input.asOfDate > todayIso()) {
      throw new AppError(
        "BANK_BALANCE_FUTURE_DATE",
        "Top bakiye tarihi bugünden ileri olamaz.",
        422,
        { asOfDate: ["Bugünden ileri bir tarih girilemez."] },
      );
    }
    return bankBalanceRepository.upsert(context.tenantId, context.userId, input);
  },

  async listTransactions(
    tenantId: string,
    filters: BankTransactionFilters,
  ): Promise<BankTransactionEntry[]> {
    return bankTransactionRepository.findMany(tenantId, filters);
  },

  async createTransaction(
    context: RequestContext,
    input: CreateBankTransactionInput,
  ): Promise<BankTransactionEntry> {
    if (input.externalRef) {
      const existing = await bankTransactionRepository.findExistingRefs(
        context.tenantId,
        [input.externalRef],
      );
      if (existing.has(input.externalRef)) {
        throw new AppError(
          "BANK_TRANSACTION_DUPLICATE_REF",
          `"${input.externalRef}" referanslı bir hareket zaten kayıtlı.`,
          409,
          { externalRef: ["Bu referans zaten kullanılmış."] },
        );
      }
    }
    return bankTransactionRepository.create(context.tenantId, context.userId, input);
  },
};

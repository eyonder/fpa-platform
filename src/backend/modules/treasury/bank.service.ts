import { AppError, NotFoundError } from "@/backend/core/errors";
import type { RequestContext } from "@/backend/core/tenant";
import type {
  BankAccount,
  BankBalanceSnapshot,
  BankTransactionEntry,
  CreateBankAccountInput,
} from "@/shared/types";

import { bankAccountRepository } from "./bank-account.repository";
import { bankBalanceRepository } from "./bank-balance.repository";
import { bankTransactionRepository } from "./bank-transaction.repository";
import type { BankTransactionFilters } from "./bank-transaction.repository";
import { todayIso } from "./treasury.dates";
import type {
  CreateBankTransactionInput,
  UpsertBankBalanceInput,
} from "./treasury.schema";
import { convertAccountBalances } from "./treasury-fx";
import type { ConvertedAccountBalance } from "./treasury-fx";

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
  async listAccounts(tenantId: string): Promise<BankAccount[]> {
    return bankAccountRepository.findByTenant(tenantId);
  },

  async createAccount(
    context: RequestContext,
    input: CreateBankAccountInput,
  ): Promise<BankAccount> {
    const existing = await bankAccountRepository.findByTenant(context.tenantId);
    if (
      existing.some(
        (a) => a.bankName === input.bankName && a.currency === input.currency,
      )
    ) {
      throw new AppError(
        "BANK_ACCOUNT_DUPLICATE",
        `"${input.bankName}" bankasının ${input.currency} hesabı zaten tanımlı.`,
        409,
      );
    }
    return bankAccountRepository.create(context.tenantId, context.userId, input);
  },

  async getBalance(tenantId: string): Promise<{
    latest: BankBalanceSnapshot | null;
    history: BankBalanceSnapshot[];
  }> {
    const history = await bankBalanceRepository.listRecent(tenantId);
    return { latest: history[0] ?? null, history };
  },

  /**
   * Projeksiyonun ÇIPASI — çoklu hesap/para birimi.
   * En güncel fotoğraf gününün TÜM hesap bakiyelerini raporlama para birimine
   * çevirip toplar. Kur eksikse ilgili hesap toplama girmez ve UYARI üretilir
   * (bkz. treasury-fx.ts) — sessizce yanlış bakiye üretilmez.
   */
  async resolveAnchor(
    tenantId: string,
    onOrBefore: string,
    reportingCurrency: string,
  ): Promise<{
    asOfDate: string;
    totalMinor: number;
    accounts: ConvertedAccountBalance[];
    warnings: string[];
  } | null> {
    const snapshots = await bankBalanceRepository.findAnchorSnapshots(
      tenantId,
      onOrBefore,
    );
    if (snapshots.length === 0) return null;

    const asOfDate = snapshots[0].asOfDate;
    const { items, totalMinor, warnings } = await convertAccountBalances(
      snapshots,
      reportingCurrency,
      asOfDate,
    );
    return { asOfDate, totalMinor, accounts: items, warnings };
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
    const account = await bankAccountRepository.findById(
      context.tenantId,
      input.bankAccountId,
    );
    if (!account) throw new NotFoundError("Banka hesabı");

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
    const account = await bankAccountRepository.findById(
      context.tenantId,
      input.bankAccountId,
    );
    if (!account) throw new NotFoundError("Banka hesabı");

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

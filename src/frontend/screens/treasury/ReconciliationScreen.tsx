"use client";

import { useCallback, useState } from "react";

import { Badge } from "@/frontend/components/ui/Badge";
import { Card } from "@/frontend/components/ui/Card";
import { StatTile } from "@/frontend/components/charts/StatTile";
import { bankAccountLabel, useBankAccounts } from "@/frontend/hooks/useBankAccounts";
import { useBankBalance } from "@/frontend/hooks/useBankBalance";
import { useBankTransactions } from "@/frontend/hooks/useBankTransactions";
import { useBudgetCategories } from "@/frontend/hooks/useBudgetCategories";
import { useScenarios } from "@/frontend/hooks/useScenarios";
import { useTreasuryPosition } from "@/frontend/hooks/useTreasuryPosition";
import { apiClient, ApiError } from "@/frontend/lib/api-client";
import { formatAmount } from "@/frontend/lib/format";
import type { BankAccount, CashFlowDirection } from "@/shared/types";

import { BankStatementImportWizard } from "./BankStatementImportWizard";
import { MatchingPanel } from "./MatchingPanel";

const INPUT_CLASS =
  "mt-1 w-full rounded-md border border-rule bg-surface px-3 py-1.5 text-sm focus-visible:ring-2 focus-visible:ring-ledger focus-visible:outline-none";
const PRIMARY_BUTTON =
  "rounded-md bg-ledger px-4 py-2 text-sm font-medium text-white transition-colors hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-ledger focus-visible:ring-offset-2 focus-visible:outline-none";
const SMALL_SECONDARY_BUTTON =
  "rounded-md border border-rule px-3 py-1.5 text-xs font-medium text-ink transition-colors hover:bg-paper disabled:cursor-not-allowed disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-ledger focus-visible:outline-none";

const MAX_LISTED_TRANSACTIONS = 40;

/**
 * Hazine > Banka & Mutabakat ekranı.
 *
 * Faz 4.3'ün TEK ekranı: top bakiye (projeksiyonun çıpası), gerçekleşen banka
 * hareketleri (elle ya da ekstre ile), ve mutabakat/nötrleme paneli. Tam
 * nakit defteri + 90 günlük AG Grid projeksiyonu Faz 4.4'te gelir — buradaki
 * "Nakit Pozisyonu" kartı bilerek ÖZET seviyesindedir, çünkü asıl amacı
 * nötrlemenin bakiyeyi DEĞİŞTİRMEDİĞİNİ görünür kılmaktır.
 *
 * `canManageBank` / `canReconcile` SADECE UX içindir — asıl yetki sınırı
 * backend'deki `treasury-bank:write` ve `treasury-reconciliation:run`
 * izinleridir (bkz. authorize.ts). Bu propler olmasa da DATA_ENTRY ilgili
 * uçlardan 403 alır.
 */
export function ReconciliationScreen({
  canManageBank,
  canReconcile,
}: {
  canManageBank: boolean;
  canReconcile: boolean;
}) {
  const { state: scenarioState } = useScenarios();
  const scenarios = scenarioState.status === "ready" ? scenarioState.scenarios : [];

  const [selectedScenarioId, setSelectedScenarioId] = useState("");
  const effectiveScenarioId = selectedScenarioId || (scenarios[0]?.id ?? "");

  const { state: balanceState, reload: reloadBalance } = useBankBalance();
  const { state: accountsState } = useBankAccounts();
  const accounts = accountsState.status === "ready" ? accountsState.accounts : [];
  const [onlyUnmatched, setOnlyUnmatched] = useState(false);
  const { state: transactionsState, reload: reloadTransactions } =
    useBankTransactions(onlyUnmatched);
  const { state: positionState, reload: reloadPosition } = useTreasuryPosition(
    effectiveScenarioId || null,
  );
  const { state: categoriesState } = useBudgetCategories();
  const categories =
    categoriesState.status === "ready" ? categoriesState.categories : [];

  const reloadAll = useCallback(() => {
    reloadBalance();
    reloadTransactions();
    reloadPosition();
  }, [reloadBalance, reloadTransactions, reloadPosition]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold tracking-tight">
          Hazine — Banka & Mutabakat
        </h1>
        <p className="mt-1 text-sm text-muted">
          Top bakiyeyi girin, gerçekleşen banka hareketlerini kaydedin ve tahminlerle
          eşleştirin. Eşleşen bir tahmin <em>nötrlenir</em>: karşılığı artık gerçek
          banka toplamında sayıldığı için projeksiyonun tahmin toplamından düşer —
          bakiye değişmez, sadece belirsizlik azalır.
        </p>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <label className="block">
          <span className="text-xs text-muted">Senaryo</span>
          <select
            className={`${INPUT_CLASS} w-72`}
            value={effectiveScenarioId}
            onChange={(e) => setSelectedScenarioId(e.target.value)}
          >
            {scenarios.map((scenario) => (
              <option key={scenario.id} value={scenario.id}>
                {scenario.name}
                {scenario.isLocked ? " (kilitli)" : ""}
              </option>
            ))}
          </select>
        </label>
      </div>

      <BankBalanceCard
        canManageBank={canManageBank}
        state={balanceState}
        accounts={accounts}
        onSaved={reloadAll}
      />

      <Card
        title="Nakit Pozisyonu"
        hint={
          positionState.status === "ready"
            ? `${positionState.position.startDate} → ${positionState.position.endDate}`
            : ""
        }
      >
        {positionState.status === "loading" ? (
          <p className="text-sm text-muted">Yükleniyor…</p>
        ) : null}
        {positionState.status === "error" ? (
          <p className="text-sm text-brick">{positionState.message}</p>
        ) : null}
        {positionState.status === "ready" ? (
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-3">
              <StatTile
                label="Açılış Bakiyesi"
                value={formatAmount(positionState.position.openingBalance)}
                hint={
                  positionState.position.anchor
                    ? `çıpa: ${positionState.position.anchor.asOfDate}`
                    : "top bakiye girilmemiş — 0 kabul edildi"
                }
              />
              <StatTile
                label="90. Gün Bakiyesi"
                value={formatAmount(
                  positionState.position.days.at(-1)?.closingBalance ??
                    positionState.position.openingBalance,
                )}
              />
              <StatTile
                label="İlk Negatif Gün"
                value={positionState.position.firstNegativeDate ?? "yok"}
                hint={
                  positionState.position.firstNegativeDate
                    ? "bu güne kadar nakit tükeniyor"
                    : "pencere boyunca pozitif"
                }
              />
            </div>

            {positionState.position.warnings.length > 0 ? (
              <div className="rounded-md border border-rule bg-paper px-4 py-3">
                <ul className="space-y-1 text-xs text-muted">
                  {positionState.position.warnings.map((w, i) => (
                    <li key={i}>⚠ {w}</li>
                  ))}
                </ul>
              </div>
            ) : null}

            {positionState.position.unreconciledOverdue.count > 0 ? (
              <div className="rounded-md border border-brick/40 bg-brick-soft px-4 py-3">
                <p className="text-sm text-brick">
                  <span className="font-medium">
                    {positionState.position.unreconciledOverdue.count}
                  </span>{" "}
                  vadesi geçmiş, hâlâ eşleşmemiş tahmin var (tahsilat{" "}
                  {formatAmount(positionState.position.unreconciledOverdue.inflowTotal)}
                  , ödeme{" "}
                  {formatAmount(
                    positionState.position.unreconciledOverdue.outflowTotal,
                  )}
                  ). Bunlar projeksiyona DAHİL EDİLMEDİ — ya gerçekleşip eşleştirilmeli
                  ya da iptal edilmeli.
                </p>
              </div>
            ) : null}
          </div>
        ) : null}
      </Card>

      <Card
        title="Banka Hareketleri"
        hint={
          transactionsState.status === "ready"
            ? `${transactionsState.transactions.length} hareket`
            : ""
        }
      >
        <div className="space-y-4">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={onlyUnmatched}
              onChange={(e) => setOnlyUnmatched(e.target.checked)}
            />
            Sadece eşleşmemiş hareketler
          </label>

          {transactionsState.status === "loading" ? (
            <p className="text-sm text-muted">Yükleniyor…</p>
          ) : null}
          {transactionsState.status === "error" ? (
            <p className="text-sm text-brick">{transactionsState.message}</p>
          ) : null}

          {transactionsState.status === "ready" ? (
            transactionsState.transactions.length === 0 ? (
              <p className="text-sm text-muted">
                Henüz banka hareketi yok. Aşağıdan elle girebilir ya da ekstre
                yükleyebilirsiniz.
              </p>
            ) : (
              <TransactionTable
                transactions={transactionsState.transactions.slice(
                  0,
                  MAX_LISTED_TRANSACTIONS,
                )}
                total={transactionsState.transactions.length}
                canReconcile={canReconcile}
                onChanged={reloadAll}
              />
            )
          ) : null}

          {canManageBank ? (
            <ManualTransactionForm accounts={accounts} onCreated={reloadAll} />
          ) : (
            <p className="text-xs text-muted">
              Banka hareketi girmek için Yönetici ya da Bütçe Yöneticisi rolü gerekir.
            </p>
          )}
        </div>
      </Card>

      {canManageBank && effectiveScenarioId ? (
        <BankStatementImportWizard
          scenarioId={effectiveScenarioId}
          accounts={accounts}
          onCommitted={reloadAll}
        />
      ) : null}

      {canReconcile && effectiveScenarioId ? (
        <MatchingPanel
          scenarioId={effectiveScenarioId}
          categories={categories}
          onChanged={reloadAll}
        />
      ) : null}
    </div>
  );
}

/** Çıpa günündeki TÜM hesap bakiyeleri, her biri KENDİ para biriminde.
 * Tek bir toplam göstermek yanıltıcı olurdu: farklı para birimlerini toplamak
 * ancak kurla mümkün ve o çevrim projeksiyonun işi (bkz. treasury-fx.ts). */
function BalanceBreakdown({
  asOfDate,
  rows,
}: {
  asOfDate: string;
  rows: Array<{
    bankAccountId: string;
    bankName: string;
    currency: string;
    balance: number;
  }>;
}) {
  const byCurrency = new Map<string, number>();
  for (const r of rows) {
    byCurrency.set(r.currency, (byCurrency.get(r.currency) ?? 0) + r.balance);
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted">
        {asOfDate} itibarıyla {rows.length} hesap
      </p>
      <div className="flex flex-wrap gap-4">
        {[...byCurrency.entries()].map(([currency, total]) => (
          <div key={currency}>
            <span className="text-xs text-muted">{currency}</span>
            <p className="tabular text-lg font-semibold">
              {formatAmount(total, currency)}
            </p>
          </div>
        ))}
      </div>
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-rule text-left text-muted">
            <th className="py-1.5 pr-3">Banka</th>
            <th className="py-1.5 pr-3">Para Birimi</th>
            <th className="py-1.5 pr-3 text-right">Bakiye</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.bankAccountId} className="border-b border-rule/60">
              <td className="py-1.5 pr-3">{r.bankName}</td>
              <td className="py-1.5 pr-3 text-muted">{r.currency}</td>
              <td className="tabular py-1.5 pr-3 text-right">
                {formatAmount(r.balance, r.currency)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function BankBalanceCard({
  canManageBank,
  state,
  accounts,
  onSaved,
}: {
  canManageBank: boolean;
  state: ReturnType<typeof useBankBalance>["state"];
  accounts: BankAccount[];
  onSaved: () => void;
}) {
  const [bankAccountId, setBankAccountId] = useState("");
  const [asOfDate, setAsOfDate] = useState("");
  const [balance, setBalance] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setSaving(true);
    setError(null);
    try {
      await apiClient.put("/treasury/bank-balance", {
        bankAccountId: bankAccountId || accounts[0]?.id,
        asOfDate,
        balance: Number(balance),
        note: note || undefined,
      });
      setNote("");
      onSaved();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Top bakiye kaydedilemedi.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card
      title="Top Bakiye"
      hint={
        state.status === "ready" && state.balance.latest
          ? `son giriş: ${state.balance.latest.asOfDate}`
          : ""
      }
    >
      <div className="space-y-4">
        {state.status === "loading" ? (
          <p className="text-sm text-muted">Yükleniyor…</p>
        ) : null}
        {state.status === "error" ? (
          <p className="text-sm text-brick">{state.message}</p>
        ) : null}
        {state.status === "ready" ? (
          state.balance.latest ? (
            <BalanceBreakdown
              asOfDate={state.balance.latest.asOfDate}
              rows={state.balance.history.filter(
                (h) => h.asOfDate === state.balance.latest!.asOfDate,
              )}
            />
          ) : (
            <p className="text-sm text-muted">
              Henüz top bakiye girilmemiş. Projeksiyon 0 açılış bakiyesiyle
              hesaplanıyor.
            </p>
          )
        ) : null}

        {canManageBank ? (
          <div className="flex flex-wrap items-end gap-3 border-t border-rule pt-4">
            <label className="block">
              <span className="text-xs text-muted">Hesap</span>
              <select
                className={`${INPUT_CLASS} w-56`}
                value={bankAccountId || (accounts[0]?.id ?? "")}
                onChange={(e) => setBankAccountId(e.target.value)}
              >
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {bankAccountLabel(a)}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="text-xs text-muted">Tarih</span>
              <input
                type="date"
                value={asOfDate}
                onChange={(e) => setAsOfDate(e.target.value)}
                className={`${INPUT_CLASS} w-44`}
              />
            </label>
            <label className="block">
              <span className="text-xs text-muted">Bakiye (negatif olabilir)</span>
              <input
                type="number"
                step="0.01"
                value={balance}
                onChange={(e) => setBalance(e.target.value)}
                className={`${INPUT_CLASS} w-44`}
              />
            </label>
            <label className="block flex-1">
              <span className="text-xs text-muted">Not</span>
              <input
                type="text"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                className={INPUT_CLASS}
              />
            </label>
            <button
              type="button"
              className={PRIMARY_BUTTON}
              disabled={!asOfDate || balance === "" || saving || accounts.length === 0}
              onClick={submit}
            >
              {saving ? "Kaydediliyor…" : "Kaydet"}
            </button>
          </div>
        ) : null}

        {error ? <p className="text-sm text-brick">{error}</p> : null}
      </div>
    </Card>
  );
}

function TransactionTable({
  transactions,
  total,
  canReconcile,
  onChanged,
}: {
  transactions: Array<{
    id: string;
    bankName: string;
    currency: string;
    valueDate: string;
    direction: CashFlowDirection;
    amount: number;
    description: string;
    counterparty: string | null;
    matchedEventId: string | null;
  }>;
  total: number;
  canReconcile: boolean;
  onChanged: () => void;
}) {
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const unmatch = async (id: string) => {
    setBusyId(id);
    setError(null);
    try {
      await apiClient.post("/treasury/reconciliation/unmatch", {
        bankTransactionId: id,
      });
      onChanged();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Eşleşme geri alınamadı.");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-2">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-rule text-left text-xs text-muted">
              <th className="py-2 pr-3">Valör</th>
              <th className="py-2 pr-3">Hesap</th>
              <th className="py-2 pr-3">Açıklama</th>
              <th className="py-2 pr-3">Karşı Taraf</th>
              <th className="py-2 pr-3 text-right">Tutar</th>
              <th className="py-2 pr-3">Durum</th>
              <th className="py-2" />
            </tr>
          </thead>
          <tbody>
            {transactions.map((transaction) => (
              <tr key={transaction.id} className="border-b border-rule/60">
                <td className="tabular py-2 pr-3">{transaction.valueDate}</td>
                <td className="py-2 pr-3 text-muted">
                  {transaction.bankName} ({transaction.currency})
                </td>
                <td className="max-w-[20rem] truncate py-2 pr-3">
                  {transaction.description}
                </td>
                <td className="max-w-[12rem] truncate py-2 pr-3 text-muted">
                  {transaction.counterparty ?? "—"}
                </td>
                <td
                  className={`tabular py-2 pr-3 text-right ${
                    transaction.direction === "INFLOW" ? "text-ledger" : "text-brick"
                  }`}
                >
                  {transaction.direction === "INFLOW" ? "+" : "−"}
                  {formatAmount(transaction.amount, transaction.currency)}
                </td>
                <td className="py-2 pr-3">
                  {transaction.matchedEventId ? (
                    <Badge tone="ledger">Eşleşti</Badge>
                  ) : (
                    <Badge tone="neutral">Eşleşmedi</Badge>
                  )}
                </td>
                <td className="py-2 text-right">
                  {transaction.matchedEventId && canReconcile ? (
                    <button
                      type="button"
                      className={SMALL_SECONDARY_BUTTON}
                      disabled={busyId === transaction.id}
                      onClick={() => unmatch(transaction.id)}
                    >
                      {busyId === transaction.id ? "…" : "Eşleşmeyi Kaldır"}
                    </button>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {total > transactions.length ? (
        <p className="text-xs text-muted">
          İlk {transactions.length} hareket gösteriliyor ({total} hareketten).
        </p>
      ) : null}
      {error ? <p className="text-sm text-brick">{error}</p> : null}
    </div>
  );
}

function ManualTransactionForm({
  accounts,
  onCreated,
}: {
  accounts: BankAccount[];
  onCreated: () => void;
}) {
  const [bankAccountId, setBankAccountId] = useState("");
  const [valueDate, setValueDate] = useState("");
  const [direction, setDirection] = useState<CashFlowDirection>("OUTFLOW");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [counterparty, setCounterparty] = useState("");
  const [externalRef, setExternalRef] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setSaving(true);
    setError(null);
    try {
      await apiClient.post("/treasury/bank-transactions", {
        bankAccountId: bankAccountId || accounts[0]?.id,
        valueDate,
        direction,
        amount: Number(amount),
        description,
        counterparty: counterparty || undefined,
        externalRef: externalRef || undefined,
      });
      setAmount("");
      setDescription("");
      setCounterparty("");
      setExternalRef("");
      onCreated();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Hareket kaydedilemedi.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-3 border-t border-rule pt-4">
      <h3 className="text-xs font-semibold tracking-wide text-muted uppercase">
        Elle Hareket Ekle
      </h3>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <label className="block">
          <span className="text-xs text-muted">Hesap</span>
          <select
            value={bankAccountId || (accounts[0]?.id ?? "")}
            onChange={(e) => setBankAccountId(e.target.value)}
            className={INPUT_CLASS}
          >
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {bankAccountLabel(a)}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="text-xs text-muted">Valör</span>
          <input
            type="date"
            value={valueDate}
            onChange={(e) => setValueDate(e.target.value)}
            className={INPUT_CLASS}
          />
        </label>
        <label className="block">
          <span className="text-xs text-muted">Yön</span>
          <select
            value={direction}
            onChange={(e) => setDirection(e.target.value as CashFlowDirection)}
            className={INPUT_CLASS}
          >
            <option value="OUTFLOW">Çıkış (ödeme)</option>
            <option value="INFLOW">Giriş (tahsilat)</option>
          </select>
        </label>
        <label className="block">
          <span className="text-xs text-muted">Tutar</span>
          <input
            type="number"
            step="0.01"
            min="0"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className={INPUT_CLASS}
          />
        </label>
        <label className="block lg:col-span-2">
          <span className="text-xs text-muted">Açıklama</span>
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className={INPUT_CLASS}
          />
        </label>
        <label className="block">
          <span className="text-xs text-muted">Karşı Taraf</span>
          <input
            type="text"
            value={counterparty}
            onChange={(e) => setCounterparty(e.target.value)}
            className={INPUT_CLASS}
          />
        </label>
        <label className="block">
          <span className="text-xs text-muted">Referans No (opsiyonel)</span>
          <input
            type="text"
            value={externalRef}
            onChange={(e) => setExternalRef(e.target.value)}
            className={INPUT_CLASS}
          />
        </label>
      </div>
      {error ? <p className="text-sm text-brick">{error}</p> : null}
      <button
        type="button"
        className={PRIMARY_BUTTON}
        disabled={
          !valueDate || !amount || !description || saving || accounts.length === 0
        }
        onClick={submit}
      >
        {saving ? "Kaydediliyor…" : "Hareketi Ekle"}
      </button>
    </div>
  );
}

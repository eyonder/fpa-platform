"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useCallback, useMemo, useState } from "react";

import { StatTile } from "@/frontend/components/charts/StatTile";
import { BalanceCurveChart } from "@/frontend/components/treasury/BalanceCurveChart";
import { PasteDialog } from "@/frontend/components/treasury/PasteDialog";
import type { PastedRow } from "@/frontend/components/treasury/PasteDialog";
import { SimulationPanel } from "@/frontend/components/treasury/SimulationPanel";
import type { LedgerEdit } from "@/frontend/components/treasury-grid/TreasuryLedgerGrid";
import { Badge } from "@/frontend/components/ui/Badge";
import { Card } from "@/frontend/components/ui/Card";
import { useBudgetCategories } from "@/frontend/hooks/useBudgetCategories";
import { useScenarios } from "@/frontend/hooks/useScenarios";
import { useTreasuryProjection } from "@/frontend/hooks/useTreasuryProjection";
import { useTreasurySimulation } from "@/frontend/hooks/useTreasurySimulation";
import { apiClient, ApiError } from "@/frontend/lib/api-client";
import { formatAmount } from "@/frontend/lib/format";
import type {
  BudgetCategory,
  CashFlowDirection,
  TreasuryAdjustment,
} from "@/shared/types";

// AG Grid DOM/ölçüm API'lerine dayanır ve `ModuleRegistry.registerModules`
// modül kapsamında çalışır; sunucuda render EDİLMEMELİ.
function gridLoading(height: string) {
  function GridLoading() {
    return (
      <div
        className={`flex ${height} w-full items-center justify-center rounded-md border border-rule text-sm text-muted`}
      >
        Tablo yükleniyor…
      </div>
    );
  }
  return GridLoading;
}

const TreasuryLedgerGrid = dynamic(
  () =>
    import("@/frontend/components/treasury-grid/TreasuryLedgerGrid").then(
      (m) => m.TreasuryLedgerGrid,
    ),
  { ssr: false, loading: gridLoading("h-[calc(100vh-24rem)] min-h-[360px]") },
);

const TreasuryProjectionGrid = dynamic(
  () =>
    import("@/frontend/components/treasury-grid/TreasuryProjectionGrid").then(
      (m) => m.TreasuryProjectionGrid,
    ),
  { ssr: false, loading: gridLoading("h-[calc(100vh-24rem)] min-h-[360px]") },
);

const INPUT_CLASS =
  "mt-1 w-full rounded-md border border-rule bg-surface px-3 py-1.5 text-sm focus-visible:ring-2 focus-visible:ring-ledger focus-visible:outline-none";
const SMALL_SECONDARY_BUTTON =
  "rounded-md border border-rule px-3 py-1.5 text-xs font-medium text-ink transition-colors hover:bg-paper disabled:cursor-not-allowed disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-ledger focus-visible:outline-none";

const SOURCE_TOGGLES = [
  { key: "sales", label: "Satış hakedişleri" },
  { key: "capex", label: "Sabit kıymetler" },
  { key: "payroll", label: "Bordro" },
  { key: "pipeline", label: "Açık pipeline" },
] as const;

/**
 * /hazine — Hazine ana ekranı.
 *
 * İKİ IZGARA, BİR GRAFİK: üstte bakiye eğrisi, altta nakit defteri (satır
 * başına bir yükümlülük, düzenlenebilir) ve günlük projeksiyon (salt okunur).
 * Defter satırı düzenlemesi ANINDA sunucuya gider ve projeksiyon yeniden
 * çekilir — türetilmiş kaynaklar (Satış/Capex/Bordro) canlı okunduğu için
 * lokal yeniden hesaplama sunucuyla ayrışırdı.
 *
 * Simülasyon AKTİFKEN defter düzenlemesi KAPANIR: ekrandaki değerler
 * varsayımsaldır (bkz. treasury-projection.service.ts).
 */
export function TreasuryScreen({
  canEditLedger,
  canSimulate,
}: {
  canEditLedger: boolean;
  canSimulate: boolean;
}) {
  const { state: scenarioState } = useScenarios();
  const scenarios = scenarioState.status === "ready" ? scenarioState.scenarios : [];
  const [selectedScenarioId, setSelectedScenarioId] = useState("");
  const effectiveScenarioId = selectedScenarioId || (scenarios[0]?.id ?? "");
  const selectedScenario = scenarios.find((s) => s.id === effectiveScenarioId);

  const [granularity, setGranularity] = useState<"DAY" | "WEEK">("DAY");
  const [horizonDays, setHorizonDays] = useState(90);
  const [includeDerived, setIncludeDerived] = useState({
    sales: true,
    capex: true,
    payroll: true,
    pipeline: false,
  });

  const options = useMemo(
    () => ({ granularity, horizonDays, includeDerived }),
    [granularity, horizonDays, includeDerived],
  );

  const { state, reload } = useTreasuryProjection(effectiveScenarioId || null, options);
  const { state: categoriesState } = useBudgetCategories();
  const categories =
    categoriesState.status === "ready" ? categoriesState.categories : [];

  const simulation = useTreasurySimulation();
  const [adjustments, setAdjustments] = useState<TreasuryAdjustment[]>([]);
  const [pasteOpen, setPasteOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // Simülasyon sonucu VARSA ekranın kaynağı odur; yoksa taban çizgi.
  const baselineProjection = state.status === "ready" ? state.projection : null;
  const view = simulation.result ?? baselineProjection;
  const simulationActive = simulation.result !== null;

  const handleEdit = useCallback(
    async (edit: LedgerEdit) => {
      setActionError(null);
      try {
        await apiClient.patch(`/treasury/events/${edit.eventId}`, {
          [edit.field]: edit.value,
        });
        reload();
      } catch (err) {
        // Sunucu reddettiyse (ör. 409 SCENARIO_LOCKED) ızgaradaki iyimser
        // değer GEÇERSİZDİR — projeksiyonu yeniden çekmek satırı gerçek
        // değerine döndürür.
        setActionError(err instanceof ApiError ? err.message : "Satır güncellenemedi.");
        reload();
      }
    },
    [reload],
  );

  const handlePasteConfirm = useCallback(
    async (rows: PastedRow[]) => {
      setPasteOpen(false);
      setActionError(null);
      try {
        for (const row of rows) {
          await apiClient.post("/treasury/events", {
            scenarioId: effectiveScenarioId,
            dueDate: row.date,
            direction: row.direction,
            amount: row.amount,
            categoryId: row.categoryId,
            counterparty: row.counterparty ?? undefined,
          });
        }
        setNotice(`${rows.length} satır deftere eklendi.`);
        reload();
      } catch (err) {
        setActionError(err instanceof ApiError ? err.message : "Satırlar eklenemedi.");
        reload();
      }
    },
    [effectiveScenarioId, reload],
  );

  const handleDelete = useCallback(
    async (eventId: string) => {
      setActionError(null);
      try {
        await apiClient.delete(`/treasury/events/${eventId}`);
        reload();
      } catch (err) {
        setActionError(err instanceof ApiError ? err.message : "Satır silinemedi.");
      }
    },
    [reload],
  );

  /** Bütçe satırlarından nakit defteri üretir. SADECE daha önce üretilmiş
   * satırları değiştirir — elle girilenlere dokunmaz (bkz.
   * budget-to-cash.service.ts). */
  const generateFromBudget = useCallback(async () => {
    setGenerating(true);
    setActionError(null);
    setNotice(null);
    try {
      const result = await apiClient.post<{
        created: number;
        replaced: number;
        revenueTermDays: number;
        expenseTermDays: number;
        warnings: string[];
      }>("/treasury/generate-from-budget", { scenarioId: effectiveScenarioId });
      setNotice(
        `${result.created} nakit satırı üretildi (${result.replaced} önceki üretim ` +
          `değiştirildi). Vade: gelir +${result.revenueTermDays} gün, gider ` +
          `+${result.expenseTermDays} gün.` +
          (result.warnings.length > 0 ? ` ⚠ ${result.warnings.join(" ")}` : ""),
      );
      reload();
    } catch (err) {
      setActionError(
        err instanceof ApiError ? err.message : "Nakit defteri üretilemedi.",
      );
    } finally {
      setGenerating(false);
    }
  }, [effectiveScenarioId, reload]);

  const runSimulation = useCallback(async () => {
    setActionError(null);
    await simulation.run({
      scenarioId: effectiveScenarioId,
      horizonDays,
      granularity,
      includeDerived,
      adjustments,
    });
  }, [
    simulation,
    effectiveScenarioId,
    horizonDays,
    granularity,
    includeDerived,
    adjustments,
  ]);

  const currency = view?.currency ?? "TRY";
  const summary = view?.summary;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold tracking-tight">Hazine</h1>
        <p className="mt-1 text-sm text-muted">
          Gün hassasiyetli nakit pozisyonu. Kalıcı nakit defteri satırlarına ek olarak
          Satış hakedişleri, sabit kıymet edinimleri ve bordro ödemeleri kaynak
          modüllerden <em>canlı</em> türetilir — kopyalanmaz, saklanmaz.
        </p>
        {/* Alt ekranlar: üst nav tek bir "Hazine" girişi taşır, modülün diğer
            iki ekranına buradan gidilir. */}
        <nav className="mt-3 flex flex-wrap gap-4 text-sm">
          <Link
            href="/hazine/mutabakat"
            className="rounded-sm text-ledger underline-offset-2 hover:underline focus-visible:ring-2 focus-visible:ring-ledger focus-visible:outline-none"
          >
            Banka &amp; Mutabakat
          </Link>
          <Link
            href="/hazine/eslestirme"
            className="rounded-sm text-ledger underline-offset-2 hover:underline focus-visible:ring-2 focus-visible:ring-ledger focus-visible:outline-none"
          >
            THP Eşleştirme
          </Link>
        </nav>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <label className="block">
          <span className="text-xs text-muted">Senaryo</span>
          <select
            className={`${INPUT_CLASS} w-64`}
            value={effectiveScenarioId}
            onChange={(e) => {
              setSelectedScenarioId(e.target.value);
              simulation.clear();
            }}
          >
            {scenarios.map((scenario) => (
              <option key={scenario.id} value={scenario.id}>
                {scenario.name}
                {scenario.isLocked ? " (kilitli)" : ""}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="text-xs text-muted">Kırılım</span>
          <select
            className={`${INPUT_CLASS} w-36`}
            value={granularity}
            onChange={(e) => setGranularity(e.target.value as "DAY" | "WEEK")}
          >
            <option value="DAY">Günlük</option>
            <option value="WEEK">Haftalık</option>
          </select>
        </label>
        <label className="block">
          <span className="text-xs text-muted">Ufuk (gün)</span>
          <input
            type="number"
            min={1}
            max={365}
            className={`${INPUT_CLASS} w-28`}
            value={horizonDays}
            onChange={(e) => setHorizonDays(Number(e.target.value) || 90)}
          />
        </label>
        <div className="flex flex-wrap items-center gap-3 pb-1">
          {SOURCE_TOGGLES.map((toggle) => (
            <label key={toggle.key} className="flex items-center gap-1.5 text-xs">
              <input
                type="checkbox"
                checked={includeDerived[toggle.key]}
                onChange={(e) =>
                  setIncludeDerived((current) => ({
                    ...current,
                    [toggle.key]: e.target.checked,
                  }))
                }
              />
              {toggle.label}
            </label>
          ))}
        </div>
      </div>

      {state.status === "loading" ? (
        <p className="text-sm text-muted">Yükleniyor…</p>
      ) : null}
      {state.status === "error" ? (
        <p className="text-sm text-brick">{state.message}</p>
      ) : null}
      {actionError ? <p className="text-sm text-brick">{actionError}</p> : null}
      {simulation.error ? (
        <p className="text-sm text-brick">{simulation.error}</p>
      ) : null}
      {notice ? <p className="text-sm text-ledger">{notice}</p> : null}

      {view && summary ? (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <StatTile
              label="Açılış Bakiyesi"
              value={formatAmount(view.openingBalance, currency)}
              hint={
                view.openingBalanceAsOf
                  ? `çıpa: ${view.openingBalanceAsOf}`
                  : "top bakiye girilmemiş"
              }
            />
            <StatTile
              label="En Düşük Bakiye"
              value={formatAmount(
                simulationActive && summary.simulatedMinBalance !== null
                  ? summary.simulatedMinBalance
                  : summary.baselineMinBalance,
                currency,
              )}
              hint={
                (simulationActive
                  ? summary.simulatedMinDate
                  : summary.baselineMinDate) ?? ""
              }
              tone={
                (simulationActive && summary.simulatedMinBalance !== null
                  ? summary.simulatedMinBalance
                  : summary.baselineMinBalance) < 0
                  ? "brick"
                  : "neutral"
              }
            />
            <StatTile
              label={`${view.granularity === "WEEK" ? "Dönem" : "Ufuk"} Sonu Bakiye`}
              value={formatAmount(
                simulationActive && summary.simulatedClosing !== null
                  ? summary.simulatedClosing
                  : summary.baselineClosing,
                currency,
              )}
              hint={
                summary.deltaClosing !== null
                  ? `Δ ${formatAmount(summary.deltaClosing, currency)}`
                  : view.endDate
              }
            />
            <StatTile
              label="İlk Negatif Gün"
              value={
                (simulationActive
                  ? summary.simulatedFirstNegativeDate
                  : summary.baselineFirstNegativeDate) ?? "yok"
              }
              hint={
                (
                  simulationActive
                    ? summary.simulatedFirstNegativeDate
                    : summary.baselineFirstNegativeDate
                )
                  ? "bu güne kadar nakit tükeniyor"
                  : "pencere boyunca pozitif"
              }
              tone={
                (
                  simulationActive
                    ? summary.simulatedFirstNegativeDate
                    : summary.baselineFirstNegativeDate
                )
                  ? "brick"
                  : "neutral"
              }
            />
          </div>

          {view.unreconciledOverdue.count > 0 ? (
            <div className="rounded-md border border-brick/40 bg-brick-soft px-4 py-3">
              <p className="text-sm text-brick">
                <span className="font-medium">{view.unreconciledOverdue.count}</span>{" "}
                vadesi geçmiş, hâlâ eşleşmemiş tahmin projeksiyona DAHİL EDİLMEDİ
                (tahsilat {formatAmount(view.unreconciledOverdue.inflowTotal, currency)}
                , ödeme {formatAmount(view.unreconciledOverdue.outflowTotal, currency)}
                ).
              </p>
            </div>
          ) : null}

          {view.warnings.length > 0 ? (
            <div className="rounded-md border border-rule bg-paper px-4 py-3">
              <ul className="space-y-1 text-xs text-muted">
                {view.warnings.map((warning, i) => (
                  <li key={i}>⚠ {warning}</li>
                ))}
              </ul>
            </div>
          ) : null}

          <Card title="Bakiye Eğrisi" hint={`${view.startDate} → ${view.endDate}`}>
            <BalanceCurveChart
              baseline={view.baseline}
              simulated={view.simulated}
              summary={summary}
              currency={currency}
            />
          </Card>

          <Card title="Nakit Defteri" hint={`${view.rows.length} yükümlülük`}>
            <div className="space-y-3">
              {simulationActive ? (
                <div className="flex items-center gap-2">
                  <Badge tone="brick">Simülasyon aktif</Badge>
                  <span className="text-xs text-muted">
                    Gösterilen değerler varsayımsaldır — düzenleme kapalıdır.
                  </span>
                  <button
                    type="button"
                    className={SMALL_SECONDARY_BUTTON}
                    onClick={() => simulation.clear()}
                  >
                    Tabana Dön
                  </button>
                </div>
              ) : canEditLedger ? (
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    className={SMALL_SECONDARY_BUTTON}
                    disabled={selectedScenario?.isLocked}
                    onClick={() => setAddOpen((v) => !v)}
                  >
                    {addOpen ? "Formu Kapat" : "Satır Ekle"}
                  </button>
                  <button
                    type="button"
                    className={SMALL_SECONDARY_BUTTON}
                    disabled={selectedScenario?.isLocked}
                    onClick={() => setPasteOpen(true)}
                  >
                    Excel&apos;den Yapıştır
                  </button>
                  <button
                    type="button"
                    className={SMALL_SECONDARY_BUTTON}
                    disabled={selectedScenario?.isLocked || generating}
                    onClick={generateFromBudget}
                    title="Bütçe satırlarından ödeme vadesi konvansiyonuyla nakit defteri üretir"
                  >
                    {generating ? "Üretiliyor…" : "Bütçeden Üret"}
                  </button>
                  {selectedScenario?.isLocked ? (
                    <span className="text-xs text-muted">
                      Senaryo kilitli — düzenleme kapalı.
                    </span>
                  ) : null}
                </div>
              ) : null}

              {addOpen && !simulationActive ? (
                <NewLedgerRowForm
                  categories={categories}
                  onCreate={async (input) => {
                    setActionError(null);
                    try {
                      await apiClient.post("/treasury/events", {
                        scenarioId: effectiveScenarioId,
                        ...input,
                      });
                      setAddOpen(false);
                      reload();
                    } catch (err) {
                      setActionError(
                        err instanceof ApiError ? err.message : "Satır eklenemedi.",
                      );
                    }
                  }}
                />
              ) : null}

              <TreasuryLedgerGrid
                rows={view.rows}
                categories={categories}
                currency={currency}
                editable={canEditLedger && !simulationActive}
                onEdit={handleEdit}
                onDelete={handleDelete}
              />
            </div>
          </Card>

          <Card
            title={`${view.granularity === "WEEK" ? "Haftalık" : "Günlük"} Projeksiyon`}
            hint={`${view.baseline.length} ${view.granularity === "WEEK" ? "hafta" : "gün"}`}
          >
            <TreasuryProjectionGrid
              baseline={view.baseline}
              simulated={view.simulated}
              granularity={view.granularity}
              currency={currency}
            />
          </Card>

          {canSimulate ? (
            <SimulationPanel
              currency={currency}
              adjustments={adjustments}
              running={simulation.running}
              onAdd={(adjustment) =>
                setAdjustments((current) => [...current, adjustment])
              }
              onRemove={(id) =>
                setAdjustments((current) => current.filter((a) => a.id !== id))
              }
              onRun={runSimulation}
              onClear={() => {
                setAdjustments([]);
                simulation.clear();
              }}
            />
          ) : null}
        </>
      ) : null}

      {pasteOpen ? (
        <PasteDialog
          categories={categories}
          onCancel={() => setPasteOpen(false)}
          onConfirm={handlePasteConfirm}
        />
      ) : null}
    </div>
  );
}

interface NewLedgerRow {
  dueDate: string;
  direction: CashFlowDirection;
  amount: number;
  categoryId: string;
  counterparty?: string;
  description?: string;
}

/** Defterе elle satır ekleme formu. Izgaranın İÇİNDE boş satır yaratmak yerine
 * ayrı bir form: yarım bırakılan bir satır deftere (ve dolayısıyla ödeme gücü
 * tablosuna) sıfır tutarlı çöp olarak düşmesin. */
function NewLedgerRowForm({
  categories,
  onCreate,
}: {
  categories: BudgetCategory[];
  onCreate: (input: NewLedgerRow) => Promise<void>;
}) {
  const [dueDate, setDueDate] = useState("");
  const [direction, setDirection] = useState<CashFlowDirection>("OUTFLOW");
  const [amount, setAmount] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [counterparty, setCounterparty] = useState("");
  const [saving, setSaving] = useState(false);

  const effectiveCategoryId = categoryId || (categories[0]?.id ?? "");
  const ready = dueDate !== "" && amount !== "" && effectiveCategoryId !== "";

  return (
    <div className="grid gap-3 rounded-md border border-rule bg-paper px-4 py-3 sm:grid-cols-2 lg:grid-cols-5">
      <label className="block">
        <span className="text-xs text-muted">Vade</span>
        <input
          type="date"
          value={dueDate}
          onChange={(e) => setDueDate(e.target.value)}
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
          <option value="OUTFLOW">Ödeme</option>
          <option value="INFLOW">Tahsilat</option>
        </select>
      </label>
      <label className="block">
        <span className="text-xs text-muted">Kategori</span>
        <select
          value={effectiveCategoryId}
          onChange={(e) => setCategoryId(e.target.value)}
          className={INPUT_CLASS}
        >
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
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
      <div className="flex items-end gap-2">
        <label className="block flex-1">
          <span className="text-xs text-muted">Tutar</span>
          <input
            type="number"
            min="0"
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className={INPUT_CLASS}
          />
        </label>
        <button
          type="button"
          className={SMALL_SECONDARY_BUTTON}
          disabled={!ready || saving}
          onClick={async () => {
            setSaving(true);
            await onCreate({
              dueDate,
              direction,
              amount: Number(amount),
              categoryId: effectiveCategoryId,
              counterparty: counterparty || undefined,
            });
            setSaving(false);
          }}
        >
          {saving ? "…" : "Ekle"}
        </button>
      </div>
    </div>
  );
}

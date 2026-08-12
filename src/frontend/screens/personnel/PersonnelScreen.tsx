"use client";

import { useState } from "react";

import { Badge } from "@/frontend/components/ui/Badge";
import { Card } from "@/frontend/components/ui/Card";
import { usePersonnel } from "@/frontend/hooks/usePersonnel";
import { useScenarios } from "@/frontend/hooks/useScenarios";
import { apiClient, ApiError } from "@/frontend/lib/api-client";
import { formatAmount, formatDate } from "@/frontend/lib/format";
import type {
  BudgetLine,
  CompensationInputMode,
  DisabilityDegree,
  Employee,
  EmployeeCompensation,
  PayrollRunPreview,
} from "@/shared/types";

const INPUT_CLASS =
  "mt-1 w-full rounded-md border border-rule bg-surface px-3 py-1.5 text-sm focus-visible:ring-2 focus-visible:ring-ledger focus-visible:outline-none";
const PRIMARY_BUTTON =
  "rounded-md bg-ledger px-4 py-2 text-sm font-medium text-white transition-colors hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-ledger focus-visible:ring-offset-2 focus-visible:outline-none";
const SECONDARY_BUTTON =
  "rounded-md border border-rule px-4 py-2 text-sm font-medium text-ink transition-colors hover:bg-paper disabled:cursor-not-allowed disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-ledger focus-visible:ring-offset-2 focus-visible:outline-none";

const DISABILITY_LABEL: Record<DisabilityDegree, string> = {
  NONE: "Yok",
  DEGREE_1: "1. Derece (%80+)",
  DEGREE_2: "2. Derece (%60-79)",
  DEGREE_3: "3. Derece (%40-59)",
};

/**
 * Personel & Bordro ekranı — SADECE ADMIN'e açık (bkz. AppShell.tsx nav
 * filtresi + backend/core/authorize.ts'teki payroll:read/write). Üç bölüm:
 * personel listesi + ekleme, seçili personelin ücret geçmişi + yeni kayıt,
 * bordro çalıştırma (önizle → bütçeye yaz).
 */
export function PersonnelScreen() {
  const { state: employeesState, reload: reloadEmployees } = usePersonnel();
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string | null>(null);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold tracking-tight">Personel &amp; Bordro</h1>
        <p className="mt-1 text-sm text-muted">
          Personel kayıtları ve ücret geçmişi — sadece Admin görebilir. Bordro
          çalıştırma, hesaplanan işveren maliyetini seçilen senaryonun &quot;Personel
          Giderleri&quot; kategorisine yazar.
        </p>
      </div>

      <Card title="Personel Listesi" hint={hintFor(employeesState)}>
        {employeesState.status === "loading" ? (
          <p className="text-sm text-muted">Yükleniyor…</p>
        ) : null}
        {employeesState.status === "error" ? (
          <p className="text-sm text-brick">{employeesState.message}</p>
        ) : null}
        {employeesState.status === "ready" ? (
          <EmployeeTable
            employees={employeesState.employees}
            selectedId={selectedEmployeeId}
            onSelect={setSelectedEmployeeId}
          />
        ) : null}

        <NewEmployeeForm onCreated={reloadEmployees} />
      </Card>

      {selectedEmployeeId ? (
        <CompensationPanel employeeId={selectedEmployeeId} />
      ) : null}

      <PayrollRunPanel />
    </div>
  );
}

function hintFor(state: ReturnType<typeof usePersonnel>["state"]): string | undefined {
  return state.status === "ready" ? `${state.employees.length} kayıt` : undefined;
}

function EmployeeTable({
  employees,
  selectedId,
  onSelect,
}: {
  employees: Employee[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  if (employees.length === 0) {
    return <p className="text-sm text-muted">Henüz personel eklenmedi.</p>;
  }

  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b border-rule text-left text-xs text-muted">
          <th className="py-2 pr-3">Ad Soyad</th>
          <th className="py-2 pr-3">Unvan</th>
          <th className="py-2 pr-3">Departman</th>
          <th className="py-2 pr-3">İşe Giriş</th>
          <th className="py-2 pr-3">Durum</th>
          <th className="py-2 pr-3">Nitelikler</th>
        </tr>
      </thead>
      <tbody>
        {employees.map((employee) => (
          <tr
            key={employee.id}
            onClick={() => onSelect(employee.id)}
            className={`tabular cursor-pointer border-b border-rule last:border-0 hover:bg-paper ${
              selectedId === employee.id ? "bg-ledger-soft" : ""
            }`}
          >
            <td className="py-2 pr-3 font-medium text-ink">{employee.fullName}</td>
            <td className="py-2 pr-3">{employee.position}</td>
            <td className="py-2 pr-3 text-muted">{employee.department ?? "—"}</td>
            <td className="py-2 pr-3">{formatDate(employee.hireDate)}</td>
            <td className="py-2 pr-3">
              <Badge tone={employee.isActive ? "ledger" : "brick"}>
                {employee.isActive ? "Aktif" : "Ayrıldı"}
              </Badge>
            </td>
            <td className="space-x-1 py-2 pr-3">
              {employee.isRetired ? <Badge>Emekli (SGDP)</Badge> : null}
              {employee.isConcierge ? <Badge>Kapıcı</Badge> : null}
              {employee.disabilityDegree !== "NONE" ? (
                <Badge>{DISABILITY_LABEL[employee.disabilityDegree]}</Badge>
              ) : null}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function NewEmployeeForm({ onCreated }: { onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [fullName, setFullName] = useState("");
  const [position, setPosition] = useState("");
  const [department, setDepartment] = useState("");
  const [hireDate, setHireDate] = useState("");
  const [isRetired, setIsRetired] = useState(false);
  const [isConcierge, setIsConcierge] = useState(false);
  const [disabilityDegree, setDisabilityDegree] = useState<DisabilityDegree>("NONE");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`${SECONDARY_BUTTON} mt-4`}
      >
        + Yeni Personel Ekle
      </button>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await apiClient.post("/personnel", {
        fullName,
        position,
        department: department || undefined,
        hireDate,
        isRetired,
        isConcierge,
        disabilityDegree,
      });
      setFullName("");
      setPosition("");
      setDepartment("");
      setHireDate("");
      setIsRetired(false);
      setIsConcierge(false);
      setDisabilityDegree("NONE");
      setOpen(false);
      onCreated();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Personel eklenemedi.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="mt-4 space-y-3 rounded-md bg-paper p-4">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-ink">Ad Soyad</label>
          <input
            required
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            className={INPUT_CLASS}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-ink">Unvan</label>
          <input
            required
            value={position}
            onChange={(e) => setPosition(e.target.value)}
            className={INPUT_CLASS}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-ink">Departman</label>
          <input
            value={department}
            onChange={(e) => setDepartment(e.target.value)}
            className={INPUT_CLASS}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-ink">İşe Giriş Tarihi</label>
          <input
            required
            type="date"
            value={hireDate}
            onChange={(e) => setHireDate(e.target.value)}
            className={INPUT_CLASS}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-ink">
            Engellilik Derecesi
          </label>
          <select
            value={disabilityDegree}
            onChange={(e) => setDisabilityDegree(e.target.value as DisabilityDegree)}
            className={INPUT_CLASS}
          >
            {Object.entries(DISABILITY_LABEL).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-end gap-4 pb-1">
          <label className="flex items-center gap-2 text-sm text-ink">
            <input
              type="checkbox"
              checked={isRetired}
              onChange={(e) => setIsRetired(e.target.checked)}
              className="rounded border-rule"
            />
            Emekli (SGDP)
          </label>
          <label className="flex items-center gap-2 text-sm text-ink">
            <input
              type="checkbox"
              checked={isConcierge}
              onChange={(e) => setIsConcierge(e.target.checked)}
              className="rounded border-rule"
            />
            Kapıcı
          </label>
        </div>
      </div>

      {error ? <p className="text-sm text-brick">{error}</p> : null}

      <div className="flex gap-3">
        <button type="submit" disabled={submitting} className={PRIMARY_BUTTON}>
          {submitting ? "Ekleniyor…" : "Ekle"}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className={SECONDARY_BUTTON}
        >
          Vazgeç
        </button>
      </div>
    </form>
  );
}

function CompensationPanel({ employeeId }: { employeeId: string }) {
  const [compensations, setCompensations] = useState<EmployeeCompensation[] | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);

  const reload = () => {
    setCompensations(null);
    apiClient
      .get<EmployeeCompensation[]>(`/personnel/${employeeId}/compensation`)
      .then(setCompensations)
      .catch((err: unknown) =>
        setError(err instanceof ApiError ? err.message : "Ücret geçmişi yüklenemedi."),
      );
  };

  // Personel değiştiğinde yeniden yükle.
  const [loadedFor, setLoadedFor] = useState<string | null>(null);
  if (loadedFor !== employeeId) {
    setLoadedFor(employeeId);
    reload();
  }

  return (
    <Card title="Ücret Geçmişi">
      {error ? <p className="text-sm text-brick">{error}</p> : null}
      {compensations === null && !error ? (
        <p className="text-sm text-muted">Yükleniyor…</p>
      ) : null}
      {compensations && compensations.length === 0 ? (
        <p className="text-sm text-muted">Bu personel için henüz ücret kaydı yok.</p>
      ) : null}
      {compensations && compensations.length > 0 ? (
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-rule text-left text-xs text-muted">
              <th className="py-2 pr-3">Yürürlük</th>
              <th className="py-2 pr-3">Tür</th>
              <th className="py-2 pr-3">Tutar</th>
              <th className="py-2 pr-3">Yemek/Yol (gün)</th>
              <th className="py-2 pr-3">Planlı Mesai (sa)</th>
              <th className="py-2 pr-3">Teşvik</th>
            </tr>
          </thead>
          <tbody>
            {compensations.map((c) => (
              <tr key={c.id} className="tabular border-b border-rule last:border-0">
                <td className="py-2 pr-3">{formatDate(c.effectiveFrom)}</td>
                <td className="py-2 pr-3">
                  {c.inputMode === "GROSS_FIXED" ? "Brüt Sabit" : "Net Sabit"}
                </td>
                <td className="py-2 pr-3">{formatAmount(c.amount, "TRY")}</td>
                <td className="py-2 pr-3">
                  {c.mealAllowanceDays}/{c.transportAllowanceDays}
                </td>
                <td className="py-2 pr-3">{c.plannedOvertimeHoursPerMonth}</td>
                <td className="py-2 pr-3">
                  {c.applyEmployerIncentive ? "Evet" : "Hayır"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : null}

      <NewCompensationForm employeeId={employeeId} onCreated={reload} />
    </Card>
  );
}

function NewCompensationForm({
  employeeId,
  onCreated,
}: {
  employeeId: string;
  onCreated: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [effectiveFrom, setEffectiveFrom] = useState("");
  const [inputMode, setInputMode] = useState<CompensationInputMode>("GROSS_FIXED");
  const [amount, setAmount] = useState("");
  const [mealAllowanceDays, setMealAllowanceDays] = useState("0");
  const [transportAllowanceDays, setTransportAllowanceDays] = useState("0");
  const [plannedOvertimeHoursPerMonth, setPlannedOvertimeHoursPerMonth] = useState("0");
  const [applyEmployerIncentive, setApplyEmployerIncentive] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`${SECONDARY_BUTTON} mt-4`}
      >
        + Yeni Ücret Kaydı
      </button>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await apiClient.post(`/personnel/${employeeId}/compensation`, {
        effectiveFrom,
        inputMode,
        amount: Number(amount),
        mealAllowanceDays: Number(mealAllowanceDays),
        transportAllowanceDays: Number(transportAllowanceDays),
        plannedOvertimeHoursPerMonth: Number(plannedOvertimeHoursPerMonth),
        applyEmployerIncentive,
      });
      setOpen(false);
      setEffectiveFrom("");
      setAmount("");
      onCreated();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Ücret kaydı eklenemedi.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="mt-4 space-y-3 rounded-md bg-paper p-4">
      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className="block text-sm font-medium text-ink">Yürürlük Tarihi</label>
          <input
            required
            type="date"
            value={effectiveFrom}
            onChange={(e) => setEffectiveFrom(e.target.value)}
            className={INPUT_CLASS}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-ink">Girdi Türü</label>
          <select
            value={inputMode}
            onChange={(e) => setInputMode(e.target.value as CompensationInputMode)}
            className={INPUT_CLASS}
          >
            <option value="GROSS_FIXED">Brüt Sabit</option>
            <option value="NET_FIXED">Net Sabit</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-ink">Tutar (TRY)</label>
          <input
            required
            type="number"
            min="0"
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className={INPUT_CLASS}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-ink">
            Yemek Günü (aylık)
          </label>
          <input
            type="number"
            min="0"
            max="31"
            value={mealAllowanceDays}
            onChange={(e) => setMealAllowanceDays(e.target.value)}
            className={INPUT_CLASS}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-ink">Yol Günü (aylık)</label>
          <input
            type="number"
            min="0"
            max="31"
            value={transportAllowanceDays}
            onChange={(e) => setTransportAllowanceDays(e.target.value)}
            className={INPUT_CLASS}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-ink">
            Planlı Fazla Mesai (sa/ay)
          </label>
          <input
            type="number"
            min="0"
            step="0.5"
            value={plannedOvertimeHoursPerMonth}
            onChange={(e) => setPlannedOvertimeHoursPerMonth(e.target.value)}
            className={INPUT_CLASS}
          />
        </div>
      </div>

      <label className="flex items-center gap-2 text-sm text-ink">
        <input
          type="checkbox"
          checked={applyEmployerIncentive}
          onChange={(e) => setApplyEmployerIncentive(e.target.checked)}
          className="rounded border-rule"
        />
        İşveren SGK teşvikini uygula (5 puan)
      </label>

      {error ? <p className="text-sm text-brick">{error}</p> : null}

      <div className="flex gap-3">
        <button type="submit" disabled={submitting} className={PRIMARY_BUTTON}>
          {submitting ? "Ekleniyor…" : "Ekle"}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className={SECONDARY_BUTTON}
        >
          Vazgeç
        </button>
      </div>
    </form>
  );
}

function PayrollRunPanel() {
  const { state: scenariosState } = useScenarios();
  const [scenarioId, setScenarioId] = useState("");
  const [preview, setPreview] = useState<PayrollRunPreview | null>(null);
  const [committedLines, setCommittedLines] = useState<BudgetLine[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const runPreview = async () => {
    if (!scenarioId) return;
    setLoading(true);
    setError(null);
    setCommittedLines(null);
    try {
      const result = await apiClient.post<PayrollRunPreview>("/personnel/payroll-run", {
        scenarioId,
      });
      setPreview(result);
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Bordro önizlemesi hesaplanamadı.",
      );
    } finally {
      setLoading(false);
    }
  };

  const commit = async () => {
    if (!scenarioId) return;
    setLoading(true);
    setError(null);
    try {
      const result = await apiClient.post<BudgetLine[]>(
        "/personnel/payroll-run/commit",
        {
          scenarioId,
        },
      );
      setCommittedLines(result);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Bütçeye yazılamadı.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card
      title="Bordro Çalıştır"
      hint="Önizleme HİÇBİR ŞEY yazmaz — yalnızca 'Bütçeye Yaz' bütçeyi günceller."
    >
      <div className="flex items-end gap-3">
        <div className="flex-1">
          <label className="block text-sm font-medium text-ink">Senaryo</label>
          <select
            value={scenarioId}
            onChange={(e) => {
              setScenarioId(e.target.value);
              setPreview(null);
              setCommittedLines(null);
            }}
            className={INPUT_CLASS}
          >
            <option value="">Seçin…</option>
            {scenariosState.status === "ready"
              ? scenariosState.scenarios.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.fiscalYear})
                  </option>
                ))
              : null}
          </select>
        </div>
        <button
          type="button"
          onClick={runPreview}
          disabled={!scenarioId || loading}
          className={PRIMARY_BUTTON}
        >
          {loading ? "Hesaplanıyor…" : "Önizle"}
        </button>
      </div>

      {error ? <p className="mt-3 text-sm text-brick">{error}</p> : null}

      {preview ? (
        <div className="mt-4 space-y-4">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-rule text-left text-xs text-muted">
                <th className="py-2 pr-3">Ay</th>
                <th className="py-2 pr-3">Toplam İşveren Maliyeti</th>
              </tr>
            </thead>
            <tbody>
              {preview.monthlyTotals.map((t) => (
                <tr
                  key={t.month}
                  className="tabular border-b border-rule last:border-0"
                >
                  <td className="py-2 pr-3">{t.month}</td>
                  <td className="py-2 pr-3">
                    {formatAmount(t.totalEmployerCost, "TRY")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <details className="text-sm">
            <summary className="cursor-pointer font-medium text-ink">
              Personel bazlı ayrıntı ({preview.employees.length} satır)
            </summary>
            <table className="tabular mt-2 w-full text-xs">
              <thead>
                <tr className="border-b border-rule text-left text-muted">
                  <th className="py-1 pr-2">Personel</th>
                  <th className="py-1 pr-2">Ay</th>
                  <th className="py-1 pr-2">Brüt</th>
                  <th className="py-1 pr-2">SGK</th>
                  <th className="py-1 pr-2">Gelir V.</th>
                  <th className="py-1 pr-2">Damga V.</th>
                  <th className="py-1 pr-2">Net</th>
                  <th className="py-1 pr-2">İşveren Maliyeti</th>
                </tr>
              </thead>
              <tbody>
                {preview.employees.map((row) => (
                  <tr
                    key={`${row.employeeId}-${row.month}`}
                    className="border-b border-rule last:border-0"
                  >
                    <td className="py-1 pr-2">{row.employeeName}</td>
                    <td className="py-1 pr-2">{row.month}</td>
                    <td className="py-1 pr-2">{formatAmount(row.grossAmount)}</td>
                    <td className="py-1 pr-2">
                      {formatAmount(row.employeeSgkAndUnemployment)}
                    </td>
                    <td className="py-1 pr-2">{formatAmount(row.incomeTax)}</td>
                    <td className="py-1 pr-2">{formatAmount(row.stampTax)}</td>
                    <td className="py-1 pr-2">{formatAmount(row.netAmount)}</td>
                    <td className="py-1 pr-2">{formatAmount(row.employerCost)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </details>

          <button
            type="button"
            onClick={commit}
            disabled={loading}
            className={PRIMARY_BUTTON}
          >
            {loading ? "Yazılıyor…" : "Bütçeye Yaz"}
          </button>
        </div>
      ) : null}

      {committedLines ? (
        <p className="mt-3 text-sm text-ledger">
          {committedLines.length} bütçe satırı güncellendi — Bütçe Girişi ekranından
          kontrol edebilirsiniz.
        </p>
      ) : null}
    </Card>
  );
}

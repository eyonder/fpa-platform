const TONE_CLASS = {
  neutral: "text-ink",
  ledger: "text-ledger",
  brick: "text-brick",
} as const;

interface StatTileProps {
  label: string;
  value: string;
  hint?: string;
  tone?: keyof typeof TONE_CLASS;
}

/** Tek bir başlık metriği (KPI) — dataviz becerisindeki "hero figure" kalıbı. */
export function StatTile({ label, value, hint, tone = "neutral" }: StatTileProps) {
  return (
    <div className="rounded-lg border border-rule bg-surface p-4">
      <p className="text-xs tracking-wide text-muted uppercase">{label}</p>
      <p className={`tabular mt-1 text-2xl font-semibold ${TONE_CLASS[tone]}`}>
        {value}
      </p>
      {hint ? <p className="mt-1 text-xs text-muted">{hint}</p> : null}
    </div>
  );
}

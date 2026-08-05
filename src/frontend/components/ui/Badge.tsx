const TONES = {
  neutral: "bg-paper text-muted",
  ledger: "bg-ledger-soft text-ledger",
  brick: "bg-brick-soft text-brick",
} as const;

export function Badge({
  tone = "neutral",
  children,
}: {
  tone?: keyof typeof TONES;
  children: React.ReactNode;
}) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${TONES[tone]}`}
    >
      {children}
    </span>
  );
}

export function Card({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-lg border border-rule bg-surface">
      <header className="flex items-baseline justify-between gap-4 border-b border-rule px-5 py-3">
        <h2 className="text-sm font-semibold tracking-tight">{title}</h2>
        {hint ? <p className="text-xs text-muted">{hint}</p> : null}
      </header>
      <div className="px-5 py-4">{children}</div>
    </section>
  );
}

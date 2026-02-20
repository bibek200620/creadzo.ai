export default function StatCard({ label, value, subtext, tone = "default" }) {
  const toneClasses =
    tone === "success"
      ? "border-emerald-200 bg-emerald-50/60 dark:border-emerald-900 dark:bg-emerald-950/20"
      : tone === "warning"
        ? "border-amber-200 bg-amber-50/60 dark:border-amber-900 dark:bg-amber-950/20"
        : "border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900";

  return (
    <div className={`rounded-2xl border p-4 shadow-sm ${toneClasses}`}>
      <p className="text-xs uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">{label}</p>
      <p className="mt-1 text-2xl font-bold text-slate-900 dark:text-slate-100">{value}</p>
      {subtext ? <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{subtext}</p> : null}
    </div>
  );
}

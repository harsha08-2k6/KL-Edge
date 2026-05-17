export function MetricCard({ label, value, helper, tone = "bg-white" }) {
  return (
    <section className={`${tone} rounded-lg border border-ink/10 p-3 shadow-soft`}>
      <div className="flex items-center justify-between gap-2">
        <p className="text-[10px] font-black uppercase tracking-widest text-ink/40">{label}</p>
        <span className="h-2 w-2 rounded-full bg-mint" aria-hidden="true" />
      </div>
      <p className="mt-2 rounded-md border border-ink/10 bg-surface px-2.5 py-1.5 text-xl font-black tracking-normal text-ink">
        {value}
      </p>
      {helper ? <p className="mt-1.5 text-xs font-semibold text-ink/55">{helper}</p> : null}
    </section>
  );
}


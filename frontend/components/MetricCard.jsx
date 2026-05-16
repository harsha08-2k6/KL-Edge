export function MetricCard({ label, value, helper, tone = "bg-white" }) {
  return (
    <section className={`${tone} rounded-lg border border-ink/10 p-4 shadow-soft`}>
      <p className="text-sm font-bold text-ink/62">{label}</p>
      <p className="mt-2 text-3xl font-black tracking-normal text-ink">{value}</p>
      {helper ? <p className="mt-2 text-sm font-semibold text-ink/60">{helper}</p> : null}
    </section>
  );
}


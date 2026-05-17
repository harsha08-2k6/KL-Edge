const toneClasses = {
  safe: "bg-mint/15 text-mint",
  good: "bg-lime/25 text-ink",
  warning: "bg-amber/20 text-amber",
  danger: "bg-coral/15 text-coral"
};

export function StatusPill({ status }) {
  return (
    <span className={`inline-flex h-6 items-center rounded-full px-2.5 text-xs font-bold ${toneClasses[status.tone] || toneClasses.warning}`}>
      {status.label}
    </span>
  );
}


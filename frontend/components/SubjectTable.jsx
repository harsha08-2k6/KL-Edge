import { StatusPill } from "./StatusPill.jsx";

const cells = ["L", "T", "P", "S"];
const cellLabel = { L: "Lecture", T: "Tutorial", P: "Practical", S: "Skill" };

export function SubjectTable({ subjects }) {
  return (
    <div className="space-y-2.5">
      {subjects.map((subject) => (
        <div key={subject.courseCode} className="rounded-lg border border-border bg-paper p-2.5 shadow-soft">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-bold uppercase tracking-wider text-ink/40">{subject.courseCode}</p>
              <p className="mt-0.5 truncate text-sm font-black text-ink">{subject.subject}</p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <span className="text-base font-black text-ink">{subject.final}%</span>
              <StatusPill status={subject.status} />
            </div>
          </div>

          <div className="mt-2.5 grid grid-cols-4 gap-1.5 overflow-x-auto">
            {cells.map((cell) => {
              if (subject[cell] == null) return null;
              return (
                <div key={cell} className="rounded-lg bg-surface p-1.5 text-center">
                  <p className="text-[9px] font-black uppercase tracking-wider text-ink/40">{cellLabel[cell]}</p>
                  <p className="mt-0.5 text-sm font-black text-ink">{subject[cell]}%</p>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}


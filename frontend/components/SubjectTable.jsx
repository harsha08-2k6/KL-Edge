import { StatusPill } from "./StatusPill.jsx";

const cells = ["L", "T", "P", "S"];
const cellLabel = { L: "Lecture", T: "Tutorial", P: "Practical", S: "Skill" };

export function SubjectTable({ subjects }) {
  return (
    <div className="space-y-2.5">
      {subjects.map((subject) => {
        const hasLtpsData = cells.some((cell) => subject[cell] != null);

        return (
          <div key={subject.courseCode} className="rounded-lg border border-border bg-paper p-2.5 shadow-soft">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-bold uppercase tracking-wider text-ink/40">{subject.courseCode}</p>
                <p className="mt-0.5 truncate text-sm font-black text-ink">{subject.subject}</p>
                {(subject.faculty || subject.facultyName) && (
                  <p className="mt-0.5 truncate text-xs font-semibold text-ink/60">{subject.faculty || subject.facultyName}</p>
                )}
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <span className="text-base font-black text-ink">{subject.final}%</span>
                <StatusPill status={subject.status} />
              </div>
            </div>

            {/* LTPS breakdown */}
            {hasLtpsData && (
              <div className="mt-2.5 grid grid-cols-2 md:grid-cols-4 gap-1.5 overflow-x-auto">
                {cells.map((cell) => {
                  if (subject[cell] == null) return null;
                  const conducted = subject[`${cell}_conducted`];
                  const attended = subject[`${cell}_attended`];
                  return (
                    <div key={cell} className="rounded-lg bg-surface p-1.5">
                      <div className="flex items-center justify-between">
                        <p className="text-[9px] font-black uppercase tracking-wider text-ink/40">{cellLabel[cell]}</p>
                        <span className={`text-[10px] font-black ${subject[cell] >= 85 ? "text-mint" : subject[cell] >= 75 ? "text-lime" : subject[cell] >= 65 ? "text-amber" : "text-coral"}`}>
                          {subject[cell]}%
                        </span>
                      </div>
                      {conducted != null && attended != null && (
                        <p className="mt-0.5 text-[10px] font-bold text-ink/50">
                          {attended}/{conducted} classes
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

          </div>
        );
      })}


    </div>
  );
}

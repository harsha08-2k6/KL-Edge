import { StatusPill } from "./StatusPill.jsx";

const cells = ["L", "T", "P", "S"];
const cellLabel = { L: "Lecture", T: "Tutorial", P: "Practical", S: "Skill" };

export function SubjectTable({ subjects }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
      {subjects.map((subject) => {
        const activeCells = cells.filter((cell) => subject[cell] != null);
        const hasLtpsData = activeCells.length > 0;

        return (
          <div key={subject.courseCode} className="rounded-xl border border-border bg-paper p-3.5 md:p-4 shadow-soft flex flex-col justify-between h-full">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <p className="text-[10px] md:text-xs font-bold uppercase tracking-wider text-ink/40">{subject.courseCode}</p>
                  {subject.section && (
                    <span className="rounded bg-surface px-1.5 py-0.5 text-[9px] font-bold text-ink/60">
                      Sec {subject.section}
                    </span>
                  )}
                </div>
                <p className="mt-1 text-sm md:text-base font-black text-ink leading-snug">{subject.subject}</p>
                {(subject.faculty || subject.facultyName) && (
                  <p className="mt-1 truncate text-xs font-semibold text-ink/60">{subject.faculty || subject.facultyName}</p>
                )}
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <span className="text-base md:text-lg font-black text-ink">{subject.final}%</span>
                <StatusPill status={subject.status} />
              </div>
            </div>

            {/* LTPS breakdown */}
            {hasLtpsData && (
              <div className="mt-3 pt-3 border-t border-ink/5 grid grid-cols-2 gap-2">
                {activeCells.map((cell, idx) => {
                  const conducted = subject[`${cell}_conducted`];
                  const attended = subject[`${cell}_attended`];
                  const isLastOdd = activeCells.length % 2 !== 0 && idx === activeCells.length - 1;

                  return (
                    <div
                      key={cell}
                      className={`${isLastOdd ? "col-span-2" : "col-span-1"} rounded-lg bg-surface px-2.5 py-2 flex flex-col justify-between`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[9px] md:text-[10px] font-black uppercase tracking-wider text-ink/40 truncate">
                          {cellLabel[cell]}
                        </span>
                        <span
                          className={`shrink-0 text-[10px] md:text-xs font-black ${
                            subject[cell] >= 85
                              ? "text-mint"
                              : subject[cell] >= 75
                              ? "text-lime"
                              : subject[cell] >= 65
                              ? "text-amber"
                              : "text-coral"
                          }`}
                        >
                          {subject[cell]}%
                        </span>
                      </div>
                      {conducted != null && attended != null && (
                        <p className="mt-1 text-[10px] md:text-xs font-bold text-ink/50 whitespace-nowrap">
                          {attended}/{conducted} classes
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {!hasLtpsData && subject.conducted != null && subject.attended != null && (
              <div className="mt-3 pt-3 border-t border-ink/5">
                <div className="rounded-lg bg-surface px-2.5 py-2 flex items-center justify-between gap-2">
                  <p className="text-[9px] md:text-[10px] font-black uppercase tracking-wider text-ink/40">Classes</p>
                  <p className="text-[10px] md:text-xs font-bold text-ink/50 whitespace-nowrap">
                    {subject.attended}/{subject.conducted} classes {subject.absent != null ? `(${subject.absent} absent)` : ""}
                  </p>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

import { useEffect, useMemo, useState } from "react";
import { Layout } from "../components/Layout.jsx";
import { readLocal, STORAGE_KEYS } from "../utils/storage.js";

export default function Cgpa() {
  const [rawCgpa, setRawCgpa] = useState(null);
  const [syncOptions, setSyncOptions] = useState({});

  useEffect(() => {
    setRawCgpa(readLocal(STORAGE_KEYS.cgpa, null));
    setSyncOptions(readLocal(STORAGE_KEYS.syncOptions, {}));
  }, []);

  const cgpa = useMemo(() => {
    if (typeof rawCgpa === "number") return { value: rawCgpa, semesters: [], subjects: [] };
    if (rawCgpa && typeof rawCgpa === "object") return { semesters: [], subjects: [], ...rawCgpa };
    return null;
  }, [rawCgpa]);

  return (
    <Layout title="CGPA">
      {cgpa ? (
        <div className="space-y-4">
          <section className="rounded-lg border border-ink/10 bg-white p-4 text-center shadow-soft">
            <p className="text-[10px] font-black uppercase tracking-widest text-ink/40">Overall CGPA</p>
            <p className="mt-2 text-3xl font-black text-ink">{cgpa.value != null ? cgpa.value : "--"}</p>
            {cgpa.updatedAt ? (
              <p className="mt-1 text-xs font-semibold text-ink/45">
                Updated {new Date(cgpa.updatedAt).toLocaleDateString()}
              </p>
            ) : null}
          </section>

          <section className="space-y-2.5">
            <h2 className="text-sm font-black text-ink">Subject Wise CGPA</h2>
            {cgpa.subjects?.length > 0 ? (
              <div className="space-y-2">
                {cgpa.subjects.map((sub, idx) => (
                  <article key={idx} className="flex items-center justify-between gap-3 rounded-lg border border-ink/10 bg-white p-3 shadow-soft">
                    <div className="min-w-0 flex-1">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-ink/40">{sub.courseCode || "Course"}</p>
                      <p className="mt-0.5 truncate text-sm font-black text-ink">{sub.subject || "Subject"}</p>
                      {sub.credits ? (
                        <p className="mt-0.5 text-[10px] font-semibold text-ink/50">Credits: {sub.credits}</p>
                      ) : null}
                    </div>
                    <div className="flex shrink-0 items-center gap-2 text-right">
                      {sub.points ? (
                        <div className="hidden sm:block">
                          <p className="text-[9px] font-semibold text-ink/40">Points</p>
                          <p className="text-sm font-black text-ink">{sub.points}</p>
                        </div>
                      ) : null}
                      <div className="rounded-md bg-surface px-2.5 py-1.5">
                        <p className="text-[9px] font-bold uppercase text-ink/40">Grade</p>
                        <p className="text-base font-black text-ink">{sub.grade}</p>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <div className="rounded-lg border border-dashed border-ink/15 bg-white p-4 text-center">
                <p className="text-sm font-semibold text-ink/50">No subject-wise grades found.</p>
              </div>
            )}
          </section>
        </div>
      ) : (
        <div className="rounded-lg border border-dashed border-ink/25 bg-white p-4 text-center shadow-soft">
          <p className="font-black text-ink/60">No CGPA saved yet</p>
          <p className="mt-1 text-sm text-ink/40">Add CGPA data from ERP to see it here.</p>
        </div>
      )}
    </Layout>
  );
}

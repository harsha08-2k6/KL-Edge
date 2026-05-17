import { useEffect, useMemo, useState } from "react";
import { Layout } from "../components/Layout.jsx";
import { readLocal, STORAGE_KEYS } from "../utils/storage.js";

const markKeys = {
  courseCode: ["courseCode", "course_code", "code", "subjectCode", "subject_code"],
  subject: ["subject", "course", "courseTitle", "courseName", "name", "title"],
  insem1: ["insem1", "inSem1", "inSemester1", "internal1", "mid1", "midterm1", "insem_1"],
  insem2: ["insem2", "inSem2", "inSemester2", "internal2", "mid2", "midterm2", "insem_2"],
  total: ["total", "totalMarks", "overall", "score"]
};

function pickValue(row, keys) {
  if (!row) return null;
  for (const key of keys) {
    if (row[key] != null && row[key] !== "") return row[key];
  }
  return null;
}

function normalizeMarks(raw) {
  const rows = Array.isArray(raw) ? raw : raw?.marks || raw?.data || [];
  if (!Array.isArray(rows)) return [];

  return rows
    .map((row, index) => {
      const courseCode = pickValue(row, markKeys.courseCode);
      const subject = pickValue(row, markKeys.subject);
      const insem1 = pickValue(row, markKeys.insem1);
      const insem2 = pickValue(row, markKeys.insem2);
      const total = pickValue(row, markKeys.total);

      return {
        id: courseCode || subject || `row-${index}`,
        courseCode,
        subject,
        insem1,
        insem2,
        total
      };
    })
    .filter((row) => row.courseCode || row.subject || row.insem1 != null || row.insem2 != null);
}

function displayScore(value) {
  if (value == null || value === "") return "--";
  return value;
}

export default function Marks() {
  const [rawMarks, setRawMarks] = useState([]);

  useEffect(() => {
    setRawMarks(readLocal(STORAGE_KEYS.marks, []));
  }, []);

  const marks = useMemo(() => normalizeMarks(rawMarks), [rawMarks]);

  return (
    <Layout title="Marks">
      <div className="rounded-lg border border-ink/10 bg-white p-3 text-xs font-semibold text-ink/50 shadow-soft">
        In-Semester 1 and 2 marks come from ERP Courses -> Internals.
      </div>

      {marks.length ? (
        <section className="mt-3 space-y-2.5">
          {marks.map((row) => (
            <article key={row.id} className="rounded-lg border border-ink/10 bg-white p-2.5 shadow-soft">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-ink/40">{row.courseCode || "Course"}</p>
                  <p className="mt-0.5 truncate text-sm font-black text-ink">{row.subject || "Subject"}</p>
                </div>
                {row.total != null && (
                  <span className="rounded-full bg-surface px-2.5 py-1 text-xs font-black text-ink/60">
                    Total {displayScore(row.total)}
                  </span>
                )}
              </div>

              <div className="mt-2.5 grid grid-cols-2 gap-2">
                <div className="rounded-lg bg-surface p-2 text-center">
                  <p className="text-[10px] font-black uppercase tracking-wider text-ink/40">In-Sem 1</p>
                  <p className="mt-1 text-lg font-black text-ink">{displayScore(row.insem1)}</p>
                </div>
                <div className="rounded-lg bg-surface p-2 text-center">
                  <p className="text-[10px] font-black uppercase tracking-wider text-ink/40">In-Sem 2</p>
                  <p className="mt-1 text-lg font-black text-ink">{displayScore(row.insem2)}</p>
                </div>
              </div>
            </article>
          ))}
        </section>
      ) : (
        <div className="mt-3 rounded-lg border border-dashed border-ink/25 bg-white p-4 text-center shadow-soft">
          <p className="font-black text-ink/60">No marks synced yet</p>
          <p className="mt-1 text-sm text-ink/40">Sync from ERP and the in-semester marks will appear here.</p>
        </div>
      )}
    </Layout>
  );
}

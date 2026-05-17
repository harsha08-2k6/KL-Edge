import { useEffect, useMemo, useState } from "react";
import { Layout } from "../components/Layout.jsx";
import { readLocal, STORAGE_KEYS } from "../utils/storage.js";

function buildMeta(entry) {
  const parts = [];
  if (entry.examType) parts.push(entry.examType);
  if (entry.examSlot) parts.push(`Slot ${String(entry.examSlot).toUpperCase()}`);
  if (entry.room) parts.push(`Room ${entry.room}`);
  if (entry.seat) parts.push(`Seat ${entry.seat}`);
  if (entry.block) parts.push(`Block ${entry.block}`);
  if (entry.date) parts.push(entry.date);
  if (entry.time) parts.push(entry.time);
  return parts.join(" · ");
}

function parseMonth(dateText) {
  if (!dateText) return null;
  const isoMatch = String(dateText).match(/(\d{4})[-/](\d{2})[-/](\d{2})/);
  if (isoMatch) return Number(isoMatch[2]);
  const altMatch = String(dateText).match(/(\d{2})[-/](\d{2})[-/](\d{4})/);
  if (altMatch) return Number(altMatch[2]);
  return null;
}

function parseDateValue(dateText) {
  if (!dateText) return null;
  const isoMatch = String(dateText).match(/(\d{4})[-/](\d{2})[-/](\d{2})/);
  if (isoMatch) {
    const year = Number(isoMatch[1]);
    const month = Number(isoMatch[2]) - 1;
    const day = Number(isoMatch[3]);
    return new Date(year, month, day).getTime();
  }
  const altMatch = String(dateText).match(/(\d{2})[-/](\d{2})[-/](\d{4})/);
  if (altMatch) {
    const day = Number(altMatch[1]);
    const month = Number(altMatch[2]) - 1;
    const year = Number(altMatch[3]);
    return new Date(year, month, day).getTime();
  }
  return null;
}

function parseSlotValue(slotText) {
  if (!slotText) return 0;
  const text = String(slotText).toLowerCase();
  if (text.includes("am")) return 1;
  if (text.includes("pm")) return 2;
  return 0;
}

function getExamType(entry) {
  return String(entry.examType || entry.exam_type || entry.type || "").trim();
}

function isInSemester(entry) {
  const text = getExamType(entry).toLowerCase();
  return text.includes("in sem") || text.includes("insem") || text.includes("in semester");
}

function isEndSemester(entry) {
  const text = getExamType(entry).toLowerCase();
  return text.includes("end sem") || text.includes("end semester");
}

function getInSemBucket(entry, splitMonth) {
  const text = getExamType(entry).toLowerCase();
  if (/(in\s*sem|semester)\s*[- ]?(2|ii)\b/.test(text)) return "insem2";
  if (/(in\s*sem|semester)\s*[- ]?(1|i)\b/.test(text)) return "insem1";

  const month = parseMonth(entry.date);
  if (splitMonth && month) {
    return month <= splitMonth ? "insem1" : "insem2";
  }
  return "insem1";
}

export default function SeatingPlan() {
  const [rawPlan, setRawPlan] = useState([]);

  useEffect(() => {
    setRawPlan(readLocal(STORAGE_KEYS.seatingPlan, []));
  }, []);

  const entries = useMemo(() => {
    if (Array.isArray(rawPlan)) return rawPlan;
    if (rawPlan && Array.isArray(rawPlan.entries)) return rawPlan.entries;
    return [];
  }, [rawPlan]);

  const groups = useMemo(() => {
    if (!entries.length) return [];

    const normalized = entries.map((entry) => ({
      ...entry,
      examType: getExamType(entry)
    }));

    const sorted = [...normalized].sort((a, b) => {
      const aDate = parseDateValue(a.date);
      const bDate = parseDateValue(b.date);
      if (aDate != null && bDate != null && aDate !== bDate) {
        return aDate - bDate;
      }
      if (aDate != null && bDate == null) return -1;
      if (aDate == null && bDate != null) return 1;

      const aSlot = parseSlotValue(a.examSlot || a.time);
      const bSlot = parseSlotValue(b.examSlot || b.time);
      if (aSlot !== bSlot) return aSlot - bSlot;

      const aKey = `${a.courseCode || ""}${a.subject || ""}`.toLowerCase();
      const bKey = `${b.courseCode || ""}${b.subject || ""}`.toLowerCase();
      return aKey.localeCompare(bKey);
    });

    const inSemEntries = sorted.filter(isInSemester);
    const endSemEntries = sorted.filter(isEndSemester);
    const otherEntries = sorted.filter((entry) => !isInSemester(entry) && !isEndSemester(entry));

    const inSemMonths = Array.from(
      new Set(inSemEntries.map((entry) => parseMonth(entry.date)).filter(Boolean))
    ).sort((a, b) => a - b);
    const splitMonth = inSemMonths.length > 1
      ? inSemMonths[Math.floor((inSemMonths.length - 1) / 2)]
      : null;

    const inSem1 = [];
    const inSem2 = [];

    inSemEntries.forEach((entry) => {
      const bucket = getInSemBucket(entry, splitMonth);
      if (bucket === "insem2") {
        inSem2.push(entry);
      } else {
        inSem1.push(entry);
      }
    });

    const result = [];
    if (inSem1.length) result.push({ id: "insem1", label: "In-Semester 1", items: inSem1 });
    if (inSem2.length) result.push({ id: "insem2", label: "In-Semester 2", items: inSem2 });
    if (endSemEntries.length) result.push({ id: "endsem", label: "Semester Exams", items: endSemEntries });
    if (otherEntries.length) result.push({ id: "other", label: "Other", items: otherEntries });
    return result;
  }, [entries]);

  return (
    <Layout title="Seating Plan">
      {entries.length ? (
        <section className="space-y-4">
          {groups.map((group) => (
            <div key={group.id} className="space-y-2.5">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-black text-ink">{group.label}</h2>
                <span className="rounded-full bg-surface px-2.5 py-1 text-[10px] font-black text-ink/55">
                  {group.items.length} exam{group.items.length === 1 ? "" : "s"}
                </span>
              </div>
              {group.items.map((entry, index) => {
                const title = entry.subject || entry.course || entry.title || "Seating";
                const code = entry.courseCode || entry.code || entry.subjectCode;
                const meta = buildMeta(entry);

                return (
                  <article key={`${group.id}-${code || title}-${index}`} className="rounded-lg border border-ink/10 bg-white p-3 shadow-soft">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-ink/40">{code || "Course"}</p>
                        <p className="mt-0.5 truncate text-sm font-black text-ink">{title}</p>
                      </div>
                    </div>
                    {meta ? <p className="mt-2 text-xs font-semibold text-ink/55">{meta}</p> : null}
                  </article>
                );
              })}
            </div>
          ))}
        </section>
      ) : (
        <div className="rounded-lg border border-dashed border-ink/25 bg-white p-4 text-center shadow-soft">
          <p className="font-black text-ink/60">No seating plan saved yet</p>
          <p className="mt-1 text-sm text-ink/40">Add seating details from ERP to view them here.</p>
        </div>
      )}
    </Layout>
  );
}

import { Plus, RotateCcw, Save } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Layout } from "../components/Layout.jsx";
import { readLocal, STORAGE_KEYS, writeLocal } from "../utils/storage.js";
import { extractTimetableCourseCodes, normalizeSubjectKey } from "../utils/timetable.js";

function getAttendanceKey(item) {
  return normalizeSubjectKey(item?.courseCode || item?.code || item?.subjectCode);
}

export default function SubjectNames() {
  const [attendance, setAttendance] = useState([]);
  const [timetable, setTimetable] = useState({ grid: [], mappings: [] });
  const [syncOptions, setSyncOptions] = useState({});
  const [subjectNames, setSubjectNames] = useState({});
  const [newKey, setNewKey] = useState("");
  const [newName, setNewName] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    setAttendance(readLocal(STORAGE_KEYS.attendance, []));
    setTimetable(readLocal(STORAGE_KEYS.timetable, { grid: [], mappings: [] }));
    setSyncOptions(readLocal(STORAGE_KEYS.syncOptions, {}));
    setSubjectNames(readLocal(STORAGE_KEYS.subjectNames, {}));
  }, []);

  const timetableCodes = useMemo(() => extractTimetableCourseCodes(timetable), [timetable]);

  const rows = useMemo(() => {
    const byKey = new Map();
    const attendanceNames = new Map();

    attendance.forEach((item) => {
      const key = getAttendanceKey(item);
      const subject = String(item?.subject || item?.course || item?.title || "").trim();
      if (key && subject) {
        attendanceNames.set(key, subject);
      }
      if (key && subject && !byKey.has(key)) {
        byKey.set(key, {
          key,
          defaultName: subject,
          source: "Attendance"
        });
      }
    });

    timetableCodes.forEach((key) => {
      if (byKey.has(key)) {
        byKey.set(key, {
          ...byKey.get(key),
          source: "Attendance + Timetable"
        });
        return;
      }

      byKey.set(key, {
        key,
        defaultName: attendanceNames.get(key) || "",
        source: "Timetable"
      });
    });

    Object.keys(subjectNames).forEach((key) => {
      const normalizedKey = normalizeSubjectKey(key);
      if (normalizedKey && !byKey.has(normalizedKey)) {
        byKey.set(normalizedKey, {
          key: normalizedKey,
          defaultName: "",
          source: "Custom"
        });
      }
    });

    return Array.from(byKey.values()).sort((a, b) => a.key.localeCompare(b.key));
  }, [attendance, subjectNames, timetableCodes]);

  const selectedTerm = [
    timetable?.academicYear || syncOptions.academicYear,
    timetable?.semesterId || syncOptions.semesterId
  ].filter(Boolean).join(" / ");
  const timetableCodeCount = timetableCodes.length;

  const updateName = (key, value) => {
    setSubjectNames((current) => ({
      ...current,
      [normalizeSubjectKey(key)]: value
    }));
  };

  const resetName = (key) => {
    setSubjectNames((current) => {
      const next = { ...current };
      delete next[normalizeSubjectKey(key)];
      return next;
    });
  };

  const saveNames = () => {
    const cleaned = {};
    Object.entries(subjectNames).forEach(([key, value]) => {
      const normalizedKey = normalizeSubjectKey(key);
      const name = String(value || "").trim();
      if (normalizedKey && name) {
        cleaned[normalizedKey] = name;
      }
    });

    setSubjectNames(cleaned);
    writeLocal(STORAGE_KEYS.subjectNames, cleaned);
    setMessage("Subject names saved.");
    window.setTimeout(() => setMessage(""), 2200);
  };

  const addCustomName = () => {
    const key = normalizeSubjectKey(newKey);
    const name = newName.trim();
    if (!key || !name) {
      setMessage("Enter a timetable code/text and subject name.");
      return;
    }

    setSubjectNames((current) => ({
      ...current,
      [key]: name
    }));
    setNewKey("");
    setNewName("");
    setMessage("Custom subject added. Save to keep it.");
  };

  return (
    <Layout title="Subject Names">
      <div className="rounded-xl border border-ink/10 bg-white p-3 shadow-soft">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-ink/40">Timetable Display</p>
            <h2 className="text-xl font-black text-ink">Subject Names</h2>
            <p className="mt-0.5 text-xs font-semibold text-ink/50">
              {selectedTerm || "No year or semester selected"} - {timetableCodeCount} timetable code{timetableCodeCount === 1 ? "" : "s"}
            </p>
          </div>
          <button
            type="button"
            onClick={saveNames}
            className="tap inline-flex h-10 items-center gap-1.5 rounded-lg bg-ink px-3 text-sm font-bold text-paper shadow-soft"
          >
            <Save size={15} />
            Save
          </button>
        </div>

        {message && (
          <p className="mt-3 rounded-lg bg-surface px-3 py-2 text-xs font-bold text-ink/60">{message}</p>
        )}

        <div className="mt-3 grid gap-2 md:grid-cols-[1fr_1.4fr_auto]">
          <input
            value={newKey}
            onChange={(event) => setNewKey(event.target.value)}
            placeholder="Course code or timetable text"
            className="h-11 rounded-lg border border-ink/10 bg-paper px-3 text-sm font-bold text-ink outline-none focus:border-ink/30"
          />
          <input
            value={newName}
            onChange={(event) => setNewName(event.target.value)}
            placeholder="Subject name"
            className="h-11 rounded-lg border border-ink/10 bg-paper px-3 text-sm font-bold text-ink outline-none focus:border-ink/30"
          />
          <button
            type="button"
            onClick={addCustomName}
            className="tap inline-flex h-11 items-center justify-center gap-1.5 rounded-lg border border-ink/10 bg-paper px-3 text-sm font-black text-ink"
          >
            <Plus size={15} />
            Add
          </button>
        </div>
      </div>

      <div className="mt-3 space-y-2">
        {rows.length ? (
          rows.map((row) => {
            const displayValue = subjectNames[row.key] ?? row.defaultName;

            return (
              <article key={row.key} className="rounded-lg border border-ink/10 bg-white p-3 shadow-soft">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-[10px] font-black uppercase tracking-wider text-ink/40">{row.source}</p>
                    <p className="truncate text-sm font-black text-ink">{row.key}</p>
                    {row.defaultName && (
                      <p className="mt-0.5 truncate text-xs font-semibold text-ink/50">{row.defaultName}</p>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => resetName(row.key)}
                    title="Reset name"
                    aria-label={`Reset ${row.key}`}
                    className="tap inline-flex h-9 w-9 items-center justify-center rounded-lg border border-ink/10 bg-paper text-ink/60"
                  >
                    <RotateCcw size={14} />
                  </button>
                </div>
                <input
                  value={displayValue}
                  onChange={(event) => updateName(row.key, event.target.value)}
                  placeholder="Subject name"
                  className="mt-2 h-11 w-full rounded-lg border border-ink/10 bg-paper px-3 text-sm font-bold text-ink outline-none focus:border-ink/30"
                />
              </article>
            );
          })
        ) : (
          <div className="rounded-lg border border-dashed border-ink/15 bg-white p-5 text-center shadow-soft">
            <p className="font-black text-ink/60">No attendance subjects yet.</p>
            <p className="mt-1 text-sm font-semibold text-ink/40">Sync attendance or add a custom timetable subject above.</p>
          </div>
        )}
      </div>
    </Layout>
  );
}

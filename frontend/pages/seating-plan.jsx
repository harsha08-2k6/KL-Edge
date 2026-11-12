import { useEffect, useMemo, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import { Settings, RefreshCw, Calendar, MapPin, Armchair, Clock } from "lucide-react";
import { Layout } from "../components/Layout.jsx";
import { readLocal, STORAGE_KEYS, writeLocal, mergeSeatingPlans } from "../utils/storage.js";
import { fetchSeatingPlan, fetchTimetable, syncSeatingPlanOnly } from "../utils/api.js";
import {
  buildMeta,
  parseMonth,
  parseDateValue,
  parseSlotValue,
  formatSlotText,
  getExamType,
  matchesAcademicYear,
  matchesSemester,
  matchesStudent,
  getExamGroup
} from "../utils/seating.js";

export default function SeatingPlan() {
  const [rawPlan, setRawPlan] = useState([]);
  const [attendance, setAttendance] = useState([]);
  const [syncOptions, setSyncOptions] = useState({});
  const [credentials, setCredentials] = useState({});
  const [isFetching, setIsFetching] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [refreshMessage, setRefreshMessage] = useState("");

  const reloadSettings = useCallback(() => {
    setRawPlan(readLocal(STORAGE_KEYS.seatingPlan, []));
    setAttendance(readLocal(STORAGE_KEYS.attendance, []));
    setSyncOptions(readLocal(STORAGE_KEYS.syncOptions, {}));
    setCredentials(readLocal(STORAGE_KEYS.credentials, {}));
  }, []);

  useEffect(() => {
    reloadSettings();

    // Auto-refresh when student changes settings in another tab or navigates back
    const handleStorage = (e) => {
      if (
        !e.key ||
        e.key === STORAGE_KEYS.syncOptions ||
        e.key === STORAGE_KEYS.credentials ||
        e.key === STORAGE_KEYS.seatingPlan
      ) {
        reloadSettings();
      }
    };

    window.addEventListener("storage", handleStorage);
    window.addEventListener("focus", reloadSettings);
    return () => {
      window.removeEventListener("storage", handleStorage);
      window.removeEventListener("focus", reloadSettings);
    };
  }, [reloadSettings]);

  // Fetch backend-filtered seating plan and timetable metadata concurrently using Promise.allSettled
  useEffect(() => {
    if (credentials.erpId && syncOptions.academicYear && syncOptions.semesterId) {
      setIsFetching(true);
      const query = {
        erpId: credentials.erpId,
        academicYear: syncOptions.academicYear,
        semesterId: syncOptions.semesterId
      };

      Promise.allSettled([
        fetchSeatingPlan(query),
        fetchTimetable(query)
      ])
        .then(([seatingOutcome, timetableOutcome]) => {
          if (
            seatingOutcome.status === "fulfilled" &&
            seatingOutcome.value?.seatingPlan &&
            Array.isArray(seatingOutcome.value.seatingPlan) &&
            seatingOutcome.value.seatingPlan.length > 0
          ) {
            const currentStored = readLocal(STORAGE_KEYS.seatingPlan, []);
            const updated = mergeSeatingPlans(currentStored, seatingOutcome.value.seatingPlan);
            writeLocal(STORAGE_KEYS.seatingPlan, updated);
            setRawPlan(updated);
          }

          if (
            timetableOutcome.status === "fulfilled" &&
            timetableOutcome.value?.mappings &&
            Array.isArray(timetableOutcome.value.mappings) &&
            timetableOutcome.value.mappings.length > 0
          ) {
            const currentTT = readLocal(STORAGE_KEYS.timetable, { grid: [], mappings: [] });
            if (!currentTT.mappings || currentTT.mappings.length === 0) {
              writeLocal(STORAGE_KEYS.timetable, { ...currentTT, mappings: timetableOutcome.value.mappings });
            }
          }
        })
        .finally(() => setIsFetching(false));
    }
  }, [credentials.erpId, syncOptions.academicYear, syncOptions.semesterId]);

  const handleRefreshSeating = async () => {
    if (!credentials.erpId || !credentials.password) {
      setRefreshMessage("Please enter your ERP credentials in Login Settings first.");
      setTimeout(() => setRefreshMessage(""), 4000);
      return;
    }
    if (!syncOptions.academicYear || !syncOptions.semesterId) {
      setRefreshMessage("Please choose your academic year and semester in Login Settings.");
      setTimeout(() => setRefreshMessage(""), 4000);
      return;
    }

    setIsRefreshing(true);
    setRefreshMessage("");

    try {
      const captchaSessionId = readLocal(STORAGE_KEYS.captchaSessionId, "");
      const res = await syncSeatingPlanOnly({
        erpId: credentials.erpId,
        password: credentials.password,
        academicYear: syncOptions.academicYear,
        semesterId: syncOptions.semesterId,
        captchaSessionId,
        forceRefresh: true
      });

      if (res && res.seatingPlan && Array.isArray(res.seatingPlan)) {
        const currentStored = readLocal(STORAGE_KEYS.seatingPlan, []);
        const updated = mergeSeatingPlans(currentStored, res.seatingPlan);
        writeLocal(STORAGE_KEYS.seatingPlan, updated);
        setRawPlan(updated);
        setRefreshMessage(`Seating synchronized! Found ${res.count ?? res.seatingPlan.length} exam arrangements. ✅`);
      } else {
        setRefreshMessage("Sync completed. No new seating arrangements found on ERP.");
      }
    } catch (err) {
      console.error("[seating:sync] Error:", err);
      setRefreshMessage("Seating sync failed. Please check ERP credentials or portal status.");
    } finally {
      setIsRefreshing(false);
      setTimeout(() => setRefreshMessage(""), 4000);
    }
  };

  const entries = useMemo(() => {
    if (Array.isArray(rawPlan)) return rawPlan;
    if (rawPlan && Array.isArray(rawPlan.entries)) return rawPlan.entries;
    return [];
  }, [rawPlan]);

  // Dynamic heading reflecting selected Academic Year and Semester from Login Settings
  const pageHeading = useMemo(() => {
    const parts = [];
    if (syncOptions.academicYear) parts.push(syncOptions.academicYear);
    if (syncOptions.semesterId) parts.push(String(syncOptions.semesterId).toUpperCase());
    if (parts.length > 0) {
      return `${parts.join(" ")} - SEATING PLAN`;
    }
    return "SEATING PLAN";
  }, [syncOptions.academicYear, syncOptions.semesterId]);

  // Filter seating plan strictly for the student's selected Academic Year and Semester
  const matchingEntries = useMemo(() => {
    if (!entries.length) return [];
    const targetYear = syncOptions.academicYear;
    const targetSem = syncOptions.semesterId;
    const studentId = credentials.erpId;

    if (!targetYear || !targetSem) return [];

    return entries.filter((entry) => {
      // 1. Student association check
      if (!matchesStudent(entry, studentId)) return false;
      // 2. Academic Year filter
      if (!matchesAcademicYear(entry, targetYear)) return false;
      // 3. Semester filter
      if (!matchesSemester(entry, targetSem)) return false;
      return true;
    });
  }, [entries, syncOptions.academicYear, syncOptions.semesterId, credentials.erpId]);

  // Group all available exam seating plans (INSEM 01, INSEM 02, and ENDSEM) within the selected session
  const groups = useMemo(() => {
    if (!matchingEntries.length) return [];

    const sorted = [...matchingEntries].sort((a, b) => {
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

    const inSemEntries = sorted.filter((entry) => {
      const text = getExamType(entry).toLowerCase();
      return (
        text.includes("in sem") ||
        text.includes("insem") ||
        text.includes("in semester") ||
        text.includes("in-sem")
      );
    });

    const inSemMonths = Array.from(
      new Set(inSemEntries.map((entry) => parseMonth(entry.date)).filter(Boolean))
    ).sort((a, b) => a - b);
    const splitMonth =
      inSemMonths.length > 1 ? inSemMonths[Math.floor((inSemMonths.length - 1) / 2)] : null;

    const inSem1 = [];
    const inSem2 = [];
    const endSem = [];

    sorted.forEach((entry) => {
      const groupType = getExamGroup(entry, splitMonth);
      if (groupType === "insem1") {
        inSem1.push(entry);
      } else if (groupType === "insem2") {
        inSem2.push(entry);
      } else if (groupType === "endsem") {
        endSem.push(entry);
      }
    });

    const result = [];
    if (inSem1.length) result.push({ id: "insem1", label: "INSEM 01", items: inSem1 });
    if (inSem2.length) result.push({ id: "insem2", label: "INSEM 02", items: inSem2 });
    if (endSem.length) result.push({ id: "endsem", label: "ENDSEM (Semester End Examination)", items: endSem });
    return result;
  }, [matchingEntries]);

  const courseMap = useMemo(() => {
    const map = {};
    attendance.forEach((item) => {
      if (item.courseCode && item.subject) {
        map[item.courseCode.trim().toUpperCase()] = item.subject.trim();
      }
    });
    const tt = readLocal(STORAGE_KEYS.timetable, { mappings: [] });
    (tt?.mappings || []).forEach((m) => {
      const code = (m.code || m.courseCode || "").trim().toUpperCase();
      const title = (m.title || m.courseTitle || m.subject || "").trim();
      if (code && title && !map[code]) {
        map[code] = title;
      }
    });
    return map;
  }, [attendance]);

  return (
    <Layout
      title={pageHeading}
      action={
        <div className="flex items-center gap-2">
          <button
            onClick={handleRefreshSeating}
            disabled={isRefreshing}
            className="tap inline-flex h-9 items-center gap-1.5 rounded-lg border border-ink/10 bg-white px-3 text-xs font-bold text-ink/70 shadow-soft transition-colors hover:text-ink disabled:opacity-50"
            title="Sync latest seating arrangements from ERP"
          >
            <RefreshCw size={14} className={isRefreshing ? "animate-spin text-mint" : ""} />
            <span className="hidden sm:inline">{isRefreshing ? "Syncing..." : "Sync Seating"}</span>
          </button>
          <Link
            to="/settings"
            className="tap inline-flex h-9 items-center gap-1.5 rounded-lg border border-ink/10 bg-white px-3 text-xs font-bold text-ink/70 shadow-soft transition-colors hover:text-ink"
            title="Configure Academic Year & Semester in Login Settings"
          >
            <Settings size={14} />
            <span className="hidden sm:inline">Settings</span>
          </Link>
        </div>
      }
    >
      <div className="space-y-4">
        {/* Refresh feedback toast */}
        {refreshMessage && (
          <div className="rounded-xl border border-ink/10 bg-surface p-3 text-xs font-bold text-ink transition-all">
            {refreshMessage}
          </div>
        )}

        {/* Active Session Card referencing Login Settings as Single Source of Truth */}
        <section className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 rounded-xl border border-ink/10 bg-white p-3.5 shadow-soft">
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-ink/40">
              Active Session from Login Settings
            </p>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <span className="rounded-md bg-ink px-2.5 py-0.5 text-xs font-black text-paper">
                {syncOptions.academicYear || "Academic Year Not Set"}
              </span>
              <span className="rounded-md bg-surface px-2.5 py-0.5 text-xs font-black text-ink">
                {syncOptions.semesterId || "Semester Not Set"}
              </span>
              {matchingEntries.length > 0 && (
                <span className="rounded-full bg-surface px-2 py-0.5 text-[10px] font-bold text-ink/50">
                  {matchingEntries.length} exam{matchingEntries.length === 1 ? "" : "s"}
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 self-start sm:self-auto">
            <button
              onClick={handleRefreshSeating}
              disabled={isRefreshing}
              className="tap inline-flex items-center gap-1.5 rounded-lg border border-ink/10 bg-surface px-3 py-1.5 text-xs font-bold text-ink/70 hover:text-ink hover:bg-surface/80 transition-colors disabled:opacity-50"
            >
              <RefreshCw size={13} className={isRefreshing ? "animate-spin text-ink/40" : "text-ink/40"} />
              <span>{isRefreshing ? "Syncing..." : "Sync Seating"}</span>
            </button>
            <Link
              to="/settings"
              className="tap inline-flex items-center gap-1 rounded-lg border border-ink/10 bg-surface px-3 py-1.5 text-xs font-bold text-ink/70 hover:text-ink hover:bg-surface/80 transition-colors"
            >
              <Settings size={13} className="text-ink/40" />
              <span>Settings</span>
            </Link>
          </div>
        </section>

        {/* Content Section or Empty State */}
        {matchingEntries.length === 0 ? (
          <div className="rounded-lg border border-dashed border-ink/25 bg-white p-8 text-center shadow-soft space-y-3">
            <Armchair className="mx-auto text-ink/30" size={36} />
            <p className="font-black text-ink/70 text-base">
              No seating plan available for the selected academic year and semester.
            </p>
            <p className="text-xs text-ink/45 max-w-md mx-auto">
              Currently filtering for <b>{syncOptions.academicYear || "unspecified year"}</b> •{" "}
              <b>{syncOptions.semesterId || "unspecified semester"}</b>. You can synchronize your latest ERP seating
              arrangements or modify your session in Settings.
            </p>
            <div className="flex flex-wrap justify-center gap-2 pt-2">
              <button
                onClick={handleRefreshSeating}
                disabled={isRefreshing}
                className="tap inline-flex items-center gap-1.5 rounded-lg bg-mint px-4 py-2 text-xs font-black text-ink shadow-soft hover:bg-mint/90 transition-colors disabled:opacity-50"
              >
                <RefreshCw size={14} className={isRefreshing ? "animate-spin" : ""} />
                <span>{isRefreshing ? "Syncing ERP..." : "Sync from ERP"}</span>
              </button>
              <Link
                to="/settings"
                className="tap inline-flex items-center gap-1.5 rounded-lg border border-ink/10 bg-surface px-4 py-2 text-xs font-bold text-ink shadow-soft hover:bg-surface/80 transition-colors"
              >
                <Settings size={14} />
                <span>Open Login Settings</span>
              </Link>
            </div>
          </div>
        ) : (
          <section className="space-y-4">
            {groups.map((group) => (
              <div key={group.id} className="space-y-2.5">
                <div className="flex items-center justify-between border-b border-ink/5 pb-1.5">
                  <div className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-mint" />
                    <h2 className="text-sm font-black text-ink tracking-tight">{group.label}</h2>
                  </div>
                  <span className="rounded-full bg-surface px-2.5 py-0.5 text-[10px] font-black text-ink/60">
                    {group.items.length} exam{group.items.length === 1 ? "" : "s"}
                  </span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {group.items.map((entry, index) => {
                    const code = entry.courseCode || entry.code || entry.subjectCode;
                    const mappedSubject = code ? courseMap[code.trim().toUpperCase()] : null;
                    const title = mappedSubject || entry.subject || entry.course || entry.title || "Seating";
                    const examTypeLabel = entry.examType || "EXAM";

                    return (
                      <article
                        key={`${group.id}-${code || title}-${index}`}
                        className="rounded-xl border border-ink/10 bg-white p-3.5 shadow-soft transition-all hover:border-ink/20"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <span className="text-[10px] font-bold uppercase tracking-wider text-ink/40">
                                {code || "Course"}
                              </span>
                              {examTypeLabel && (
                                <span className="rounded bg-surface px-1.5 py-0.5 text-[9px] font-bold uppercase text-ink/60">
                                  {examTypeLabel}
                                </span>
                              )}
                            </div>
                            <p className="mt-1 font-black text-sm text-ink leading-tight">{title}</p>
                          </div>
                        </div>

                        {/* Room and Seat Highlights */}
                        <div className="mt-2.5 flex flex-wrap items-center gap-2 pt-2 border-t border-ink/5 text-xs font-bold text-ink/80">
                          {entry.room && (
                            <span className="inline-flex items-center gap-1 rounded bg-surface px-2 py-0.5 font-bold text-ink">
                              <MapPin size={12} className="text-ink/40" />
                              <span>Room {entry.room}</span>
                            </span>
                          )}
                          {entry.seat && (
                            <span className="inline-flex items-center gap-1 rounded bg-surface px-2 py-0.5 font-bold text-ink">
                              <Armchair size={12} className="text-ink/40" />
                              <span>Seat {entry.seat}</span>
                            </span>
                          )}
                          {entry.block && (
                            <span className="inline-flex items-center gap-1 rounded bg-surface px-2 py-0.5 text-xs text-ink/60">
                              <span>Block {entry.block}</span>
                            </span>
                          )}
                        </div>

                        {/* Date & Time Slot */}
                        {(entry.date || entry.time || entry.examSlot) && (
                          <div className="mt-2 flex flex-wrap items-center gap-3 text-[11px] font-semibold text-ink/55">
                            {entry.date && (
                              <span className="inline-flex items-center gap-1">
                                <Calendar size={11} className="text-ink/40" />
                                <span>{entry.date}</span>
                              </span>
                            )}
                            {(entry.time || entry.examSlot) && (
                              <span className="inline-flex items-center gap-1">
                                <Clock size={11} className="text-ink/40" />
                                <span>{formatSlotText(entry.time || entry.examSlot)}</span>
                              </span>
                            )}
                          </div>
                        )}
                      </article>
                    );
                  })}
                </div>
              </div>
            ))}
          </section>
        )}
      </div>
    </Layout>
  );
}

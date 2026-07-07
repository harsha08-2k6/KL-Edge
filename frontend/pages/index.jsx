import { RefreshCw, Settings } from "lucide-react";
import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import { Link } from "react-router-dom";
import { Layout } from "../components/Layout.jsx";
import { MetricCard } from "../components/MetricCard.jsx";
import { SocialLinks } from "../components/SocialLinks.jsx";
import { SubjectTable } from "../components/SubjectTable.jsx";
import { Toast } from "../components/Toast.jsx";
import { fetchLatestSync, syncAttendance } from "../utils/api.js";
import { readLocal, STORAGE_KEYS, writeLocal } from "../utils/storage.js";
import { showNotification } from "../utils/notifications.js";
import { calculateOverall } from '../utils/attendance.js';
import { enrichSubjects, getAttendanceStatus, classesNeededForTarget } from "../utils/attendance.js";

const AUTO_SYNC_INTERVAL_MS = 10 * 60 * 1000;

export default function Home() {
  const [rawSubjects, setRawSubjects] = useState([]);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [target, setTarget] = useState(() => readLocal("kl-edge.target", 75));
  const [syncBusy, setSyncBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const syncInProgressRef = useRef(false);

  const selectTarget = (t) => {
    setTarget(t);
    writeLocal("kl-edge.target", t);
  };

  const refreshFromBackend = useCallback(() => {
    return (async () => {
      try {
        const credentials = readLocal(STORAGE_KEYS.credentials, {});
        if (!credentials.erpId) {
          setRawSubjects(readLocal(STORAGE_KEYS.attendance, []));
          setLastUpdated(readLocal(STORAGE_KEYS.lastUpdated, null));
          return;
        }
        const latest = await fetchLatestSync(credentials.erpId);
        if (latest?.attendance) {
          writeLocal(STORAGE_KEYS.attendance, latest.attendance);
          writeLocal(STORAGE_KEYS.timetable, latest.timetable);
          if (latest.seatingPlan) writeLocal(STORAGE_KEYS.seatingPlan, latest.seatingPlan);
          if (latest.cgpa) writeLocal(STORAGE_KEYS.cgpa, latest.cgpa);
          writeLocal(STORAGE_KEYS.timetableStatus, {
            status: latest.timetable?.status || (latest.timetable?.grid?.length ? "ok" : "empty"),
            message: latest.timetable?.message || ""
          });
          writeLocal(STORAGE_KEYS.lastUpdated, latest.syncedAt);
        }
      } catch {
        // Ignore backend cache misses or temporary downtime and fall back to local data.
      }

      setRawSubjects(readLocal(STORAGE_KEYS.attendance, []));
      setLastUpdated(readLocal(STORAGE_KEYS.lastUpdated, null));
    })();
  }, []);

  useEffect(() => {
    void refreshFromBackend();
  }, [refreshFromBackend]);

  useEffect(() => {
    const syncWhenActive = () => {
      if (document.visibilityState === "visible") {
        void refreshFromBackend();
      }
    };

    window.addEventListener("focus", syncWhenActive);
    window.addEventListener("online", syncWhenActive);
    document.addEventListener("visibilitychange", syncWhenActive);

    return () => {
      window.removeEventListener("focus", syncWhenActive);
      window.removeEventListener("online", syncWhenActive);
      document.removeEventListener("visibilitychange", syncWhenActive);
    };
  }, [refreshFromBackend]);

  const handleResync = useCallback(async () => {
    if (syncInProgressRef.current) {
      return;
    }

    const credentials = readLocal(STORAGE_KEYS.credentials, {});
    const syncOptions = readLocal(STORAGE_KEYS.syncOptions, {});
    if (!credentials.erpId || !credentials.password) {
      setMessage("Please set credentials in Settings first.");
      return;
    }
    if (!syncOptions.academicYear || !syncOptions.semesterId) {
      setMessage("Please choose academic year and semester in Settings first.");
      return;
    }
    const captchaSessionId = readLocal(STORAGE_KEYS.captchaSessionId, "");
    syncInProgressRef.current = true;
    setSyncBusy(true);
    setMessage("");
    try {
      setMessage("Syncing ERP data...");
      const payload = await syncAttendance({ ...credentials, ...syncOptions, captcha: "", captchaSessionId });
      if (payload.captchaSessionId) {
        writeLocal(STORAGE_KEYS.captchaSessionId, payload.captchaSessionId);
      }
      writeLocal(STORAGE_KEYS.attendance, payload.attendance);
      writeLocal(STORAGE_KEYS.timetable, payload.timetable);
      // if (payload.marks) writeLocal(STORAGE_KEYS.marks, payload.marks);
      if (payload.seatingPlan) writeLocal(STORAGE_KEYS.seatingPlan, payload.seatingPlan);
      if (payload.cgpa) writeLocal(STORAGE_KEYS.cgpa, payload.cgpa);
      writeLocal(STORAGE_KEYS.timetableStatus, {
        status: payload.timetable?.status || (payload.timetable?.grid?.length ? "ok" : "empty"),
        message: payload.timetable?.message || ""
      });
      writeLocal(STORAGE_KEYS.lastUpdated, payload.syncedAt);
      void refreshFromBackend();
      setMessage("");
      setSuccessMessage("Resync successful! ✅");
      setTimeout(() => setSuccessMessage(""), 3000);

      if (localStorage.getItem("kl-edge.notificationsEnabled") === "true") {
        showNotification("KL-Edge Sync Complete", {
          body: "Your attendance and timetable have been refreshed."
        });
      }
    } catch (error) {
      setMessage(
        error.status === 401
          ? `${error.message} Please re-run a manual sync in Settings.`
          : error.status === 410
            ? "Saved ERP session expired. Open Settings and do one manual sync again."
          : error.message
      );
    } finally {
      syncInProgressRef.current = false;
      setSyncBusy(false);
    }
  }, [refreshFromBackend]);

  useEffect(() => {
    const credentials = readLocal(STORAGE_KEYS.credentials, {});
    const syncOptions = readLocal(STORAGE_KEYS.syncOptions, {});

    if (!credentials.erpId || !credentials.password || !syncOptions.academicYear || !syncOptions.semesterId) {
      return undefined;
    }

    const timerId = window.setInterval(() => {
      handleResync();
    }, AUTO_SYNC_INTERVAL_MS);

    return () => window.clearInterval(timerId);
  }, [handleResync]);

  const subjects = useMemo(() => enrichSubjects(rawSubjects, target), [rawSubjects, target]);
  const overall = calculateOverall(rawSubjects);
  const status = getAttendanceStatus(overall, target);
  const classesNeeded = classesNeededForTarget(overall, target);

  const statusColor = {
    safe: "text-mint", good: "text-lime", warning: "text-amber", danger: "text-coral"
  }[status.tone] || "text-ink";

  return (
    <Layout
      title="Dashboard"
      action={
        <div className="flex flex-wrap items-center justify-end gap-2">
          <SocialLinks showLinkedIn={false} />
          <Link
            to="/settings"
            aria-label="Settings"
            title="Settings"
            className="tap inline-flex h-10 w-10 items-center justify-center rounded-lg border border-ink/10 bg-white text-ink/70 shadow-soft transition-colors hover:text-ink"
          >
            <Settings size={16} aria-hidden="true" />
          </Link>
          <button
            onClick={handleResync}
            disabled={syncBusy}
            className="tap inline-flex h-10 items-center gap-1.5 rounded-lg bg-ink px-3 text-sm font-bold text-paper shadow-soft transition-transform hover:-translate-y-0.5 active:translate-y-0"
          >
            <RefreshCw size={15} className={syncBusy ? "animate-spin" : ""} />
            {syncBusy ? "Syncing..." : "Resync"}
          </button>
        </div>
      }
    >
      {message && (
        <div className="mb-3 rounded-xl border border-ink/10 bg-white/80 px-3 py-2 text-sm font-bold text-ink/70 shadow-soft">
          {message}
        </div>
      )}

      {/* Top cards */}
      <section className="grid grid-cols-1 gap-2.5 md:grid-cols-2">
        <div className="rounded-xl border border-ink/10 bg-white/80 p-3 shadow-soft">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-ink/40">Overall</p>
              <h3 className={`mt-0.5 text-2xl font-black leading-none ${statusColor}`}>{overall}%</h3>
            </div>
            <span className={`rounded-full bg-surface px-2.5 py-1 text-xs font-black ${statusColor}`}>
              {status.label}
            </span>
          </div>

          <div className="mt-3 grid grid-cols-2 gap-1.5 rounded-lg bg-surface p-1">
            {[75, 85].map((t) => (
              <button
                key={t}
                onClick={() => selectTarget(t)}
                className={`rounded-md py-1.5 text-[11px] font-black transition-all ${target === t
                    ? "bg-ink text-paper shadow-sm"
                    : "text-ink/45 hover:bg-white hover:text-ink"
                  }`}
              >
                {t}%
              </button>
            ))}
          </div>
          {classesNeeded > 0 && (
            <p className="mt-2 rounded-md bg-coral/10 px-2 py-1 text-[10px] font-bold text-coral">
              +{classesNeeded} class{classesNeeded !== 1 ? "es" : ""} to reach {target}%
            </p>
          )}
        </div>

        <MetricCard
          label="Last Sync"
          value={lastUpdated ? new Date(lastUpdated).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "--"}
          helper={lastUpdated ? new Date(lastUpdated).toLocaleDateString() : "No data yet"}
        />
      </section>

      {/* Success Message */}
      {successMessage && (
        <Toast
          message={successMessage}
          type="success"
          onClose={() => setSuccessMessage("")}
        />
      )}

      {/* Subjects */}
      <section className="mt-3.5">
        {subjects.length ? (
          <SubjectTable subjects={subjects} />
        ) : (
          <div className="rounded-xl border border-dashed border-ink/15 bg-white/70 p-5 text-center shadow-soft">
            <p className="font-black text-ink/70">No attendance synced yet</p>
            <p className="mt-1 text-sm font-semibold text-ink/45">Go to Settings and run a sync.</p>
          </div>
        )}
      </section>

    </Layout>
  );
}

import { RefreshCw, Settings, X } from "lucide-react";
import { useEffect, useMemo, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import { Layout } from "../components/Layout.jsx";
import { MetricCard } from "../components/MetricCard.jsx";
import { SocialLinks } from "../components/SocialLinks.jsx";
import { SubjectTable } from "../components/SubjectTable.jsx";
import { fetchCaptcha, syncAttendance } from "../utils/api.js";
import { readLocal, STORAGE_KEYS, writeLocal } from "../utils/storage.js";
import { calculateOverall } from '../utils/attendance.js';
import { enrichSubjects, getAttendanceStatus, classesNeededForTarget } from "../utils/attendance.js";

export default function Home() {
  const [rawSubjects, setRawSubjects] = useState([]);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [showSync, setShowSync] = useState(false);
  const [target, setTarget] = useState(() => readLocal("kl-edge.target", 75));
  const [captcha, setCaptcha] = useState("");
  const [captchaImage, setCaptchaImage] = useState("");
  const [captchaSessionId, setCaptchaSessionId] = useState("");
  const [syncBusy, setSyncBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const selectTarget = (t) => {
    setTarget(t);
    writeLocal("kl-edge.target", t);
  };

  const loadAttendance = useCallback(() => {
    setRawSubjects(readLocal(STORAGE_KEYS.attendance, []));
    setLastUpdated(readLocal(STORAGE_KEYS.lastUpdated, null));
  }, []);

  useEffect(() => { loadAttendance(); }, [loadAttendance]);

  const loadCaptcha = useCallback(async () => {
    setMessage("");
    try {
      const payload = await fetchCaptcha();
      setCaptchaImage(payload.image);
      setCaptchaSessionId(payload.sessionId);
    } catch (error) {
      setMessage(error.message);
    }
  }, []);

  const handleResync = async () => {
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
    setSyncBusy(true);
    setMessage("");
    try {
      const payload = await syncAttendance({ ...credentials, ...syncOptions, captcha, captchaSessionId });
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
      loadAttendance();
      setShowSync(false);
      setCaptcha("");
      setSuccessMessage("Resync successful! ✅");
      setTimeout(() => setSuccessMessage(""), 3000);
    } catch (error) {
      setMessage(
        error.status === 401
          ? `${error.message} Check the captcha and try again with the newly loaded captcha.`
          : error.message
      );
      loadCaptcha();
    } finally {
      setSyncBusy(false);
    }
  };

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
            onClick={() => { setShowSync(true); loadCaptcha(); }}
            className="tap inline-flex h-10 items-center gap-1.5 rounded-lg bg-ink px-3 text-sm font-bold text-paper shadow-soft transition-transform hover:-translate-y-0.5 active:translate-y-0"
          >
            <RefreshCw size={15} className={syncBusy ? "animate-spin" : ""} />
            Resync
          </button>
        </div>
      }
    >
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
                  className={`rounded-md py-1.5 text-[11px] font-black transition-all ${
                    target === t
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
        <div className="mt-3 rounded-xl border border-mint/20 bg-mint/10 p-3 text-center text-sm font-black text-mint shadow-soft">
              {successMessage}
            </div>
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

      {/* Resync Modal */}
      {showSync && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-base/80 p-4 backdrop-blur-sm sm:items-center">
          <div className="w-full max-w-md rounded-2xl border border-ink/10 bg-paper p-4 shadow-soft md:p-5">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-black text-ink">Quick Resync</h3>
              <button onClick={() => setShowSync(false)} className="rounded-full bg-surface p-2 text-ink/40 transition-colors hover:text-ink">
                <X size={18} />
              </button>
            </div>

            <p className="mt-1 text-sm text-ink/50">Enter the ERP captcha to refresh data.</p>

            <div className="mt-4 flex flex-col gap-3 sm:flex-row">
              <div className="flex h-14 flex-1 items-center justify-center rounded-xl border border-border bg-surface">
                {captchaImage
                  ? <img src={captchaImage} alt="captcha" className="max-h-10" />
                  : <div className="h-3 w-20 animate-pulse rounded bg-ink/10" />
                }
              </div>
              <button onClick={loadCaptcha} className="h-12 rounded-xl border border-border bg-surface px-4 text-ink/50 transition-colors hover:text-ink">
                <RefreshCw size={18} />
              </button>
            </div>

            <input
              value={captcha}
              onChange={(e) => setCaptcha(e.target.value)}
              placeholder="Enter captcha"
              className="mt-3 h-12 w-full rounded-xl border border-border bg-surface px-4 text-ink placeholder:text-ink/30 focus:border-mint focus:outline-none"
              autoFocus
            />

            {message && <p className="mt-3 text-center text-sm font-bold text-coral">{message}</p>}

            <button
              onClick={handleResync}
              disabled={syncBusy || captcha.length < 4}
              className="mt-4 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-ink font-black text-paper transition-transform hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-40"
            >
              <RefreshCw size={18} className={syncBusy ? "animate-spin" : ""} />
              {syncBusy ? "Syncing..." : "Sync Now"}
            </button>
          </div>
        </div>
      )}
    </Layout>
  );
}

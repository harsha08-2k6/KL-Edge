import { RefreshCw, X } from "lucide-react";
import { Layout } from "../components/Layout.jsx";
import { MetricCard } from "../components/MetricCard.jsx";
import { SubjectTable } from "../components/SubjectTable.jsx";
import { readLocal, STORAGE_KEYS, writeLocal } from "../utils/storage.js";
import { calculateOverall, enrichSubjects, getAttendanceStatus, classesNeededForTarget } from "../../shared/attendance";
import { useEffect, useMemo, useState, useCallback } from "react";
import { fetchCaptcha, syncAttendance } from "../utils/api.js";

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
    setSyncBusy(true);
    setMessage("");
    try {
      const payload = await syncAttendance({ ...credentials, ...syncOptions, captcha, captchaSessionId });
      writeLocal(STORAGE_KEYS.attendance, payload.attendance);
      writeLocal(STORAGE_KEYS.timetable, payload.timetable);
      writeLocal(STORAGE_KEYS.lastUpdated, payload.syncedAt);
      loadAttendance();
      setShowSync(false);
      setCaptcha("");
    } catch (error) {
      setMessage(error.message);
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
        <button
          onClick={() => { setShowSync(true); loadCaptcha(); }}
          className="tap inline-flex items-center gap-2 rounded-xl bg-mint/20 px-4 py-2 text-sm font-bold text-mint"
        >
          <RefreshCw size={16} className={syncBusy ? "animate-spin" : ""} />
          Resync
        </button>
      }
    >
      {/* Top cards */}
      <section className="grid grid-cols-2 gap-3">
        <div className="rounded-xl border border-border bg-paper p-4 shadow-soft">
          <p className="text-[10px] font-black uppercase tracking-widest text-ink/40">Overall</p>
          <h3 className={`mt-1 text-2xl font-black ${statusColor}`}>{overall}%</h3>
          <p className={`text-xs font-bold ${statusColor}`}>{status.label}</p>
          <div className="mt-3 flex gap-2">
            {[75, 85].map((t) => (
              <button
                key={t}
                onClick={() => selectTarget(t)}
                className={`flex-1 rounded-lg py-1.5 text-xs font-black transition-all ${
                  target === t
                    ? "bg-mint text-base"
                    : "border border-border bg-surface text-ink/40"
                }`}
              >
                {t}%
              </button>
            ))}
          </div>
          {classesNeeded > 0 && (
            <p className="mt-2 text-[10px] font-bold text-coral">
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

      {/* Subjects */}
      <section className="mt-5">
        {subjects.length ? (
          <SubjectTable subjects={subjects} />
        ) : (
          <div className="rounded-xl border border-dashed border-border bg-paper p-8 text-center">
            <p className="font-black text-ink/60">No attendance synced yet</p>
            <p className="mt-1 text-sm text-ink/40">Go to Settings and run a sync.</p>
          </div>
        )}
      </section>

      {/* Resync Modal */}
      {showSync && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-base/80 p-4 backdrop-blur-sm sm:items-center">
          <div className="w-full max-w-md rounded-2xl border border-border bg-paper p-6 shadow-soft">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-black text-ink">Quick Resync</h3>
              <button onClick={() => setShowSync(false)} className="rounded-full bg-surface p-2 text-ink/40">
                <X size={18} />
              </button>
            </div>

            <p className="mt-1 text-sm text-ink/50">Enter the ERP captcha to refresh data.</p>

            <div className="mt-5 flex items-center gap-3">
              <div className="flex h-14 flex-1 items-center justify-center rounded-xl border border-border bg-surface">
                {captchaImage
                  ? <img src={captchaImage} alt="captcha" className="max-h-10" />
                  : <div className="h-3 w-20 animate-pulse rounded bg-ink/10" />
                }
              </div>
              <button onClick={loadCaptcha} className="rounded-xl border border-border bg-surface p-3 text-ink/50">
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
              className="mt-4 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-mint font-black text-base disabled:opacity-40"
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

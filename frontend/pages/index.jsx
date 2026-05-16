import { Link } from "react-router-dom";
import { RefreshCw, X, Eye, EyeOff } from "lucide-react";
import { Layout } from "../components/Layout.jsx";
import { MetricCard } from "../components/MetricCard.jsx";
import { SubjectTable } from "../components/SubjectTable.jsx";
import { readLocal, STORAGE_KEYS, writeLocal } from "../utils/storage.js";
import { calculateOverall, enrichSubjects, getAttendanceStatus } from "../../shared/attendance";
import { useEffect, useMemo, useState, useCallback } from "react";
import { fetchCaptcha, syncAttendance } from "../utils/api.js";

export default function Home() {
  const [rawSubjects, setRawSubjects] = useState([]);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [showSync, setShowSync] = useState(false);
  const [showAttendance, setShowAttendance] = useState(false);
  const [captcha, setCaptcha] = useState("");
  const [captchaImage, setCaptchaImage] = useState("");
  const [captchaSessionId, setCaptchaSessionId] = useState("");
  const [syncBusy, setSyncBusy] = useState(false);
  const [message, setMessage] = useState("");

  const loadAttendance = useCallback(() => {
    setRawSubjects(readLocal(STORAGE_KEYS.attendance, []));
    setLastUpdated(readLocal(STORAGE_KEYS.lastUpdated, null));
  }, []);

  useEffect(() => {
    loadAttendance();
  }, [loadAttendance]);

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
      const payload = await syncAttendance({
        ...credentials,
        ...syncOptions,
        captcha,
        captchaSessionId
      });
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

  const subjects = useMemo(() => enrichSubjects(rawSubjects), [rawSubjects]);
  const overall = calculateOverall(rawSubjects);
  const status = getAttendanceStatus(overall);
  const warningSubjects = subjects.filter((subject) => subject.final < 85);

  return (
    <Layout
      title="Dashboard"
      action={
        <button 
          onClick={() => { setShowSync(true); loadCaptcha(); }}
          className="tap inline-flex items-center gap-2 rounded-lg bg-ink px-4 py-2 text-sm font-bold text-paper shadow-soft"
        >
          <RefreshCw size={17} className={syncBusy ? "animate-spin" : ""} />
          Resync
        </button>
      }
    >
      <section className="grid grid-cols-2 gap-3">
        <div className="relative overflow-hidden rounded-lg border border-ink/10 bg-white p-4 shadow-soft">
          <p className="text-xs font-black uppercase tracking-wider text-ink/40">Overall Attendance</p>
          <div className="mt-2 flex items-center justify-between">
            <h3 className="text-3xl font-black">{showAttendance ? `${overall}%` : "••%"}</h3>
            <button 
              onClick={() => setShowAttendance(!showAttendance)}
              className="text-ink/40"
            >
              {showAttendance ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
          <p className={`mt-1 text-xs font-bold ${status.tone === 'safe' ? 'text-mint' : 'text-coral'}`}>
            {showAttendance ? status.label : "Tap eye to show"}
          </p>
        </div>
        <MetricCard 
          label="Last Sync" 
          value={lastUpdated ? new Date(lastUpdated).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "--"} 
          helper={lastUpdated ? new Date(lastUpdated).toLocaleDateString() : "No data yet"} 
          tone="bg-lime/10" 
        />
      </section>

      {showAttendance ? (
        <>
          <section className="mt-5 rounded-lg border border-ink/10 bg-white p-4 shadow-soft">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-base font-black">Risk Watch</h2>
              <span className="rounded-full bg-coral/12 px-3 py-1 text-xs font-bold text-coral">{warningSubjects.length} subjects</span>
            </div>
            <div className="mt-4 space-y-3">
              {warningSubjects.length ? warningSubjects.slice(0, 4).map((subject) => (
                <div key={subject.subject} className="flex items-center justify-between gap-3">
                  <span className="font-bold text-ink/78">{subject.subject}</span>
                  <span className="text-lg font-black">{subject.final}%</span>
                </div>
              )) : (
                <p className="text-sm font-semibold text-ink/62">Everything is at or above 85%.</p>
              )}
            </div>
          </section>

          <section className="mt-5">
            {subjects.length ? (
              <SubjectTable subjects={subjects} />
            ) : (
              <div className="rounded-lg border border-dashed border-ink/25 bg-white p-6 text-center shadow-soft">
                <p className="text-lg font-black">No attendance synced yet</p>
                <p className="mt-2 text-sm font-semibold text-ink/62">Add ERP credentials in Settings and run a captcha-based sync.</p>
              </div>
            )}
          </section>
        </>
      ) : (
        <section className="mt-5 rounded-lg border border-dashed border-ink/20 bg-white p-12 text-center shadow-soft">
           <Eye size={32} className="mx-auto text-ink/20" />
           <p className="mt-4 font-black text-ink/60">Attendance is hidden</p>
           <button 
             onClick={() => setShowAttendance(true)}
             className="mt-4 rounded-full bg-ink px-6 py-2 text-sm font-bold text-paper"
           >
             Show Details
           </button>
        </section>
      )}

      {/* Resync Modal */}
      {showSync && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/60 p-4 backdrop-blur-sm sm:items-center">
          <div className="w-full max-w-md animate-in slide-in-from-bottom-8 duration-300 rounded-2xl bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-black">Quick Resync</h3>
              <button onClick={() => setShowSync(false)} className="rounded-full bg-paper p-2 text-ink/40">
                <X size={20} />
              </button>
            </div>
            
            <p className="mt-2 text-sm font-semibold text-ink/60">Enter the captcha from ERP to refresh your data.</p>
            
            <div className="mt-6 flex items-center gap-3">
              <div className="flex h-16 flex-1 items-center justify-center rounded-xl border border-ink/10 bg-paper">
                {captchaImage ? (
                  <img src={captchaImage} alt="captcha" className="max-h-12" />
                ) : (
                  <div className="h-4 w-24 animate-pulse rounded bg-ink/5" />
                )}
              </div>
              <button 
                onClick={loadCaptcha}
                className="rounded-xl border border-ink/10 p-4 text-ink/60"
              >
                <RefreshCw size={20} />
              </button>
            </div>

            <input 
              value={captcha}
              onChange={(e) => setCaptcha(e.target.value)}
              placeholder="Enter captcha"
              className="mt-4 h-14 w-full rounded-xl border-ink/10 bg-paper px-4 font-black focus:border-mint focus:ring-mint"
              autoFocus
            />

            {message && <p className="mt-4 text-center text-sm font-bold text-coral">{message}</p>}

            <button 
              onClick={handleResync}
              disabled={syncBusy || captcha.length < 4}
              className="mt-6 flex h-14 w-full items-center justify-center gap-3 rounded-xl bg-ink font-black text-paper disabled:opacity-40"
            >
              <RefreshCw size={20} className={syncBusy ? "animate-spin" : ""} />
              {syncBusy ? "Syncing..." : "Sync Now"}
            </button>
          </div>
        </div>
      )}
    </Layout>
  );
}


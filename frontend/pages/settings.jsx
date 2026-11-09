import { Eye, EyeOff, RefreshCw, Trash2 } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Layout } from "../components/Layout.jsx";
import { SocialLinks } from "../components/SocialLinks.jsx";
import { Footer } from "../components/Footer.jsx";
import { Toast } from "../components/Toast.jsx";
import { fetchCaptcha, syncAttendance, syncLMS, disconnectLMS } from "../utils/api.js";
import { readLocal, removeLocal, STORAGE_KEYS, writeLocal, mergeSeatingPlans } from "../utils/storage.js";
import { processSyncUpdates } from "../utils/notifications.js";

const academicYears = [
  "2026-2027",
  "2025-2026",
  "2024-2025",
  "2023-2024",
  "2022-2023",
  "2021-2022",
  "2020-2021",
  "2019-2020",
  "2018-2019",
  "2017-2018",
  "2016-2017",
  "2015-2016",
  "2014-2015",
  "2013-2014",
  "2012-2013",
  "2011-2012",
  "2010-2011",
  "2009-2010"
];

const semesters = ["Odd Sem", "Even Sem", "Summer Term", "Term3"];

function getDefaultAcademicYear(date = new Date()) {
  const year = date.getFullYear();
  const startYear = date.getMonth() >= 6 ? year : year - 1;
  return `${startYear}-${startYear + 1}`;
}

function getDefaultSemester(date = new Date()) {
  const month = date.getMonth();
  if (month >= 0 && month <= 5) return "Even Sem";
  if (month >= 6 && month <= 11) return "Odd Sem";
  return "";
}

export default function Settings() {
  const [erpId, setErpId] = useState("");
  const [password, setPassword] = useState("");
  const [captcha, setCaptcha] = useState("");
  const [academicYear, setAcademicYear] = useState("");
  const [semesterId, setSemesterId] = useState("");
  const [captchaImage, setCaptchaImage] = useState("");
  const [captchaSessionId, setCaptchaSessionId] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [captchaBusy, setCaptchaBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [toast, setToast] = useState(null);

  // LMS state
  const [lmsUsername, setLmsUsername] = useState("");
  const [lmsPassword, setLmsPassword] = useState("");
  const [showLmsPassword, setShowLmsPassword] = useState(false);
  const [lmsToken, setLmsToken] = useState(() => readLocal(STORAGE_KEYS.lmsToken, null));
  const [lmsLastSynced, setLmsLastSynced] = useState(() => readLocal(STORAGE_KEYS.lmsLastSynced, null));
  const [lmsBusy, setLmsBusy] = useState(false);
  const [lmsMessage, setLmsMessage] = useState("");




  const initialCaptchaLoaded = useRef(false);
  const captchaRequestId = useRef(0);

  const loadCaptcha = useCallback(async ({ preserveMessage = false } = {}) => {
    const requestId = captchaRequestId.current + 1;
    captchaRequestId.current = requestId;
    setCaptchaBusy(true);
    if (!preserveMessage) {
      setMessage("");
    }
    setCaptcha("");

    try {
      const payload = await fetchCaptcha();
      if (requestId !== captchaRequestId.current) return;
      setCaptchaImage(payload.image);
      setCaptchaSessionId(payload.sessionId);
    } catch (error) {
      if (requestId !== captchaRequestId.current) return;
      setCaptchaImage("");
      setCaptchaSessionId("");
      if (error.status === 501) {
        setMessage("ERP sync is not configured on the backend. Set ERP_* env vars and restart the backend.");
      } else {
        setMessage(error.message);
      }
    } finally {
      if (requestId === captchaRequestId.current) {
        setCaptchaBusy(false);
      }
    }
  }, []);

  useEffect(() => {
    const credentials = readLocal(STORAGE_KEYS.credentials, { erpId: "", password: "" });
    const defaults = { academicYear: getDefaultAcademicYear(), semesterId: getDefaultSemester() };
    const syncOptions = readLocal(STORAGE_KEYS.syncOptions, defaults);
    setErpId(credentials.erpId || "");
    setPassword(credentials.password || "");
    setAcademicYear(syncOptions.academicYear || defaults.academicYear);
    setSemesterId(syncOptions.semesterId || defaults.semesterId);

    const lmsCreds = readLocal(STORAGE_KEYS.lmsCredentials, { username: "", password: "" });
    setLmsUsername(lmsCreds.username || credentials.erpId || "");
    setLmsPassword(lmsCreds.password || "");
    if (!initialCaptchaLoaded.current) {
      initialCaptchaLoaded.current = true;
      loadCaptcha();
    }
  }, [loadCaptcha]);

  function saveCredentials(next = { erpId, password }) {
    writeLocal(STORAGE_KEYS.credentials, next);
  }

  function saveSyncOptions(next = { academicYear, semesterId }) {
    writeLocal(STORAGE_KEYS.syncOptions, next);
  }

  async function handleSync() {
    setBusy(true);
    setMessage("");
    saveCredentials();
    saveSyncOptions();

    try {
      const payload = await syncAttendance({ erpId, password, captcha, academicYear, semesterId, captchaSessionId });
      processSyncUpdates(payload);
      const timetable = { ...(payload.timetable || {}), academicYear, semesterId };
      writeLocal(STORAGE_KEYS.attendance, payload.attendance);
      writeLocal(STORAGE_KEYS.timetable, timetable);
      // if (payload.marks) writeLocal(STORAGE_KEYS.marks, payload.marks);
      if (payload.seatingPlan && payload.seatingPlan.length > 0) {
        const existingPlans = readLocal(STORAGE_KEYS.seatingPlan, []);
        writeLocal(STORAGE_KEYS.seatingPlan, mergeSeatingPlans(existingPlans, payload.seatingPlan));
      }
      if (payload.cgpa) writeLocal(STORAGE_KEYS.cgpa, payload.cgpa);
      writeLocal(STORAGE_KEYS.timetableStatus, {
        status: timetable?.status || (timetable?.grid?.length ? "ok" : "empty"),
        source: timetable?.source || (timetable?.cached ? "cache" : "live"),
        refreshedAt: timetable?.refreshedAt || payload.syncedAt,
        cachedAt: timetable?.cachedAt || null,
        mappingsCount: (timetable?.mappings || []).length,
        message: timetable?.message || ""
      });
      writeLocal(STORAGE_KEYS.lastUpdated, payload.syncedAt);
      if (payload.captchaSessionId) {
        writeLocal(STORAGE_KEYS.captchaSessionId, payload.captchaSessionId);
      } else if (captchaSessionId) {
        writeLocal(STORAGE_KEYS.captchaSessionId, captchaSessionId);
      }
      setCaptcha("");
      setCaptchaImage("");
      setMessage("");
      setToast({ message: "Attendance synced successfully! ✅", type: "success" });


    } catch (error) {
      if (error.status === 501) {
        setCaptcha("");
        setCaptchaImage("");
        setCaptchaSessionId("");
        setMessage("ERP sync is not configured on the backend. Set ERP_* env vars and restart the backend.");
      } else if (error.status === 410) {
        setMessage("Captcha expired. Loading new captcha...");
        await loadCaptcha({ preserveMessage: true });
      } else if (error.status === 401) {
        setMessage(`${error.message} Check the captcha and try again with the newly loaded captcha.`);
        await loadCaptcha({ preserveMessage: true });
      } else {
        setCaptcha("");
        setCaptchaImage("");
        setCaptchaSessionId("");
        setMessage(error.message);
      }
    } finally {
      setBusy(false);
    }
  }

  function clearData() {
    removeLocal(STORAGE_KEYS.credentials);
    removeLocal(STORAGE_KEYS.syncOptions);
    removeLocal(STORAGE_KEYS.attendance);
    removeLocal(STORAGE_KEYS.timetable);
    removeLocal(STORAGE_KEYS.timetableStatus);
    removeLocal(STORAGE_KEYS.marks);
    removeLocal(STORAGE_KEYS.lastUpdated);
    removeLocal(STORAGE_KEYS.captchaSessionId);
    removeLocal(STORAGE_KEYS.lmsToken);
    removeLocal(STORAGE_KEYS.lmsCredentials);
    removeLocal(STORAGE_KEYS.lmsAssignments);
    removeLocal(STORAGE_KEYS.lmsLastSynced);
    setLmsToken(null);
    setLmsLastSynced(null);
    setLmsUsername("");
    setLmsPassword("");
    setErpId("");
    setPassword("");
    setCaptcha("");
    setCaptchaImage("");
    setCaptchaSessionId("");
    setAcademicYear("");
    setSemesterId("");
    setMessage("Local data cleared.");
  }

  async function handleLmsSync() {
    if (!lmsUsername || !lmsPassword) {
      setLmsMessage("Please enter your LMS Username and Password.");
      return;
    }
    setLmsBusy(true);
    setLmsMessage("");
    writeLocal(STORAGE_KEYS.lmsCredentials, { username: lmsUsername, password: lmsPassword });

    try {
      const res = await syncLMS(lmsToken, { username: lmsUsername, password: lmsPassword });
      writeLocal(STORAGE_KEYS.lmsToken, res.lmsToken);
      writeLocal(STORAGE_KEYS.lmsAssignments, res.assignments || []);
      writeLocal(STORAGE_KEYS.lmsLastSynced, res.syncedAt);
      setLmsToken(res.lmsToken);
      setLmsLastSynced(res.syncedAt);
      setLmsMessage("");
      setToast({ message: `LMS synced successfully! (${(res.assignments || []).length} assignments) ✅`, type: "success" });
    } catch (err) {
      setLmsMessage(err.message || "Failed to sync LMS assignments");
      if (err.status === 401) {
        removeLocal(STORAGE_KEYS.lmsToken);
        setLmsToken(null);
      }
    } finally {
      setLmsBusy(false);
    }
  }

  async function handleLmsDisconnect() {
    if (lmsToken) {
      try { await disconnectLMS(lmsToken); } catch(e) {}
    }
    removeLocal(STORAGE_KEYS.lmsToken);
    removeLocal(STORAGE_KEYS.lmsAssignments);
    removeLocal(STORAGE_KEYS.lmsLastSynced);
    setLmsToken(null);
    setLmsLastSynced(null);
    setLmsMessage("LMS disconnected.");
    setToast({ message: "LMS account disconnected", type: "info" });
  }

  return (
    <Layout title="Login Settings" action={<SocialLinks />} width="wide">
      <section className="space-y-2.5 rounded-lg border border-ink/10 bg-white p-2.5 shadow-soft">
        <p className="text-sm font-bold text-ink/60">Configure your ERP login credentials below</p>
        <label className="block">
          <span className="text-sm font-black text-ink/70">ERP ID</span>
          <input
            value={erpId}
            onChange={(event) => {
              setErpId(event.target.value);
              saveCredentials({ erpId: event.target.value, password });
            }}
            className="mt-1 h-9 w-full rounded-lg border border-ink/15 bg-white px-3 text-sm font-bold focus:border-mint focus:ring-1 focus:ring-mint"
            autoComplete="username"
          />
        </label>

        <label className="block">
          <span className="text-sm font-black text-ink/70">Password</span>
          <div className="mt-1 flex overflow-hidden rounded-lg border border-ink/15 focus-within:border-mint focus-within:ring-1 focus-within:ring-mint">
            <input
              value={password}
              onChange={(event) => {
                setPassword(event.target.value);
                saveCredentials({ erpId, password: event.target.value });
              }}
              type={showPassword ? "text" : "password"}
              className="h-9 min-w-0 flex-1 border-0 px-3 text-sm font-bold focus:ring-0"
              autoComplete="current-password"
            />
            <button
              type="button"
              onClick={() => setShowPassword((value) => !value)}
              className="tap inline-flex items-center justify-center px-3 text-ink/62"
              title={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
            </button>
          </div>
        </label>

        <label className="block">
          <span className="text-sm font-black text-ink/70">Captcha</span>
          <div className="mt-1 flex flex-col gap-2 sm:flex-row">
            <div className="flex h-12 min-w-40 flex-1 items-center justify-center rounded-lg border border-ink/15 bg-paper px-3">
              {captchaImage ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={captchaImage} alt="ERP captcha" className="max-h-12 max-w-full object-contain" />
              ) : (
                <span className="text-sm font-bold text-ink/48">{captchaBusy ? "Loading captcha" : "Captcha unavailable"}</span>
              )}
            </div>
            <button
              type="button"
              onClick={loadCaptcha}
              disabled={captchaBusy || busy}
              className="tap inline-flex h-9 items-center justify-center rounded-lg border border-ink/15 px-3 text-ink disabled:opacity-45"
              title="Refresh captcha"
            >
              <RefreshCw size={18} className={captchaBusy ? "animate-spin" : ""} />
            </button>
          </div>
          <input
            value={captcha}
            onChange={(event) => setCaptcha(event.target.value)}
            className="mt-1 h-9 w-full rounded-lg border border-ink/15 bg-white px-3 text-sm font-bold focus:border-mint focus:ring-1 focus:ring-mint"
            placeholder="Enter Captcha"
            autoComplete="off"
          />
        </label>

        <div className="grid gap-2.5 sm:grid-cols-2">
          <label className="block">
            <span className="text-sm font-black text-ink/70">Academic Year</span>
            <select
              value={academicYear}
              onChange={(event) => {
                setAcademicYear(event.target.value);
                saveSyncOptions({ academicYear: event.target.value, semesterId });
              }}
              className="mt-1 h-9 w-full rounded-lg border border-ink/15 bg-white px-3 text-sm font-bold focus:border-mint focus:ring-1 focus:ring-mint"
            >
              <option value="">Select Academic Year</option>
              {academicYears.map((year) => (
                <option key={year} value={year}>{year}</option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="text-sm font-black text-ink/70">Semester</span>
            <select
              value={semesterId}
              onChange={(event) => {
                setSemesterId(event.target.value);
                saveSyncOptions({ academicYear, semesterId: event.target.value });
              }}
              className="mt-1 h-9 w-full rounded-lg border border-ink/15 bg-white px-3 text-sm font-bold focus:border-mint focus:ring-1 focus:ring-mint"
            >
              <option value="">Select Semester</option>
              {semesters.map((semester) => (
                <option key={semester} value={semester}>{semester}</option>
              ))}
            </select>
          </label>
        </div>

        <button
          type="button"
          onClick={handleSync}
          disabled={busy || !erpId || !password || !academicYear || !semesterId}
          className="tap inline-flex h-9 w-full items-center justify-center gap-2 rounded-lg bg-ink px-3 text-sm font-black text-paper disabled:cursor-not-allowed disabled:opacity-45"
        >
          <RefreshCw size={18} className={busy ? "animate-spin" : ""} />
          {busy ? "Syncing" : "Sync ERP"}
        </button>

        <button
          type="button"
          onClick={clearData}
          className="tap inline-flex h-9 w-full items-center justify-center gap-2 rounded-lg bg-coral/12 px-3 text-sm font-black text-coral"
        >
          <Trash2 size={18} />
          Clear Local Data
        </button>

        {message ? <p className="rounded-lg bg-paper px-3 py-2 text-sm font-bold text-ink/70">{message}</p> : null}
      </section>

      {/* LMS Settings Section */}
      <section className="space-y-2.5 rounded-lg border border-ink/10 bg-white p-2.5 shadow-soft">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-black text-ink">KL University LMS Settings</h3>
            <p className="text-xs font-bold text-ink/60">Configure your LMS credentials to sync deadlines & assignments</p>
          </div>
          {lmsToken ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-mint/10 px-2 py-0.5 text-[11px] font-black text-mint">
              ✓ Connected
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 rounded-full bg-ink/5 px-2 py-0.5 text-[11px] font-bold text-ink/50">
              Not Connected
            </span>
          )}
        </div>

        <label className="block">
          <span className="text-sm font-black text-ink/70">LMS Username</span>
          <input
            value={lmsUsername}
            onChange={(event) => {
              setLmsUsername(event.target.value);
              writeLocal(STORAGE_KEYS.lmsCredentials, { username: event.target.value, password: lmsPassword });
            }}
            placeholder="e.g. 2400030361"
            className="mt-1 h-9 w-full rounded-lg border border-ink/15 bg-white px-3 text-sm font-bold focus:border-mint focus:ring-1 focus:ring-mint"
            autoComplete="username"
          />
        </label>

        <label className="block">
          <span className="text-sm font-black text-ink/70">LMS Password</span>
          <div className="mt-1 flex overflow-hidden rounded-lg border border-ink/15 focus-within:border-mint focus-within:ring-1 focus-within:ring-mint">
            <input
              value={lmsPassword}
              onChange={(event) => {
                setLmsPassword(event.target.value);
                writeLocal(STORAGE_KEYS.lmsCredentials, { username: lmsUsername, password: event.target.value });
              }}
              type={showLmsPassword ? "text" : "password"}
              placeholder="Enter LMS password"
              className="h-9 min-w-0 flex-1 border-0 px-3 text-sm font-bold focus:ring-0"
              autoComplete="current-password"
            />
            <button
              type="button"
              onClick={() => setShowLmsPassword((v) => !v)}
              className="tap inline-flex items-center justify-center px-3 text-ink/62"
              title={showLmsPassword ? "Hide password" : "Show password"}
            >
              {showLmsPassword ? <EyeOff size={20} /> : <Eye size={20} />}
            </button>
          </div>
        </label>

        {lmsLastSynced && (
          <p className="text-[11px] font-semibold text-ink/50">
            Last synced: {new Date(lmsLastSynced).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
          </p>
        )}

        <button
          type="button"
          onClick={handleLmsSync}
          disabled={lmsBusy || !lmsUsername || !lmsPassword}
          className="tap inline-flex h-9 w-full items-center justify-center gap-2 rounded-lg bg-ink px-3 text-sm font-black text-paper disabled:cursor-not-allowed disabled:opacity-45"
        >
          <RefreshCw size={18} className={lmsBusy ? "animate-spin" : ""} />
          {lmsBusy ? "Syncing LMS..." : "Sync LMS"}
        </button>

        {lmsToken && (
          <button
            type="button"
            onClick={handleLmsDisconnect}
            className="tap inline-flex h-9 w-full items-center justify-center gap-2 rounded-lg bg-coral/12 px-3 text-sm font-black text-coral"
          >
            Disconnect LMS
          </button>
        )}

        {lmsMessage ? <p className="rounded-lg bg-paper px-3 py-2 text-sm font-bold text-coral">{lmsMessage}</p> : null}
      </section>



      {/* Toast Notification */}
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}

      {/* Footer */}
      <Footer />
    </Layout>
  );
}

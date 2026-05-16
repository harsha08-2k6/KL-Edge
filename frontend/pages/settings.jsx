import { Eye, EyeOff, RefreshCw, Trash2 } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Layout } from "../components/Layout.jsx";
import { fetchCaptcha, syncAttendance } from "../utils/api.js";
import { readLocal, removeLocal, STORAGE_KEYS, writeLocal } from "../utils/storage.js";

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
    const syncOptions = readLocal(STORAGE_KEYS.syncOptions, { academicYear: "", semesterId: "" });
    setErpId(credentials.erpId || "");
    setPassword(credentials.password || "");
    setAcademicYear(syncOptions.academicYear || "");
    setSemesterId(syncOptions.semesterId || "");
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
      writeLocal(STORAGE_KEYS.attendance, payload.attendance);
      writeLocal(STORAGE_KEYS.timetable, payload.timetable);
      writeLocal(STORAGE_KEYS.lastUpdated, payload.syncedAt);
      setCaptcha("");
      setCaptchaImage("");
      setCaptchaSessionId("");
      setMessage("Attendance synced successfully.");
    } catch (error) {
      setCaptcha("");
      setCaptchaImage("");
      setCaptchaSessionId("");

      if (error.status === 501) {
        setMessage("ERP sync is not configured on the backend. Set ERP_* env vars and restart the backend.");
      } else if (error.status === 410) {
        setMessage("Captcha expired. Click refresh captcha, enter the new code, then sync again.");
      } else if (error.status === 401) {
        setMessage(`${error.message} Click refresh captcha, enter the new code, then sync again.`);
      } else {
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
    removeLocal(STORAGE_KEYS.lastUpdated);
    setErpId("");
    setPassword("");
    setCaptcha("");
    setCaptchaImage("");
    setCaptchaSessionId("");
    setAcademicYear("");
    setSemesterId("");
    setMessage("Local data cleared.");
  }

  return (
    <Layout title="Settings">
      <section className="space-y-4 rounded-lg border border-ink/10 bg-white p-4 shadow-soft">
        <label className="block">
          <span className="text-sm font-black text-ink/70">ERP ID</span>
          <input
            value={erpId}
            onChange={(event) => {
              setErpId(event.target.value);
              saveCredentials({ erpId: event.target.value, password });
            }}
            className="mt-2 h-12 w-full rounded-lg border-ink/15 font-bold focus:border-mint focus:ring-mint"
            autoComplete="username"
          />
        </label>

        <label className="block">
          <span className="text-sm font-black text-ink/70">Password</span>
          <div className="mt-2 flex overflow-hidden rounded-lg border border-ink/15 focus-within:border-mint focus-within:ring-1 focus-within:ring-mint">
            <input
              value={password}
              onChange={(event) => {
                setPassword(event.target.value);
                saveCredentials({ erpId, password: event.target.value });
              }}
              type={showPassword ? "text" : "password"}
              className="h-12 min-w-0 flex-1 border-0 font-bold focus:ring-0"
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
          <div className="mt-2 flex items-center gap-3">
            <div className="flex h-16 min-w-40 flex-1 items-center justify-center rounded-lg border border-ink/15 bg-paper px-3">
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
              className="tap inline-flex items-center justify-center rounded-lg border border-ink/15 px-3 text-ink disabled:opacity-45"
              title="Refresh captcha"
            >
              <RefreshCw size={18} className={captchaBusy ? "animate-spin" : ""} />
            </button>
          </div>
          <input
            value={captcha}
            onChange={(event) => setCaptcha(event.target.value)}
            className="mt-2 h-12 w-full rounded-lg border-ink/15 font-bold focus:border-mint focus:ring-mint"
            placeholder="Enter fresh captcha before every sync"
            autoComplete="off"
          />
        </label>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="text-sm font-black text-ink/70">Academic Year</span>
            <select
              value={academicYear}
              onChange={(event) => {
                setAcademicYear(event.target.value);
                saveSyncOptions({ academicYear: event.target.value, semesterId });
              }}
              className="mt-2 h-12 w-full rounded-lg border-ink/15 font-bold focus:border-mint focus:ring-mint"
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
              className="mt-2 h-12 w-full rounded-lg border-ink/15 font-bold focus:border-mint focus:ring-mint"
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
          disabled={busy || !erpId || !password || !captcha || !captchaSessionId || !academicYear || !semesterId}
          className="tap inline-flex w-full items-center justify-center gap-2 rounded-lg bg-ink px-4 text-sm font-black text-paper disabled:cursor-not-allowed disabled:opacity-45"
        >
          <RefreshCw size={18} className={busy ? "animate-spin" : ""} />
          {busy ? "Syncing" : "Sync ERP"}
        </button>

        <button
          type="button"
          onClick={clearData}
          className="tap inline-flex w-full items-center justify-center gap-2 rounded-lg bg-coral/12 px-4 text-sm font-black text-coral"
        >
          <Trash2 size={18} />
          Clear Local Data
        </button>

        {message ? <p className="rounded-lg bg-paper px-3 py-2 text-sm font-bold text-ink/70">{message}</p> : null}
      </section>
    </Layout>
  );
}


import { RefreshCw, Settings, Bell } from "lucide-react";
import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Layout } from "../components/Layout.jsx";
import { MetricCard } from "../components/MetricCard.jsx";
import { SocialLinks } from "../components/SocialLinks.jsx";
import { SubjectTable } from "../components/SubjectTable.jsx";
import { Toast } from "../components/Toast.jsx";
import { fetchLatestSync, syncAttendance } from "../utils/api.js";
import { readLocal, STORAGE_KEYS, writeLocal } from "../utils/storage.js";
import { showNotification, processSyncUpdates } from "../utils/notifications.js";
import { calculateOverall } from '../utils/attendance.js';
import { enrichSubjects, getAttendanceStatus, classesNeededForTarget } from "../utils/attendance.js";

export default function Home() {
  const navigate = useNavigate();

  const hasCredentials = useMemo(() => {
    const credentials = readLocal(STORAGE_KEYS.credentials, {});
    const syncOptions = readLocal(STORAGE_KEYS.syncOptions, {});
    return !!(credentials.erpId && credentials.password && syncOptions.academicYear && syncOptions.semesterId);
  }, []);

  useEffect(() => {
    if (!hasCredentials) {
      navigate("/settings", { replace: true });
    }
  }, [hasCredentials, navigate]);

  const [rawSubjects, setRawSubjects] = useState([]);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [target, setTarget] = useState(() => readLocal("kl-edge.target", 75));
  const [syncBusy, setSyncBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [notifications, setNotifications] = useState(() => readLocal("kl-edge.recentUpdates", []));
  const [showNotificationsPanel, setShowNotificationsPanel] = useState(false);
  const syncInProgressRef = useRef(false);

  const unreadCount = useMemo(() => notifications.filter((n) => !n.read).length, [notifications]);

  if (!hasCredentials) {
    return null;
  }

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
          processSyncUpdates(latest);
          setNotifications(readLocal("kl-edge.recentUpdates", []));
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
        setNotifications(readLocal("kl-edge.recentUpdates", []));
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
      processSyncUpdates(payload);
      setNotifications(readLocal("kl-edge.recentUpdates", []));
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
          ? "ERP sync failed: Invalid credentials. Check your Settings."
          : error.status === 410
            ? "ERP sync failed: Session expired. Check your Settings."
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

    if (credentials.erpId && credentials.password && syncOptions.academicYear && syncOptions.semesterId) {
      const lastUpdated = readLocal(STORAGE_KEYS.lastUpdated, null);
      const lastSyncTime = lastUpdated ? new Date(lastUpdated).getTime() : 0;
      if (isNaN(lastSyncTime) || Date.now() - lastSyncTime > 10 * 60 * 1000) {
        handleResync();
      }
    }
  }, [handleResync]);

  const toggleNotificationsPanel = useCallback(() => {
    setShowNotificationsPanel((prev) => {
      const next = !prev;
      if (next) {
        const updated = notifications.map((n) => ({ ...n, read: true }));
        writeLocal("kl-edge.recentUpdates", updated);
        setNotifications(updated);
      }
      return next;
    });
  }, [notifications]);

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
          <button
            onClick={toggleNotificationsPanel}
            aria-label="Recent Updates"
            title="Recent Updates"
            className="tap relative inline-flex h-10 w-10 items-center justify-center rounded-lg border border-ink/10 bg-white text-ink/70 shadow-soft transition-colors hover:text-ink"
          >
            <Bell size={16} />
            {unreadCount > 0 && (
              <span className="absolute -right-1.5 -top-1.5 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-coral px-1 text-[9px] font-black text-white ring-2 ring-white">
                {unreadCount}
              </span>
            )}
          </button>
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

      {showNotificationsPanel && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-md rounded-2xl border border-ink/10 bg-white p-5 shadow-lg animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-ink/5 pb-3">
              <h3 className="text-base font-black text-ink flex items-center gap-2">
                <Bell size={18} className="text-ink/70" />
                Recent Updates
              </h3>
              <button
                onClick={() => setShowNotificationsPanel(false)}
                className="tap rounded-lg bg-surface px-2.5 py-1 text-xs font-bold text-ink/60 hover:bg-ink/10 hover:text-ink"
              >
                Close
              </button>
            </div>

            <div className="mt-4 max-h-[350px] overflow-y-auto space-y-2.5 pr-1">
              {notifications.length === 0 ? (
                <div className="py-8 text-center">
                  <p className="text-sm font-black text-ink/40">No recent changes detected</p>
                  <p className="mt-1 text-xs text-ink/30">Changes to your timetable or seating plan will appear here.</p>
                </div>
              ) : (
                notifications.map((item) => (
                  <div
                    key={item.id}
                    className={`rounded-xl border p-3 shadow-soft transition-colors ${
                      item.type === "room_change"
                        ? "border-coral/20 bg-coral/5"
                        : "border-mint/20 bg-mint/5"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-[10px] font-black uppercase tracking-widest text-ink/40">
                        {item.type === "room_change" ? "🏫 Timetable" : "🎟️ Seating Plan"}
                      </span>
                      <span className="text-[9px] font-semibold text-ink/30">
                        {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <h5 className="mt-1 text-xs font-black text-ink">{item.title}</h5>
                    <p className="mt-1.5 text-[11px] font-semibold text-ink/70 leading-relaxed">
                      {item.message}
                    </p>
                  </div>
                ))
              )}
            </div>

            {notifications.length > 0 && (
              <div className="mt-4 border-t border-ink/5 pt-3 text-right">
                <button
                  onClick={() => {
                    writeLocal("kl-edge.recentUpdates", []);
                    setNotifications([]);
                  }}
                  className="tap text-xs font-bold text-coral hover:underline"
                >
                  Clear All History
                </button>
              </div>
            )}
          </div>
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
            <p className="mt-1 text-sm font-semibold text-ink/45">Go to Settings and configure your credentials.</p>
          </div>
        )}
      </section>

    </Layout>
  );
}

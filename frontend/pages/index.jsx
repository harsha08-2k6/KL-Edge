import { RefreshCw, Settings, Bell, Footprints } from "lucide-react";
import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Layout } from "../components/Layout.jsx";
import { MetricCard } from "../components/MetricCard.jsx";
import { SocialLinks } from "../components/SocialLinks.jsx";
import { Toast } from "../components/Toast.jsx";
import { syncAttendance, connectLMS, fetchAssignments, disconnectLMS } from "../utils/api.js";
import { readLocal, STORAGE_KEYS, writeLocal, removeLocal } from "../utils/storage.js";
import { showNotification, processSyncUpdates, formatNotificationDay, getSlotTimeText } from "../utils/notifications.js";
import { getCurrentAndNextClass } from "../utils/timetable.js";
import { logVisit, getStreakStats } from "../utils/streak.js";

function getRelativeTimeString(timestamp) {
  if (!timestamp) return "Never updated";
  try {
    const timeMs = new Date(timestamp).getTime();
    if (isNaN(timeMs)) return "Never updated";
    const diffMs = Date.now() - timeMs;
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return "just now";
    if (diffMins === 1) return "1 min ago";
    if (diffMins < 60) return `${diffMins} min ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours === 1) return "1 hour ago";
    if (diffHours < 24) return `${diffHours} hours ago`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays === 1) return "yesterday";
    return `${diffDays} days ago`;
  } catch (e) {
    return "Never updated";
  }
}

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

  const [streakStats, setStreakStats] = useState({ streak: 0, activeDaysThisMonth: 0, visits: [] });

  useEffect(() => {
    logVisit();
    setStreakStats(getStreakStats());
  }, []);

  const [rawSubjects, setRawSubjects] = useState(() => readLocal(STORAGE_KEYS.attendance, []));
  const [lastUpdated, setLastUpdated] = useState(() => readLocal(STORAGE_KEYS.lastUpdated, null));
  const [syncBusy, setSyncBusy] = useState(false);
  const [syncStatus, setSyncStatus] = useState("idle");
  const [relativeTime, setRelativeTime] = useState(() => getRelativeTimeString(readLocal(STORAGE_KEYS.lastUpdated, null)));
  const [message, setMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [syncChanges, setSyncChanges] = useState([]);
  const [showChangesPopup, setShowChangesPopup] = useState(false);
  const [notifications, setNotifications] = useState(() => readLocal("kl-edge.recentUpdates", []));
  const [showNotificationsPanel, setShowNotificationsPanel] = useState(false);
  const [timetableGrid, setTimetableGrid] = useState(() => {
    const timetableData = readLocal(STORAGE_KEYS.timetable, { grid: [], mappings: [] });
    return Array.isArray(timetableData) ? timetableData : timetableData.grid || [];
  });
  const [customSubjectNames, setCustomSubjectNames] = useState(() => readLocal(STORAGE_KEYS.subjectNames, {}));
  const syncInProgressRef = useRef(false);
  const autoSyncAttemptedRef = useRef(false);

  // LMS State
  const [lmsToken, setLmsToken] = useState(() => readLocal(STORAGE_KEYS.lmsToken, null));
  const [lmsAssignments, setLmsAssignments] = useState(() => readLocal(STORAGE_KEYS.lmsAssignments, []));
  const [lmsLastSynced, setLmsLastSynced] = useState(() => readLocal(STORAGE_KEYS.lmsLastSynced, null));
  const [showLmsModal, setShowLmsModal] = useState(false);
  const [lmsUsername, setLmsUsername] = useState("");
  const [lmsPassword, setLmsPassword] = useState("");
  const [lmsBusy, setLmsBusy] = useState(false);
  const [lmsError, setLmsError] = useState("");

  const unreadCount = useMemo(() => notifications.filter((n) => !n.read).length, [notifications]);

  const loadLocalData = useCallback(() => {
    setRawSubjects(readLocal(STORAGE_KEYS.attendance, []));
    const up = readLocal(STORAGE_KEYS.lastUpdated, null);
    setLastUpdated(up);
    setRelativeTime(getRelativeTimeString(up));
    const timetableData = readLocal(STORAGE_KEYS.timetable, { grid: [], mappings: [] });
    setTimetableGrid(Array.isArray(timetableData) ? timetableData : timetableData.grid || []);
    setCustomSubjectNames(readLocal(STORAGE_KEYS.subjectNames, {}));
    setNotifications(readLocal("kl-edge.recentUpdates", []));
  }, []);

  const performBackgroundSync = useCallback(async (isManual = false) => {
    if (syncInProgressRef.current) return;

    const credentials = readLocal(STORAGE_KEYS.credentials, {});
    const syncOptions = readLocal(STORAGE_KEYS.syncOptions, {});
    if (!credentials.erpId || !credentials.password) {
      if (isManual) {
        setMessage("Please set credentials in Settings first.");
      }
      return;
    }
    if (!syncOptions.academicYear || !syncOptions.semesterId) {
      if (isManual) {
        setMessage("Please choose academic year and semester in Settings first.");
      }
      return;
    }

    const captchaSessionId = readLocal(STORAGE_KEYS.captchaSessionId, "");
    syncInProgressRef.current = true;
    setSyncBusy(true);
    setSyncStatus("syncing");
    setMessage("");

    try {
      const payload = await syncAttendance({
        ...credentials,
        ...syncOptions,
        captcha: "",
        captchaSessionId
      });

      if (payload.captchaSessionId) {
        writeLocal(STORAGE_KEYS.captchaSessionId, payload.captchaSessionId);
      }

      const changes = processSyncUpdates(payload);
      if (changes && changes.length > 0) {
        setSyncChanges(changes);
        setShowChangesPopup(true);
      }
      if (payload.attendance && payload.attendance.length > 0) writeLocal(STORAGE_KEYS.attendance, payload.attendance);
      if (payload.timetable && payload.timetable.grid && payload.timetable.grid.length > 0) {
        const timetableToSave = { ...payload.timetable, academicYear: syncOptions.academicYear, semesterId: syncOptions.semesterId };
        writeLocal(STORAGE_KEYS.timetable, timetableToSave);
        writeLocal(STORAGE_KEYS.timetableStatus, {
          status: payload.timetable.status || "ok",
          message: payload.timetable.message || ""
        });
      }
      if (payload.seatingPlan && payload.seatingPlan.length > 0) writeLocal(STORAGE_KEYS.seatingPlan, payload.seatingPlan);
      if (payload.cgpa && (payload.cgpa.value || (payload.cgpa.semesters && payload.cgpa.semesters.length > 0))) writeLocal(STORAGE_KEYS.cgpa, payload.cgpa);
      writeLocal(STORAGE_KEYS.lastUpdated, payload.syncedAt);

      loadLocalData();
      setSyncStatus("success");

      if (isManual) {
        setSuccessMessage("Resync successful! ✅");
        setTimeout(() => setSuccessMessage(""), 3000);
      }

      if (localStorage.getItem("kl-edge.notificationsEnabled") === "true") {
        showNotification("KL-Edge Sync Complete", {
          body: "Your attendance and timetable have been refreshed."
        });
      }
    } catch (error) {
      console.error("Sync failed:", error);
      setSyncStatus("failed");
      if (isManual) {
        setMessage(
          error.status === 401
            ? "ERP sync failed: Invalid credentials. Check your Settings."
            : error.status === 410
              ? "ERP sync failed: Session expired. Check your Settings."
              : error.message || "Failed to sync ERP data."
        );
      }
    } finally {
      syncInProgressRef.current = false;
      setSyncBusy(false);
      setTimeout(() => {
        setSyncStatus("idle");
      }, 5000);
    }
  }, [loadLocalData]);

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

  // LMS Handlers
  const handleLmsConnect = async (e) => {
    e.preventDefault();
    if (!lmsUsername || !lmsPassword) return;
    setLmsBusy(true);
    setLmsError("");
    try {
      const res = await connectLMS(lmsUsername, lmsPassword);
      writeLocal(STORAGE_KEYS.lmsToken, res.lmsToken);
      setLmsToken(res.lmsToken);
      setShowLmsModal(false);
      setLmsUsername("");
      setLmsPassword("");
      await handleLmsSync(res.lmsToken);
    } catch (err) {
      setLmsError(err.message || "Failed to connect to LMS");
    } finally {
      setLmsBusy(false);
    }
  };

  const handleLmsSync = useCallback(async (token = lmsToken) => {
    if (!token) return;
    setLmsBusy(true);
    try {
      const res = await fetchAssignments(token);
      writeLocal(STORAGE_KEYS.lmsAssignments, res.assignments);
      writeLocal(STORAGE_KEYS.lmsLastSynced, res.syncedAt);
      setLmsAssignments(res.assignments);
      setLmsLastSynced(res.syncedAt);
      setLmsError(""); // Clear any previous errors on success
    } catch (err) {
      const errMsg = err.message || "Failed to sync assignments. The LMS might be down.";
      setLmsError(errMsg);
      setMessage(errMsg);
      if (err.status === 401) {
          handleLmsDisconnect();
      }
    } finally {
      setLmsBusy(false);
    }
  }, [lmsToken]);

  const handleLmsDisconnect = async () => {
    if (lmsToken) {
      try { await disconnectLMS(lmsToken); } catch(e) {}
    }
    removeLocal(STORAGE_KEYS.lmsToken);
    removeLocal(STORAGE_KEYS.lmsAssignments);
    removeLocal(STORAGE_KEYS.lmsLastSynced);
    setLmsToken(null);
    setLmsAssignments([]);
    setLmsLastSynced(null);
  };

  const checkFreshnessAndSync = useCallback(async () => {
    if (syncInProgressRef.current) return;
    if (typeof navigator !== "undefined" && !navigator.onLine) return;

    const lastUp = readLocal(STORAGE_KEYS.lastUpdated, null);
    const SYNC_INTERVAL = 15 * 60 * 1000; // 15 minutes
    const now = Date.now();

    if (!lastUp || (now - new Date(lastUp).getTime() > SYNC_INTERVAL)) {
      await performBackgroundSync(false);
    }
  }, [performBackgroundSync]);

  useEffect(() => {
    loadLocalData();
  }, [loadLocalData]);

  useEffect(() => {
    if (hasCredentials && !autoSyncAttemptedRef.current) {
      autoSyncAttemptedRef.current = true;
      void checkFreshnessAndSync();
    }
  }, [hasCredentials, checkFreshnessAndSync]);

  useEffect(() => {
    let timeoutId;
    const handleCheck = () => {
      if (document.visibilityState === "visible") {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => {
          void checkFreshnessAndSync();
        }, 2000); // Wait 2s for network to stabilize after device wake
      }
    };

    window.addEventListener("focus", handleCheck);
    window.addEventListener("online", handleCheck);
    document.addEventListener("visibilitychange", handleCheck);

    return () => {
      clearTimeout(timeoutId);
      window.removeEventListener("focus", handleCheck);
      window.removeEventListener("online", handleCheck);
      document.removeEventListener("visibilitychange", handleCheck);
    };
  }, [checkFreshnessAndSync]);

  useEffect(() => {
    const interval = setInterval(() => {
      const up = readLocal(STORAGE_KEYS.lastUpdated, null);
      setRelativeTime(getRelativeTimeString(up));

      // Fallback periodic sync check if wake-up events were missed or failed
      if (document.visibilityState === "visible") {
        void checkFreshnessAndSync();
      }
    }, 30000);
    return () => clearInterval(interval);
  }, [checkFreshnessAndSync]);

  const { present: presentClass, next: nextClass } = useMemo(() => {
    return getCurrentAndNextClass(timetableGrid, rawSubjects, customSubjectNames);
  }, [timetableGrid, rawSubjects, customSubjectNames]);
  
  const getUrgency = (dueDateStr) => {
      if (!dueDateStr) return { color: "border-ink/10 bg-ink/5", text: "text-ink/60", label: "No Date", dot: "⚪" };
      const due = new Date(dueDateStr).getTime();
      const now = Date.now();
      const diffDays = Math.ceil((due - now) / (1000 * 60 * 60 * 24));
      if (diffDays <= 1) return { color: "border-coral/20 bg-coral/5", text: "text-coral font-bold", label: diffDays <= 0 ? "Due today" : "Due tomorrow", dot: "🔴" };
      if (diffDays <= 3) return { color: "border-amber/20 bg-amber/5", text: "text-amber font-bold", label: `Due in ${diffDays} days`, dot: "🟠" };
      if (diffDays <= 7) return { color: "border-yellow-500/30 bg-yellow-500/10", text: "text-yellow-600 font-bold", label: `Due in ${diffDays} days`, dot: "🟡" };
      return { color: "border-mint/20 bg-mint/5", text: "text-mint font-bold", label: `Due in ${diffDays} days`, dot: "🟢" };
  };

  const urgentAssignmentsCount = lmsAssignments.filter(a => {
      const diffDays = Math.ceil((new Date(a.dueDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
      return diffDays <= 3;
  }).length;

  if (!hasCredentials) {
    return null;
  }

  return (
    <Layout
      title="Dashboard"
      action={
        <div className="flex flex-wrap items-center justify-end gap-2">
          {streakStats.streak > 0 && (
            <Link
              to="/streak"
              className="tap flex h-10 items-center gap-1.5 rounded-lg border border-orange-500/20 bg-orange-500/10 px-3 text-sm font-black text-orange-600 transition-colors hover:bg-orange-500/20"
              title={`${streakStats.streak} Day Streak`}
            >
              🔥 {streakStats.streak}
            </Link>
          )}
          <SocialLinks showLinkedIn={false} />
          <Link
            to="/steps"
            aria-label="Steps Counter"
            title="Steps Counter"
            className="tap relative inline-flex h-10 w-10 items-center justify-center rounded-lg border border-ink/10 bg-white text-ink/70 shadow-soft transition-colors hover:text-ink"
          >
            <Footprints size={16} />
          </Link>
          <Link
            to="/settings"
            aria-label="Settings"
            title="Settings"
            className="tap inline-flex h-10 w-10 items-center justify-center rounded-lg border border-ink/10 bg-white text-ink/70 shadow-soft transition-colors hover:text-ink"
          >
            <Settings size={16} aria-hidden="true" />
          </Link>
          <button
            onClick={() => {
              performBackgroundSync(true);
              if (lmsToken) handleLmsSync(lmsToken);
            }}
            disabled={syncBusy || lmsBusy}
            className="tap inline-flex h-10 items-center gap-1.5 rounded-lg bg-ink px-3 text-sm font-bold text-paper shadow-soft transition-transform hover:-translate-y-0.5 active:translate-y-0"
          >
            <RefreshCw size={15} className={syncBusy ? "animate-spin" : ""} />
            {syncBusy ? "Syncing..." : "Resync"}
          </button>
        </div>
      }
    >
      {/* In-Website Changes Popup Modal */}
      {showChangesPopup && syncChanges.length > 0 && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4 backdrop-blur-sm animate-fade-in">
          <div className="relative w-full max-w-md rounded-2xl border border-ink/10 bg-white p-6 shadow-xl animate-in fade-in zoom-in-95 duration-150">
            {/* Close button */}
            <button
              onClick={() => setShowChangesPopup(false)}
              className="absolute right-4 top-4 tap flex h-8 w-8 items-center justify-center rounded-lg bg-surface text-ink/50 hover:bg-ink/10 hover:text-ink transition-colors"
              aria-label="Close popup"
            >
              ×
            </button>

            {syncChanges.length === 1 ? (
              // Single Change Layout
              <div>
                <h3 className="text-base font-black text-ink flex items-center gap-2">
                  <span className="text-amber">🔔</span> Class Schedule Updated
                </h3>
                
                {(() => {
                  const ch = syncChanges[0];
                  const relativeDay = formatNotificationDay(ch.day);
                  const timeStr = ch.slot ? getSlotTimeText(ch.slot) : (ch.newSlot ? getSlotTimeText(ch.newSlot) : "");
                  
                  return (
                    <div className="mt-4 space-y-3">
                      <div className="text-sm font-black text-ink/80 flex items-center gap-1.5">
                        <span>📅</span> {relativeDay}{timeStr ? `, ${timeStr}` : ""}
                      </div>
                      <div className="text-lg font-black text-ink leading-tight">
                        {ch.subject || ch.newSubject || ch.courseCode}
                      </div>
                      
                      <div className="rounded-xl bg-surface p-3 text-xs font-bold text-ink/70 border border-ink/5 space-y-1.5">
                        {ch.type === "room_changed" && (
                          <div>Room: <span className="line-through text-coral">{ch.oldRoom}</span> → <span className="text-mint">{ch.newRoom}</span></div>
                        )}
                        {ch.type === "rescheduled" && (
                          <div>Moved from <span className="line-through text-coral">{getSlotTimeText(ch.oldSlot)}</span> → <span className="text-mint">{getSlotTimeText(ch.newSlot)}</span></div>
                        )}
                        {ch.type === "subject_changed" && (
                          <div>Subject: <span className="line-through text-coral">{ch.oldSubject}</span> → <span className="text-mint">{ch.newSubject}</span></div>
                        )}
                        {ch.type === "added" && (
                          <div className="text-mint">New class added in Room {ch.room}</div>
                        )}
                        {ch.type === "cancelled" && (
                          <div className="text-coral">Class is cancelled</div>
                        )}
                        {ch.type === "faculty_changed" && (
                          <div>Faculty: <span className="line-through text-coral">{ch.oldFaculty}</span> → <span className="text-mint">{ch.newFaculty}</span></div>
                        )}
                      </div>
                      <div className="text-[10px] text-ink/40 font-semibold text-right mt-1">
                        Updated just now
                      </div>
                    </div>
                  );
                })()}
              </div>
            ) : (
              // Multiple Changes Layout
              <div>
                <h3 className="text-base font-black text-ink flex items-center gap-2">
                  <span className="text-amber">🔔</span> {syncChanges.length} Class Changes
                </h3>
                
                <div className="mt-4 max-h-[250px] overflow-y-auto space-y-2.5 pr-1">
                  {syncChanges.map((ch, idx) => {
                    const relativeDay = formatNotificationDay(ch.day);
                    const timeStr = ch.slot ? getSlotTimeText(ch.slot) : (ch.newSlot ? getSlotTimeText(ch.newSlot) : "");
                    
                    let changeDesc = "";
                    if (ch.type === "room_changed") changeDesc = "Room changed";
                    else if (ch.type === "rescheduled") changeDesc = "Class rescheduled";
                    else if (ch.type === "subject_changed") changeDesc = "Subject changed";
                    else if (ch.type === "added") changeDesc = "Class added";
                    else if (ch.type === "cancelled") changeDesc = "Class cancelled";
                    else if (ch.type === "faculty_changed") changeDesc = "Faculty changed";

                    return (
                      <div key={idx} className="rounded-xl border border-ink/5 bg-surface p-3 text-xs font-bold text-ink/80 shadow-soft">
                        <div className="flex justify-between items-start gap-2">
                          <span className="text-[10px] text-ink/40 font-black uppercase tracking-wider">{relativeDay}</span>
                          <span className="text-[10px] text-coral font-bold">{changeDesc}</span>
                        </div>
                        <h4 className="mt-1 text-sm font-black text-ink leading-tight">
                          {ch.subject || ch.newSubject || ch.courseCode}
                        </h4>
                        <div className="mt-2 text-[11px] text-ink/60 space-y-1">
                          {ch.type === "room_changed" && (
                            <div>Room: <span className="line-through text-coral/75">{ch.oldRoom}</span> → <span className="text-mint font-bold">{ch.newRoom}</span></div>
                          )}
                          {ch.type === "rescheduled" && (
                            <div>Moved: <span className="line-through text-coral/75">{getSlotTimeText(ch.oldSlot)}</span> → <span className="text-mint font-bold">{getSlotTimeText(ch.newSlot)}</span></div>
                          )}
                          {ch.type === "subject_changed" && (
                            <div>Subject: <span className="line-through text-coral/75">{ch.oldSubject}</span> → <span className="text-mint font-bold">{ch.newSubject}</span></div>
                          )}
                          {ch.type === "added" && (
                            <div>Room: <span className="text-mint font-bold">{ch.room}</span></div>
                          )}
                          {ch.type === "cancelled" && (
                            <div className="text-coral/80 font-bold">Cancelled</div>
                          )}
                          {ch.type === "faculty_changed" && (
                            <div>Faculty: <span className="line-through text-coral/75">{ch.oldFaculty}</span> → <span className="text-mint font-bold">{ch.newFaculty}</span></div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
                
                <div className="mt-5 flex justify-end gap-2">
                  <button
                    onClick={() => {
                      setShowChangesPopup(false);
                      toggleNotificationsPanel();
                    }}
                    className="tap flex items-center justify-center rounded-lg bg-ink px-4 text-xs font-black text-paper hover:bg-ink/90 active:scale-95 transition-all"
                  >
                    View History
                  </button>
                  <button
                    onClick={() => setShowChangesPopup(false)}
                    className="tap flex items-center justify-center rounded-lg bg-surface px-4 text-xs font-bold text-ink/75 hover:bg-ink/10 active:scale-95 transition-all"
                  >
                    Dismiss
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Sync Status Banner */}
      <div className="mb-3 flex items-center justify-between rounded-xl border border-ink/10 bg-white/80 px-4 py-2.5 text-xs font-bold text-ink/70 shadow-soft backdrop-blur-sm">
        <div className="flex items-center gap-2">
          <span className={`inline-block h-2 w-2 rounded-full ${
            syncStatus === "syncing" ? "bg-amber animate-pulse" :
            syncStatus === "success" ? "bg-mint" :
            syncStatus === "failed" ? "bg-coral" : "bg-mint/60"
          }`} />
          <span>
            {syncStatus === "syncing" && "Updating data..."}
            {syncStatus === "success" && "Updated just now"}
            {syncStatus === "failed" && "Couldn't refresh. Showing your last saved data."}
            {syncStatus === "idle" && `Last updated ${relativeTime}`}
          </span>
        </div>
        {syncStatus === "idle" && (
          <span className="text-[10px] text-ink/40">
            Auto-refreshing in background
          </span>
        )}
      </div>

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


      {/* LMS Connection Modal */}
      {showLmsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-md rounded-2xl border border-ink/10 bg-white p-6 shadow-xl animate-in fade-in zoom-in-95 duration-150">
            <h3 className="text-lg font-black text-ink mb-1">Connect KL University LMS</h3>
            <p className="text-xs font-semibold text-ink/60 mb-5">Login with your LMS credentials.</p>
            
            <form onSubmit={handleLmsConnect} className="space-y-4">
              <div>
                <label className="mb-1.5 block text-xs font-bold text-ink/70">LMS Username</label>
                <input
                  type="text"
                  value={lmsUsername}
                  onChange={(e) => setLmsUsername(e.target.value)}
                  className="w-full rounded-xl border border-ink/10 bg-surface px-4 py-3 text-sm font-semibold outline-none transition-colors focus:border-mint"
                  required
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-bold text-ink/70">LMS Password</label>
                <input
                  type="password"
                  value={lmsPassword}
                  onChange={(e) => setLmsPassword(e.target.value)}
                  className="w-full rounded-xl border border-ink/10 bg-surface px-4 py-3 text-sm font-semibold outline-none transition-colors focus:border-mint"
                  required
                />
              </div>
              {lmsError && (
                <p className="text-xs font-bold text-coral">{lmsError}</p>
              )}
              <div className="pt-2">
                <button
                  type="submit"
                  disabled={lmsBusy}
                  className="tap w-full rounded-xl bg-ink py-3.5 text-sm font-black text-white hover:bg-ink/90 transition-colors disabled:opacity-50"
                >
                  {lmsBusy ? "Connecting..." : "Connect LMS"}
                </button>
              </div>
              <div className="flex justify-center items-center mt-2">
                <button 
                  type="button" 
                  onClick={() => setShowLmsModal(false)}
                  className="text-xs font-bold text-ink/40 hover:text-ink"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Current and Next Class */}
      <section className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {/* Ongoing Class Card */}
        <div className="rounded-xl border border-ink/10 bg-white/80 p-4 shadow-soft">
          <div className="flex items-center justify-between">
            <span className="rounded-full bg-mint/10 px-2.5 py-0.5 text-[10px] font-black text-mint uppercase tracking-wider">
              Ongoing Class
            </span>
            {presentClass && (
              <span className="text-[10px] font-black uppercase tracking-widest text-ink/40">
                {presentClass.slot}
              </span>
            )}
          </div>
          {presentClass ? (
            <div className="mt-3">
              <h3 className="text-base font-black text-ink leading-tight">
                {presentClass.subjectName}
              </h3>
              <p className="mt-0.5 text-[10px] font-semibold text-ink/45 uppercase tracking-wide">
                {presentClass.courseCode}
              </p>
              <div className="mt-3 flex flex-wrap gap-1.5 text-[11px] font-bold text-ink/70">
                <span className="rounded-md bg-surface px-2 py-1 flex items-center gap-1">
                  🕒 {presentClass.timeString}
                </span>
                {presentClass.classroom && (
                  <span className="rounded-md bg-surface px-2 py-1 flex items-center gap-1">
                    🏫 Room {presentClass.classroom}
                  </span>
                )}
              </div>
            </div>
          ) : (
            <div className="mt-4 py-4 text-center">
              <p className="text-xs font-black text-ink/40">No ongoing class right now</p>
              <p className="mt-0.5 text-[10px] text-ink/30">Enjoy your break! ☕</p>
            </div>
          )}
        </div>

        {/* Next Class Card */}
        <div className="rounded-xl border border-ink/10 bg-white/80 p-4 shadow-soft">
          <div className="flex items-center justify-between">
            <span className="rounded-full bg-violet/10 px-2.5 py-0.5 text-[10px] font-black text-violet uppercase tracking-wider">
              Next Class
            </span>
            {nextClass && (
              <span className="text-[10px] font-black uppercase tracking-widest text-ink/40">
                {nextClass.slot}
              </span>
            )}
          </div>
          {nextClass ? (
            <div className="mt-3">
              <h3 className="text-base font-black text-ink leading-tight">
                {nextClass.subjectName}
              </h3>
              <p className="mt-0.5 text-[10px] font-semibold text-ink/45 uppercase tracking-wide">
                {nextClass.courseCode}
              </p>
              <div className="mt-3 flex flex-wrap gap-1.5 text-[11px] font-bold text-ink/70">
                <span className="rounded-md bg-surface px-2 py-1 flex items-center gap-1">
                  🕒 {nextClass.timeString}
                </span>
                {nextClass.classroom && (
                  <span className="rounded-md bg-surface px-2 py-1 flex items-center gap-1">
                    🏫 Room {nextClass.classroom}
                  </span>
                )}
              </div>
            </div>
          ) : (
            <div className="mt-4 py-4 text-center">
              <p className="text-xs font-black text-ink/40">No more classes today</p>
              <p className="mt-0.5 text-[10px] text-ink/30">All done for the day! 🎉</p>
            </div>
          )}
        </div>
      </section>

      {/* Last Sync */}
      <section className="mt-3">
        <MetricCard
          label="Last Sync"
          value={lastUpdated ? new Date(lastUpdated).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "--"}
          helper={lastUpdated ? new Date(lastUpdated).toLocaleDateString() : "No data yet"}
        />
      </section>

      {timetableGrid.length === 0 && (
        <section className="mt-3">
          <div className="rounded-xl border border-dashed border-ink/15 bg-white/70 p-5 text-center shadow-soft">
            <p className="font-black text-ink/70">No timetable synced yet</p>
            <p className="mt-1 text-xs font-semibold text-ink/45">Resync using the button above to load your class schedule.</p>
          </div>
        </section>
      )}

      {/* LMS Section */}
      <section className="mt-4 mb-4">
        {!lmsToken ? (
          <div className="rounded-xl border border-ink/10 bg-white/80 p-5 shadow-soft">
            <h3 className="text-base font-black text-ink mb-1">Assignment Deadlines</h3>
            <p className="text-sm font-semibold text-ink/60 mb-4">
              Connect your LMS to see your upcoming assignment deadlines.
            </p>
            <button
              onClick={() => setShowLmsModal(true)}
              className="tap w-full rounded-lg bg-ink py-3 text-sm font-black text-paper hover:bg-ink/90 transition-colors md:w-auto md:px-8"
            >
              Connect LMS
            </button>
            <p className="mt-3 text-[10px] font-semibold text-ink/40">
              Your LMS credentials are used securely to retrieve your assignment details.
            </p>
          </div>
        ) : (
          <div className="rounded-xl border border-ink/10 bg-white/80 p-5 shadow-soft">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-ink/5 pb-3 mb-4">
              <div>
                <h3 className="text-base font-black text-ink flex items-center gap-2">
                  Assignments
                  {urgentAssignmentsCount > 0 && (
                    <span className="text-[10px] bg-coral text-white px-2 py-0.5 rounded-full font-bold">
                      {urgentAssignmentsCount} need attention
                    </span>
                  )}
                </h3>
                <div className="flex items-center gap-2 mt-1 text-[10px] font-bold text-ink/50">
                  <span className="text-mint flex items-center gap-1">✓ LMS Connected</span>
                  <span>|</span>
                  <span>Last synced: {getRelativeTimeString(lmsLastSynced)}</span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleLmsSync()}
                  disabled={lmsBusy}
                  className="tap rounded-lg bg-surface px-3 py-1.5 text-xs font-bold text-ink/70 hover:bg-ink/10 transition-colors"
                >
                  {lmsBusy ? "Syncing..." : "Sync Now"}
                </button>
                <button
                  onClick={handleLmsDisconnect}
                  className="tap rounded-lg border border-coral/20 bg-coral/5 px-3 py-1.5 text-xs font-bold text-coral hover:bg-coral/10 transition-colors"
                >
                  Disconnect
                </button>
              </div>
            </div>

            <div className="space-y-3">
              {lmsError ? (
                <div className="rounded-xl border border-coral/20 bg-coral/5 p-4 text-center">
                  <p className="text-sm font-black text-coral">LMS Error</p>
                  <p className="mt-1 text-xs font-semibold text-coral/80">{lmsError}</p>
                </div>
              ) : lmsAssignments.length === 0 ? (
                <div className="text-center py-6">
                  <p className="text-sm font-black text-ink/40">No pending assignments</p>
                  <p className="mt-1 text-xs font-semibold text-ink/30">You're all caught up!</p>
                </div>
              ) : (
                lmsAssignments.slice(0, 3).map((assignment) => {
                  const urgency = getUrgency(assignment.dueDate);
                  return (
                    <div key={assignment.id} className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border p-4 transition-colors ${urgency.color}`}>
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-wider text-ink/40">{assignment.course}</p>
                        <h4 className="mt-0.5 text-sm font-black text-ink">{assignment.title}</h4>
                        <div className="mt-1 flex items-center gap-2 text-xs">
                          <span className="font-semibold text-ink/60">
                            Due: {assignment.dueDateText || new Date(assignment.dueDate).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                          </span>
                          <span className={urgency.text}>
                            {urgency.dot} {urgency.label}
                          </span>
                        </div>
                      </div>
                      <a
                        href={assignment.lmsLink}
                        target="_blank"
                        rel="noreferrer"
                        className="tap flex items-center justify-center whitespace-nowrap rounded-lg bg-ink px-4 py-2 text-xs font-bold text-white hover:bg-ink/90 transition-colors"
                      >
                        Open LMS
                      </a>
                    </div>
                  );
                })
              )}
            </div>
            {lmsAssignments.length > 3 && (
              <div className="mt-4 text-center">
                <Link 
                  to="/assignments"
                  className="text-xs font-bold text-ink/60 hover:text-ink"
                >
                  View all {lmsAssignments.length} assignments
                </Link>
              </div>
            )}
          </div>
        )}
      </section>

      {/* Success Message */}
      {successMessage && (
        <Toast
          message={successMessage}
          type="success"
          onClose={() => setSuccessMessage("")}
        />
      )}
      
      <div className="mt-6 pb-20 text-center text-[10px] text-ink/60">
        <p className="font-bold text-ink/70">
          Built by SHVR - <a href="https://sivaharshavardhanreddy-portfolio.netlify.app/" target="_blank" rel="noreferrer" className="text-mint hover:underline">View Portfolio</a>
        </p>
      </div>
    </Layout>
  );
}

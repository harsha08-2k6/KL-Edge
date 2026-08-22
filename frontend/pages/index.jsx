import { RefreshCw, Settings, Bell } from "lucide-react";
import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Layout } from "../components/Layout.jsx";
import { MetricCard } from "../components/MetricCard.jsx";
import { SocialLinks } from "../components/SocialLinks.jsx";
import { Toast } from "../components/Toast.jsx";
import { syncAttendance } from "../utils/api.js";
import { readLocal, STORAGE_KEYS, writeLocal } from "../utils/storage.js";
import { showNotification, processSyncUpdates, formatNotificationDay, getSlotTimeText } from "../utils/notifications.js";
import { getCurrentAndNextClass } from "../utils/timetable.js";

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
      writeLocal(STORAGE_KEYS.attendance, payload.attendance);
      writeLocal(STORAGE_KEYS.timetable, payload.timetable);
      if (payload.seatingPlan) writeLocal(STORAGE_KEYS.seatingPlan, payload.seatingPlan);
      if (payload.cgpa) writeLocal(STORAGE_KEYS.cgpa, payload.cgpa);
      writeLocal(STORAGE_KEYS.timetableStatus, {
        status: payload.timetable?.status || (payload.timetable?.grid?.length ? "ok" : "empty"),
        message: payload.timetable?.message || ""
      });
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

  const checkFreshnessAndSync = useCallback(async () => {
    if (syncInProgressRef.current) return;

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
    const handleCheck = () => {
      if (document.visibilityState === "visible") {
        void checkFreshnessAndSync();
      }
    };

    window.addEventListener("focus", handleCheck);
    window.addEventListener("online", handleCheck);
    document.addEventListener("visibilitychange", handleCheck);

    return () => {
      window.removeEventListener("focus", handleCheck);
      window.removeEventListener("online", handleCheck);
      document.removeEventListener("visibilitychange", handleCheck);
    };
  }, [checkFreshnessAndSync]);

  useEffect(() => {
    const interval = setInterval(() => {
      const up = readLocal(STORAGE_KEYS.lastUpdated, null);
      setRelativeTime(getRelativeTimeString(up));
    }, 30000);
    return () => clearInterval(interval);
  }, []);

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

  const { present: presentClass, next: nextClass } = useMemo(() => {
    return getCurrentAndNextClass(timetableGrid, rawSubjects, customSubjectNames);
  }, [timetableGrid, rawSubjects, customSubjectNames]);

  if (!hasCredentials) {
    return null;
  }

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
            onClick={() => performBackgroundSync(true)}
            disabled={syncBusy}
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

      {/* Success Message */}
      {successMessage && (
        <Toast
          message={successMessage}
          type="success"
          onClose={() => setSuccessMessage("")}
        />
      )}

    </Layout>
  );
}

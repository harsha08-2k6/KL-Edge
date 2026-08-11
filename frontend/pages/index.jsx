import { RefreshCw, Settings, Bell } from "lucide-react";
import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Layout } from "../components/Layout.jsx";
import { MetricCard } from "../components/MetricCard.jsx";
import { SocialLinks } from "../components/SocialLinks.jsx";
import { Toast } from "../components/Toast.jsx";
import { fetchLatestSync, syncAttendance, fetchNotice, updateNotice } from "../utils/api.js";
import { readLocal, STORAGE_KEYS, writeLocal } from "../utils/storage.js";
import { showNotification, processSyncUpdates } from "../utils/notifications.js";
import { getCurrentAndNextClass } from "../utils/timetable.js";

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
  const [message, setMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [notifications, setNotifications] = useState(() => readLocal("kl-edge.recentUpdates", []));
  const [showNotificationsPanel, setShowNotificationsPanel] = useState(false);
  const [timetableGrid, setTimetableGrid] = useState(() => {
    const timetableData = readLocal(STORAGE_KEYS.timetable, { grid: [], mappings: [] });
    return Array.isArray(timetableData) ? timetableData : timetableData.grid || [];
  });
  const [customSubjectNames, setCustomSubjectNames] = useState(() => readLocal(STORAGE_KEYS.subjectNames, {}));
  const [notice, setNotice] = useState(null);
  const [showNoticeModal, setShowNoticeModal] = useState(false);
  const [noticeTitle, setNoticeTitle] = useState("");
  const [noticeContent, setNoticeContent] = useState("");
  const [expiresInHours, setExpiresInHours] = useState(24);
  const [pdfFile, setPdfFile] = useState(null);
  const [noticeBusy, setNoticeBusy] = useState(false);
  const syncInProgressRef = useRef(false);
  const autoSyncAttemptedRef = useRef(false);

  const credentials = useMemo(() => readLocal(STORAGE_KEYS.credentials, {}), []);
  const isAdmin = useMemo(() => credentials.erpId === "2400030361", [credentials]);

  const unreadCount = useMemo(() => notifications.filter((n) => !n.read).length, [notifications]);

  const loadNoticeData = useCallback(async () => {
    try {
      const data = await fetchNotice();
      setNotice(data);
      if (data) {
        setNoticeTitle(data.title || "");
        setNoticeContent(data.content || "");
        setExpiresInHours(data.expiresInHours || 24);
      } else {
        setNoticeTitle("");
        setNoticeContent("");
        setExpiresInHours(24);
      }
    } catch {
      // Ignore errors
    }
  }, []);

  if (!hasCredentials) {
    return null;
  }

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
          
          const localTimetable = readLocal(STORAGE_KEYS.timetable, null);
          const hasLocalTimetable = localTimetable && (Array.isArray(localTimetable) ? localTimetable.length > 0 : localTimetable.grid?.length > 0);
          const hasNewTimetable = latest.timetable && (Array.isArray(latest.timetable) ? latest.timetable.length > 0 : latest.timetable.grid?.length > 0);
          
          if (hasNewTimetable || !hasLocalTimetable) {
            writeLocal(STORAGE_KEYS.timetable, latest.timetable);
            writeLocal(STORAGE_KEYS.timetableStatus, {
              status: latest.timetable?.status || (latest.timetable?.grid?.length ? "ok" : "empty"),
              message: latest.timetable?.message || ""
            });
          }
          
          if (latest.seatingPlan) writeLocal(STORAGE_KEYS.seatingPlan, latest.seatingPlan);
          if (latest.cgpa) writeLocal(STORAGE_KEYS.cgpa, latest.cgpa);
          writeLocal(STORAGE_KEYS.lastUpdated, latest.syncedAt);
        }
      } catch {
        // Ignore backend cache misses or temporary downtime and fall back to local data.
      }

      setRawSubjects(readLocal(STORAGE_KEYS.attendance, []));
      setLastUpdated(readLocal(STORAGE_KEYS.lastUpdated, null));
      const timetableData = readLocal(STORAGE_KEYS.timetable, { grid: [], mappings: [] });
      setTimetableGrid(Array.isArray(timetableData) ? timetableData : timetableData.grid || []);
      setCustomSubjectNames(readLocal(STORAGE_KEYS.subjectNames, {}));
      void loadNoticeData();
    })();
  }, [loadNoticeData]);

  useEffect(() => {
    void refreshFromBackend();
  }, [refreshFromBackend]);



  useEffect(() => {
    void loadNoticeData();
  }, [loadNoticeData]);

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
    if (hasCredentials && !lastUpdated && !syncBusy && !autoSyncAttemptedRef.current) {
      autoSyncAttemptedRef.current = true;
      void handleResync();
    }
  }, [hasCredentials, lastUpdated, syncBusy, handleResync]);



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

  const handleSaveNotice = async (e) => {
    e.preventDefault();
    if (!noticeTitle.trim() || !noticeContent.trim()) {
      alert("Please fill in both title and content.");
      return;
    }
    setNoticeBusy(true);
    try {
      const result = await updateNotice(credentials.erpId, noticeTitle, noticeContent, expiresInHours, pdfFile);
      setNotice(result.notice);
      setShowNoticeModal(false);
      setPdfFile(null);
      const fileInput = document.getElementById("notice-pdf-input");
      if (fileInput) fileInput.value = "";
      setSuccessMessage("Notice posted successfully! 📢");
      setTimeout(() => setSuccessMessage(""), 3000);
    } catch (err) {
      alert(err.message || "Failed to update notice.");
    } finally {
      setNoticeBusy(false);
    }
  };

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

      {/* Notice Board Section */}
      <section className="mt-3.5">
        <div className="rounded-xl border border-ink/10 bg-white/80 p-4 shadow-soft">
          <div className="flex items-center justify-between border-b border-ink/5 pb-2.5">
            <h3 className="text-sm font-black text-ink flex items-center gap-1.5">
              📢 Notice Board
            </h3>
            {isAdmin && (
              <button
                onClick={() => setShowNoticeModal(true)}
                className="tap rounded-lg bg-ink px-3 py-1 text-xs font-bold text-paper transition-transform hover:-translate-y-0.5"
              >
                Update Notice
              </button>
            )}
          </div>

          <div className="mt-3">
            {notice ? (
              <div className="space-y-2">
                <h4 className="text-base font-black text-ink">{notice.title}</h4>
                <p className="text-xs text-ink/75 whitespace-pre-wrap leading-relaxed">
                  {notice.content}
                </p>
                
                {notice.pdfBase64 && (
                  <div className="mt-3.5 pt-2.5 border-t border-ink/5 flex items-center justify-between">
                    <span className="text-[10px] font-semibold text-ink/40 flex items-center gap-1">
                      📄 {notice.pdfName || "attached_document.pdf"}
                    </span>
                    <a
                      href={notice.pdfBase64}
                      download={notice.pdfName || "Notice.pdf"}
                      className="tap inline-flex items-center gap-1 rounded-lg bg-surface px-2.5 py-1 text-xs font-bold text-ink/70 hover:bg-ink/10 hover:text-ink transition-colors"
                    >
                      Download PDF
                    </a>
                  </div>
                )}
                
                <p className="text-[9px] text-ink/30 text-right mt-1.5">
                  Posted on {new Date(notice.uploadedAt).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                </p>
              </div>
            ) : (
              <div className="py-4 text-center">
                <p className="text-xs font-black text-ink/40">No active announcements</p>
                <p className="mt-0.5 text-[10px] text-ink/30">Check back later for updates.</p>
              </div>
            )}
          </div>
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

      {/* Notice Update Modal */}
      {showNoticeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4 backdrop-blur-sm animate-fade-in">
          <form
            onSubmit={handleSaveNotice}
            className="w-full max-w-md rounded-2xl border border-ink/10 bg-white p-5 shadow-lg animate-in fade-in zoom-in-95 duration-150"
          >
            <h3 className="text-base font-black text-ink flex items-center gap-2 border-b border-ink/5 pb-3">
              📢 Update Notice Board
            </h3>
            
            <div className="mt-4 space-y-3">
              <div>
                <label className="text-[10px] font-black uppercase tracking-widest text-ink/40">Notice Title</label>
                <input
                  type="text"
                  required
                  value={noticeTitle}
                  onChange={(e) => setNoticeTitle(e.target.value)}
                  placeholder="e.g. Exam Schedule Postponed"
                  className="mt-1 block w-full rounded-lg border border-ink/10 bg-surface px-3 py-2 text-xs font-bold text-ink placeholder:text-ink/30 focus:border-ink/20 focus:outline-none"
                />
              </div>
              
              <div>
                <label className="text-[10px] font-black uppercase tracking-widest text-ink/40">Notice Content</label>
                <textarea
                  required
                  rows={4}
                  value={noticeContent}
                  onChange={(e) => setNoticeContent(e.target.value)}
                  placeholder="Type the announcement details here..."
                  className="mt-1 block w-full rounded-lg border border-ink/10 bg-surface px-3 py-2 text-xs font-bold text-ink placeholder:text-ink/30 focus:border-ink/20 focus:outline-none resize-none"
                />
              </div>

              <div>
                <label className="text-[10px] font-black uppercase tracking-widest text-ink/40">Attach PDF (Optional)</label>
                <input
                  id="notice-pdf-input"
                  type="file"
                  accept=".pdf"
                  onChange={(e) => setPdfFile(e.target.files[0] || null)}
                  className="mt-1 block w-full text-xs text-ink/50 file:mr-3 file:py-1 file:px-2.5 file:rounded-md file:border-0 file:text-[10px] file:font-black file:bg-ink file:text-paper file:cursor-pointer hover:file:opacity-90"
                />
                {notice?.pdfName && !pdfFile && (
                  <p className="mt-1.5 text-[9px] font-semibold text-mint">
                    Current attachment: {notice.pdfName} (will be kept unless overwritten)
                  </p>
                )}
              </div>

              <div>
                <label className="text-[10px] font-black uppercase tracking-widest text-ink/40">Visible For</label>
                <select
                  value={expiresInHours}
                  onChange={(e) => setExpiresInHours(parseInt(e.target.value))}
                  className="mt-1 block w-full rounded-lg border border-ink/10 bg-surface px-3 py-2 text-xs font-bold text-ink focus:border-ink/20 focus:outline-none"
                >
                  <option value={1}>1 Hour</option>
                  <option value={3}>3 Hours</option>
                  <option value={6}>6 Hours</option>
                  <option value={12}>12 Hours</option>
                  <option value={24}>24 Hours (1 Day)</option>
                  <option value={48}>48 Hours (2 Days)</option>
                  <option value={72}>72 Hours (3 Days)</option>
                  <option value={168}>168 Hours (1 Week)</option>
                </select>
              </div>
            </div>

            <div className="mt-5 flex items-center justify-end gap-2 border-t border-ink/5 pt-3">
              <button
                type="button"
                disabled={noticeBusy}
                onClick={() => {
                  setShowNoticeModal(false);
                  setPdfFile(null);
                }}
                className="tap rounded-lg bg-surface px-3 py-1.5 text-xs font-bold text-ink/60 hover:bg-ink/10 hover:text-ink"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={noticeBusy}
                className="tap rounded-lg bg-ink px-4 py-1.5 text-xs font-bold text-paper hover:opacity-90 disabled:opacity-50"
              >
                {noticeBusy ? "Saving..." : "Save Notice"}
              </button>
            </div>
          </form>
        </div>
      )}

    </Layout>
  );
}

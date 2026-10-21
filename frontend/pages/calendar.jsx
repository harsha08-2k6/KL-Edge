import React, { useState, useMemo, useEffect, useCallback, useRef } from "react";
import { Link } from "react-router-dom";
import { 
  Calendar as CalendarIcon, 
  Clock, 
  Sparkles, 
  Flag, 
  Search, 
  X,
  Filter, 
  ChevronRight,
  ChevronLeft,
  Info,
  CalendarDays,
  List,
  Bell,
  CheckCircle2,
  AlertTriangle,
  GraduationCap,
  BookOpen,
  CalendarCheck,
  AlertCircle,
  Sliders,
  ChevronDown,
  Layers,
  FileText,
  Briefcase,
  Download,
  Share2,
  ArrowRight,
  Timer,
  ExternalLink,
  Flame,
  Check,
  CreditCard,
  BellOff
} from "lucide-react";
import { Layout } from "../components/Layout.jsx";
import { readLocal, writeLocal, STORAGE_KEYS } from "../utils/storage.js";
import { 
  PROGRAM_KEYS, 
  PROGRAM_DEFINITIONS, 
  EVENT_CATEGORIES, 
  getProgramEvents, 
  detectStudentProgram, 
  calculateDashboardStats, 
  formatDDMMMYYYY, 
  formatDateRange, 
  getEventStatus,
  getDaysUntil,
  generatePersonalizedReminders,
  downloadICalendar,
  DEFAULT_REMINDER_PREFERENCES,
  getKolkataDate,
  isFeeEvent
} from "../utils/academicCalendarData.js";
import { getTodayHoliday } from "../utils/holidays.js";

const TAB_OPTIONS = [
  { id: "ALL", label: "All Events", icon: Layers, countKey: "all" },
  { id: EVENT_CATEGORIES.EXAM, label: "Examinations", icon: FileText, countKey: "exam" },
  { id: EVENT_CATEGORIES.HOLIDAY, label: "Official Holidays", icon: CalendarCheck, countKey: "holiday" },
  { id: EVENT_CATEGORIES.DEADLINE, label: "Important Deadlines", icon: AlertCircle, countKey: "deadline" },
  { id: EVENT_CATEGORIES.ACADEMIC, label: "Academic Events", icon: GraduationCap, countKey: "academic" },
  { id: "TIMELINE", label: "Program Timeline", icon: CalendarDays, countKey: "timeline" },
  { id: "REMINDERS", label: "Smart Reminders", icon: Bell, countKey: "reminders" }
];

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];
const DAYS_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default function CalendarPage() {
  // Determine student initial program
  const credentials = readLocal(STORAGE_KEYS.credentials, null);
  const savedProgram = readLocal("kl-edge.academicProgram", null);
  const initialProgram = savedProgram || detectStudentProgram(credentials?.username || credentials?.erpId);

  const [selectedProgramKey, setSelectedProgramKey] = useState(initialProgram);
  const [activeTab, setActiveTab] = useState("ALL");
  const [viewStyle, setViewStyle] = useState("list"); // "list" | "month"
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTermFilter, setSelectedTermFilter] = useState("ALL");
  const [selectedStatusFilter, setSelectedStatusFilter] = useState("ALL"); // ALL | upcoming | ongoing | completed
  
  // Interactive Monthly View State
  const [calendarMonth, setCalendarMonth] = useState(() => new Date().getMonth());
  const [calendarYear, setCalendarYear] = useState(() => new Date().getFullYear());
  const [selectedMonthDateDetail, setSelectedMonthDateDetail] = useState(null);

  // Reminder preferences state
  const [reminderPrefs, setReminderPrefs] = useState(() => {
    return readLocal("kl-edge.reminderPrefs", DEFAULT_REMINDER_PREFERENCES);
  });
  const [completedFeeIds, setCompletedFeeIds] = useState(() => {
    const saved = readLocal("kl-edge.completedFeeIds", null);
    if (Array.isArray(saved)) return saved;
    const prefs = readLocal("kl-edge.reminderPrefs", null);
    return Array.isArray(prefs?.completedFeeIds) ? prefs.completedFeeIds : [];
  });
  const [notificationSyncStatus, setNotificationSyncStatus] = useState(null);

  // Toggle Fee Completed Status (Stops all reminders immediately for this fee)
  const toggleFeeCompleted = useCallback(async (feeEventId) => {
    setCompletedFeeIds((prev) => {
      const isCompleted = prev.includes(feeEventId);
      const updated = isCompleted
        ? prev.filter((id) => id !== feeEventId)
        : [...prev, feeEventId];

      writeLocal("kl-edge.completedFeeIds", updated);
      
      setReminderPrefs((prevPrefs) => {
        const next = { ...prevPrefs, completedFeeIds: updated };
        writeLocal("kl-edge.reminderPrefs", next);
        return next;
      });

      const studentId = credentials?.username || credentials?.erpId || "guest_student";
      fetch("/api/calendar/fee-status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentId,
          eventId: feeEventId,
          completed: !isCompleted,
          status: isCompleted ? "pending" : "completed"
        })
      }).catch(() => {});

      return updated;
    });
  }, [credentials]);

  // Toggle Academic Notifications ON / OFF
  const toggleAcademicNotifications = useCallback(async (enabled) => {
    setReminderPrefs((prev) => {
      const updated = {
        ...prev,
        academicNotificationsEnabled: enabled
      };
      writeLocal("kl-edge.reminderPrefs", updated);

      const studentId = credentials?.username || credentials?.erpId || "guest_student";
      fetch("/api/calendar/preferences", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentId,
          programKey: selectedProgramKey,
          preferences: updated
        })
      }).catch(() => {});

      return updated;
    });

    setNotificationSyncStatus(enabled ? "reminders_on" : "reminders_off");
    setTimeout(() => setNotificationSyncStatus(null), 3500);
  }, [credentials, selectedProgramKey]);

  // Program Selectable Dropdown State
  const [isProgramDropdownOpen, setIsProgramDropdownOpen] = useState(false);
  const programDropdownRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(event) {
      if (programDropdownRef.current && !programDropdownRef.current.contains(event.target)) {
        setIsProgramDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const todayHoliday = useMemo(() => getTodayHoliday(), []);
  const todayDate = useMemo(() => new Date(), []);
  // Asia/Kolkata timezone reference for the 7-day activation rule
  const todayKey = useMemo(() => getKolkataDate(todayDate), [todayDate]);

  // Active Program Definition
  const currentProgram = useMemo(() => {
    return PROGRAM_DEFINITIONS.find(p => p.key === selectedProgramKey) || PROGRAM_DEFINITIONS[1];
  }, [selectedProgramKey]);

  // Handle program change with persistence
  const handleProgramChange = (newKey) => {
    setSelectedProgramKey(newKey);
    writeLocal("kl-edge.academicProgram", newKey);
    // Background sync to backend
    const studentId = credentials?.username || credentials?.erpId || "guest_student";
    fetch("/api/calendar/preferences", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        studentId,
        programKey: newKey,
        preferences: reminderPrefs
      })
    }).catch(() => {});
  };

  // Dashboard Metrics & Highlights
  const dashboardStats = useMemo(() => {
    return calculateDashboardStats(selectedProgramKey, todayDate);
  }, [selectedProgramKey, todayDate]);

  // All events for active program
  const allProgramEvents = useMemo(() => {
    return getProgramEvents(selectedProgramKey);
  }, [selectedProgramKey]);

  // Generated Smart Reminders adhering strictly to 7-Day Window and Asia/Kolkata timezone
  const personalizedReminders = useMemo(() => {
    const effectivePrefs = {
      ...reminderPrefs,
      completedFeeIds,
      academicNotificationsEnabled: reminderPrefs?.academicNotificationsEnabled !== false
    };
    return generatePersonalizedReminders(selectedProgramKey, effectivePrefs, todayDate);
  }, [selectedProgramKey, reminderPrefs, completedFeeIds, todayDate]);

  // Category counts
  const categoryCounts = useMemo(() => {
    const counts = { 
      all: allProgramEvents.length, 
      exam: 0, 
      holiday: 0, 
      deadline: 0, 
      academic: 0,
      timeline: allProgramEvents.length,
      reminders: personalizedReminders.filter(r => !r.isPast).length
    };
    allProgramEvents.forEach(e => {
      if (e.category === EVENT_CATEGORIES.EXAM) counts.exam++;
      else if (e.category === EVENT_CATEGORIES.HOLIDAY) counts.holiday++;
      else if (e.category === EVENT_CATEGORIES.DEADLINE) counts.deadline++;
      else if (e.category === EVENT_CATEGORIES.ACADEMIC || e.category === EVENT_CATEGORIES.INTERNSHIP) counts.academic++;
    });
    return counts;
  }, [allProgramEvents, personalizedReminders]);

  // Available Terms for active program
  const availableTerms = useMemo(() => {
    const set = new Set();
    allProgramEvents.forEach(e => {
      if (e.term && e.term !== "Official Holiday") set.add(e.term);
    });
    return Array.from(set);
  }, [allProgramEvents]);

  // 1. Scoped events matching active category tab, selected term, and search query
  const scopedEvents = useMemo(() => {
    return allProgramEvents.filter((item) => {
      // Category / Tab filter
      if (activeTab !== "ALL" && activeTab !== "TIMELINE" && activeTab !== "REMINDERS") {
        if (item.category !== activeTab) return false;
      }

      // Term filter
      if (selectedTermFilter !== "ALL") {
        if (item.term !== selectedTermFilter) return false;
      }

      // Search query filter
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const matchesTitle = item.title.toLowerCase().includes(query);
        const matchesCategory = item.category.toLowerCase().includes(query);
        const matchesTerm = (item.term || "").toLowerCase().includes(query);
        const matchesDesc = (item.description || "").toLowerCase().includes(query);
        const matchesDates = (item.displayDates || "").toLowerCase().includes(query);
        return matchesTitle || matchesCategory || matchesTerm || matchesDesc || matchesDates;
      }

      return true;
    });
  }, [allProgramEvents, activeTab, selectedTermFilter, searchQuery]);

  // 2. Dynamic status counts strictly within the currently filtered scope
  const statusFilterCounts = useMemo(() => {
    let upcoming = 0;
    let completed = 0;
    let ongoing = 0;

    scopedEvents.forEach((item) => {
      const status = getEventStatus(item.startDate, item.endDate, todayDate);
      if (status === "completed") {
        completed++;
      } else if (status === "ongoing") {
        ongoing++;
        upcoming++; // ongoing is active/upcoming
      } else {
        upcoming++;
      }
    });

    return {
      all: scopedEvents.length,
      upcoming,
      completed,
      ongoing
    };
  }, [scopedEvents, todayDate]);

  // 3. Final filtered events applying the status filter
  const filteredEvents = useMemo(() => {
    return scopedEvents.filter((item) => {
      if (selectedStatusFilter === "ALL") return true;
      const status = getEventStatus(item.startDate, item.endDate, todayDate);
      if (selectedStatusFilter === "upcoming") {
        return status === "upcoming" || status === "ongoing";
      }
      if (selectedStatusFilter === "completed") {
        return status === "completed";
      }
      if (selectedStatusFilter === "ongoing") {
        return status === "ongoing";
      }
      return true;
    });
  }, [scopedEvents, selectedStatusFilter, todayDate]);

  // Timeline Grouping (by Semester/Trimester/Summer)
  const timelineGrouped = useMemo(() => {
    const groups = {};
    allProgramEvents.forEach(e => {
      const groupKey = e.term || "General";
      if (!groups[groupKey]) groups[groupKey] = [];
      groups[groupKey].push(e);
    });
    return groups;
  }, [allProgramEvents]);

  // Monthly Calendar Calculations
  const monthDays = useMemo(() => {
    const firstDay = new Date(calendarYear, calendarMonth, 1).getDay();
    const daysInMonth = new Date(calendarYear, calendarMonth + 1, 0).getDate();

    const days = [];
    for (let i = 0; i < firstDay; i++) {
      days.push({ dayNumber: null, dateKey: null, events: [] });
    }
    for (let d = 1; d <= daysInMonth; d++) {
      const mStr = String(calendarMonth + 1).padStart(2, "0");
      const dStr = String(d).padStart(2, "0");
      const dateKey = `${calendarYear}-${mStr}-${dStr}`;

      const matchedEvents = allProgramEvents.filter(ev => {
        return dateKey >= ev.startDate && dateKey <= (ev.endDate || ev.startDate);
      });

      days.push({
        dayNumber: d,
        dateKey,
        events: matchedEvents,
        isToday: dateKey === todayKey,
        isSunday: new Date(calendarYear, calendarMonth, d).getDay() === 0
      });
    }
    return days;
  }, [calendarYear, calendarMonth, allProgramEvents, todayKey]);

  // Sync reminders to system notifications & local updates with strict 7-day de-duplication
  const syncRemindersToNotifications = useCallback(async () => {
    if (reminderPrefs?.academicNotificationsEnabled === false) {
      setNotificationSyncStatus("disabled");
      setTimeout(() => setNotificationSyncStatus(null), 3000);
      return;
    }

    try {
      setNotificationSyncStatus("syncing");
      
      // Request browser notification permission if available
      if ("Notification" in window && Notification.permission !== "granted" && Notification.permission !== "denied") {
        await Notification.requestPermission();
      }

      const existingUpdates = readLocal("kl-edge.recentUpdates", []);
      const deliveredRecords = readLocal("kl-edge.deliveredReminders", []);
      const newDelivered = [];
      const newNotifs = [];

      // Only notify for active reminders in the 7-day window that are due today or overdue
      personalizedReminders.forEach((rem) => {
        // Prevent duplicate delivery records
        if (deliveredRecords.includes(rem.id)) {
          return;
        }

        if (rem.isDueToday || rem.isOverdue) {
          newDelivered.push(rem.id);

          const exists = existingUpdates.some((u) => u.id === rem.id);
          if (!exists) {
            newNotifs.push({
              id: rem.id,
              type: "calendar_reminder",
              timestamp: new Date().toISOString(),
              read: false,
              title: rem.title,
              message: rem.message,
              data: rem
            });

            if ("Notification" in window && Notification.permission === "granted") {
              try {
                new Notification(rem.title, {
                  body: rem.message,
                  icon: "/icon-192.png"
                });
              } catch {
                // ignore
              }
            }
          }
        }
      });

      if (newDelivered.length > 0) {
        writeLocal("kl-edge.deliveredReminders", [...deliveredRecords, ...newDelivered]);
      }

      if (newNotifs.length > 0) {
        const merged = [...newNotifs, ...existingUpdates].slice(0, 30);
        writeLocal("kl-edge.recentUpdates", merged);
      }

      const studentId = credentials?.username || credentials?.erpId || "student_user";
      await fetch("/api/calendar/reminders/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentId,
          programKey: selectedProgramKey
        })
      });

      setNotificationSyncStatus("synced");
      setTimeout(() => setNotificationSyncStatus(null), 3000);
    } catch {
      setNotificationSyncStatus("error");
      setTimeout(() => setNotificationSyncStatus(null), 3000);
    }
  }, [personalizedReminders, credentials, selectedProgramKey, reminderPrefs]);

  return (
    <Layout
      title="Academic Calendar"
      action={
        <div className="flex items-center gap-1.5 md:gap-2">
          {/* Quick Reminders ON/OFF Toggle Switch Button */}
          <button
            type="button"
            onClick={() => toggleAcademicNotifications(reminderPrefs?.academicNotificationsEnabled === false)}
            className={`tap inline-flex h-9 items-center gap-2 rounded-lg border px-2.5 md:px-3 text-xs font-bold transition-all shadow-xs ${
              reminderPrefs?.academicNotificationsEnabled !== false
                ? "border-mint/30 bg-mint/10 text-mint hover:bg-mint/20"
                : "border-ink/15 bg-white text-ink/60 hover:bg-surface"
            }`}
            title={
              reminderPrefs?.academicNotificationsEnabled !== false
                ? "Academic Reminders are ON (Click to Turn OFF)"
                : "Academic Reminders are OFF (Click to Turn ON)"
            }
          >
            {reminderPrefs?.academicNotificationsEnabled !== false ? (
              <Bell size={14} className="text-mint shrink-0" />
            ) : (
              <BellOff size={14} className="text-ink/40 shrink-0" />
            )}
            <span className="hidden sm:inline">Reminders:</span>
            {/* Interactive Switch Indicator */}
            <div
              className={`relative inline-flex h-4 w-7 items-center rounded-full transition-colors ${
                reminderPrefs?.academicNotificationsEnabled !== false ? "bg-mint" : "bg-ink/20"
              }`}
            >
              <span
                className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform shadow-xs ${
                  reminderPrefs?.academicNotificationsEnabled !== false ? "translate-x-3.5" : "translate-x-0.5"
                }`}
              />
            </div>
            <span
              className={`text-[10px] font-black uppercase ${
                reminderPrefs?.academicNotificationsEnabled !== false ? "text-mint" : "text-ink/60"
              }`}
            >
              {reminderPrefs?.academicNotificationsEnabled !== false ? "ON" : "OFF"}
            </span>
          </button>

          {/* 1-Click iCal Export */}
          <button
            type="button"
            onClick={() => downloadICalendar(selectedProgramKey)}
            className="tap inline-flex h-9 items-center gap-1.5 rounded-lg border border-ink/10 bg-white px-2.5 md:px-3 text-xs font-bold text-ink/75 shadow-soft transition-all hover:bg-surface hover:text-ink"
            title="Download iCal file to import into Google/Apple Calendar"
          >
            <Download size={14} className="text-mint" />
            <span className="hidden sm:inline">Export Calendar (.ics)</span>
          </button>

          {/* Sync Reminders */}
          <button
            type="button"
            onClick={syncRemindersToNotifications}
            disabled={reminderPrefs?.academicNotificationsEnabled === false}
            className={`tap inline-flex h-9 items-center gap-1.5 rounded-lg border px-2.5 md:px-3 text-xs font-bold transition-all ${
              reminderPrefs?.academicNotificationsEnabled === false
                ? "border-ink/10 bg-surface text-ink/40 cursor-not-allowed"
                : "border-mint/30 bg-mint/10 text-mint hover:bg-mint/20"
            }`}
            title={
              reminderPrefs?.academicNotificationsEnabled === false
                ? "Reminders are turned OFF (Turn ON above to sync)"
                : "Synchronize smart reminders to notification center"
            }
          >
            <Bell size={14} />
            <span className="hidden md:inline">Sync Reminders</span>
          </button>

          <Link
            to="/timetable"
            className="tap inline-flex h-9 items-center gap-1.5 rounded-lg border border-ink/10 bg-white px-2.5 md:px-3 text-xs font-bold text-ink/75 shadow-soft transition-all hover:text-ink"
          >
            <Clock size={14} />
            <span className="hidden sm:inline">Timetable</span>
          </Link>
        </div>
      }
    >
      <div className="pb-16 space-y-4">
        {/* Sync Toast Feedback */}
        {notificationSyncStatus === "synced" && (
          <div className="rounded-xl border border-mint/30 bg-mint/10 p-3 text-xs font-bold text-mint flex items-center gap-2 shadow-soft animate-in fade-in slide-in-from-top-2">
            <CheckCircle2 size={16} />
            <span>Academic reminders successfully synced with your notifications!</span>
          </div>
        )}
        {notificationSyncStatus === "reminders_on" && (
          <div className="rounded-xl border border-mint/30 bg-mint/10 p-3 text-xs font-bold text-mint flex items-center gap-2 shadow-soft animate-in fade-in slide-in-from-top-2">
            <Bell size={16} />
            <span>Academic Reminders are now turned ON! Notifications activate 7 days prior to exams & fee deadlines.</span>
          </div>
        )}
        {notificationSyncStatus === "reminders_off" && (
          <div className="rounded-xl border border-ink/15 bg-surface p-3 text-xs font-bold text-ink/75 flex items-center gap-2 shadow-soft animate-in fade-in slide-in-from-top-2">
            <BellOff size={16} className="text-ink/50" />
            <span>Academic Reminders turned OFF. Alerts are paused with zero backlog delivery.</span>
          </div>
        )}

        {/* 1. Compact Selectable Student Program Card */}
        <div className="rounded-2xl border border-ink/10 bg-white p-3.5 md:p-4 shadow-soft space-y-2.5 relative">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            {/* Left: Active Program Details */}
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-mint/15 text-mint shrink-0 shadow-sm">
                <GraduationCap size={20} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="flex h-2 w-2 rounded-full bg-mint animate-pulse" />
                  <span className="text-[10px] font-black uppercase tracking-widest text-ink/50">
                    Active Program
                  </span>
                  <span className="rounded-md bg-ink/5 px-1.5 py-0.2 text-[10px] font-black text-ink/70">
                    {currentProgram.batch}
                  </span>
                  <span className="hidden sm:inline text-[10px] font-bold text-mint bg-mint/10 px-2 py-0.2 rounded-md">
                    {dashboardStats.currentTerm}
                  </span>
                </div>
                <h2 className="text-sm md:text-base font-black text-ink mt-0.5">
                  {currentProgram.name}
                </h2>
                <p className="text-[11px] font-bold text-ink/50 sm:hidden">
                  {dashboardStats.currentTerm} • {currentProgram.system}
                </p>
              </div>
            </div>

            {/* Right: Selectable Dropdown Menu */}
            <div className="relative shrink-0" ref={programDropdownRef}>
              <button
                type="button"
                onClick={() => setIsProgramDropdownOpen(!isProgramDropdownOpen)}
                className="tap w-full sm:w-auto inline-flex items-center justify-between gap-2.5 rounded-xl border border-ink/15 bg-surface/50 hover:bg-surface px-3.5 py-2 text-xs font-bold text-ink shadow-sm transition-all focus:border-mint focus:outline-none"
                aria-haspopup="true"
                aria-expanded={isProgramDropdownOpen}
              >
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] font-black px-1.5 py-0.5 rounded bg-mint text-white">
                    {currentProgram.batch}
                  </span>
                  <span className="truncate max-w-[180px] md:max-w-[220px]">
                    {currentProgram.shortName}
                  </span>
                </div>
                <ChevronDown
                  size={14}
                  className={`text-ink/40 transition-transform duration-200 ${isProgramDropdownOpen ? "rotate-180 text-mint" : ""}`}
                />
              </button>

              {/* Dropdown Popover */}
              {isProgramDropdownOpen && (
                <div className="absolute right-0 top-full mt-2 w-full sm:w-80 rounded-2xl border border-ink/15 bg-white p-2 shadow-soft z-30 animate-in fade-in slide-in-from-top-2">
                  <div className="px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-ink/40 border-b border-ink/5 mb-1">
                    Select Academic Program
                  </div>
                  <div className="space-y-1">
                    {PROGRAM_DEFINITIONS.map((prog) => {
                      const isSelected = prog.key === selectedProgramKey;
                      return (
                        <button
                          key={prog.key}
                          type="button"
                          onClick={() => {
                            handleProgramChange(prog.key);
                            setIsProgramDropdownOpen(false);
                          }}
                          className={`w-full text-left p-2.5 rounded-xl flex items-center justify-between transition-all ${
                            isSelected
                              ? "bg-mint/10 text-ink font-black border border-mint/25"
                              : "hover:bg-surface text-ink/75 font-semibold"
                          }`}
                        >
                          <div>
                            <div className="flex items-center gap-1.5">
                              <span className={`text-[10px] font-black px-1.5 py-0.5 rounded ${
                                isSelected ? "bg-mint text-white" : "bg-ink/5 text-ink/60"
                              }`}>
                                {prog.batch}
                              </span>
                              <span className="text-xs">{prog.shortName}</span>
                            </div>
                            <span className="text-[10px] font-medium text-ink/45 block mt-0.5 pl-6">
                              {prog.system}
                            </span>
                          </div>
                          {isSelected && (
                            <CheckCircle2 size={15} className="text-mint shrink-0 ml-2" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Bottom subtle metadata */}
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-ink/5 pt-2 text-[10px] md:text-[11px] text-ink/50">
            <div className="flex items-center gap-2">
              <span className="font-semibold">Curriculum System:</span>
              <span className="font-bold text-ink/70">{currentProgram.system}</span>
            </div>
            <div className="italic text-ink/40 truncate max-w-xs md:max-w-md">
              Source: {currentProgram.sourcePdf}
            </div>
          </div>
        </div>

        {/* 2. Today's Holiday Suspension Banner */}
        {todayHoliday && (
          <div className="rounded-2xl border border-emerald-200/80 bg-gradient-to-r from-emerald-50/50 via-emerald-50/20 to-white p-4 md:p-5 shadow-soft">
            <div className="flex items-center gap-2">
              <span className="flex h-2 w-2 rounded-full bg-emerald-600 animate-pulse" />
              <span className="text-[10px] font-bold uppercase tracking-widest text-emerald-800">
                Official University Holiday Today
              </span>
            </div>
            <h2 className="mt-1 text-base md:text-lg font-bold text-ink">
              Holiday due to {todayHoliday.name}
            </h2>
            {todayHoliday.subEvent && (
              <p className="mt-0.5 text-xs font-semibold text-emerald-950">
                Special Occasion: {todayHoliday.subEvent}
              </p>
            )}
            <p className="mt-1.5 text-xs text-ink/70 leading-relaxed">
              Timetable suspended today • Regular instructional classes do not convene on confirmed official holidays.
            </p>
          </div>
        )}

        {/* 3. Clickable Quick-Jump Dashboard Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Next Examination */}
          <div
            onClick={() => { setActiveTab(EVENT_CATEGORIES.EXAM); setViewStyle("list"); }}
            className="tap rounded-2xl border border-rose-200/70 bg-gradient-to-br from-rose-50/35 via-white to-white p-4 shadow-soft cursor-pointer hover:border-rose-300 hover:shadow-md transition-all flex flex-col justify-between group"
          >
            <div>
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider text-rose-800">
                  Next Examination
                </span>
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-rose-50 text-rose-700 border border-rose-100 group-hover:bg-rose-100/70 transition-colors">
                  <FileText size={14} />
                </span>
              </div>
              {dashboardStats.nextExam ? (
                <>
                  <h4 className="mt-2 text-xs md:text-sm font-bold text-ink line-clamp-2">
                    {dashboardStats.nextExam.title}
                  </h4>
                  <p className="mt-1 text-xs font-semibold text-rose-950/80">
                    {dashboardStats.nextExam.displayDates}
                  </p>
                </>
              ) : (
                <p className="mt-2 text-xs text-ink/40 italic">No upcoming exams listed.</p>
              )}
            </div>
            <div className="mt-3 flex items-center justify-between border-t border-rose-100/80 pt-2 text-[10px]">
              <span className="font-semibold text-ink/60">
                {dashboardStats.nextExam ? getDaysUntil(dashboardStats.nextExam.startDate)?.label : "Up to date"}
              </span>
              <span className="font-bold text-rose-700 flex items-center gap-0.5 group-hover:translate-x-1 transition-transform">
                View Exams <ChevronRight size={12} />
              </span>
            </div>
          </div>

          {/* Upcoming Official Holiday */}
          <div
            onClick={() => { setActiveTab(EVENT_CATEGORIES.HOLIDAY); setViewStyle("list"); }}
            className="tap rounded-2xl border border-emerald-200/70 bg-gradient-to-br from-emerald-50/35 via-white to-white p-4 shadow-soft cursor-pointer hover:border-emerald-300 hover:shadow-md transition-all flex flex-col justify-between group"
          >
            <div>
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-800">
                  Upcoming Holiday
                </span>
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-100 group-hover:bg-emerald-100/70 transition-colors">
                  <CalendarCheck size={14} />
                </span>
              </div>
              {dashboardStats.nextHoliday ? (
                <>
                  <h4 className="mt-2 text-xs md:text-sm font-bold text-ink line-clamp-2">
                    {dashboardStats.nextHoliday.title}
                  </h4>
                  <p className="mt-1 text-xs font-semibold text-emerald-950/80">
                    {dashboardStats.nextHoliday.displayDates} {dashboardStats.nextHoliday.dayDescription && `(${dashboardStats.nextHoliday.dayDescription})`}
                  </p>
                </>
              ) : (
                <p className="mt-2 text-xs text-ink/40 italic">No upcoming holidays listed.</p>
              )}
            </div>
            <div className="mt-3 flex items-center justify-between border-t border-emerald-100/80 pt-2 text-[10px]">
              <span className="font-semibold text-ink/60">
                Timetable Suspended
              </span>
              <span className="font-bold text-emerald-700 flex items-center gap-0.5 group-hover:translate-x-1 transition-transform">
                View Holidays <ChevronRight size={12} />
              </span>
            </div>
          </div>

          {/* Upcoming Important Deadline */}
          <div
            onClick={() => { setActiveTab(EVENT_CATEGORIES.DEADLINE); setViewStyle("list"); }}
            className="tap rounded-2xl border border-amber-200/70 bg-gradient-to-br from-amber-50/35 via-white to-white p-4 shadow-soft cursor-pointer hover:border-amber-300 hover:shadow-md transition-all flex flex-col justify-between group"
          >
            <div>
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider text-amber-900">
                  Upcoming Deadline
                </span>
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-50 text-amber-800 border border-amber-100 group-hover:bg-amber-100/70 transition-colors">
                  <AlertCircle size={14} />
                </span>
              </div>
              {dashboardStats.nextDeadline ? (
                <>
                  <h4 className="mt-2 text-xs md:text-sm font-bold text-ink line-clamp-2">
                    {dashboardStats.nextDeadline.title}
                  </h4>
                  <p className="mt-1 text-xs font-semibold text-amber-950/80">
                    Due: {formatDDMMMYYYY(dashboardStats.nextDeadline.startDate)}
                  </p>
                </>
              ) : (
                <p className="mt-2 text-xs text-ink/40 italic">No upcoming deadlines.</p>
              )}
            </div>
            <div className="mt-3 flex items-center justify-between border-t border-amber-100/80 pt-2 text-[10px]">
              <span className="font-semibold text-ink/60">
                {dashboardStats.nextDeadline ? getDaysUntil(dashboardStats.nextDeadline.startDate)?.label : "All clear"}
              </span>
              <span className="font-bold text-amber-800 flex items-center gap-0.5 group-hover:translate-x-1 transition-transform">
                View Deadlines <ChevronRight size={12} />
              </span>
            </div>
          </div>

          {/* Next Academic Event */}
          <div
            onClick={() => { setActiveTab(EVENT_CATEGORIES.ACADEMIC); setViewStyle("list"); }}
            className="tap rounded-2xl border border-indigo-200/70 bg-gradient-to-br from-indigo-50/35 via-white to-white p-4 shadow-soft cursor-pointer hover:border-indigo-300 hover:shadow-md transition-all flex flex-col justify-between group"
          >
            <div>
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-900">
                  Next Academic Event
                </span>
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-50 text-indigo-700 border border-indigo-100 group-hover:bg-indigo-100/70 transition-colors">
                  <GraduationCap size={14} />
                </span>
              </div>
              {dashboardStats.nextAcademic ? (
                <>
                  <h4 className="mt-2 text-xs md:text-sm font-bold text-ink line-clamp-2">
                    {dashboardStats.nextAcademic.title}
                  </h4>
                  <p className="mt-1 text-xs font-semibold text-indigo-950/80">
                    {dashboardStats.nextAcademic.displayDates}
                  </p>
                </>
              ) : (
                <p className="mt-2 text-xs text-ink/40 italic">No academic event listed.</p>
              )}
            </div>
            <div className="mt-3 flex items-center justify-between border-t border-indigo-100/80 pt-2 text-[10px]">
              <span className="font-semibold text-ink/60">
                Term: {dashboardStats.nextAcademic?.term || "General"}
              </span>
              <span className="font-bold text-indigo-800 flex items-center gap-0.5 group-hover:translate-x-1 transition-transform">
                View Events <ChevronRight size={12} />
              </span>
            </div>
          </div>
        </div>

        {/* 4. Controls: Category Tabs & View Switcher */}
        <div className="rounded-2xl border border-ink/10 bg-white p-3 md:p-4 shadow-soft space-y-3">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            {/* Scrollable Category Tabs */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
              {TAB_OPTIONS.map((tab) => {
                const isRemindersTab = tab.id === "REMINDERS";
                const isRemindersOff = isRemindersTab && reminderPrefs?.academicNotificationsEnabled === false;
                const Icon = isRemindersOff ? BellOff : tab.icon;
                const isActive = activeTab === tab.id;
                const count = categoryCounts[tab.countKey];

                let badgeColorClass = "bg-ink/5 text-ink/60";
                if (isActive) {
                  badgeColorClass = "bg-white/20 text-white";
                } else if (tab.id === EVENT_CATEGORIES.EXAM) {
                  badgeColorClass = "bg-rose-50 text-rose-700 border border-rose-200/60";
                } else if (tab.id === EVENT_CATEGORIES.HOLIDAY) {
                  badgeColorClass = "bg-emerald-50 text-emerald-700 border border-emerald-200/60";
                } else if (tab.id === EVENT_CATEGORIES.DEADLINE) {
                  badgeColorClass = "bg-amber-50 text-amber-800 border border-amber-200/60";
                } else if (tab.id === EVENT_CATEGORIES.ACADEMIC) {
                  badgeColorClass = "bg-indigo-50 text-indigo-700 border border-indigo-200/60";
                } else if (tab.id === "REMINDERS") {
                  badgeColorClass = "bg-mint/15 text-mint border border-mint/25";
                }

                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveTab(tab.id)}
                    className={`tap flex items-center gap-1.5 whitespace-nowrap rounded-xl px-3 py-2 text-xs font-bold transition-all ${
                      isActive
                        ? "bg-ink text-paper shadow-sm scale-[1.02]"
                        : "bg-surface/50 text-ink/65 hover:bg-surface hover:text-ink"
                    }`}
                  >
                    <Icon size={14} className={isRemindersOff && !isActive ? "text-ink/40" : ""} />
                    <span>{tab.label}</span>
                    {isRemindersOff ? (
                      <span className="text-[10px] font-black px-1.5 py-0.2 rounded-full bg-ink/10 text-ink/50">
                        OFF
                      </span>
                    ) : count !== undefined ? (
                      <span className={`text-[10px] font-black px-1.5 py-0.2 rounded-full ${badgeColorClass}`}>
                        {count}
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </div>

            {/* View Mode Switcher: List vs Month Grid */}
            <div className="flex items-center gap-1 self-end md:self-auto rounded-xl bg-surface p-1">
              <button
                type="button"
                onClick={() => setViewStyle("list")}
                className={`tap flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition-all ${
                  viewStyle === "list"
                    ? "bg-white text-ink shadow-sm"
                    : "text-ink/60 hover:text-ink"
                }`}
              >
                <List size={14} />
                List View
              </button>
              <button
                type="button"
                onClick={() => setViewStyle("month")}
                className={`tap flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition-all ${
                  viewStyle === "month"
                    ? "bg-white text-ink shadow-sm"
                    : "text-ink/60 hover:text-ink"
                }`}
              >
                <CalendarDays size={14} />
                Month View
              </button>
            </div>
          </div>

          {/* Search Bar & Dropdown Filters */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 pt-2.5 border-t border-ink/5">
            <div className="relative flex-1">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink/40" />
              <input
                type="text"
                placeholder="Search exams, deadlines, holidays, or events..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full rounded-xl border border-ink/10 bg-surface/30 py-2 pl-9 pr-8 text-xs md:text-sm font-semibold text-ink placeholder:text-ink/35 focus:border-mint focus:outline-none focus:ring-1 focus:ring-mint"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-ink/40 hover:text-ink"
                >
                  <X size={14} />
                </button>
              )}
            </div>

            <div className="flex items-center gap-2">
              {/* Term Filter */}
              <select
                value={selectedTermFilter}
                onChange={(e) => setSelectedTermFilter(e.target.value)}
                className="rounded-xl border border-ink/10 bg-surface/40 px-3 py-2 text-xs font-bold text-ink/80 focus:border-mint focus:outline-none"
              >
                <option value="ALL">All Terms</option>
                {availableTerms.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>

              {/* Status Filter */}
              <select
                value={selectedStatusFilter}
                onChange={(e) => setSelectedStatusFilter(e.target.value)}
                className="rounded-xl border border-ink/10 bg-surface/40 px-3 py-2 text-xs font-bold text-ink/80 focus:border-mint focus:outline-none"
              >
                <option value="ALL">All Status ({statusFilterCounts.all})</option>
                <option value="upcoming">Upcoming ({statusFilterCounts.upcoming})</option>
                <option value="completed">Completed ({statusFilterCounts.completed})</option>
              </select>
            </div>
          </div>
        </div>

        {/* 5. View Content Rendering */}

        {/* Option A: Monthly Calendar Grid View */}
        {viewStyle === "month" && (
          <div className="rounded-2xl border border-ink/10 bg-white p-4 shadow-soft space-y-4">
            {/* Month Header Navigation */}
            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={() => {
                  if (calendarMonth === 0) {
                    setCalendarMonth(11);
                    setCalendarYear(y => y - 1);
                  } else {
                    setCalendarMonth(m => m - 1);
                  }
                }}
                className="tap flex h-9 w-9 items-center justify-center rounded-xl border border-ink/10 bg-surface/50 text-ink/70 hover:bg-surface"
              >
                <ChevronLeft size={16} />
              </button>
              <h3 className="text-base md:text-lg font-black text-ink flex items-center gap-2">
                <CalendarIcon size={18} className="text-mint" />
                {MONTH_NAMES[calendarMonth]} {calendarYear}
              </h3>
              <button
                type="button"
                onClick={() => {
                  if (calendarMonth === 11) {
                    setCalendarMonth(0);
                    setCalendarYear(y => y + 1);
                  } else {
                    setCalendarMonth(m => m + 1);
                  }
                }}
                className="tap flex h-9 w-9 items-center justify-center rounded-xl border border-ink/10 bg-surface/50 text-ink/70 hover:bg-surface"
              >
                <ChevronRight size={16} />
              </button>
            </div>

            {/* Days Short Header */}
            <div className="grid grid-cols-7 gap-1 text-center text-[10px] md:text-xs font-black uppercase text-ink/40">
              {DAYS_SHORT.map((day) => (
                <div key={day} className="py-1">
                  {day}
                </div>
              ))}
            </div>

            {/* Days Grid */}
            <div className="grid grid-cols-7 gap-1 md:gap-1.5">
              {monthDays.map((item, idx) => {
                if (!item.dayNumber) {
                  return <div key={`pad-${idx}`} className="h-16 md:h-20 rounded-xl bg-surface/20" />;
                }

                const hasEvents = item.events.length > 0;
                const hasHoliday = item.events.some(e => e.category === EVENT_CATEGORIES.HOLIDAY);
                const hasExam = item.events.some(e => e.category === EVENT_CATEGORIES.EXAM);
                const isSelected = selectedMonthDateDetail?.dateKey === item.dateKey;
                const isPastDate = item.dateKey < todayKey;

                return (
                  <button
                    key={item.dateKey}
                    type="button"
                    onClick={() => {
                      if (hasEvents) {
                        setSelectedMonthDateDetail(item);
                      } else {
                        setSelectedMonthDateDetail(null);
                      }
                    }}
                    className={`tap flex flex-col justify-between p-1.5 md:p-2 h-16 md:h-20 rounded-xl border text-left transition-all ${
                      item.isToday
                        ? "border-mint ring-2 ring-mint/30 bg-mint/5"
                        : isPastDate
                        ? hasEvents
                          ? "border-ink/10 bg-surface/30 opacity-70 cursor-pointer"
                          : "border-ink/5 bg-surface/20 text-ink/40"
                        : hasEvents
                        ? "border-ink/15 bg-surface/30 hover:bg-surface/60 cursor-pointer"
                        : item.isSunday
                        ? "border-ink/5 bg-surface/20 text-ink/45"
                        : "border-ink/5 bg-paper hover:bg-surface/40"
                    } ${
                      isSelected ? "ring-2 ring-ink ring-offset-1" : ""
                    }`}
                  >
                    <div className="flex items-center justify-between w-full">
                      <span className={`text-xs md:text-sm font-bold ${
                        item.isToday ? "text-mint font-black" : isPastDate ? "text-ink/40" : "text-ink"
                      }`}>
                        {item.dayNumber}
                      </span>
                      {item.isToday && (
                        <span className="text-[8px] font-black text-mint uppercase">Today</span>
                      )}
                    </div>

                    {hasEvents && (
                      <div className="space-y-0.5 truncate w-full">
                        {item.events.slice(0, 2).map((ev, i) => {
                          const badgeClass = isPastDate
                            ? "bg-stone-100 text-stone-500 border border-stone-200/60 font-medium"
                            : ev.category === EVENT_CATEGORIES.EXAM
                            ? "bg-rose-50 text-rose-800 border border-rose-200/70 font-semibold"
                            : ev.category === EVENT_CATEGORIES.HOLIDAY
                            ? "bg-emerald-50 text-emerald-800 border border-emerald-200/70 font-semibold"
                            : ev.category === EVENT_CATEGORIES.DEADLINE
                            ? "bg-amber-50 text-amber-900 border border-amber-200/70 font-semibold"
                            : "bg-indigo-50 text-indigo-900 border border-indigo-200/70 font-semibold";

                          return (
                            <span
                              key={i}
                              className={`block truncate text-[9px] md:text-[10px] rounded px-1.5 py-0.5 leading-tight ${badgeClass}`}
                            >
                              {ev.title}
                            </span>
                          );
                        })}
                        {item.events.length > 2 && (
                          <span className="text-[9px] text-ink/50 font-bold block px-1">
                            +{item.events.length - 2} more
                          </span>
                        )}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Selected Date Detail Drawer in Month View */}
            {selectedMonthDateDetail && (
              <div className="rounded-xl border border-ink/15 bg-surface/40 p-4 space-y-2.5 animate-in fade-in">
                <div className="flex items-center justify-between border-b border-ink/5 pb-2">
                  <h4 className="text-xs md:text-sm font-black text-ink">
                    Activities on {formatDDMMMYYYY(selectedMonthDateDetail.dateKey)}
                  </h4>
                  <button
                    type="button"
                    onClick={() => setSelectedMonthDateDetail(null)}
                    className="text-xs font-bold text-ink/50 hover:text-ink"
                  >
                    Close
                  </button>
                </div>
                <div className="space-y-2">
                  {selectedMonthDateDetail.events.map((ev) => (
                    <div key={ev.id} className="rounded-lg bg-white p-3 border border-ink/10 flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <h5 className="text-xs md:text-sm font-black text-ink">{ev.title}</h5>
                          {ev.verificationFlag && (
                            <span className="text-[9px] bg-amber-500/15 text-amber-800 font-bold px-1.5 py-0.2 rounded">
                              Flagged for verification
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-ink/60 mt-0.5">{ev.displayDates} • {ev.term}</p>
                        {ev.description && <p className="text-xs text-ink/75 mt-1">{ev.description}</p>}
                      </div>
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                        ev.category === EVENT_CATEGORIES.EXAM
                          ? "bg-rose-50 text-rose-800 border border-rose-200/70"
                          : ev.category === EVENT_CATEGORIES.HOLIDAY
                          ? "bg-emerald-50 text-emerald-800 border border-emerald-200/70"
                          : ev.category === EVENT_CATEGORIES.DEADLINE
                          ? "bg-amber-50 text-amber-900 border border-amber-200/70"
                          : "bg-indigo-50 text-indigo-900 border border-indigo-200/70"
                      }`}>
                        {ev.category}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Option B: Smart Reminders Tab */}
        {activeTab === "REMINDERS" && (
          <div className="space-y-4">
            <div className="rounded-2xl border border-ink/10 bg-white p-4 md:p-5 shadow-soft space-y-3.5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h3 className="text-base font-black text-ink flex items-center gap-2">
                    <Sliders size={18} className="text-mint" />
                    Automated Academic Reminders
                  </h3>
                  <p className="mt-0.5 text-xs text-ink/60 leading-relaxed">
                    Personalized to <strong>{currentProgram.shortName}</strong>. Evaluated in <strong>Asia/Kolkata</strong> timezone.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={syncRemindersToNotifications}
                  disabled={reminderPrefs?.academicNotificationsEnabled === false}
                  className={`tap flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-xs font-bold shadow-soft self-start sm:self-auto transition-all ${
                    reminderPrefs?.academicNotificationsEnabled === false
                      ? "bg-surface text-ink/40 cursor-not-allowed border border-ink/10"
                      : "bg-mint text-white hover:bg-mint/90"
                  }`}
                >
                  <Bell size={15} />
                  Sync to Notifications Now
                </button>
              </div>

              {/* Master Academic Notifications Toggle Switch */}
              <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 bg-surface/50 rounded-xl border border-ink/5">
                <div className="flex items-center gap-2.5">
                  <span className={`flex h-8 w-8 items-center justify-center rounded-lg text-sm shrink-0 ${
                    reminderPrefs?.academicNotificationsEnabled !== false ? "bg-mint text-white shadow-xs" : "bg-ink/10 text-ink/40"
                  }`}>
                    {reminderPrefs?.academicNotificationsEnabled !== false ? <Bell size={16} /> : <BellOff size={16} />}
                  </span>
                  <div>
                    <span className="text-xs font-black text-ink block">Academic Notifications</span>
                    <span className="text-[11px] text-ink/60 block">
                      {reminderPrefs?.academicNotificationsEnabled !== false
                        ? "Active — Showing events in 7-day window (Asia/Kolkata)"
                        : "Turned OFF — Reminders muted, zero backlog delivery"}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2.5">
                  <button
                    type="button"
                    onClick={() => toggleAcademicNotifications(reminderPrefs?.academicNotificationsEnabled === false)}
                    className={`tap relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${
                      reminderPrefs?.academicNotificationsEnabled !== false ? "bg-mint" : "bg-ink/20"
                    }`}
                    title="Toggle Academic Notifications"
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform shadow-xs ${
                        reminderPrefs?.academicNotificationsEnabled !== false ? "translate-x-6" : "translate-x-1"
                      }`}
                    />
                  </button>
                  <span className={`text-xs font-black uppercase tracking-wider ${
                    reminderPrefs?.academicNotificationsEnabled !== false ? "text-mint" : "text-ink/40"
                  }`}>
                    {reminderPrefs?.academicNotificationsEnabled !== false ? "ON" : "OFF"}
                  </span>
                </div>
              </div>

              {/* 7-Day Window Activation Rule Highlights */}
              <div className="pt-2">
                <span className="text-[10px] font-black uppercase tracking-wider text-ink/50 block mb-2">
                  Reminder Activation Rules (Asia/Kolkata Timezone):
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2.5 text-xs">
                  <div className="p-3 rounded-xl bg-surface/50 border border-ink/5">
                    <span className="text-[10px] font-bold uppercase text-ink/60 block">⏳ 7-Day Activation</span>
                    <span className="text-xs text-ink/75 mt-1 block">
                      Starts only 7 days before event. Distant dates (&gt;7d) suppressed.
                    </span>
                  </div>
                  <div className="p-3 rounded-xl bg-surface/50 border border-ink/5">
                    <span className="text-[10px] font-bold uppercase text-ink/60 block">📝 Examinations</span>
                    <span className="text-xs text-ink/75 mt-1 block">
                      Alerts at 7d, 3d, 1d & on Start Date
                    </span>
                  </div>
                  <div className="p-3 rounded-xl bg-surface/50 border border-ink/5">
                    <span className="text-[10px] font-bold uppercase text-ink/60 block">💳 Exam Fees</span>
                    <span className="text-xs text-ink/75 mt-1 block">
                      7d prior to deadline. Daily alerts continue if overdue.
                    </span>
                  </div>
                  <div className="p-3 rounded-xl bg-surface/50 border border-ink/5">
                    <span className="text-[10px] font-bold uppercase text-ink/60 block">🛑 Stop On Complete</span>
                    <span className="text-xs text-ink/75 mt-1 block">
                      Marking a fee as Completed halts all reminders immediately.
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Generated Upcoming Reminders or Disabled State */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-between px-1">
                <h4 className="text-xs font-black uppercase tracking-wider text-ink/50">
                  Active Reminders Within 7-Day Window ({personalizedReminders.length})
                </h4>
                {completedFeeIds.length > 0 && (
                  <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                    ✓ {completedFeeIds.length} fee{completedFeeIds.length === 1 ? "" : "s"} marked Completed
                  </span>
                )}
              </div>

              {reminderPrefs?.academicNotificationsEnabled === false ? (
                <div className="rounded-2xl border-2 border-dashed border-ink/20 bg-white p-8 text-center shadow-soft space-y-3">
                  <div className="flex h-12 w-12 mx-auto items-center justify-center rounded-2xl bg-ink/5 text-ink/40">
                    <BellOff size={24} />
                  </div>
                  <h4 className="text-sm md:text-base font-black text-ink">Academic Notifications are Paused</h4>
                  <p className="text-xs text-ink/60 max-w-md mx-auto leading-relaxed">
                    If academic notifications are OFF, reminders are not displayed. Turn notifications ON to view and receive reminders for events within their 7-day window.
                  </p>
                  <button
                    type="button"
                    onClick={() => toggleAcademicNotifications(true)}
                    className="tap inline-flex items-center gap-2 rounded-xl bg-mint px-4 py-2 text-xs font-black text-white shadow-soft hover:bg-mint/90 transition-all"
                  >
                    <Bell size={14} />
                    Turn ON Academic Notifications
                  </button>
                </div>
              ) : personalizedReminders.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-ink/20 bg-white p-8 text-center shadow-soft space-y-2">
                  <div className="flex h-10 w-10 mx-auto items-center justify-center rounded-xl bg-mint/10 text-mint">
                    <Sparkles size={20} />
                  </div>
                  <h4 className="text-sm font-black text-ink">No Events Currently Within the 7-Day Window</h4>
                  <p className="text-xs text-ink/60 max-w-lg mx-auto leading-relaxed">
                    In compliance with the <strong>7-Day Activation Rule</strong>, reminders for examinations, fee deadlines, and academic events do not activate prematurely while they are more than 7 days away. Alerts will appear automatically as each event enters its 7-day window.
                  </p>
                </div>
              ) : (
                personalizedReminders.map((rem) => (
                  <div
                    key={rem.id}
                    className={`rounded-2xl border bg-white p-3.5 md:p-4 shadow-soft flex flex-col sm:flex-row sm:items-start justify-between gap-3 transition-all ${
                      rem.isOverdue
                        ? "border-l-3 border-l-stone-700 border-ink/10"
                        : rem.isDueToday
                        ? "border-l-3 border-l-mint border-ink/10"
                        : "border-ink/10"
                    }`}
                  >
                    <div className="flex items-start gap-3 flex-1">
                      <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-xl text-xs font-bold bg-surface text-ink/70">
                        {rem.isOverdue ? <AlertTriangle size={14} className="text-ink/80" /> : <Bell size={13} />}
                      </span>
                      <div className="space-y-1 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h5 className="text-xs md:text-sm font-bold text-ink">{rem.title}</h5>
                          {rem.isOverdue && (
                            <span className="rounded-full bg-surface text-ink/85 border border-ink/15 text-[9px] font-bold px-2 py-0.2 uppercase tracking-wider">
                              Action Required
                            </span>
                          )}
                          {rem.isDueToday && !rem.isOverdue && (
                            <span className="rounded-full bg-mint/15 text-mint border border-mint/25 text-[9px] font-bold px-2 py-0.2 uppercase">
                              Due Today
                            </span>
                          )}
                          <span className="rounded-full bg-surface text-ink/50 border border-ink/5 text-[9px] font-medium px-2 py-0.2 uppercase">
                            7-Day Window
                          </span>
                        </div>
                        <p className="text-xs text-ink/65 leading-relaxed">{rem.message}</p>
                        <div className="flex flex-wrap items-center gap-3 pt-1 text-[10px] font-medium text-ink/50">
                          <span>
                            Trigger: {formatDDMMMYYYY(rem.triggerDate)} ({rem.daysBefore >= 0 ? `${rem.daysBefore}d before` : `${Math.abs(rem.daysBefore)}d overdue`})
                          </span>
                          <span>•</span>
                          <span>Event Date: {formatDDMMMYYYY(rem.startDate)}</span>
                        </div>

                        {/* If this is a fee reminder, provide 1-click completion button */}
                        {rem.isFee && (
                          <div className="mt-2.5 pt-2 border-t border-ink/10 flex items-center justify-between gap-2 flex-wrap">
                            <span className="text-[11px] font-medium text-ink/70 flex items-center gap-1.5">
                              <CreditCard size={13} className="text-ink/50" />
                              Fee Status: Pending Payment
                            </span>
                            <button
                              type="button"
                              onClick={() => toggleFeeCompleted(rem.eventId)}
                              className="tap rounded-xl bg-ink hover:bg-ink/90 px-3 py-1.5 text-xs font-bold text-white shadow-xs inline-flex items-center gap-1.5 transition-all"
                              title="Mark as Completed to immediately stop all reminders for this fee"
                            >
                              <Check size={13} />
                              Mark Fee as Completed (Stop Reminders)
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                    <span className="rounded-lg bg-surface px-2.5 py-1 text-[10px] font-bold text-ink/70 whitespace-nowrap self-start">
                      {rem.term}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* Option C: Structured Timeline View */}
        {activeTab === "TIMELINE" && (
          <div className="space-y-6">
            {Object.entries(timelineGrouped).map(([termName, items]) => (
              <div key={termName} className="rounded-2xl border border-ink/10 bg-white p-4 md:p-5 shadow-soft space-y-3">
                <div className="flex items-center justify-between border-b border-ink/5 pb-2.5">
                  <h3 className="text-sm md:text-base font-black text-ink flex items-center gap-2">
                    <CalendarDays size={18} className="text-mint" />
                    {termName}
                  </h3>
                  <span className="rounded-full bg-surface px-2.5 py-0.5 text-xs font-bold text-ink/60">
                    {items.length} Milestones
                  </span>
                </div>

                <div className="space-y-2.5">
                  {items.map((ev) => {
                    const status = getEventStatus(ev.startDate, ev.endDate, todayDate);
                    const isCompleted = status === "completed";
                    const isOngoing = status === "ongoing";
                    const isHoliday = ev.category === EVENT_CATEGORIES.HOLIDAY;
                    const isExam = ev.category === EVENT_CATEGORIES.EXAM;
                    const isDeadline = ev.category === EVENT_CATEGORIES.DEADLINE;

                    const catBadge = isCompleted
                      ? "bg-stone-100 text-stone-600 border border-stone-200 font-medium"
                      : isExam
                      ? "bg-rose-50 text-rose-800 border border-rose-200/80 font-semibold"
                      : isHoliday
                      ? "bg-emerald-50 text-emerald-800 border border-emerald-200/80 font-semibold"
                      : isDeadline
                      ? "bg-amber-50 text-amber-900 border border-amber-200/80 font-semibold"
                      : "bg-indigo-50 text-indigo-900 border border-indigo-200/80 font-semibold";

                    const leftBorder = isCompleted
                      ? "border-l-3 border-l-stone-300"
                      : isExam
                      ? "border-l-4 border-l-rose-500"
                      : isHoliday
                      ? "border-l-4 border-l-emerald-600"
                      : isDeadline
                      ? "border-l-4 border-l-amber-500"
                      : "border-l-4 border-l-indigo-500";

                    return (
                      <div
                        key={ev.id}
                        className={`rounded-xl border p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 transition-all shadow-sm hover:shadow ${leftBorder} ${
                          isOngoing
                            ? "border-mint ring-2 ring-mint/30 bg-mint/5"
                            : isCompleted
                            ? "bg-surface/30 border-ink/10 hover:bg-surface/50"
                            : "bg-white border-ink/15 hover:border-ink/25"
                        }`}
                      >
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <h4 className={`text-sm md:text-base ${isCompleted ? "text-ink/65 font-bold" : "text-ink font-black"}`}>
                              {ev.title}
                            </h4>
                            {isOngoing && (
                              <span className="rounded-full bg-mint text-white px-2.5 py-0.5 text-xs font-black uppercase tracking-wider">
                                Active Now
                              </span>
                            )}
                            {isCompleted && (
                              <span className="rounded-full bg-ink/10 text-ink/75 border border-ink/15 px-2 py-0.5 text-xs font-bold flex items-center gap-1">
                                <span>✓</span> Past Milestone
                              </span>
                            )}
                            {ev.verificationFlag && (
                              <span className="rounded bg-amber-500/20 px-2 py-0.5 text-xs font-black text-amber-950 border border-amber-500/40">
                                Flagged for verification
                              </span>
                            )}
                          </div>
                          <p className={`mt-1 text-xs md:text-sm flex items-center gap-1.5 ${isCompleted ? "text-ink/55 font-semibold" : "text-ink/90 font-extrabold"}`}>
                            <span>📅 {ev.displayDates}</span>
                            {ev.dayDescription && <span className="opacity-75 font-semibold">({ev.dayDescription})</span>}
                          </p>
                        </div>

                        <span className={`self-start sm:self-auto rounded-full px-3 py-1 text-xs uppercase tracking-wider shadow-xs ${catBadge}`}>
                          {ev.category}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Option D: Card List View (for All, Exams, Holidays, Deadlines, Events) */}
        {viewStyle === "list" && activeTab !== "TIMELINE" && activeTab !== "REMINDERS" && (
          <div className="space-y-3">
            {/* Quick Status Filter Pills for 1-Tap Access */}
            <div className="flex flex-wrap items-center justify-between gap-2 pb-1.5 pt-1">
              <div className="flex items-center gap-2 overflow-x-auto pb-1">
                <span className="text-xs font-black uppercase tracking-wider text-ink/60 mr-1 shrink-0">
                  Filter Status:
                </span>
                <button
                  type="button"
                  onClick={() => setSelectedStatusFilter("ALL")}
                  className={`tap rounded-xl px-3.5 py-1.5 text-xs font-bold transition-all ${
                    selectedStatusFilter === "ALL"
                      ? "bg-ink text-paper shadow-xs"
                      : "bg-white text-ink/75 border border-ink/15 hover:bg-surface"
                  }`}
                >
                  All Events ({statusFilterCounts.all})
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedStatusFilter("upcoming")}
                  className={`tap rounded-xl px-3.5 py-1.5 text-xs font-bold transition-all ${
                    selectedStatusFilter === "upcoming"
                      ? "bg-ink text-paper shadow-xs"
                      : "bg-white text-ink/75 border border-ink/15 hover:bg-surface"
                  }`}
                >
                  Upcoming Events ({statusFilterCounts.upcoming})
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedStatusFilter("completed")}
                  className={`tap rounded-xl px-3.5 py-1.5 text-xs font-bold transition-all ${
                    selectedStatusFilter === "completed"
                      ? "bg-ink text-paper shadow-xs"
                      : "bg-white text-ink/75 border border-ink/15 hover:bg-surface"
                  }`}
                >
                  Past Events ({statusFilterCounts.completed})
                </button>
              </div>

              {/* Reset filter shortcut if any filter is active */}
              {(selectedTermFilter !== "ALL" || selectedStatusFilter !== "ALL" || searchQuery.trim() || activeTab !== "ALL") && (
                <button
                  type="button"
                  onClick={() => {
                    setSelectedTermFilter("ALL");
                    setSelectedStatusFilter("ALL");
                    setSearchQuery("");
                    setActiveTab("ALL");
                  }}
                  className="tap text-xs font-black text-mint hover:underline flex items-center gap-1 shrink-0 px-2 py-1 rounded-lg hover:bg-mint/10 transition-colors ml-auto"
                  title="Clear all active filters"
                >
                  <X size={14} />
                  <span>Reset Filters</span>
                </button>
              )}
            </div>

            {filteredEvents.length === 0 ? (
              <div className="rounded-2xl border-2 border-dashed border-ink/20 bg-white p-10 text-center shadow-soft">
                <p className="text-base font-black text-ink">No events found matching your search or filters.</p>
                <button
                  type="button"
                  onClick={() => { setSearchQuery(""); setSelectedTermFilter("ALL"); setSelectedStatusFilter("ALL"); }}
                  className="mt-3 text-sm font-black text-mint hover:underline"
                >
                  Clear all filters
                </button>
              </div>
            ) : (
              filteredEvents.map((item) => {
                const status = getEventStatus(item.startDate, item.endDate, todayDate);
                const isCompleted = status === "completed";
                const isOngoing = status === "ongoing";
                const daysInfo = getDaysUntil(item.startDate, todayDate);
                const isHoliday = item.category === EVENT_CATEGORIES.HOLIDAY;
                const isExam = item.category === EVENT_CATEGORIES.EXAM;
                const isDeadline = item.category === EVENT_CATEGORIES.DEADLINE;

                // Soft, refined, professional theme per category
                let theme;

                if (isCompleted) {
                  theme = {
                    cardBorder: "border-l-4 border-l-stone-300 border-ink/10 bg-stone-50/40 opacity-75 hover:opacity-95",
                    iconBg: "bg-stone-100 text-stone-600 border border-stone-200/60",
                    titleColor: "text-ink/65 font-semibold",
                    badge: "bg-stone-100 text-stone-600 border border-stone-200 font-medium",
                    dateChip: "bg-stone-100/70 text-stone-600 border border-stone-200/50 font-medium",
                    termBadge: "bg-stone-100/60 text-stone-500 border border-stone-200/40",
                    descColor: "text-ink/55 font-normal",
                    iconText: isHoliday ? "🌴" : isExam ? "📝" : isDeadline ? "⏰" : "🎓",
                    subEventBg: "bg-stone-100/60 border border-stone-200/40 text-stone-600 font-normal",
                    noticeBg: "bg-stone-100/40 border border-stone-200/50 text-stone-600",
                    noticePill: "bg-stone-200/60 text-stone-600 border border-stone-200 font-medium"
                  };
                } else if (isHoliday) {
                  theme = {
                    cardBorder: "border-l-4 border-l-emerald-600 border-ink/10 bg-white hover:border-emerald-300",
                    iconBg: "bg-emerald-50 text-emerald-700 border border-emerald-200/80",
                    titleColor: "text-ink font-bold",
                    badge: "bg-emerald-50 text-emerald-800 border border-emerald-200/80 font-semibold",
                    dateChip: "bg-emerald-50/70 text-emerald-950 border border-emerald-200/60 font-medium",
                    termBadge: "bg-stone-50 text-stone-600 border border-stone-200 font-medium",
                    descColor: "text-ink/75 font-normal",
                    iconText: "🌴",
                    subEventBg: "bg-emerald-50/60 border border-emerald-200/60 text-emerald-950 font-normal",
                    noticeBg: "bg-emerald-50/50 border border-emerald-200/60 text-emerald-950",
                    noticePill: "bg-emerald-100/80 text-emerald-900 border border-emerald-200 font-semibold"
                  };
                } else if (isExam) {
                  theme = {
                    cardBorder: "border-l-4 border-l-rose-500 border-ink/10 bg-white hover:border-rose-300",
                    iconBg: "bg-rose-50 text-rose-700 border border-rose-200/80",
                    titleColor: "text-ink font-bold",
                    badge: "bg-rose-50 text-rose-800 border border-rose-200/80 font-semibold",
                    dateChip: "bg-rose-50/70 text-rose-950 border border-rose-200/60 font-medium",
                    termBadge: "bg-stone-50 text-stone-600 border border-stone-200 font-medium",
                    descColor: "text-ink/75 font-normal",
                    iconText: "📝",
                    subEventBg: "bg-rose-50/60 border border-rose-200/60 text-rose-950 font-normal",
                    noticeBg: "bg-rose-50/50 border border-rose-200/60 text-rose-950",
                    noticePill: "bg-rose-100/80 text-rose-900 border border-rose-200 font-semibold"
                  };
                } else if (isDeadline) {
                  theme = {
                    cardBorder: "border-l-4 border-l-amber-500 border-ink/10 bg-white hover:border-amber-300",
                    iconBg: "bg-amber-50 text-amber-800 border border-amber-200/80",
                    titleColor: "text-ink font-bold",
                    badge: "bg-amber-50 text-amber-900 border border-amber-200/80 font-semibold",
                    dateChip: "bg-amber-50/70 text-amber-950 border border-amber-200/60 font-medium",
                    termBadge: "bg-stone-50 text-stone-600 border border-stone-200 font-medium",
                    descColor: "text-ink/75 font-normal",
                    iconText: "⏰",
                    subEventBg: "bg-amber-50/60 border border-amber-200/60 text-amber-950 font-normal",
                    noticeBg: "bg-amber-50/50 border border-amber-200/60 text-amber-950",
                    noticePill: "bg-amber-100/80 text-amber-900 border border-amber-200 font-semibold"
                  };
                } else {
                  theme = {
                    cardBorder: "border-l-4 border-l-indigo-500 border-ink/10 bg-white hover:border-indigo-300",
                    iconBg: "bg-indigo-50 text-indigo-700 border border-indigo-200/80",
                    titleColor: "text-ink font-bold",
                    badge: "bg-indigo-50 text-indigo-900 border border-indigo-200/80 font-semibold",
                    dateChip: "bg-indigo-50/70 text-indigo-950 border border-indigo-200/60 font-medium",
                    termBadge: "bg-stone-50 text-stone-600 border border-stone-200 font-medium",
                    descColor: "text-ink/75 font-normal",
                    iconText: "🎓",
                    subEventBg: "bg-indigo-50/60 border border-indigo-200/60 text-indigo-950 font-normal",
                    noticeBg: "bg-indigo-50/50 border border-indigo-200/60 text-indigo-950",
                    noticePill: "bg-indigo-100/80 text-indigo-900 border border-indigo-200 font-semibold"
                  };
                }

                return (
                  <article
                    key={item.id}
                    className={`rounded-2xl border p-4 md:p-5 shadow-soft transition-all hover:shadow-md ${
                      isOngoing
                        ? "border-l-[6px] border-l-mint border-mint ring-2 ring-mint/40 bg-gradient-to-r from-mint/10 via-white to-white"
                        : theme.cardBorder
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                      {/* Left Main Information */}
                      <div className="space-y-2 flex-1">
                        {/* Title Row with Category Icon & Status Badges */}
                        <div className="flex flex-wrap items-center gap-2">
                          <span className={`flex h-7 w-7 items-center justify-center rounded-lg text-base shrink-0 shadow-xs ${theme.iconBg}`}>
                            {theme.iconText}
                          </span>
                          <h3 className={`text-base md:text-lg tracking-tight ${theme.titleColor}`}>
                            {item.title}
                          </h3>

                          {isOngoing && (
                            <span className="rounded-full bg-mint text-white px-2.5 py-0.5 text-xs font-black uppercase tracking-wider shadow-sm flex items-center gap-1 animate-pulse">
                              ● Active Today
                            </span>
                          )}
                          {!isOngoing && !isCompleted && daysInfo && (
                            <span className="rounded-full bg-mint/15 text-mint border border-mint/30 px-2.5 py-0.5 text-xs font-black">
                              {daysInfo.label}
                            </span>
                          )}
                          {isCompleted && (
                            <span className="rounded-full bg-ink/10 text-ink/75 border border-ink/15 px-2.5 py-0.5 text-xs font-bold flex items-center gap-1">
                              <span>✓</span> Completed
                            </span>
                          )}
                          {item.verificationFlag && (
                            <span className="rounded-lg bg-amber-500/20 text-amber-950 border border-amber-500/40 px-2 py-0.5 text-xs font-black">
                              Flagged for verification
                            </span>
                          )}
                        </div>

                        {/* Prominent, readable date display */}
                        <div className={`inline-flex flex-wrap items-center gap-2 px-3 py-1.5 rounded-xl text-xs md:text-sm ${theme.dateChip}`}>
                          <CalendarIcon size={16} className={`shrink-0 ${isCompleted ? "text-ink/50" : "text-ink"}`} />
                          <span>{item.displayDates}</span>
                          {item.dayDescription && (
                            <span className="font-bold opacity-80">({item.dayDescription})</span>
                          )}
                        </div>

                        {/* Interactive Fee Status Button for Examination Fee Deadlines */}
                        {isFeeEvent(item) && (
                          <div className="pt-0.5">
                            <button
                              type="button"
                              onClick={() => toggleFeeCompleted(item.id)}
                              className={`tap inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                                completedFeeIds.includes(item.id)
                                  ? "bg-emerald-50 text-emerald-800 border border-emerald-200/80 hover:bg-emerald-100/70"
                                  : "bg-amber-50 text-amber-900 border border-amber-200/80 hover:bg-amber-100/70"
                              }`}
                              title={
                                completedFeeIds.includes(item.id)
                                  ? "Mark as Pending (Re-enable 7-day reminders)"
                                  : "Mark as Completed (Stop all reminders for this fee immediately)"
                              }
                            >
                              {completedFeeIds.includes(item.id) ? (
                                <>
                                  <Check size={14} className="text-emerald-700" />
                                  <span>Fee Status: Completed • Reminders Stopped (Click to Undo)</span>
                                </>
                              ) : (
                                <>
                                  <CreditCard size={14} className="text-amber-700" />
                                  <span>Fee Status: Pending • 7-Day Reminders Active (Click to Mark Paid)</span>
                                </>
                              )}
                            </button>
                          </div>
                        )}
                      </div>

                      {/* Right Badges: Category & Term */}
                      <div className="flex flex-wrap items-center gap-2 self-start shrink-0">
                        <span className={`rounded-full px-3 py-1 text-xs uppercase tracking-wider ${theme.badge}`}>
                          {item.category}
                        </span>
                        {item.term && (
                          <span className={`rounded-full px-3 py-1 text-xs font-semibold ${theme.termBadge}`}>
                            {item.term}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Description */}
                    {item.description && (
                      <p className={`mt-3 text-sm md:text-base leading-relaxed ${theme.descColor}`}>
                        {item.description}
                      </p>
                    )}

                    {/* Sub-events for multi-day vacations like Pongal / Dussehra */}
                    {item.subEvents && (
                      <div className={`mt-3.5 pt-3 border-t ${isCompleted ? "border-ink/5" : "border-ink/10"} space-y-2`}>
                        <span className={`text-xs uppercase tracking-wider block ${isCompleted ? "text-ink/40 font-medium" : "text-ink/60 font-semibold"}`}>
                          Special Festival Occasions:
                        </span>
                        <div className="flex flex-wrap gap-2">
                          {item.subEvents.map((sub, idx) => (
                            <div
                              key={idx}
                              className={`flex items-center gap-2 rounded-xl px-3 py-1.5 text-xs md:text-sm ${theme.subEventBg}`}
                            >
                              <span>✨</span>
                              <span>{sub.name}:</span>
                              <span className={`font-bold ${isCompleted ? "text-ink/50" : "text-ink"}`}>{formatDDMMMYYYY(sub.date)}</span>
                              <span className="text-ink/50 font-normal">({sub.day})</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Holiday Suspension Footer */}
                    {isHoliday && (
                      <div className={`mt-3.5 flex flex-wrap items-center justify-between gap-2 p-2.5 rounded-xl text-xs font-medium ${theme.noticeBg}`}>
                        <span className="flex items-center gap-2">
                          <span className="text-sm">🌴</span>
                          <span>Confirmed Gazette University Holiday • Timetable Suspended</span>
                        </span>
                        <span className={`rounded-lg px-2.5 py-1 text-xs font-medium ${theme.noticePill}`}>
                          No Regular Classes
                        </span>
                      </div>
                    )}

                    {/* Exam Compulsory Notice Footer */}
                    {isExam && (
                      <div className={`mt-3.5 flex flex-wrap items-center justify-between gap-2 p-2.5 rounded-xl text-xs font-medium ${theme.noticeBg}`}>
                        <span className="flex items-center gap-2">
                          <span className="text-sm">📝</span>
                          <span>Official University Examination • Hall Ticket & Uniform Compulsory</span>
                        </span>
                        <span className={`rounded-lg px-2.5 py-1 text-xs font-medium ${theme.noticePill}`}>
                          Mandatory Attendance
                        </span>
                      </div>
                    )}

                    {/* Deadline Notice Footer */}
                    {isDeadline && (
                      <div className={`mt-3.5 flex flex-wrap items-center justify-between gap-2 p-2.5 rounded-xl text-xs font-medium ${theme.noticeBg}`}>
                        <span className="flex items-center gap-2">
                          <span className="text-sm">⏰</span>
                          <span>Crucial Academic Deadline • Portal Closes on Cutoff</span>
                        </span>
                        <span className={`rounded-lg px-2.5 py-1 text-xs font-medium ${theme.noticePill}`}>
                          Strict Deadline
                        </span>
                      </div>
                    )}
                  </article>
                );
              })
            )}
          </div>
        )}

        {/* 6. Optional Holidays Policy Notice Footer */}
        <div className="rounded-2xl border border-ink/10 bg-surface/40 p-4 text-xs text-ink/70 flex items-start gap-2.5 shadow-soft">
          <Info size={16} className="text-ink/50 shrink-0 mt-0.5" />
          <div className="leading-relaxed">
            <span className="font-bold text-ink">University Holiday Exclusions: </span>
            <span>Optional holidays (Good Friday and Eid al-Adha / Bakrid) are strictly excluded from official holiday lists and counts in compliance with KL University guidelines. Regular academic classes convene normally on optional holiday dates.</span>
          </div>
        </div>
      </div>
    </Layout>
  );
}

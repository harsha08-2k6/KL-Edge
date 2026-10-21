import React, { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { 
  Calendar as CalendarIcon, 
  Clock, 
  Sparkles, 
  Flag, 
  Sun, 
  Search, 
  Filter, 
  ChevronLeft, 
  ChevronRight,
  Info,
  CalendarDays,
  List
} from "lucide-react";
import { Layout } from "../components/Layout.jsx";
import { 
  HOLIDAYS_2026, 
  HOLIDAY_CATEGORIES, 
  formatDateKey, 
  getHolidayForDate,
  getTodayHoliday 
} from "../utils/holidays.js";

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

const DAYS_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default function CalendarPage() {
  const [selectedCategory, setSelectedCategory] = useState("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState("list"); // "list" | "month"
  const [activeMonth, setActiveMonth] = useState(() => new Date().getMonth());
  const [selectedDateDetail, setSelectedDateDetail] = useState(null);

  const todayKey = formatDateKey(new Date());
  const todayHoliday = useMemo(() => getTodayHoliday(), []);

  // Filtered holidays
  const filteredHolidays = useMemo(() => {
    return HOLIDAYS_2026.filter((h) => {
      // Category filter
      if (selectedCategory !== "ALL" && h.category !== selectedCategory) {
        return false;
      }
      // Search filter
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const matchesName = h.name.toLowerCase().includes(query);
        const matchesDesc = (h.dayDescription || "").toLowerCase().includes(query);
        const matchesNotes = (h.notes || "").toLowerCase().includes(query);
        const matchesActivity = (h.activityNotes || "").toLowerCase().includes(query);
        const matchesSub = Object.values(h.subEvents || {}).some((s) =>
          s.name.toLowerCase().includes(query)
        );
        return matchesName || matchesDesc || matchesNotes || matchesActivity || matchesSub;
      }
      return true;
    });
  }, [selectedCategory, searchQuery]);

  // Calendar month days calculation for activeMonth (Year 2026)
  const monthDays = useMemo(() => {
    const year = 2026;
    const firstDay = new Date(year, activeMonth, 1).getDay();
    const daysInMonth = new Date(year, activeMonth + 1, 0).getDate();

    const days = [];
    // Padding for days before start of month
    for (let i = 0; i < firstDay; i++) {
      days.push({ dayNumber: null, dateKey: null, holiday: null });
    }
    // Days in current month
    for (let d = 1; d <= daysInMonth; d++) {
      const monthStr = String(activeMonth + 1).padStart(2, "0");
      const dayStr = String(d).padStart(2, "0");
      const dateKey = `${year}-${monthStr}-${dayStr}`;
      const holiday = getHolidayForDate(dateKey);
      days.push({
        dayNumber: d,
        dateKey,
        holiday,
        isToday: dateKey === todayKey,
        isSunday: new Date(year, activeMonth, d).getDay() === 0
      });
    }
    return days;
  }, [activeMonth, todayKey]);

  // Count by category
  const generalCount = HOLIDAYS_2026.filter(h => h.category === HOLIDAY_CATEGORIES.GENERAL).length;
  const sundayCount = HOLIDAYS_2026.filter(h => h.category === HOLIDAY_CATEGORIES.SUNDAY_FESTIVAL).length;
  const socialCount = HOLIDAYS_2026.filter(h => h.category === HOLIDAY_CATEGORIES.SOCIAL_SERVICE).length;

  return (
    <Layout
      title="Academic Calendar"
      action={
        <Link
          to="/timetable"
          className="tap inline-flex h-9 items-center gap-1.5 rounded-lg border border-ink/10 bg-white px-3 text-xs font-bold text-ink/70 shadow-soft transition-colors hover:text-ink"
        >
          <Clock size={14} />
          Timetable
        </Link>
      }
    >
      <div className="pb-16 space-y-4">
        {/* Today's Holiday Banner (if active today) */}
        {todayHoliday && (
          <div className="rounded-xl border border-amber-500/30 bg-gradient-to-r from-amber-500/15 via-orange-500/10 to-amber-500/15 p-4 md:p-5 shadow-soft">
            <div className="flex items-center gap-2">
              <span className="flex h-2.5 w-2.5 rounded-full bg-amber-500 animate-pulse" />
              <span className="text-[10px] font-black uppercase tracking-widest text-amber-800">
                Today's Special Status
              </span>
            </div>
            <h2 className="mt-1 text-lg md:text-xl font-black text-ink">
              Holiday due to {todayHoliday.name}
            </h2>
            {todayHoliday.subEvent && (
              <p className="mt-0.5 text-xs font-bold text-amber-700">
                ✨ {todayHoliday.subEvent}
              </p>
            )}
            {todayHoliday.activityNotes && (
              <p className="mt-2 rounded-md bg-white/80 p-2 text-xs font-semibold text-ink/80 border border-amber-500/10">
                📌 {todayHoliday.activityNotes}
              </p>
            )}
            <p className="mt-2 text-xs font-bold text-ink/60">
              Timetable suspended today • No regular classes scheduled.
            </p>
          </div>
        )}

        {/* Header Controls: Search & View Switcher */}
        <div className="rounded-xl border border-ink/10 bg-white p-3 md:p-4 shadow-soft">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <div className="relative flex-1">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink/40" />
              <input
                type="text"
                placeholder="Search holidays, festivals, or occasions..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full rounded-lg border border-ink/10 bg-surface/40 py-2 pl-9 pr-3 text-xs md:text-sm font-semibold text-ink placeholder:text-ink/35 focus:border-ink/30 focus:outline-none"
              />
            </div>

            {/* View Mode Toggle */}
            <div className="flex items-center gap-1 self-end sm:self-auto rounded-lg bg-surface p-1">
              <button
                type="button"
                onClick={() => setViewMode("list")}
                className={`tap flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-bold transition-all ${
                  viewMode === "list"
                    ? "bg-white text-ink shadow-sm"
                    : "text-ink/60 hover:text-ink"
                }`}
              >
                <List size={14} />
                List View
              </button>
              <button
                type="button"
                onClick={() => setViewMode("month")}
                className={`tap flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-bold transition-all ${
                  viewMode === "month"
                    ? "bg-white text-ink shadow-sm"
                    : "text-ink/60 hover:text-ink"
                }`}
              >
                <CalendarDays size={14} />
                Monthly Calendar
              </button>
            </div>
          </div>

          {/* Category Filter Pills */}
          <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-ink/5 pt-3">
            <button
              type="button"
              onClick={() => setSelectedCategory("ALL")}
              className={`tap rounded-full px-3 py-1 text-xs font-black transition-colors ${
                selectedCategory === "ALL"
                  ? "bg-ink text-paper"
                  : "bg-surface text-ink/60 hover:text-ink"
              }`}
            >
              All ({HOLIDAYS_2026.length})
            </button>
            <button
              type="button"
              onClick={() => setSelectedCategory(HOLIDAY_CATEGORIES.GENERAL)}
              className={`tap rounded-full px-3 py-1 text-xs font-black transition-colors ${
                selectedCategory === HOLIDAY_CATEGORIES.GENERAL
                  ? "bg-amber-500 text-white"
                  : "bg-surface text-ink/60 hover:text-ink"
              }`}
            >
              🌴 General Holidays ({generalCount})
            </button>
            <button
              type="button"
              onClick={() => setSelectedCategory(HOLIDAY_CATEGORIES.SUNDAY_FESTIVAL)}
              className={`tap rounded-full px-3 py-1 text-xs font-black transition-colors ${
                selectedCategory === HOLIDAY_CATEGORIES.SUNDAY_FESTIVAL
                  ? "bg-indigo-600 text-white"
                  : "bg-surface text-ink/60 hover:text-ink"
              }`}
            >
              🪔 Sunday Festivals ({sundayCount})
            </button>
            <button
              type="button"
              onClick={() => setSelectedCategory(HOLIDAY_CATEGORIES.SOCIAL_SERVICE)}
              className={`tap rounded-full px-3 py-1 text-xs font-black transition-colors ${
                selectedCategory === HOLIDAY_CATEGORIES.SOCIAL_SERVICE
                  ? "bg-emerald-600 text-white"
                  : "bg-surface text-ink/60 hover:text-ink"
              }`}
            >
              🤝 Social Service ({socialCount})
            </button>
          </div>
        </div>

        {/* View Mode 1: Month Calendar View */}
        {viewMode === "month" && (
          <div className="rounded-xl border border-ink/10 bg-white p-4 shadow-soft space-y-4">
            {/* Month Navigation */}
            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={() => setActiveMonth((m) => (m === 0 ? 11 : m - 1))}
                className="tap flex h-8 w-8 items-center justify-center rounded-lg border border-ink/10 bg-surface/50 text-ink/70 hover:bg-surface"
              >
                <ChevronLeft size={16} />
              </button>
              <h3 className="text-base md:text-lg font-black text-ink">
                {MONTH_NAMES[activeMonth]} 2026
              </h3>
              <button
                type="button"
                onClick={() => setActiveMonth((m) => (m === 11 ? 0 : m + 1))}
                className="tap flex h-8 w-8 items-center justify-center rounded-lg border border-ink/10 bg-surface/50 text-ink/70 hover:bg-surface"
              >
                <ChevronRight size={16} />
              </button>
            </div>

            {/* Days Header */}
            <div className="grid grid-cols-7 gap-1 text-center text-[10px] md:text-xs font-black uppercase text-ink/40">
              {DAYS_SHORT.map((day) => (
                <div key={day} className="py-1">
                  {day}
                </div>
              ))}
            </div>

            {/* Calendar Grid */}
            <div className="grid grid-cols-7 gap-1 md:gap-1.5">
              {monthDays.map((item, idx) => {
                if (!item.dayNumber) {
                  return <div key={`pad-${idx}`} className="h-14 md:h-16 rounded-lg bg-surface/20" />;
                }

                const hasHoliday = !!item.holiday;
                const isSelected = selectedDateDetail?.date === item.dateKey;

                return (
                  <button
                    key={item.dateKey}
                    type="button"
                    onClick={() => {
                      if (hasHoliday) {
                        setSelectedDateDetail(item.holiday);
                      } else {
                        setSelectedDateDetail(null);
                      }
                    }}
                    className={`tap flex flex-col justify-between p-1.5 md:p-2 h-14 md:h-16 rounded-lg border text-left transition-all ${
                      hasHoliday
                        ? "border-amber-400/50 bg-amber-50 hover:bg-amber-100/80 cursor-pointer"
                        : item.isSunday
                        ? "border-ink/5 bg-surface/30 text-ink/50"
                        : "border-ink/5 bg-paper hover:bg-surface/50"
                    } ${item.isToday ? "ring-2 ring-mint ring-offset-1" : ""} ${
                      isSelected ? "ring-2 ring-amber-600 ring-offset-1" : ""
                    }`}
                  >
                    <div className="flex items-center justify-between w-full">
                      <span className={`text-xs md:text-sm font-black ${
                        item.isToday ? "text-mint" : hasHoliday ? "text-amber-800" : "text-ink"
                      }`}>
                        {item.dayNumber}
                      </span>
                      {item.isToday && (
                        <span className="text-[9px] font-black text-mint uppercase">Today</span>
                      )}
                    </div>
                    {hasHoliday && (
                      <div className="truncate">
                        <span className="block truncate text-[9px] md:text-[10px] font-bold text-amber-900 leading-tight">
                          🌴 {item.holiday.baseName}
                        </span>
                      </div>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Detail card when a holiday date is clicked */}
            {selectedDateDetail && (
              <div className="rounded-xl border border-amber-500/30 bg-amber-50/80 p-4 shadow-soft">
                <div className="flex items-center justify-between">
                  <span className="rounded-full bg-amber-200/70 px-2.5 py-0.5 text-[10px] font-black text-amber-900 uppercase">
                    {selectedDateDetail.category}
                  </span>
                  <span className="text-xs font-bold text-ink/50">
                    {selectedDateDetail.date}
                  </span>
                </div>
                <h4 className="mt-2 text-base font-black text-ink">
                  Holiday due to {selectedDateDetail.name}
                </h4>
                {selectedDateDetail.subEvent && (
                  <p className="mt-1 text-xs font-bold text-amber-800">
                    ✨ Occasion: {selectedDateDetail.subEvent}
                  </p>
                )}
                {selectedDateDetail.activityNotes && (
                  <p className="mt-2 rounded-md bg-white p-2.5 text-xs font-semibold text-ink/80 border border-amber-300/40">
                    📌 {selectedDateDetail.activityNotes}
                  </p>
                )}
                <p className="mt-2 text-xs font-bold text-amber-900/70">
                  Timetable is suspended on this date.
                </p>
              </div>
            )}
          </div>
        )}

        {/* View Mode 2: Detailed List View */}
        {viewMode === "list" && (
          <div className="space-y-3">
            {filteredHolidays.length === 0 ? (
              <div className="rounded-xl border border-dashed border-ink/20 bg-white p-8 text-center shadow-soft">
                <p className="font-bold text-ink/50">No holidays matching your search.</p>
              </div>
            ) : (
              filteredHolidays.map((holiday) => {
                const isCurrent = holiday.dates.includes(todayKey);
                const isGeneral = holiday.category === HOLIDAY_CATEGORIES.GENERAL;
                const isSunday = holiday.category === HOLIDAY_CATEGORIES.SUNDAY_FESTIVAL;
                const isSocial = holiday.category === HOLIDAY_CATEGORIES.SOCIAL_SERVICE;

                const categoryIcon = isSocial ? "🤝" : (isSunday ? "🪔" : "🌴");
                const categoryColor = isSocial
                  ? "bg-emerald-50 border-emerald-200 text-emerald-800"
                  : (isSunday
                    ? "bg-indigo-50 border-indigo-200 text-indigo-800"
                    : "bg-amber-50 border-amber-200 text-amber-800");

                return (
                  <article
                    key={holiday.id}
                    className={`rounded-xl border bg-white p-4 md:p-5 shadow-soft transition-all hover:shadow-md ${
                      isCurrent
                        ? "border-mint ring-2 ring-mint/20"
                        : "border-ink/10"
                    }`}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-ink/5 text-xs font-black text-ink/70">
                          #{holiday.number}
                        </span>
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="text-base md:text-lg font-black text-ink">
                              {holiday.name}
                            </h3>
                            {isCurrent && (
                              <span className="rounded-full bg-mint/15 px-2 py-0.5 text-[10px] font-black text-mint uppercase tracking-wider">
                                Today
                              </span>
                            )}
                          </div>
                          <p className="text-xs font-bold text-ink/50 mt-0.5">
                            {holiday.startDate === holiday.endDate
                              ? `${holiday.startDate} (${holiday.dayDescription})`
                              : `${holiday.startDate} to ${holiday.endDate} (${holiday.dayDescription})`}
                          </p>
                        </div>
                      </div>

                      <span className={`rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-wider ${categoryColor}`}>
                        {categoryIcon} {holiday.category}
                      </span>
                    </div>

                    {/* Sub Events (e.g. Pongal / Dussehra sub-festivals) */}
                    {holiday.subEvents && (
                      <div className="mt-3 flex flex-wrap gap-1.5 pt-2 border-t border-ink/5">
                        {Object.entries(holiday.subEvents).map(([date, event]) => {
                          const isSubToday = date === todayKey;
                          return (
                            <span
                              key={date}
                              className={`rounded-md px-2.5 py-1 text-xs font-bold ${
                                isSubToday
                                  ? "bg-mint text-white"
                                  : "bg-surface text-ink/80 border border-ink/5"
                              }`}
                            >
                              ✨ {event.name}: <span className="font-medium text-ink/60">{date} ({event.dayOfWeek})</span>
                            </span>
                          );
                        })}
                      </div>
                    )}

                    {/* Mandatory Activity Notes (for Social Service Days) */}
                    {holiday.activityNotes && (
                      <div className="mt-3 rounded-lg border border-emerald-200/80 bg-emerald-50/60 p-3 text-xs font-semibold text-emerald-950">
                        <p className="font-bold flex items-center gap-1.5 text-emerald-900">
                          <Flag size={13} />
                          Mandatory University Requirements:
                        </p>
                        <p className="mt-1 leading-relaxed pl-5">
                          {holiday.activityNotes}
                        </p>
                      </div>
                    )}

                    {/* Holiday Due To banner footer */}
                    <div className="mt-3 flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-ink/5 text-xs">
                      <span className="font-bold text-ink/60">
                        Status on this day: <span className="text-amber-700 font-black">Holiday due to {holiday.name}</span>
                      </span>
                      <span className="rounded-md bg-surface px-2 py-0.5 text-[10px] font-bold text-ink/45">
                        Timetable Suspended
                      </span>
                    </div>
                  </article>
                );
              })
            )}
          </div>
        )}
      </div>
    </Layout>
  );
}

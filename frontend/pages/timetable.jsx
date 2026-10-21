import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { CalendarDays, Flag, Sparkles } from "lucide-react";
import { Layout } from "../components/Layout.jsx";
import { readLocal, STORAGE_KEYS } from "../utils/storage.js";
import { 
  buildSubjectNameMap, 
  formatSlotWithTime, 
  getSubjectDisplayName, 
  parseCellValue,
  dayNames,
  dayOrder,
  buildWeekSchedule,
  getTodayRows,
  mergeConsecutiveClasses
} from "../utils/timetable.js";
import { 
  getWeekHolidayMap, 
  getTodayHoliday 
} from "../utils/holidays.js";

function getTodayName() {
  return dayNames[new Date().getDay()];
}

export default function Timetable() {
  const [grid, setGrid] = useState([]);
  const [syncStatus, setSyncStatus] = useState(null);
  const [attendance, setAttendance] = useState([]);
  const [customSubjectNames, setCustomSubjectNames] = useState({});
  const [showRegularWhenHoliday, setShowRegularWhenHoliday] = useState(false);

  const today = getTodayName();
  const weekMap = useMemo(() => getWeekHolidayMap(), []);
  const todayHoliday = useMemo(() => getTodayHoliday(), []);

  const { schedule } = useMemo(() => buildWeekSchedule(grid), [grid]);
  const daysWithData = dayOrder.filter((day) => schedule[day]?.length);
  const [selectedDay, setSelectedDay] = useState(today);
  const selectedDayInitialized = useRef(false);

  const selectedDayInfo = weekMap[selectedDay] || null;
  const isSelectedDayHoliday = !!selectedDayInfo?.holiday;
  const selectedHoliday = selectedDayInfo?.holiday || null;

  const todayRows = daysWithData.length ? schedule[today] || [] : getTodayRows(grid, today);
  const selectedRowsRaw = daysWithData.length
    ? schedule[selectedDay] || []
    : selectedDay === today
      ? todayRows
      : [];
  const selectedRows = useMemo(() => mergeConsecutiveClasses(selectedRowsRaw), [selectedRowsRaw]);
  const totalSlots = selectedRows.length;

  useEffect(() => {
    if (selectedDayInitialized.current) return;
    if (!grid.length) return;
    selectedDayInitialized.current = true;
  }, [grid.length]);

  useEffect(() => {
    const data = readLocal(STORAGE_KEYS.timetable, { grid: [], mappings: [] });
    setSyncStatus(readLocal(STORAGE_KEYS.timetableStatus, null));
    setAttendance(readLocal(STORAGE_KEYS.attendance, []));
    setCustomSubjectNames(readLocal(STORAGE_KEYS.subjectNames, {}));
    if (Array.isArray(data)) {
      setGrid(data);
    } else {
      setGrid(data.grid || []);
    }
  }, []);

  const subjectMap = useMemo(
    () => buildSubjectNameMap(attendance, customSubjectNames),
    [attendance, customSubjectNames]
  );

  return (
    <Layout
      title="Timetable"
      action={
        <Link
          to="/calendar"
          className="tap inline-flex h-9 items-center gap-1.5 rounded-lg border border-ink/10 bg-white px-3 text-xs font-bold text-ink/70 shadow-soft transition-colors hover:text-ink"
        >
          <CalendarDays size={14} />
          Academic Calendar
        </Link>
      }
    >
      {/* Today's Holiday Quick Notice */}
      {todayHoliday && (
        <div className="mb-3 rounded-xl border border-amber-500/25 bg-amber-500/10 p-3 shadow-soft flex items-center gap-2.5">
          <span className="text-2xl">🌴</span>
          <div>
            <p className="text-xs font-black text-ink">
              Today is a holiday due to {todayHoliday.name}
            </p>
            {todayHoliday.subEvent && (
              <p className="text-[10px] font-bold text-amber-700">
                ✨ {todayHoliday.subEvent}
              </p>
            )}
          </div>
        </div>
      )}

      {grid.length > 0 ? (
        <div className="rounded-xl border border-ink/10 bg-white p-3 shadow-soft">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-ink/40">Selected Day</p>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-black text-ink">{selectedDay}</h2>
                {selectedDayInfo?.dateKey && (
                  <span className="text-xs font-bold text-ink/40">
                    ({selectedDayInfo.dateKey})
                  </span>
                )}
                {isSelectedDayHoliday && (
                  <span className="rounded-full bg-amber-100 text-amber-800 px-2 py-0.5 text-[10px] font-black uppercase">
                    Holiday
                  </span>
                )}
              </div>
            </div>
            <span className="rounded-full bg-surface px-2.5 py-1 text-xs font-black text-ink/60">
              {isSelectedDayHoliday && !showRegularWhenHoliday
                ? "Holiday"
                : `${totalSlots} slot${totalSlots === 1 ? "" : "s"}`}
            </span>
          </div>

          {/* Day Selector Buttons */}
          <div className="mt-3 flex flex-wrap gap-2">
            {dayOrder.map((day) => {
              const dayInfo = weekMap[day];
              const isDayHoliday = !!dayInfo?.holiday;
              const isSelected = selectedDay === day;

              return (
                <button
                  key={day}
                  type="button"
                  onClick={() => {
                    setSelectedDay(day);
                    setShowRegularWhenHoliday(false);
                  }}
                  className={`tap relative rounded-full px-3 py-1 text-xs font-black transition-colors flex items-center gap-1 ${
                    isSelected
                      ? "bg-ink text-paper"
                      : isDayHoliday
                      ? "bg-amber-100/70 text-amber-900 hover:bg-amber-200/80"
                      : "bg-surface text-ink/60 hover:text-ink"
                  }`}
                >
                  <span>{day}</span>
                  {isDayHoliday && (
                    <span className="text-[11px]" title={`Holiday: ${dayInfo.holiday.name}`}>
                      🌴
                    </span>
                  )}
                  {dayInfo?.isToday && (
                    <span className="inline-block h-1.5 w-1.5 rounded-full bg-mint" title="Today" />
                  )}
                </button>
              );
            })}
          </div>

          {/* When Selected Day is a Holiday */}
          {isSelectedDayHoliday ? (
            <div className="mt-3 space-y-3">
              <div className="rounded-xl border border-amber-500/25 bg-gradient-to-br from-amber-500/10 via-orange-500/5 to-amber-500/10 p-5 text-center shadow-soft">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-amber-500/20 text-3xl">
                  {selectedHoliday.isSocialService ? "🤝" : (selectedHoliday.isSundayFestival ? "🪔" : "🌴")}
                </div>
                <span className="mt-2.5 inline-block rounded-full bg-amber-500/20 px-3 py-0.5 text-[10px] font-black text-amber-800 uppercase tracking-wider">
                  {selectedHoliday.category}
                </span>
                <h3 className="mt-2 text-xl font-black text-ink">
                  Holiday due to {selectedHoliday.name}
                </h3>
                {selectedHoliday.subEvent && (
                  <p className="mt-1 text-sm font-bold text-amber-700">
                    ✨ Special Occasion: {selectedHoliday.subEvent}
                  </p>
                )}
                {selectedHoliday.activityNotes && (
                  <div className="mt-3 mx-auto max-w-lg rounded-lg border border-amber-500/20 bg-white/90 p-3 text-left text-xs font-semibold text-ink/80 shadow-sm">
                    <p className="font-bold flex items-center gap-1.5 text-amber-900">
                      <Flag size={13} />
                      Mandatory University Requirements:
                    </p>
                    <p className="mt-1 leading-relaxed pl-5">
                      {selectedHoliday.activityNotes}
                    </p>
                  </div>
                )}
                <p className="mt-3 text-xs font-bold text-ink/50">
                  Timetable is suspended on this day. No regular classes scheduled.
                </p>

                <div className="mt-4 pt-3 border-t border-amber-500/15 flex flex-wrap items-center justify-center gap-4">
                  <button
                    type="button"
                    onClick={() => setShowRegularWhenHoliday(!showRegularWhenHoliday)}
                    className="text-xs font-bold text-ink/50 hover:text-ink underline transition-colors"
                  >
                    {showRegularWhenHoliday ? "Hide regular weekday timetable" : "View regular timetable for reference"}
                  </button>
                  <Link
                    to="/calendar"
                    className="text-xs font-bold text-mint hover:underline"
                  >
                    View Academic Calendar →
                  </Link>
                </div>
              </div>

              {/* Show regular schedule only if explicitly requested for reference */}
              {showRegularWhenHoliday && (
                <div className="rounded-lg border border-dashed border-ink/20 p-3 space-y-2 bg-paper/50">
                  <p className="text-[11px] font-black uppercase tracking-wider text-ink/50 text-center">
                    Reference Only: Regular {selectedDay} Schedule (Classes Suspended Today)
                  </p>
                  {selectedRows.length ? (
                    selectedRows.map((item, index) => {
                      const { courseCode, classroom } = parseCellValue(item.value);
                      const subjectName = getSubjectDisplayName(courseCode, subjectMap);

                      return (
                        <article key={`ref-${selectedDay}-${item.slot}-${index}`} className="rounded-lg border border-ink/10 bg-white/80 p-2.5 opacity-70">
                          <p className="text-[10px] font-black uppercase tracking-wider text-ink/40">{formatSlotWithTime(item.slot)}</p>
                          <p className="mt-1 text-sm font-black text-ink">
                            {subjectName || courseCode}{classroom ? ` - ${classroom}` : ""}
                          </p>
                          {subjectName && (
                            <p className="mt-0.5 text-[10px] font-semibold text-ink/40 uppercase tracking-wide">{courseCode}</p>
                          )}
                        </article>
                      );
                    })
                  ) : (
                    <p className="text-xs text-center text-ink/40 py-2">No regular classes on this weekday.</p>
                  )}
                </div>
              )}
            </div>
          ) : selectedRows.length ? (
            /* Normal Timetable Rows when NOT a holiday */
            <div className="mt-3 space-y-2">
              {selectedRows.map((item, index) => {
                const { courseCode, classroom } = parseCellValue(item.value);
                const subjectName = getSubjectDisplayName(courseCode, subjectMap);

                return (
                  <article key={`${selectedDay}-${item.slot}-${index}`} className="rounded-lg border border-ink/10 bg-paper p-2.5">
                    <p className="text-[10px] font-black uppercase tracking-wider text-ink/40">{formatSlotWithTime(item.slot)}</p>
                    <p className="mt-1 text-sm font-black text-ink">
                      {subjectName || courseCode}{classroom ? ` - ${classroom}` : ""}
                    </p>
                    {subjectName && (
                      <p className="mt-0.5 text-[10px] font-semibold text-ink/40 uppercase tracking-wide">{courseCode}</p>
                    )}
                  </article>
                );
              })}
            </div>
          ) : (
            <div className="mt-3 rounded-lg border border-dashed border-ink/15 bg-paper p-4 text-center">
              <p className="font-black text-ink/60">
                {selectedDay === "Sunday"
                  ? "It's Sunday, enjoy your holiday! 🌴"
                  : `No classes scheduled for ${selectedDay}.`}
              </p>
            </div>
          )}
        </div>
      ) : (
        <div className="rounded-lg border border-dashed border-ink/25 bg-white p-4 text-center shadow-soft md:p-5">
          <p className="font-black text-ink/60">
            {syncStatus?.status === "empty" ? "Timetable not available from ERP" : "No timetable synced yet"}
          </p>
          <p className="mt-2 text-sm text-ink/40">
            {syncStatus?.message || "Configure credentials in Settings to fetch your timetable."}
          </p>
          {syncStatus?.status === "empty" && (
            <p className="mt-2 text-xs font-semibold text-ink/35">
              Attendance can update even when ERP returns an empty timetable page.
            </p>
          )}
        </div>
      )}
    </Layout>
  );
}

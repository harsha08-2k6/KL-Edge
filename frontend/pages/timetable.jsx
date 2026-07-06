import { useEffect, useMemo, useRef, useState } from "react";
import { Layout } from "../components/Layout.jsx";
import { readLocal, STORAGE_KEYS } from "../utils/storage.js";
import { buildSubjectNameMap, formatSlotWithTime, getSubjectDisplayName, parseCellValue } from "../utils/timetable.js";

const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const dayOrder = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const dayAliases = {
  Monday: ["monday", "mon"],
  Tuesday: ["tuesday", "tue", "tues"],
  Wednesday: ["wednesday", "wed"],
  Thursday: ["thursday", "thu", "thur", "thurs"],
  Friday: ["friday", "fri"],
  Saturday: ["saturday", "sat"],
  Sunday: ["sunday", "sun"]
};

function normalize(value = "") {
  return String(value).trim().toLowerCase();
}

function normalizeDayText(value = "") {
  return normalize(value).replace(/[^a-z]/g, " ").replace(/\s+/g, " ").trim();
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function matchesAlias(text, alias) {
  if (!text || !alias) return false;
  return new RegExp(`\\b${escapeRegExp(alias)}\\b`, "i").test(text);
}

function cellHasDay(cell, day) {
  const text = normalizeDayText(cell);
  const aliases = dayAliases[day] || [day.toLowerCase()];
  return aliases.some((alias) => matchesAlias(text, alias));
}

function findDay(cell) {
  for (const day of dayOrder) {
    if (cellHasDay(cell, day)) return day;
  }
  return "";
}

function isSlotValue(value) {
  const text = normalize(value);
  if (!text) return false;
  return text !== "-" && text !== "--" && text !== "na" && text !== "n/a";
}

function getTodayName() {
  return dayNames[new Date().getDay()];
}

function getTodayRows(grid, today) {
  if (!Array.isArray(grid) || !grid.length) return [];

  const rowIndex = grid.findIndex((row) => row.some((cell) => cellHasDay(cell, today)));
  if (rowIndex > 0) {
    const headers = grid[0] || [];
    const row = grid[rowIndex] || [];
    return row
      .map((cell, index) => ({
        slot: headers[index] || (index === 0 ? "Day" : `Slot ${index}`),
        value: cell
      }))
      .filter((item, index) => index > 0 && normalize(item.value) && normalize(item.value) !== "-");
  }

  const headerRow = grid[0] || [];
  const dayColumnIndex = headerRow.findIndex((cell) => cellHasDay(cell, today));
  if (dayColumnIndex > 0) {
    return grid
      .slice(1)
      .map((row) => ({
        slot: row[0] || "Slot",
        value: row[dayColumnIndex]
      }))
      .filter((item) => normalize(item.value) && normalize(item.value) !== "-");
  }

  return [];
}

function buildWeekSchedule(grid) {
  const schedule = Object.fromEntries(dayOrder.map((day) => [day, []]));
  if (!Array.isArray(grid) || !grid.length) {
    return { schedule, slots: [], mode: "empty" };
  }

  const headerRow = grid[0] || [];
  const headerDays = headerRow
    .map((cell, index) => ({ day: findDay(cell), index }))
    .filter((entry) => entry.day);

  if (headerDays.length >= 3) {
    const slots = [];
    grid.slice(1).forEach((row, rowIndex) => {
      const slot = row?.[0] || `Slot ${rowIndex + 1}`;
      slots.push(slot);
      headerDays.forEach(({ day, index }) => {
        const value = row?.[index] ?? "";
        if (isSlotValue(value)) {
          schedule[day].push({ slot, value });
        }
      });
    });
    return { schedule, slots, mode: "column" };
  }

  const dayRows = grid
    .map((row, index) => ({ day: findDay(row?.[0]), index }))
    .filter((entry) => entry.day);

  if (dayRows.length >= 3) {
    const slots = headerRow.slice(1).map((cell, index) => cell || `Slot ${index + 1}`);
    dayRows.forEach(({ day, index }) => {
      const row = grid[index] || [];
      for (let col = 1; col < row.length; col += 1) {
        const value = row[col];
        if (isSlotValue(value)) {
          schedule[day].push({ slot: slots[col - 1] || `Slot ${col}`, value });
        }
      }
    });
    return { schedule, slots, mode: "row" };
  }

  return { schedule, slots: [], mode: "unknown" };
}

function getTodayRowsFallback(grid, today) {
  return getTodayRows(grid, today);
}

export default function Timetable() {
  const [grid, setGrid] = useState([]);
  const [syncStatus, setSyncStatus] = useState(null);
  const [attendance, setAttendance] = useState([]);
  const [customSubjectNames, setCustomSubjectNames] = useState({});
  const today = getTodayName();
  const { schedule } = useMemo(() => buildWeekSchedule(grid), [grid]);
  const daysWithData = dayOrder.filter((day) => schedule[day]?.length);
  const [selectedDay, setSelectedDay] = useState(today);
  const selectedDayInitialized = useRef(false);
  const todayRows = daysWithData.length ? schedule[today] || [] : getTodayRowsFallback(grid, today);
  const selectedRows = daysWithData.length
    ? schedule[selectedDay] || []
    : selectedDay === today
      ? todayRows
      : [];
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
    <Layout title="Timetable">
      {grid.length > 0 ? (
        <div className="rounded-xl border border-ink/10 bg-white p-3 shadow-soft">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-ink/40">Selected Day</p>
              <h2 className="text-xl font-black text-ink">{selectedDay}</h2>
            </div>
            <span className="rounded-full bg-surface px-2.5 py-1 text-xs font-black text-ink/60">
              {totalSlots} slot{totalSlots === 1 ? "" : "s"}
            </span>
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            {dayOrder.map((day) => (
              <button
                key={day}
                type="button"
                onClick={() => setSelectedDay(day)}
                className={`rounded-full px-3 py-1 text-xs font-black transition-colors ${
                  selectedDay === day
                    ? "bg-ink text-paper"
                    : "bg-surface text-ink/60 hover:text-ink"
                }`}
              >
                {day}
              </button>
            ))}
          </div>

          {selectedRows.length ? (
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
            {syncStatus?.message || "Sync from Settings to fetch your timetable."}
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

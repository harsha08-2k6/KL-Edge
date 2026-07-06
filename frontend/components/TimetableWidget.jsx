import React, { useState, useEffect, useMemo, useRef } from "react";
import { Clock } from "lucide-react";
import { readLocal, STORAGE_KEYS } from "../utils/storage.js";
import {
  buildSubjectNameMap,
  formatSlotStartTime,
  getShortSubjectName,
  getSlotNumber,
  getSlotTime,
  parseSlotStartTime,
  parseCellValue
} from "../utils/timetable.js";

// Day order mapping
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

export function TimetableWidget({ grid, attendance }) {
  const [now, setNow] = useState(new Date());
  const [customSubjectNames, setCustomSubjectNames] = useState({});
  const lastNotifiedClass = useRef("");

  useEffect(() => {
    const timer = setInterval(() => {
      setNow(new Date());
    }, 15000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    setCustomSubjectNames(readLocal(STORAGE_KEYS.subjectNames, {}));
  }, []);

  const subjectMap = useMemo(
    () => buildSubjectNameMap(attendance, customSubjectNames),
    [attendance, customSubjectNames]
  );

  const today = getTodayName();
  const { schedule } = useMemo(() => buildWeekSchedule(grid), [grid]);
  const daysWithData = dayOrder.filter((day) => schedule[day]?.length);
  const todayRows = daysWithData.length ? schedule[today] || [] : getTodayRows(grid, today);

  const classesWithTimes = useMemo(() => {
    return todayRows.map(item => {
      const time = parseSlotStartTime(item.slot);
      const { courseCode, classroom } = parseCellValue(item.value);
      const shortName = getShortSubjectName(courseCode, subjectMap);
      return {
        ...item,
        time,
        shortName,
        courseCode,
        classroom
      };
    }).filter(item => item.time !== null)
      .sort((a, b) => {
        const timeA = a.time.hour * 60 + a.time.minute;
        const timeB = b.time.hour * 60 + b.time.minute;
        return timeA - timeB;
      });
  }, [todayRows, subjectMap]);

  const groupedClasses = useMemo(() => {
    if (!classesWithTimes.length) return [];
    const grouped = [];
    let current = null;
    
    classesWithTimes.forEach(item => {
      const slotNum = getSlotNumber(item.slot);
      const start = item.time;
      const slotTime = getSlotTime(slotNum);
      const end = slotTime
        ? { hour: Math.floor(slotTime.endMinutes / 60), minute: slotTime.endMinutes % 60 }
        : { hour: start.hour + 1, minute: start.minute };
      
      const startTimeInMinutes = start.hour * 60 + start.minute;
      const endTimeInMinutes = end.hour * 60 + end.minute;
      
      if (!current) {
        current = {
          ...item,
          startTimeInMinutes,
          endTimeInMinutes,
          slots: [item.slot]
        };
      } else {
        const isSameSubject = current.value === item.value;
        const isConsecutive = startTimeInMinutes === current.endTimeInMinutes || (startTimeInMinutes - current.endTimeInMinutes <= 10);
        
        if (isSameSubject && isConsecutive) {
          current.endTimeInMinutes = Math.max(current.endTimeInMinutes, endTimeInMinutes);
          current.slots.push(item.slot);
        } else {
          grouped.push(current);
          current = {
            ...item,
            startTimeInMinutes,
            endTimeInMinutes,
            slots: [item.slot]
          };
        }
      }
    });
    
    if (current) {
      grouped.push(current);
    }
    return grouped;
  }, [classesWithTimes]);

  const nextClassInfo = useMemo(() => {
    if (!groupedClasses.length) return null;
    
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();
    const nowTimeInMinutes = currentHour * 60 + currentMinute;

    const futureClasses = groupedClasses
      .map(item => {
        const diff = item.startTimeInMinutes - nowTimeInMinutes;
        return { ...item, diff };
      })
      .filter(item => item.diff > 0)
      .sort((a, b) => a.diff - b.diff);

    return futureClasses[0] || null;
  }, [groupedClasses, now]);

  // Trigger countdown alert 10 minutes before class
  useEffect(() => {
    if (nextClassInfo && nextClassInfo.diff <= 10) {
      const classKey = `${nextClassInfo.shortName}-${nextClassInfo.slot}`;
      if (lastNotifiedClass.current !== classKey) {
        lastNotifiedClass.current = classKey;
        if (localStorage.getItem("kl-edge.notificationsEnabled") === "true") {
          new Notification("Upcoming Class Alert 🔔", {
            body: `${nextClassInfo.shortName} starts in ${nextClassInfo.diff} minutes!`,
            icon: "/favicon.ico"
          });
        }
      }
    }
  }, [nextClassInfo]);

  if (!grid || grid.length === 0) {
    return null;
  }

  return (
    <section className="mt-3.5 grid grid-cols-1 gap-2.5 md:grid-cols-2">
      {/* Today's Classes List */}
      <div className="rounded-xl border border-ink/10 bg-white/80 p-3 shadow-soft flex flex-col justify-between">
        <div>
          <div className="flex items-center justify-between border-b border-ink/5 pb-2">
            <h3 className="text-xs font-black uppercase tracking-widest text-ink/40">Today's Classes</h3>
            <span className="rounded-full bg-surface px-2 py-0.5 text-[10px] font-black text-ink/60">
              {today}
            </span>
          </div>

          {classesWithTimes.length > 0 ? (
            <div className="mt-3 space-y-2">
              {classesWithTimes.map((item, idx) => (
                <div key={idx} className="flex items-center justify-between rounded-lg bg-surface/50 p-2 text-xs font-bold text-ink">
                  <div className="flex items-center gap-2 shrink-0">
                    <Clock size={12} className="text-ink/40" />
                    <span>{formatSlotStartTime(item.slot)}</span>
                  </div>
                  <div className="text-right max-w-[180px]">
                    <p className="font-black text-sm truncate">{item.shortName}{item.classroom ? ` - ${item.classroom}` : ""}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-4 text-center text-xs font-bold text-ink/40 py-4">
              No classes scheduled for today! 🌴
            </p>
          )}
        </div>
      </div>

      {/* Next Class Countdown Widget */}
      <div className="rounded-xl border border-ink/10 bg-white/80 p-3 shadow-soft flex flex-col justify-between">
        <div>
          <div className="flex items-center justify-between border-b border-ink/5 pb-2">
            <h3 className="text-xs font-black uppercase tracking-widest text-ink/40">Next Class Countdown</h3>
            <span className="inline-flex h-2 w-2 rounded-full bg-mint animate-pulse" />
          </div>

          {nextClassInfo ? (
            <div className="mt-4 text-center space-y-3">
              <div>
                <p className="text-[10px] font-black uppercase tracking-wider text-ink/40">Next Class</p>
                <h4 className="text-lg font-black text-ink mt-0.5">
                  {nextClassInfo.shortName}{nextClassInfo.classroom ? ` - ${nextClassInfo.classroom}` : ""}
                </h4>
                <p className="text-[10px] font-bold text-ink/40 mt-0.5 uppercase tracking-wide">{nextClassInfo.courseCode}</p>
              </div>

              <div className="rounded-xl bg-surface/60 py-3 px-4 inline-block">
                <p className="text-[9px] font-black uppercase tracking-widest text-ink/40">Starts in</p>
                <p className="text-2xl font-black text-mint tracking-tight mt-0.5">
                  {String(Math.floor(nextClassInfo.diff / 60)).padStart(2, "0")}h{" "}
                  {String(nextClassInfo.diff % 60).padStart(2, "0")}m
                </p>
              </div>
            </div>
          ) : (
            <div className="mt-6 text-center py-6">
              <p className="text-sm font-black text-ink/60">No more classes today! 🎉</p>
              <p className="text-[10px] font-semibold text-ink/40 mt-1">Enjoy the rest of your day.</p>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

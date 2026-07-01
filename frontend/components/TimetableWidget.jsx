import React, { useState, useEffect, useMemo, useRef } from "react";
import { Clock } from "lucide-react";

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

const slotMap = {
  "1": { hour: 7, minute: 10 },
  "2": { hour: 8, minute: 0 },
  "3": { hour: 9, minute: 20 },
  "4": { hour: 10, minute: 10 },
  "5": { hour: 11, minute: 10 },
  "6": { hour: 12, minute: 0 },
  "7": { hour: 13, minute: 50 },
  "8": { hour: 14, minute: 40 },
  "9": { hour: 15, minute: 40 },
  "10": { hour: 16, minute: 30 },
  "11": { hour: 17, minute: 30 },
  "12": { hour: 18, minute: 20 }
};

const slotEndMap = {
  "1": { hour: 8, minute: 0 },
  "2": { hour: 8, minute: 50 },
  "3": { hour: 10, minute: 10 },
  "4": { hour: 11, minute: 0 },
  "5": { hour: 12, minute: 0 },
  "6": { hour: 12, minute: 50 },
  "7": { hour: 14, minute: 40 },
  "8": { hour: 15, minute: 30 },
  "9": { hour: 16, minute: 30 },
  "10": { hour: 17, minute: 30 },
  "11": { hour: 18, minute: 20 },
  "12": { hour: 19, minute: 10 }
};

function parseSlotStartTime(slot) {
  if (!slot) return null;
  const cleaned = slot.trim();
  
  // Try matching standard time format like "09:00 AM" or "14:00"
  const match = cleaned.match(/(\d{1,2}):(\d{2})\s*(AM|PM)?/i);
  if (match) {
    let hour = parseInt(match[1], 10);
    const minute = parseInt(match[2], 10);
    const ampm = match[3];
    
    if (ampm) {
      if (ampm.toUpperCase() === "PM" && hour < 12) hour += 12;
      if (ampm.toUpperCase() === "AM" && hour === 12) hour = 0;
    } else {
      if (hour >= 1 && hour <= 6) hour += 12;
    }
    return { hour, minute };
  }
  const cleanKey = String(parseInt(cleaned, 10));
  return slotMap[cleanKey] || null;
}

function formatSlotTime(slot) {
  if (!slot) return "";
  const cleaned = slot.trim();
  const time = parseSlotStartTime(cleaned);
  if (time) {
    const displayHour = time.hour > 12 ? time.hour - 12 : (time.hour === 0 ? 12 : time.hour);
    return `${String(displayHour).padStart(2, "0")}:${String(time.minute).padStart(2, "0")}`;
  }
  return slot;
}

function getShortSubjectName(value, courseMap) {
  let matchedName = value;
  const valueUpper = value.toUpperCase();
  
  const sortedCodes = Object.keys(courseMap).sort((a, b) => b.length - a.length);
  for (const code of sortedCodes) {
    if (valueUpper.includes(code)) {
      matchedName = courseMap[code];
      break;
    }
  }
  
  const cleanUpper = matchedName.toUpperCase();
  if (cleanUpper.includes("DESIGN AND ANALYSIS OF ALGORITHMS") || cleanUpper.includes("DAA")) {
    return "DAA";
  }
  if (cleanUpper.includes("PYTHON") || cleanUpper.includes("FULL STACK")) {
    return "Python";
  }
  if (cleanUpper.includes("CLOUD")) {
    return "Cloud";
  }
  if (cleanUpper.includes("MATHEMATICAL OPTIMIZATION") || cleanUpper.includes("OPTIMIZATION")) {
    return "Math Optimization";
  }
  if (cleanUpper.includes("BLOCK CHAIN") || cleanUpper.includes("BLOCKCHAIN")) {
    return "Blockchain";
  }
  if (cleanUpper.includes("COMPUTER NETWORKS") || cleanUpper.includes("CN")) {
    return "CN";
  }
  
  const words = matchedName.split(" ").filter(w => w.length > 2 && w !== "AND" && w !== "FOR" && w !== "THE");
  if (words.length > 0) {
    return words.slice(0, 2).join(" ");
  }
  return matchedName;
}

export function TimetableWidget({ grid, attendance }) {
  const [now, setNow] = useState(new Date());
  const lastNotifiedClass = useRef("");

  useEffect(() => {
    const timer = setInterval(() => {
      setNow(new Date());
    }, 15000);
    return () => clearInterval(timer);
  }, []);

  const courseMap = useMemo(() => {
    const map = {};
    attendance.forEach((item) => {
      if (item.courseCode && item.subject) {
        map[item.courseCode.trim().toUpperCase()] = item.subject.trim();
      }
    });
    return map;
  }, [attendance]);

  const today = getTodayName();
  const { schedule } = useMemo(() => buildWeekSchedule(grid), [grid]);
  const daysWithData = dayOrder.filter((day) => schedule[day]?.length);
  const todayRows = daysWithData.length ? schedule[today] || [] : getTodayRows(grid, today);

  const classesWithTimes = useMemo(() => {
    return todayRows.map(item => {
      const time = parseSlotStartTime(item.slot);
      const shortName = getShortSubjectName(item.value, courseMap);
      return {
        ...item,
        time,
        shortName
      };
    }).filter(item => item.time !== null)
      .sort((a, b) => {
        const timeA = a.time.hour * 60 + a.time.minute;
        const timeB = b.time.hour * 60 + b.time.minute;
        return timeA - timeB;
      });
  }, [todayRows, courseMap]);

  const groupedClasses = useMemo(() => {
    if (!classesWithTimes.length) return [];
    const grouped = [];
    let current = null;
    
    classesWithTimes.forEach(item => {
      const slotNum = String(parseInt(item.slot.trim(), 10));
      const start = item.time;
      const end = slotEndMap[slotNum] || { hour: start.hour + 1, minute: start.minute };
      
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
                  <div className="flex items-center gap-2">
                    <Clock size={12} className="text-ink/40" />
                    <span>{formatSlotTime(item.slot)}</span>
                  </div>
                  <span className="font-black text-right truncate max-w-[180px]">{item.shortName}</span>
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
                <h4 className="text-lg font-black text-ink mt-0.5">{nextClassInfo.shortName}</h4>
                <p className="text-[10px] font-bold text-ink/50 mt-0.5">{nextClassInfo.slot}</p>
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

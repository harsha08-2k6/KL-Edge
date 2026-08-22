export const SLOT_TIMES = {
  "1": { start: "07:10 AM", end: "08:00 AM", startMinutes: 7 * 60 + 10, endMinutes: 8 * 60 },
  "2": { start: "08:00 AM", end: "08:50 AM", startMinutes: 8 * 60, endMinutes: 8 * 60 + 50 },
  "3": { start: "09:20 AM", end: "10:10 AM", startMinutes: 9 * 60 + 20, endMinutes: 10 * 60 + 10 },
  "4": { start: "10:10 AM", end: "11:00 AM", startMinutes: 10 * 60 + 10, endMinutes: 11 * 60 },
  "5": { start: "11:10 AM", end: "12:00 PM", startMinutes: 11 * 60 + 10, endMinutes: 12 * 60 },
  "6": { start: "12:00 PM", end: "12:50 PM", startMinutes: 12 * 60, endMinutes: 12 * 60 + 50 },
  "7": { start: "12:55 PM", end: "01:45 PM", startMinutes: 12 * 60 + 55, endMinutes: 13 * 60 + 45 },
  "8": { start: "01:45 PM", end: "02:35 PM", startMinutes: 13 * 60 + 45, endMinutes: 14 * 60 + 35 },
  "9": { start: "02:40 PM", end: "03:30 PM", startMinutes: 14 * 60 + 40, endMinutes: 15 * 60 + 30 },
  "10": { start: "03:40 PM", end: "04:30 PM", startMinutes: 15 * 60 + 40, endMinutes: 16 * 60 + 30 },
  "11": { start: "04:30 PM", end: "05:20 PM", startMinutes: 16 * 60 + 30, endMinutes: 17 * 60 + 20 },
  "12": { start: "05:40 PM", end: "06:30 PM", startMinutes: 17 * 60 + 40, endMinutes: 18 * 60 + 30 },
  "13": { start: "06:30 PM", end: "07:20 PM", startMinutes: 18 * 60 + 30, endMinutes: 19 * 60 + 20 }
};

export function getSlotNumber(slot) {
  const match = String(slot || "").match(/\d+/);
  return match ? match[0] : "";
}

export function getSlotTime(slot) {
  return SLOT_TIMES[getSlotNumber(slot)] || null;
}

export function formatSlotWithTime(slot) {
  const slotNumber = getSlotNumber(slot);
  const time = SLOT_TIMES[slotNumber];
  if (!time) return slot || "";
  return `Slot ${slotNumber} - ${time.start} - ${time.end}`;
}

export function parseSlotStartTime(slot) {
  const time = getSlotTime(slot);
  if (time) {
    return {
      hour: Math.floor(time.startMinutes / 60),
      minute: time.startMinutes % 60
    };
  }

  const cleaned = String(slot || "").trim();
  const match = cleaned.match(/(\d{1,2}):(\d{2})\s*(AM|PM)?/i);
  if (!match) return null;

  let hour = parseInt(match[1], 10);
  const minute = parseInt(match[2], 10);
  const ampm = match[3];

  if (ampm) {
    if (ampm.toUpperCase() === "PM" && hour < 12) hour += 12;
    if (ampm.toUpperCase() === "AM" && hour === 12) hour = 0;
  } else if (hour >= 1 && hour <= 6) {
    hour += 12;
  }

  return { hour, minute };
}

export function formatSlotStartTime(slot) {
  const time = getSlotTime(slot);
  if (time) return time.start.replace(/\s/g, "");

  const parsed = parseSlotStartTime(slot);
  if (!parsed) return slot || "";

  const displayHour = parsed.hour > 12 ? parsed.hour - 12 : (parsed.hour === 0 ? 12 : parsed.hour);
  return `${String(displayHour).padStart(2, "0")}:${String(parsed.minute).padStart(2, "0")}`;
}

export function normalizeSubjectKey(value = "") {
  return String(value).trim().toUpperCase();
}

export function extractCourseCodesFromText(value = "") {
  const text = normalizeSubjectKey(value);
  const matches = text.match(/\b\d{2}[A-Z]{2,8}\d{2,4}[A-Z]?\b/g) || [];
  return Array.from(new Set(matches));
}

export function extractTimetableCourseCodes(timetable = {}) {
  const codes = new Set();
  const grid = Array.isArray(timetable) ? timetable : timetable?.grid;
  const mappings = Array.isArray(timetable?.mappings) ? timetable.mappings : [];

  if (Array.isArray(grid)) {
    grid.forEach((row) => {
      if (!Array.isArray(row)) return;
      row.forEach((cell) => {
        extractCourseCodesFromText(cell).forEach((code) => codes.add(code));
      });
    });
  }

  mappings.forEach((mapping) => {
    [
      mapping?.courseCode,
      mapping?.code,
      mapping?.subjectCode,
      mapping?.subject,
      mapping?.course,
      mapping?.title,
      mapping?.value
    ].forEach((value) => {
      extractCourseCodesFromText(value).forEach((code) => codes.add(code));
    });
  });

  return Array.from(codes).sort((a, b) => a.localeCompare(b));
}

export function buildSubjectNameMap(attendance = [], customNames = {}) {
  const map = {};

  attendance.forEach((item) => {
    const code = normalizeSubjectKey(item?.courseCode || item?.code || item?.subjectCode);
    const subject = String(item?.subject || item?.course || item?.title || "").trim();
    if (code && subject) {
      map[code] = subject;
    }
  });

  Object.entries(customNames || {}).forEach(([key, value]) => {
    const normalizedKey = normalizeSubjectKey(key);
    const name = String(value || "").trim();
    if (normalizedKey && name) {
      map[normalizedKey] = name;
    }
  });

  return map;
}

export function getSubjectDisplayName(value, subjectMap = {}) {
  const text = String(value || "").trim();
  const normalizedText = normalizeSubjectKey(text);
  if (!normalizedText) return "";

  if (subjectMap[normalizedText]) {
    return subjectMap[normalizedText];
  }

  const sortedKeys = Object.keys(subjectMap).sort((a, b) => b.length - a.length);
  for (const key of sortedKeys) {
    if (normalizedText.includes(key)) {
      return subjectMap[key];
    }
  }

  return "";
}

export function parseCellValue(value = "") {
  const text = String(value).trim();

  // Match KL-specific "-RoomNo-" format first
  const roomNoMatch = text.match(/^(.*?)\s*-RoomNo-?\s*(.+)$/i);
  if (roomNoMatch) {
    return { courseCode: roomNoMatch[1].trim(), classroom: roomNoMatch[2].trim() };
  }

  // Match patterns like "20CS3101 / 301" or "20CS3101/Room 301" or "20CS3101 301" or "20CS3101\n301"
  const match = text.match(/^([^/\n]+?)\s*[/\n]\s*(.+)$/);
  if (match) {
    return { courseCode: match[1].trim(), classroom: match[2].trim() };
  }
  // Try splitting on whitespace if last token looks like a room (short alphanumeric)
  const parts = text.split(/\s+/);
  if (parts.length >= 2) {
    const last = parts[parts.length - 1];
    if (/^[A-Z0-9]{2,8}$/i.test(last) && last !== text) {
      return { courseCode: parts.slice(0, -1).join(" "), classroom: last };
    }
  }
  return { courseCode: text, classroom: "" };
}

export function getShortSubjectName(value, subjectMap = {}) {
  const displayName = getSubjectDisplayName(value, subjectMap);
  if (!displayName) {
    return String(value || "");
  }
  const matchedName = displayName;
  const cleanUpper = matchedName.toUpperCase();

  if (cleanUpper.includes("DESIGN AND ANALYSIS OF ALGORITHMS") || cleanUpper.includes("DAA")) return "DAA";
  if (cleanUpper.includes("PYTHON") || cleanUpper.includes("FULL STACK")) return "Python";
  if (cleanUpper.includes("CLOUD")) return "Cloud";
  if (cleanUpper.includes("MATHEMATICAL OPTIMIZATION") || cleanUpper.includes("OPTIMIZATION")) return "Math Optimization";
  if (cleanUpper.includes("BLOCK CHAIN") || cleanUpper.includes("BLOCKCHAIN")) return "Blockchain";
  if (cleanUpper.includes("COMPUTER NETWORKS") || cleanUpper.includes("CN")) return "CN";

  const words = matchedName
    .split(" ")
    .filter((word) => word.length > 2 && !["AND", "FOR", "THE"].includes(word.toUpperCase()));

  return words.length ? words.slice(0, 2).join(" ") : matchedName;
}

export function parseClassDetails(value = "") {
  const parsed = parseCellValue(value);
  let courseCode = parsed.courseCode;
  let classroom = parsed.classroom;
  let faculty = "";
  let type = "";

  // If courseCode contains dashes (e.g. "20CS3101 - L - DR. JOHN DOE")
  const parts = parsed.courseCode.split(/\s*-\s*/);
  if (parts.length >= 2) {
    courseCode = parts[0].trim();
    // Check if the second part is a short class type indicator (L, T, P)
    if (/^[LTP]$/i.test(parts[1].trim())) {
      type = parts[1].trim().toUpperCase();
      if (parts[2]) {
        faculty = parts.slice(2).join(" - ").trim();
      }
    } else {
      faculty = parts.slice(1).join(" - ").trim();
    }
  }

  return {
    raw: value,
    courseCode,
    classroom,
    faculty,
    type
  };
}

export function detectTimetableChanges(oldTimetable, newTimetable, subjectMap = {}) {
  const oldGrid = oldTimetable?.grid;
  const newGrid = newTimetable?.grid;
  if (!Array.isArray(oldGrid) || !oldGrid.length || !Array.isArray(newGrid) || !newGrid.length) {
    return [];
  }

  const { schedule: oldSchedule } = buildWeekSchedule(oldGrid);
  const { schedule: newSchedule } = buildWeekSchedule(newGrid);

  const allChanges = [];

  dayOrder.forEach((day) => {
    const oldClasses = {};
    (oldSchedule[day] || []).forEach((item) => {
      oldClasses[item.slot] = {
        slot: item.slot,
        ...parseClassDetails(item.value)
      };
    });

    const newClasses = {};
    (newSchedule[day] || []).forEach((item) => {
      newClasses[item.slot] = {
        slot: item.slot,
        ...parseClassDetails(item.value)
      };
    });

    const addedList = [];
    const cancelledList = [];

    // Find added and modified
    Object.keys(newClasses).forEach((slot) => {
      const newClass = newClasses[slot];
      const oldClass = oldClasses[slot];

      if (!oldClass) {
        addedList.push(newClass);
      } else {
        if (newClass.raw !== oldClass.raw) {
          if (newClass.courseCode !== oldClass.courseCode) {
            allChanges.push({
              type: "subject_changed",
              day,
              slot,
              courseCode: newClass.courseCode,
              oldCourseCode: oldClass.courseCode,
              oldSubject: getSubjectDisplayName(oldClass.courseCode, subjectMap) || oldClass.courseCode,
              newSubject: getSubjectDisplayName(newClass.courseCode, subjectMap) || newClass.courseCode
            });
          } else {
            if (newClass.classroom !== oldClass.classroom) {
              allChanges.push({
                type: "room_changed",
                day,
                slot,
                courseCode: newClass.courseCode,
                subject: getSubjectDisplayName(newClass.courseCode, subjectMap) || newClass.courseCode,
                oldRoom: oldClass.classroom || "No Room",
                newRoom: newClass.classroom
              });
            }
            if (newClass.faculty !== oldClass.faculty) {
              allChanges.push({
                type: "faculty_changed",
                day,
                slot,
                courseCode: newClass.courseCode,
                subject: getSubjectDisplayName(newClass.courseCode, subjectMap) || newClass.courseCode,
                oldFaculty: oldClass.faculty || "No Faculty",
                newFaculty: newClass.faculty
              });
            }
          }
        }
      }
    });

    // Find cancelled
    Object.keys(oldClasses).forEach((slot) => {
      if (!newClasses[slot]) {
        cancelledList.push(oldClasses[slot]);
      }
    });

    // Match rescheduling (same courseCode added and cancelled on the same day)
    const pairedAddedIdx = new Set();
    const pairedCancelledIdx = new Set();

    cancelledList.forEach((oldClass, oldIdx) => {
      const matchingAddedIdx = addedList.findIndex(
        (newClass, newIdx) =>
          !pairedAddedIdx.has(newIdx) && newClass.courseCode === oldClass.courseCode
      );

      if (matchingAddedIdx !== -1) {
        const newClass = addedList[matchingAddedIdx];
        pairedAddedIdx.add(matchingAddedIdx);
        pairedCancelledIdx.add(oldIdx);

        allChanges.push({
          type: "rescheduled",
          day,
          courseCode: oldClass.courseCode,
          subject: getSubjectDisplayName(oldClass.courseCode, subjectMap) || oldClass.courseCode,
          oldSlot: oldClass.slot,
          newSlot: newClass.slot,
          oldRoom: oldClass.classroom || "No Room",
          newRoom: newClass.classroom || "No Room"
        });
      }
    });

    // Add remaining additions and cancellations
    addedList.forEach((newClass, idx) => {
      if (!pairedAddedIdx.has(idx)) {
        allChanges.push({
          type: "added",
          day,
          slot: newClass.slot,
          courseCode: newClass.courseCode,
          subject: getSubjectDisplayName(newClass.courseCode, subjectMap) || newClass.courseCode,
          room: newClass.classroom || "No Room"
        });
      }
    });

    cancelledList.forEach((oldClass, idx) => {
      if (!pairedCancelledIdx.has(idx)) {
        allChanges.push({
          type: "cancelled",
          day,
          slot: oldClass.slot,
          courseCode: oldClass.courseCode,
          subject: getSubjectDisplayName(oldClass.courseCode, subjectMap) || oldClass.courseCode
        });
      }
    });
  });

  return allChanges;
}

export function detectRoomChanges(oldTimetable, newTimetable) {
  const changes = detectTimetableChanges(oldTimetable, newTimetable);
  return changes
    .filter((ch) => ch.type === "room_changed")
    .map((ch) => ({
      courseCode: ch.courseCode,
      oldRoom: ch.oldRoom,
      newRoom: ch.newRoom,
      day: ch.day,
      slot: ch.slot
    }));
}

export function detectSeatingChanges(oldPlan, newPlan) {
  const oldEntries = Array.isArray(oldPlan) ? oldPlan : (oldPlan?.entries || []);
  const newEntries = Array.isArray(newPlan) ? newPlan : (newPlan?.entries || []);

  const changes = [];

  newEntries.forEach((newEntry) => {
    const oldEntry = oldEntries.find(
      (old) =>
        (old.courseCode || "").trim().toUpperCase() === (newEntry.courseCode || "").trim().toUpperCase() &&
        (old.examType || "").trim().toUpperCase() === (newEntry.examType || "").trim().toUpperCase() &&
        (old.date || "") === (newEntry.date || "")
    );

    if (oldEntry) {
      const roomChanged = (oldEntry.room || "") !== (newEntry.room || "");
      const seatChanged = (oldEntry.seat || "") !== (newEntry.seat || "");
      const blockChanged = (oldEntry.block || "") !== (newEntry.block || "");

      if (roomChanged || seatChanged || blockChanged) {
        changes.push({
          type: "seating_update",
          courseCode: newEntry.courseCode || "",
          subject: newEntry.subject || newEntry.courseCode || "",
          examType: newEntry.examType || "Exam",
          date: newEntry.date || "",
          time: newEntry.time || "",
          oldRoom: oldEntry.room || "N/A",
          newRoom: newEntry.room || "N/A",
          oldSeat: oldEntry.seat || "N/A",
          newSeat: newEntry.seat || "N/A",
          oldBlock: oldEntry.block || "N/A",
          newBlock: newEntry.block || "N/A",
          roomChanged,
          seatChanged,
          blockChanged
        });
      }
    } else if (oldEntries.length > 0) {
      changes.push({
        type: "seating_new",
        courseCode: newEntry.courseCode || "",
        subject: newEntry.subject || newEntry.courseCode || "",
        examType: newEntry.examType || "Exam",
        date: newEntry.date || "",
        time: newEntry.time || "",
        room: newEntry.room || "N/A",
        seat: newEntry.seat || "N/A",
        block: newEntry.block || "N/A"
      });
    }
  });

  return changes;
}

export const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
export const dayOrder = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
export const dayAliases = {
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

export function buildWeekSchedule(grid) {
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

export function getTodayRows(grid, today) {
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

export function getCurrentAndNextClass(grid, attendance = [], customSubjectNames = {}) {
  const now = new Date();
  const today = dayNames[now.getDay()];
  
  const { schedule } = buildWeekSchedule(grid);
  const todayRows = schedule[today] || [];
  
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  
  let presentClass = null;
  let nextClass = null;
  
  // Sort today's classes by slot start time
  const todayClasses = todayRows.map((item) => {
    const slotNum = getSlotNumber(item.slot);
    const times = SLOT_TIMES[slotNum];
    return {
      ...item,
      times,
      startMinutes: times ? times.startMinutes : 0,
      endMinutes: times ? times.endMinutes : 0
    };
  }).filter(c => c.times).sort((a, b) => a.startMinutes - b.startMinutes);
  
  // Find present class
  presentClass = todayClasses.find(c => currentMinutes >= c.startMinutes && currentMinutes < c.endMinutes) || null;
  
  // Find next class (strict start time after current time)
  nextClass = todayClasses.find(c => c.startMinutes > currentMinutes) || null;
  
  const subjectMap = buildSubjectNameMap(attendance, customSubjectNames);
  
  const formatClassInfo = (classItem) => {
    if (!classItem) return null;
    const { courseCode, classroom } = parseCellValue(classItem.value);
    const subjectName = getSubjectDisplayName(courseCode, subjectMap);
    return {
      courseCode,
      classroom,
      subjectName: subjectName || courseCode,
      slot: classItem.slot,
      timeString: classItem.times ? `${classItem.times.start} - ${classItem.times.end}` : ""
    };
  };
  
  return {
    present: formatClassInfo(presentClass),
    next: formatClassInfo(nextClass)
  };
}

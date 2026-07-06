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

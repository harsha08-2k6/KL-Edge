export const STORAGE_KEYS = {
  credentials: "kl-edge.credentials",
  syncOptions: "kl-edge.syncOptions",
  captchaSessionId: "kl-edge.captchaSessionId",
  attendance: "kl-edge.attendance",
  subjectNames: "kl-edge.subjectNames",
  timetable: "kl-edge.timetable",
  timetableStatus: "kl-edge.timetableStatus",
  lastUpdated: "kl-edge.lastUpdated",
  marks: "kl-edge.marks",
  seatingPlan: "kl-edge.seatingPlan",
  cgpa: "kl-edge.cgpa",
  lmsCredentials: "kl-edge.lmsCredentials",
  lmsToken: "kl-edge.lmsToken",
  lmsAssignments: "kl-edge.lmsAssignments",
  lmsLastSynced: "kl-edge.lmsLastSynced"
};

export function readLocal(key, fallback) {
  if (typeof window === "undefined") return fallback;

  try {
    const value = window.localStorage.getItem(key);
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
}

export function writeLocal(key, value) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(key, JSON.stringify(value));
}

export function removeLocal(key) {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(key);
}

export function mergeSeatingPlans(existing = [], incoming = []) {
  const listA = Array.isArray(existing) ? existing : (existing?.entries || []);
  const listB = Array.isArray(incoming) ? incoming : (incoming?.entries || []);

  const normalizeDate = (d) => {
    if (!d) return "";
    const str = String(d).trim();
    const m1 = str.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/);
    if (m1) return `${m1[1]}-${String(m1[2]).padStart(2, '0')}-${String(m1[3]).padStart(2, '0')}`;
    const m2 = str.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/);
    if (m2) return `${m2[3]}-${String(m2[2]).padStart(2, '0')}-${String(m2[1]).padStart(2, '0')}`;
    return str;
  };

  const normalizeType = (t, dateStr = "") => {
    const s = String(t || "").toLowerCase().trim();
    if (s.includes("end") || s.includes("see") || s.includes("final") || s.includes("semester exam") || s.includes("regular end")) {
      return "ENDSEM";
    }
    if (/\b(?:in\s*sem|insem|semester)[\s-_]*(?:0?2\b|ii\b)/.test(s) || s.includes("insem-2") || s.includes("in-2")) {
      return "INSEM2";
    }
    if (/\b(?:in\s*sem|insem|semester)[\s-_]*(?:0?1\b|i\b)/.test(s) || s.includes("insem-1") || s.includes("in-1")) {
      return "INSEM1";
    }
    if (s.includes("in") || s.includes("internal")) {
      // In Odd Sem, month <= 9 is In-Sem 1, month >= 10 is In-Sem 2
      const monthMatch = dateStr.match(/\b\d{4}[-/.](\d{2})[-/.]/);
      if (monthMatch) {
        const m = parseInt(monthMatch[1], 10);
        if (m <= 9) return "INSEM1";
        if (m >= 10 && m <= 11) return "INSEM2";
      }
      return "INSEM";
    }
    return s.toUpperCase();
  };

  const normalizeSlot = (s) => {
    const t = String(s || "").toLowerCase().trim();
    if (t === "fn" || t.includes("forenoon") || t.includes("am") || t.includes("morning")) return "FN";
    if (t === "an" || t.includes("afternoon") || t.includes("pm") || t.includes("evening")) return "AN";
    return t.toUpperCase();
  };

  const getKey = (item) => {
    if (!item) return "";
    const code = String(item.courseCode || item.code || "").trim().toUpperCase();
    const date = normalizeDate(item.date);
    const type = normalizeType(item.examType || item.type || "", date);

    // Primary unique identifier: Course Code + Exam Type + Date
    if (code && date) {
      return `${code}_${type}_${date}`;
    }
    if (code && type && type !== "INSEM") {
      return `${code}_${type}`;
    }
    const slot = normalizeSlot(item.examSlot || item.time || "");
    const room = String(item.room || "").trim().toUpperCase();
    if (code || date || room) {
      return `${code}_${type}_${date}_${slot}_${room}`;
    }
    if (item.refId) return `REF_${String(item.refId).trim().toUpperCase()}`;
    return "";
  };

  const map = new Map();
  [...listA, ...listB].forEach((item) => {
    if (!item) return;
    const k = getKey(item);
    if (!k) return;
    if (map.has(k)) {
      const prev = map.get(k);
      const isPrevEnd = String(prev.examType || "").toLowerCase().includes("end");
      const isItemEnd = String(item.examType || "").toLowerCase().includes("end");
      const preferredType = (isPrevEnd || isItemEnd) ? (item.examType || prev.examType || "End-Sem") : (item.examType || prev.examType);

      const isValid = (v) => v && String(v).trim().toLowerCase() !== "na" && String(v).trim() !== "-";

      map.set(k, {
        ...prev,
        ...item,
        examType: preferredType,
        room: isValid(item.room) ? item.room : prev.room,
        seat: isValid(item.seat) ? item.seat : prev.seat,
        block: isValid(item.block) ? item.block : prev.block,
        date: normalizeDate(item.date) || normalizeDate(prev.date),
        time: item.time || prev.time || item.examSlot || prev.examSlot,
        examSlot: item.examSlot || prev.examSlot || item.time || prev.time,
        courseCode: item.courseCode || prev.courseCode,
        subject: isValid(item.subject) ? item.subject : (prev.subject || item.subject),
        refId: item.refId || prev.refId,
        academicYear: item.academicYear || prev.academicYear,
        semester: item.semester || prev.semester
      });
    } else {
      map.set(k, {
        ...item,
        date: normalizeDate(item.date) || item.date
      });
    }
  });

  return Array.from(map.values());
}

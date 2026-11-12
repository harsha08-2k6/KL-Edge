export function buildMeta(entry) {
  const parts = [];
  if (entry.examType) parts.push(entry.examType);
  if (entry.examSlot) parts.push(`Slot ${String(entry.examSlot).toUpperCase()}`);
  if (entry.room) parts.push(`Room ${entry.room}`);
  if (entry.seat) parts.push(`Seat ${entry.seat}`);
  if (entry.block) parts.push(`Block ${entry.block}`);
  if (entry.date) parts.push(entry.date);
  if (entry.time) parts.push(entry.time);
  return parts.join(" · ");
}

const MONTH_MAP = {
  jan: 1, january: 1,
  feb: 2, february: 2,
  mar: 3, march: 3,
  apr: 4, april: 4,
  may: 5,
  jun: 6, june: 6,
  jul: 7, july: 7,
  aug: 8, august: 8,
  sep: 9, september: 9, sept: 9,
  oct: 10, october: 10,
  nov: 11, november: 11,
  dec: 12, december: 12
};

export function parseMonth(dateText) {
  if (!dateText) return null;
  const str = String(dateText).trim().toLowerCase();
  for (const [name, num] of Object.entries(MONTH_MAP)) {
    if (new RegExp(`\\b${name}\\b`).test(str)) return num;
  }
  const isoMatch = str.match(/(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
  if (isoMatch) return Number(isoMatch[2]);
  const altMatch = str.match(/(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})/);
  if (altMatch) return Number(altMatch[2]);
  return null;
}

export function parseDateYear(dateText) {
  if (!dateText) return null;
  const str = String(dateText).trim();
  const match = str.match(/\b(20\d{2})\b/);
  if (match) return Number(match[1]);
  return null;
}

export function parseDateValue(dateText) {
  if (!dateText) return null;
  const isoMatch = String(dateText).match(/(\d{4})[-/](\d{2})[-/](\d{2})/);
  if (isoMatch) {
    const year = Number(isoMatch[1]);
    const month = Number(isoMatch[2]) - 1;
    const day = Number(isoMatch[3]);
    return new Date(year, month, day).getTime();
  }
  const altMatch = String(dateText).match(/(\d{2})[-/](\d{2})[-/](\d{4})/);
  if (altMatch) {
    const day = Number(altMatch[1]);
    const month = Number(altMatch[2]) - 1;
    const year = Number(altMatch[3]);
    return new Date(year, month, day).getTime();
  }
  const parsed = Date.parse(dateText);
  if (!isNaN(parsed)) return parsed;
  return null;
}

export function parseSlotValue(slotText) {
  if (!slotText) return 0;
  const text = String(slotText).toLowerCase().trim();
  if (text.includes("am") || text === "fn" || text.includes("forenoon") || text.includes("morning")) return 1;
  if (text.includes("pm") || text === "an" || text.includes("afternoon") || text.includes("evening")) return 2;
  return 0;
}

export function formatSlotText(slot) {
  if (!slot) return "";
  const s = String(slot).trim().toLowerCase();
  if (s === "fn" || s === "forenoon") return "Forenoon (FN)";
  if (s === "an" || s === "afternoon") return "Afternoon (AN)";
  if (s === "am") return "Morning (AM)";
  if (s === "pm") return "Afternoon (PM)";
  return String(slot).toUpperCase();
}

export function getExamType(entry) {
  return String(entry?.examType || entry?.exam_type || entry?.type || "").trim();
}

export function normalizeSemester(rawSemester, entryDate) {
  const raw = String(rawSemester || "").trim();

  // Explicit check for Odd Sem / Sem 1 / Sem 01 / Semester 1 / Semester 01 / 1 / 01
  if (
    /odd/i.test(raw) ||
    /(?:sem|semester)[\s-_]*(?:0?1\b|i\b)/i.test(raw) ||
    raw === "1" ||
    raw === "01"
  ) {
    return { id: "SEM 01", label: "SEM 01", order: 1 };
  }

  // Explicit check for Even Sem / Sem 2 / Sem 02 / Semester 2 / Semester 02 / 2 / 02
  if (
    /even/i.test(raw) ||
    /(?:sem|semester)[\s-_]*(?:0?2\b|ii\b)/i.test(raw) ||
    raw === "2" ||
    raw === "02"
  ) {
    return { id: "SEM 02", label: "SEM 02", order: 2 };
  }

  // Check for other numbered semesters (e.g. SEM 03, Sem 4, etc.)
  const numMatch = raw.match(/(?:sem|semester)?[\s-_]*0?([1-8])\b/i);
  if (numMatch) {
    const n = parseInt(numMatch[1], 10);
    const id = `SEM ${String(n).padStart(2, "0")}`;
    return { id, label: id, order: n };
  }

  // Check for Summer Term
  if (/summer/i.test(raw)) {
    return { id: "SUMMER", label: "SUMMER TERM", order: 99 };
  }

  // Check for Term 3
  if (/term\s*3/i.test(raw)) {
    return { id: "TERM 3", label: "TERM 3", order: 98 };
  }

  // If raw is missing, infer from exam date if available
  const month = parseMonth(entryDate);
  if (month != null) {
    if (month >= 7) {
      return { id: "SEM 01", label: "SEM 01", order: 1 };
    } else {
      return { id: "SEM 02", label: "SEM 02", order: 2 };
    }
  }

  if (raw) {
    const clean = raw.toUpperCase();
    return { id: clean, label: clean, order: 50 };
  }

  return { id: "SEM 01", label: "SEM 01", order: 1 };
}

export function getSeatingSession(entry) {
  if (entry?.date) {
    const dYear = parseDateYear(entry.date);
    const dMonth = parseMonth(entry.date);
    if (dYear != null && dMonth != null) {
      const acadStartYear = dMonth >= 7 ? dYear : dYear - 1;
      const academicYear = `${acadStartYear}-${acadStartYear + 1}`;
      const semester = dMonth >= 7 ? "Odd Sem" : "Even Sem";
      return {
        academicYear,
        semester,
        startYear: acadStartYear,
        source: "date"
      };
    }
  }

  const entryYear = String(entry?.academicYear || entry?.year || "").trim();
  const entrySem = String(entry?.semester || entry?.sem || entry?.semesterId || entry?.term || "").trim();
  const yearMatch = entryYear.match(/\d{4}/);
  const startYear = yearMatch ? Number(yearMatch[0]) : null;

  return {
    academicYear: entryYear || null,
    semester: entrySem || null,
    startYear,
    source: "explicit"
  };
}

export function matchesAcademicYear(entry, targetYear) {
  if (!targetYear) return true;
  const cleanTarget = String(targetYear).trim();
  const targetNumbers = cleanTarget.match(/\d{4}/g) || cleanTarget.match(/\d+/g) || [];
  if (!targetNumbers.length) return true;
  const targetStartYear = Number(targetNumbers[0]);

  // 1. If entry has date, the official KL University academic calendar rule is the authoritative ground truth!
  // Academic year begins in July (month 7) and ends in June (month 6).
  if (entry?.date) {
    const dYear = parseDateYear(entry.date);
    const dMonth = parseMonth(entry.date);
    if (dYear != null && dMonth != null) {
      const acadStartYear = dMonth >= 7 ? dYear : dYear - 1;
      return acadStartYear === targetStartYear;
    }
  }

  // 2. Only if date is absent or unparseable, fall back to entry.academicYear
  const entryYear = String(entry?.academicYear || entry?.year || "").trim();
  if (entryYear) {
    const entryNumbers = entryYear.match(/\d{4}/g) || entryYear.match(/\d+/g) || [];
    if (entryNumbers.length && Number(entryNumbers[0]) === targetStartYear) {
      return true;
    }
    return (
      entryYear.toLowerCase().includes(cleanTarget.toLowerCase()) ||
      cleanTarget.toLowerCase().includes(entryYear.toLowerCase())
    );
  }

  // 3. Fallback: if entry has no date and no academicYear specified, treat as matching current session
  if (!entryYear && !entry?.date) return true;

  return false;
}

export function matchesSemester(entry, targetSemester) {
  if (!targetSemester) return true;
  const targetLower = String(targetSemester).toLowerCase().trim();

  const isTargetOdd =
    targetLower.includes("odd") ||
    /(?:sem|semester)[\s-_]*(?:0?1\b|i\b)/i.test(targetLower) ||
    targetLower === "1" ||
    targetLower === "01";
  const isTargetEven =
    targetLower.includes("even") ||
    /(?:sem|semester)[\s-_]*(?:0?2\b|ii\b)/i.test(targetLower) ||
    targetLower === "2" ||
    targetLower === "02";
  const isTargetSummer = targetLower.includes("summer");
  const isTargetTerm3 = targetLower.includes("term3") || targetLower.includes("term 3");

  const entryExamType = String(entry?.examType || entry?.exam_type || entry?.type || "").toLowerCase();
  const isEndSem = entryExamType.includes("end") || entryExamType.includes("see") || entryExamType.includes("final");

  // 1. If entry has date, the official academic calendar month is authoritative!
  // Months 7-12 (July-December) -> Odd Semester
  // For Odd Semester End-Sem exams, examinations frequently take place in January (month 1)!
  // Months 1-6 (January-June)   -> Even Semester
  if (entry?.date) {
    const month = parseMonth(entry.date);
    if (month != null) {
      if (isTargetOdd) return month >= 7 || (month === 1 && isEndSem);
      if (isTargetEven) return month <= 6 && !(month === 1 && isEndSem && targetLower.includes("odd"));
      if (isTargetSummer || isTargetTerm3) return month >= 5 && month <= 7;
    }
  }

  // 2. Only if date is absent or unparseable, fall back to entry.semester
  const entrySem = String(entry?.semester || entry?.sem || entry?.semesterId || entry?.term || "")
    .toLowerCase()
    .trim();

  if (entrySem) {
    if (
      isTargetOdd &&
      (entrySem.includes("odd") ||
        /(?:sem|semester)[\s-_]*(?:0?1\b|i\b)/i.test(entrySem) ||
        entrySem === "1" ||
        entrySem === "01")
    ) {
      return true;
    }
    if (
      isTargetEven &&
      (entrySem.includes("even") ||
        /(?:sem|semester)[\s-_]*(?:0?2\b|ii\b)/i.test(entrySem) ||
        entrySem === "2" ||
        entrySem === "02")
    ) {
      return true;
    }
    if ((isTargetSummer || isTargetTerm3) && (entrySem.includes("summer") || entrySem.includes("term"))) return true;
    return (
      entrySem === targetLower ||
      entrySem.includes(targetLower) ||
      targetLower.includes(entrySem)
    );
  }

  // 3. Fallback: if no date or semester specified, assume match
  if (!entrySem && !entry?.date) return true;

  return false;
}

export function matchesStudent(entry, studentId) {
  if (!studentId) return true;
  const entryStudent = String(entry?.studentId || "").trim().toLowerCase();
  if (!entryStudent) return true;
  return entryStudent === String(studentId).trim().toLowerCase();
}

export function getExamGroup(entry, splitMonth) {
  const text = getExamType(entry).toLowerCase();

  // End Semester checks (SEE, Semester End, End Sem, Final, Main, Regular End, etc.)
  if (
    text.includes("end sem") ||
    text.includes("endsem") ||
    text.includes("end semester") ||
    text.includes("semester end") ||
    text.includes("semester exam") ||
    text.includes("end-sem") ||
    text.includes("end exam") ||
    text.includes("regular end") ||
    text.includes("see") ||
    text.includes("final") ||
    text.includes("main") ||
    text.includes("end")
  ) {
    return "endsem";
  }

  // In-Sem 2 checks
  if (
    /(in\s*sem|semester)\s*[- ]?(2|ii)\b/i.test(text) ||
    text.includes("insem 02") ||
    text.includes("insem 2") ||
    text.includes("in-sem 2") ||
    text.includes("in-sem-2") ||
    text.includes("in-2") ||
    text.includes("in2")
  ) {
    return "insem2";
  }

  // In-Sem 1 checks
  if (
    /(in\s*sem|semester)\s*[- ]?(1|i)\b/i.test(text) ||
    text.includes("insem 01") ||
    text.includes("insem 1") ||
    text.includes("in-sem 1") ||
    text.includes("in-sem-1") ||
    text.includes("in-1") ||
    text.includes("in1")
  ) {
    return "insem1";
  }

  // General In-Sem with splitMonth
  if (
    text.includes("in sem") ||
    text.includes("insem") ||
    text.includes("in semester") ||
    text.includes("in-sem") ||
    text.includes("internal")
  ) {
    const month = parseMonth(entry?.date);
    if (splitMonth && month) {
      return month <= splitMonth ? "insem1" : "insem2";
    }
    return "insem1";
  }

  // If examType is unspecified, infer from date month relative to academic term
  const month = parseMonth(entry?.date);
  if (month) {
    // Months 11, 12, 1 for Odd Sem and 4, 5 for Even Sem are End-Semester exam periods
    if (month === 11 || month === 12 || month === 1 || month === 4 || month === 5) {
      return "endsem";
    }
    if (splitMonth && month > splitMonth) {
      return "insem2";
    }
    return "insem1";
  }

  return "other";
}

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

  const map = new Map();
  const getKey = (item) => {
    if (!item) return "";
    if (item.refId) return `REF_${String(item.refId).trim().toUpperCase()}`;
    const code = String(item.courseCode || item.code || "").trim().toUpperCase();
    const date = String(item.date || "").trim();
    const slot = String(item.examSlot || item.time || "").trim().toUpperCase();
    const type = String(item.examType || item.type || "").trim().toUpperCase();
    const room = String(item.room || "").trim().toUpperCase();
    const seat = String(item.seat || "").trim().toUpperCase();
    return `${code}_${date}_${slot}_${type}_${room}_${seat}`;
  };

  listA.forEach((item) => {
    if (item) {
      const k = getKey(item);
      if (k) map.set(k, item);
    }
  });
  listB.forEach((item) => {
    if (item) {
      const k = getKey(item);
      if (k) map.set(k, item);
    }
  });

  return Array.from(map.values());
}

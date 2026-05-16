export const STORAGE_KEYS = {
  credentials: "kl-edge.credentials",
  syncOptions: "kl-edge.syncOptions",
  attendance: "kl-edge.attendance",
  timetable: "kl-edge.timetable",
  lastUpdated: "kl-edge.lastUpdated"
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

import { readLocal, writeLocal } from "./storage.js";
import { detectRoomChanges, detectSeatingChanges } from "./timetable.js";

/**
 * Displays a desktop notification safely across different environments (including mobile PWA).
 * If the Service Worker is available, it uses the service worker registration.
 * Otherwise, it falls back to the legacy Notification constructor.
 *
 * @param {string} title
 * @param {NotificationOptions} options
 * @returns {Promise<boolean>} Resolves to true if notification was shown successfully, false otherwise.
 */
export async function showNotification(title, options = {}) {
  if (typeof window === "undefined" || !("Notification" in window)) {
    console.warn("Notifications not supported in this environment.");
    return false;
  }

  if (Notification.permission !== "granted") {
    console.warn("Notification permission not granted.");
    return false;
  }

  // Try using Service Worker registration first (required for mobile browsers like Chrome on Android/iOS PWA)
  if ("serviceWorker" in navigator) {
    try {
      const registration = await navigator.serviceWorker.getRegistration();
      if (registration && typeof registration.showNotification === "function") {
        await registration.showNotification(title, {
          icon: "/favicon.ico",
          badge: "/icon-192.png",
          ...options
        });
        return true;
      }
    } catch (err) {
      console.warn("Service worker showNotification failed, trying legacy fallback:", err);
    }
  }

  // Fallback to legacy Notification constructor (works in standard desktop browsers)
  try {
    new Notification(title, {
      icon: "/favicon.ico",
      ...options
    });
    return true;
  } catch (err) {
    console.error("Legacy Notification constructor failed:", err);
    return false;
  }
}

export function processSyncUpdates(payload) {
  if (!payload) return;

  const oldTimetable = readLocal("kl-edge.timetable", {});
  const oldSeatingPlan = readLocal("kl-edge.seatingPlan", []);

  const newTimetable = payload.timetable || {};
  const newSeatingPlan = payload.seatingPlan || [];

  const timetableChanges = detectRoomChanges(oldTimetable, newTimetable);
  const seatingChanges = detectSeatingChanges(oldSeatingPlan, newSeatingPlan);

  if (timetableChanges.length === 0 && seatingChanges.length === 0) {
    return;
  }

  const existingUpdates = readLocal("kl-edge.recentUpdates", []);
  const newNotifications = [];

  timetableChanges.forEach((ch) => {
    newNotifications.push({
      id: `room_${ch.courseCode}_${ch.day}_${ch.slot}_${Date.now()}`,
      type: "room_change",
      timestamp: new Date().toISOString(),
      read: false,
      title: `Room Change: ${ch.courseCode}`,
      message: `${ch.day} (${ch.slot}): Room changed from ${ch.oldRoom} to ${ch.newRoom}`,
      data: ch
    });
  });

  seatingChanges.forEach((ch) => {
    if (ch.type === "seating_update") {
      newNotifications.push({
        id: `seat_up_${ch.courseCode}_${ch.examType}_${Date.now()}`,
        type: "seating_update",
        timestamp: new Date().toISOString(),
        read: false,
        title: `Seating Updated: ${ch.courseCode}`,
        message: `${ch.examType} on ${ch.date || "unknown date"}: Seat/Room updated to Room ${ch.newRoom}, Seat ${ch.newSeat}`,
        data: ch
      });
    } else if (ch.type === "seating_new") {
      newNotifications.push({
        id: `seat_new_${ch.courseCode}_${ch.examType}_${Date.now()}`,
        type: "seating_new",
        timestamp: new Date().toISOString(),
        read: false,
        title: `New Seating: ${ch.courseCode}`,
        message: `${ch.examType} on ${ch.date || "unknown date"}: Assigned to Room ${ch.room}, Seat ${ch.seat}`,
        data: ch
      });
    }
  });

  const merged = [...newNotifications, ...existingUpdates].slice(0, 20);
  writeLocal("kl-edge.recentUpdates", merged);
}

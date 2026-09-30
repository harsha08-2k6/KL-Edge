import { readLocal, writeLocal } from "./storage.js";
import { detectTimetableChanges, detectSeatingChanges, SLOT_TIMES, getSlotNumber, buildSubjectNameMap } from "./timetable.js";



export function formatNotificationDay(dayName) {
  const dayNamesArr = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const todayIndex = new Date().getDay();
  const todayName = dayNamesArr[todayIndex];
  const tomorrowName = dayNamesArr[(todayIndex + 1) % 7];

  if (dayName === todayName) return "Today";
  if (dayName === tomorrowName) return "Tomorrow";
  return dayName;
}

export function getSlotTimeText(slotName) {
  const slotNum = getSlotNumber(slotName);
  const time = SLOT_TIMES[slotNum];
  return time ? time.start : slotName;
}

export function processSyncUpdates(payload) {
  if (!payload) return;

  const oldTimetable = readLocal("kl-edge.timetable", {});
  const oldSeatingPlan = readLocal("kl-edge.seatingPlan", []);

  const newTimetable = payload.timetable || {};
  const newSeatingPlan = payload.seatingPlan || [];

  const attendance = readLocal("kl-edge.attendance", []);
  const customSubjectNames = readLocal("kl-edge.subjectNames", {});
  const subjectMap = buildSubjectNameMap(attendance, customSubjectNames);

  const timetableChanges = detectTimetableChanges(oldTimetable, newTimetable, subjectMap);
  const seatingChanges = detectSeatingChanges(oldSeatingPlan, newSeatingPlan);

  if (timetableChanges.length === 0 && seatingChanges.length === 0) {
    return;
  }

  const existingUpdates = readLocal("kl-edge.recentUpdates", []);
  const newNotifications = [];
  const notificationsToTrigger = [];

  timetableChanges.forEach((ch) => {
    let title = "Class Schedule Changed";
    let message = "";
    const relativeDay = formatNotificationDay(ch.day);

    if (ch.type === "room_changed") {
      title = "Class Room Changed";
      const timeStr = getSlotTimeText(ch.slot);
      message = `${relativeDay}, ${timeStr}\n${ch.subject}\nRoom changed: ${ch.oldRoom} → ${ch.newRoom}`;
    } else if (ch.type === "rescheduled") {
      title = "Class Rescheduled";
      const oldTime = getSlotTimeText(ch.oldSlot);
      const newTime = getSlotTimeText(ch.newSlot);
      message = `${relativeDay}\n${ch.subject}\nMoved from ${oldTime} → ${newTime}`;
    } else if (ch.type === "subject_changed") {
      title = "Class Subject Changed";
      const timeStr = getSlotTimeText(ch.slot);
      message = `${relativeDay}, ${timeStr}\nSubject changed: ${ch.oldSubject} → ${ch.newSubject}`;
    } else if (ch.type === "added") {
      title = "New Class Scheduled";
      const timeStr = getSlotTimeText(ch.slot);
      message = `${relativeDay}, ${timeStr}\n${ch.subject} added in Room ${ch.room}`;
    } else if (ch.type === "cancelled") {
      title = "Class Cancelled";
      const timeStr = getSlotTimeText(ch.slot);
      message = `${relativeDay}, ${timeStr}\n${ch.subject} is cancelled`;
    } else if (ch.type === "faculty_changed") {
      title = "Class Faculty Changed";
      const timeStr = getSlotTimeText(ch.slot);
      message = `${relativeDay}, ${timeStr}\n${ch.subject}\nFaculty changed: ${ch.oldFaculty} → ${ch.newFaculty}`;
    }

    newNotifications.push({
      id: `room_${ch.courseCode}_${ch.day}_${ch.slot || ch.newSlot || "slot"}_${Date.now()}`,
      type: "room_change",
      timestamp: new Date().toISOString(),
      read: false,
      title,
      message,
      data: ch
    });

    notificationsToTrigger.push({ title, message });
  });

  seatingChanges.forEach((ch) => {
    let title = "";
    let message = "";
    if (ch.type === "seating_update") {
      title = `Seating Updated: ${ch.courseCode}`;
      message = `${ch.examType} on ${ch.date || "unknown date"}: Seat/Room updated to Room ${ch.newRoom}, Seat ${ch.newSeat}`;
    } else if (ch.type === "seating_new") {
      title = `New Seating: ${ch.courseCode}`;
      message = `${ch.examType} on ${ch.date || "unknown date"}: Assigned to Room ${ch.room}, Seat ${ch.seat}`;
    }

    newNotifications.push({
      id: `seat_${ch.courseCode}_${ch.examType}_${Date.now()}`,
      type: ch.type,
      timestamp: new Date().toISOString(),
      read: false,
      title,
      message,
      data: ch
    });

    notificationsToTrigger.push({ title, message });
  });

  const merged = [...newNotifications, ...existingUpdates].slice(0, 20);
  writeLocal("kl-edge.recentUpdates", merged);



  return timetableChanges;
}

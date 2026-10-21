/**
 * Academic Calendar & Holidays 2026 for KL-Edge
 */

export const HOLIDAY_CATEGORIES = {
  GENERAL: "General Holidays",
  SUNDAY_FESTIVAL: "Festivals Falling on Sunday",
  SOCIAL_SERVICE: "Social Service Activities"
};

export const HOLIDAYS_2026 = [
  // General Holidays
  {
    id: "pongal-2026",
    number: 1,
    name: "Pongal Holidays",
    category: HOLIDAY_CATEGORIES.GENERAL,
    startDate: "2026-01-12",
    endDate: "2026-01-17",
    dayDescription: "Monday to Saturday",
    subEvents: {
      "2026-01-14": { name: "Bhogi", dayOfWeek: "Wednesday" },
      "2026-01-15": { name: "Sankranthi", dayOfWeek: "Thursday" },
      "2026-01-16": { name: "Kanuma", dayOfWeek: "Friday" }
    },
    dates: [
      "2026-01-12",
      "2026-01-13",
      "2026-01-14",
      "2026-01-15",
      "2026-01-16",
      "2026-01-17"
    ],
    notes: "Bhogi (14 Jan), Sankranthi (15 Jan), Kanuma (16 Jan)"
  },
  {
    id: "ugadi-2026",
    number: 2,
    name: "Ugadi",
    category: HOLIDAY_CATEGORIES.GENERAL,
    startDate: "2026-03-19",
    endDate: "2026-03-19",
    dayDescription: "Thursday",
    dates: ["2026-03-19"]
  },
  {
    id: "ramzan-2026",
    number: 3,
    name: "Ramzan (Id-ul-Fitr)",
    category: HOLIDAY_CATEGORIES.GENERAL,
    startDate: "2026-03-21",
    endDate: "2026-03-21",
    dayDescription: "Saturday",
    dates: ["2026-03-21"]
  },
  {
    id: "sri-ramanavami-2026",
    number: 4,
    name: "Sri Ramanavami",
    category: HOLIDAY_CATEGORIES.GENERAL,
    startDate: "2026-03-27",
    endDate: "2026-03-27",
    dayDescription: "Friday",
    dates: ["2026-03-27"]
  },
  {
    id: "ambedkar-jayanthi-2026",
    number: 5,
    name: "Dr. B. R. Ambedkar Jayanthi",
    category: HOLIDAY_CATEGORIES.GENERAL,
    startDate: "2026-04-14",
    endDate: "2026-04-14",
    dayDescription: "Tuesday",
    dates: ["2026-04-14"]
  },
  {
    id: "varalakshmi-vratham-2026",
    number: 6,
    name: "Varalakshmi Vratham",
    category: HOLIDAY_CATEGORIES.GENERAL,
    startDate: "2026-08-28",
    endDate: "2026-08-28",
    dayDescription: "Friday",
    dates: ["2026-08-28"]
  },
  {
    id: "krishnashtami-2026",
    number: 7,
    name: "Krishnashtami",
    category: HOLIDAY_CATEGORIES.GENERAL,
    startDate: "2026-09-04",
    endDate: "2026-09-04",
    dayDescription: "Friday",
    dates: ["2026-09-04"]
  },
  {
    id: "vinayaka-chavithi-2026",
    number: 8,
    name: "Vinayaka Chavithi",
    category: HOLIDAY_CATEGORIES.GENERAL,
    startDate: "2026-09-14",
    endDate: "2026-09-14",
    dayDescription: "Monday",
    dates: ["2026-09-14"]
  },
  {
    id: "dussehra-vacation-2026",
    number: 9,
    name: "Dussehra Vacation",
    category: HOLIDAY_CATEGORIES.GENERAL,
    startDate: "2026-10-19",
    endDate: "2026-10-24",
    dayDescription: "Monday to Saturday",
    subEvents: {
      "2026-10-19": { name: "Durgashtami", dayOfWeek: "Monday" },
      "2026-10-20": { name: "Mahanavami", dayOfWeek: "Tuesday" },
      "2026-10-21": { name: "Vijaya Dasami", dayOfWeek: "Wednesday" }
    },
    dates: [
      "2026-10-19",
      "2026-10-20",
      "2026-10-21",
      "2026-10-22",
      "2026-10-23",
      "2026-10-24"
    ],
    notes: "Durgashtami (19 Oct), Mahanavami (20 Oct), Vijaya Dasami (21 Oct)"
  },
  {
    id: "day-after-deepavali-2026",
    number: 10,
    name: "The day after Deepavali",
    category: HOLIDAY_CATEGORIES.GENERAL,
    startDate: "2026-11-09",
    endDate: "2026-11-09",
    dayDescription: "Monday",
    dates: ["2026-11-09"]
  },
  {
    id: "christmas-2026",
    number: 11,
    name: "Christmas",
    category: HOLIDAY_CATEGORIES.GENERAL,
    startDate: "2026-12-25",
    endDate: "2026-12-25",
    dayDescription: "Friday",
    dates: ["2026-12-25"]
  },

  // Festivals Falling on Sunday
  {
    id: "maha-sivarathri-2026",
    number: 12,
    name: "Maha Sivarathri",
    category: HOLIDAY_CATEGORIES.SUNDAY_FESTIVAL,
    startDate: "2026-02-15",
    endDate: "2026-02-15",
    dayDescription: "Sunday",
    dates: ["2026-02-15"],
    notes: "Festival falling on Sunday"
  },
  {
    id: "deepavali-2026",
    number: 13,
    name: "Deepavali",
    category: HOLIDAY_CATEGORIES.SUNDAY_FESTIVAL,
    startDate: "2026-11-08",
    endDate: "2026-11-08",
    dayDescription: "Sunday",
    dates: ["2026-11-08"],
    notes: "Festival falling on Sunday"
  },

  // Social Service Activities
  {
    id: "republic-day-2026",
    number: 14,
    name: "Republic Day",
    category: HOLIDAY_CATEGORIES.SOCIAL_SERVICE,
    startDate: "2026-01-26",
    endDate: "2026-01-26",
    dayDescription: "Monday",
    dates: ["2026-01-26"],
    activityNotes: "Attendance at flag hoisting is mandatory for faculty and staff. Student participation in social work is compulsory."
  },
  {
    id: "independence-day-2026",
    number: 15,
    name: "Independence Day",
    category: HOLIDAY_CATEGORIES.SOCIAL_SERVICE,
    startDate: "2026-08-15",
    endDate: "2026-08-15",
    dayDescription: "Saturday",
    dates: ["2026-08-15"],
    activityNotes: "Attendance at flag hoisting is mandatory for faculty and staff. Student participation in social work is compulsory."
  },
  {
    id: "gandhi-jayanthi-2026",
    number: 16,
    name: "Gandhi Jayanthi",
    category: HOLIDAY_CATEGORIES.SOCIAL_SERVICE,
    startDate: "2026-10-02",
    endDate: "2026-10-02",
    dayDescription: "Friday",
    dates: ["2026-10-02"],
    activityNotes: "Attendance is mandatory for faculty and staff. Participation in social work and the Swachhata campaign is compulsory."
  }
];

// Precompute date map for O(1) lookups: "YYYY-MM-DD" -> holiday details
const DATE_TO_HOLIDAY_MAP = {};

HOLIDAYS_2026.forEach((holiday) => {
  holiday.dates.forEach((dateStr) => {
    const subEvent = holiday.subEvents ? holiday.subEvents[dateStr] : null;
    let displayName = holiday.name;
    if (subEvent) {
      displayName = `${holiday.name} (${subEvent.name})`;
    }

    DATE_TO_HOLIDAY_MAP[dateStr] = {
      isHoliday: true,
      id: holiday.id,
      number: holiday.number,
      name: displayName,
      baseName: holiday.name,
      subEvent: subEvent ? subEvent.name : null,
      category: holiday.category,
      date: dateStr,
      dayDescription: holiday.dayDescription,
      activityNotes: holiday.activityNotes || null,
      notes: holiday.notes || null,
      holidayDueTo: displayName,
      reason: `Holiday due to ${displayName}`,
      isSocialService: holiday.category === HOLIDAY_CATEGORIES.SOCIAL_SERVICE,
      isSundayFestival: holiday.category === HOLIDAY_CATEGORIES.SUNDAY_FESTIVAL
    };
  });
});

/**
 * Format a Date object to "YYYY-MM-DD" in local time.
 */
export function formatDateKey(date) {
  if (!date) return "";
  if (typeof date === "string") {
    // If already in YYYY-MM-DD or ISO format, take first 10 chars
    return date.slice(0, 10);
  }
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Get holiday details for a given date (Date instance or YYYY-MM-DD string).
 * Returns holiday details object or null if not a holiday.
 */
export function getHolidayForDate(date) {
  const key = formatDateKey(date);
  return DATE_TO_HOLIDAY_MAP[key] || null;
}

/**
 * Checks if a given date is a holiday.
 */
export function isHoliday(date) {
  return !!getHolidayForDate(date);
}

/**
 * Get holiday details for today.
 */
export function getTodayHoliday() {
  return getHolidayForDate(new Date());
}

/**
 * Given a day of week (e.g. "Monday", "Wednesday") in the current week,
 * returns the holiday details if that specific weekday in the current week is a holiday.
 *
 * @param {string} dayName - e.g. "Monday", "Wednesday"
 * @param {Date} [referenceDate] - defaults to new Date()
 */
export function getHolidayForCurrentWeekDay(dayName, referenceDate = new Date()) {
  const dayOrder = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const targetDayIdx = dayOrder.indexOf(dayName);
  if (targetDayIdx === -1) return null;

  const currentDayIdx = referenceDate.getDay();
  const diffDays = targetDayIdx - currentDayIdx;

  const targetDate = new Date(referenceDate);
  targetDate.setDate(referenceDate.getDate() + diffDays);

  return getHolidayForDate(targetDate);
}

/**
 * Returns a map of all 7 days in the week containing `referenceDate`
 * with their Date objects and holiday info.
 */
export function getWeekHolidayMap(referenceDate = new Date()) {
  const dayOrder = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
  const currentDay = referenceDate.getDay(); // 0 is Sunday, 1 is Monday
  // In Monday-first week: Monday is offset (1 - currentDay) if currentDay != 0 else -6
  const mondayOffset = currentDay === 0 ? -6 : 1 - currentDay;

  const result = {};

  dayOrder.forEach((dayName, idx) => {
    const d = new Date(referenceDate);
    d.setDate(referenceDate.getDate() + (mondayOffset + idx));
    const dateKey = formatDateKey(d);
    const holiday = getHolidayForDate(d);
    result[dayName] = {
      date: d,
      dateKey,
      dayName,
      isToday: dateKey === formatDateKey(referenceDate),
      holiday
    };
  });

  return result;
}

/**
 * Get upcoming holidays relative to referenceDate
 */
export function getUpcomingHolidays(referenceDate = new Date(), limit = 3) {
  const refKey = formatDateKey(referenceDate);
  const upcoming = [];

  for (const h of HOLIDAYS_2026) {
    if (h.endDate >= refKey) {
      upcoming.push(h);
      if (upcoming.length >= limit) break;
    }
  }

  return upcoming;
}

/**
 * KL University Academic Calendar Data & Engine (2026-2027)
 * Official source: KL University Academic Calendar 2026-2027 Gazette & Notifications
 */

export const PROGRAM_KEYS = {
  Y26_TRIMESTER: "y26_trimester",
  Y25_SEMESTER: "y25_semester",
  Y25_TRIMESTER: "y25_trimester",
  Y24_SEMESTER: "y24_semester",
  Y23_SEMESTER: "y23_semester"
};

export const PROGRAM_DEFINITIONS = [
  {
    key: PROGRAM_KEYS.Y26_TRIMESTER,
    batch: "Y26",
    year: "1st Year",
    system: "Trimester (PBL)",
    name: "First Year B.Tech, Y26, Trimester Program (PBL)",
    shortName: "I Year B.Tech (Y26 Trimester PBL)",
    sourcePdf: "Academic Calendar 2026-27 I Year UG Engineering Programs Trimester Program (PBL).pdf",
    terms: ["Trimester 1", "Trimester 2", "Trimester 3", "Summer Term"]
  },
  {
    key: PROGRAM_KEYS.Y25_SEMESTER,
    batch: "Y25",
    year: "2nd Year",
    system: "Regular Semester",
    name: "Second Year B.Tech, Y25, Regular Semester Program",
    shortName: "II Year B.Tech (Y25 Regular Semester)",
    sourcePdf: "Academic Calendar 2026-27 II Year UG Engineering Programs.pdf",
    terms: ["Odd Semester", "Even Semester", "Summer Term"]
  },
  {
    key: PROGRAM_KEYS.Y25_TRIMESTER,
    batch: "Y25",
    year: "2nd Year",
    system: "Trimester (PBL)",
    name: "Second Year B.Tech, Y25, Trimester Program (PBL)",
    shortName: "II Year B.Tech (Y25 Trimester PBL)",
    sourcePdf: "Academic Calendar 2026-27 II Year UG Engineering Programs Trimester Program (PBL).pdf",
    terms: ["Trimester 4", "Trimester 5", "Trimester 6", "Summer Term"]
  },
  {
    key: PROGRAM_KEYS.Y24_SEMESTER,
    batch: "Y24",
    year: "3rd Year",
    system: "Regular Semester",
    name: "Third Year B.Tech",
    shortName: "III Year B.Tech",
    sourcePdf: "Academic Calendar 2026-27 III and IV Year UG Engineering Programs.pdf",
    terms: ["Odd Semester", "Even Semester", "Summer Term"]
  },
  {
    key: PROGRAM_KEYS.Y23_SEMESTER,
    batch: "Y23",
    year: "4th Year",
    system: "Regular Semester",
    name: "Fourth Year B.Tech",
    shortName: "IV Year B.Tech",
    sourcePdf: "Academic Calendar 2026-27 III and IV Year UG Engineering Programs.pdf",
    terms: ["Odd Semester", "Even Semester", "Summer Term"]
  }
];

export const EVENT_CATEGORIES = {
  EXAM: "Examinations",
  HOLIDAY: "Official Holidays",
  ACADEMIC: "Academic Events",
  DEADLINE: "Important Deadlines",
  INTERNSHIP: "Internships"
};

/**
 * Confirmed Official Holidays (Excluding Optional Holidays entirely)
 * Source: List of Public Holidays for the Calendar Year 2026 & Gazette
 */
export const OFFICIAL_HOLIDAYS = [
  {
    id: "hol_pongal_2026",
    title: "Pongal Holidays",
    category: EVENT_CATEGORIES.HOLIDAY,
    startDate: "2026-01-12",
    endDate: "2026-01-17",
    dayDescription: "Monday to Saturday",
    suspendsTimetable: true,
    subEvents: [
      { name: "Bhogi", date: "2026-01-14", day: "Wednesday" },
      { name: "Sankranthi", date: "2026-01-15", day: "Thursday" },
      { name: "Kanuma", date: "2026-01-16", day: "Friday" }
    ],
    description: "Official Pongal vacation spanning Bhogi, Sankranthi, and Kanuma."
  },
  {
    id: "hol_republic_2026",
    title: "Republic Day",
    category: EVENT_CATEGORIES.HOLIDAY,
    startDate: "2026-01-26",
    endDate: "2026-01-26",
    dayDescription: "Monday",
    suspendsTimetable: true,
    description: "National Holiday. Mandatory attendance at flag hoisting for faculty and staff; student social work compulsory."
  },
  {
    id: "hol_sivarathri_2026",
    title: "Maha Sivarathri",
    category: EVENT_CATEGORIES.HOLIDAY,
    startDate: "2026-02-15",
    endDate: "2026-02-15",
    dayDescription: "Sunday",
    suspendsTimetable: true,
    description: "Confirmed festival falling on Sunday."
  },
  {
    id: "hol_ugadi_2026",
    title: "Ugadi",
    category: EVENT_CATEGORIES.HOLIDAY,
    startDate: "2026-03-19",
    endDate: "2026-03-19",
    dayDescription: "Thursday",
    suspendsTimetable: true,
    description: "Telugu New Year official holiday."
  },
  {
    id: "hol_ramzan_2026",
    title: "Ramzan (Id-ul-Fitr)",
    category: EVENT_CATEGORIES.HOLIDAY,
    startDate: "2026-03-21",
    endDate: "2026-03-21",
    dayDescription: "Saturday",
    suspendsTimetable: true,
    description: "Id-ul-Fitr official public holiday."
  },
  {
    id: "hol_ramanavami_2026",
    title: "Sri Ramanavami",
    category: EVENT_CATEGORIES.HOLIDAY,
    startDate: "2026-03-27",
    endDate: "2026-03-27",
    dayDescription: "Friday",
    suspendsTimetable: true,
    description: "Sri Ramanavami public holiday."
  },
  {
    id: "hol_ambedkar_2026",
    title: "Dr. B. R. Ambedkar Jayanthi",
    category: EVENT_CATEGORIES.HOLIDAY,
    startDate: "2026-04-14",
    endDate: "2026-04-14",
    dayDescription: "Tuesday",
    suspendsTimetable: true,
    description: "Dr. B.R. Ambedkar Jayanthi gazetted holiday."
  },
  {
    id: "hol_independence_2026",
    title: "Independence Day",
    category: EVENT_CATEGORIES.HOLIDAY,
    startDate: "2026-08-15",
    endDate: "2026-08-15",
    dayDescription: "Saturday",
    suspendsTimetable: true,
    description: "National Holiday. Mandatory attendance at flag hoisting for faculty and staff; student social work compulsory."
  },
  {
    id: "hol_varalakshmi_2026",
    title: "Varalakshmi Vratham",
    category: EVENT_CATEGORIES.HOLIDAY,
    startDate: "2026-08-28",
    endDate: "2026-08-28",
    dayDescription: "Friday",
    suspendsTimetable: true,
    description: "Varalakshmi Vratham official holiday."
  },
  {
    id: "hol_krishnashtami_2026",
    title: "Krishnashtami",
    category: EVENT_CATEGORIES.HOLIDAY,
    startDate: "2026-09-04",
    endDate: "2026-09-04",
    dayDescription: "Friday",
    suspendsTimetable: true,
    description: "Sri Krishna Janmashtami official holiday."
  },
  {
    id: "hol_vinayaka_2026",
    title: "Vinayaka Chavithi",
    category: EVENT_CATEGORIES.HOLIDAY,
    startDate: "2026-09-14",
    endDate: "2026-09-14",
    dayDescription: "Monday",
    suspendsTimetable: true,
    description: "Vinayaka Chavithi festival holiday."
  },
  {
    id: "hol_gandhi_2026",
    title: "Mahatma Gandhi Jayanthi",
    category: EVENT_CATEGORIES.HOLIDAY,
    startDate: "2026-10-02",
    endDate: "2026-10-02",
    dayDescription: "Friday",
    suspendsTimetable: true,
    description: "National Holiday. Attendance mandatory for faculty and staff; Swachhata social work campaign."
  },
  {
    id: "hol_dussehra_2026",
    title: "Dussehra Vacation",
    category: EVENT_CATEGORIES.HOLIDAY,
    startDate: "2026-10-19",
    endDate: "2026-10-24",
    dayDescription: "Monday to Saturday",
    suspendsTimetable: true,
    subEvents: [
      { name: "Durgashtami", date: "2026-10-19", day: "Monday" },
      { name: "Mahanavami", date: "2026-10-20", day: "Tuesday" },
      { name: "Vijaya Dasami", date: "2026-10-21", day: "Wednesday" }
    ],
    description: "University Dussehra vacation (Durgashtami, Mahanavami, and Vijaya Dasami)."
  },
  {
    id: "hol_deepavali_sunday_2026",
    title: "Deepavali",
    category: EVENT_CATEGORIES.HOLIDAY,
    startDate: "2026-11-08",
    endDate: "2026-11-08",
    dayDescription: "Sunday",
    suspendsTimetable: true,
    description: "Festival falling on Sunday."
  },
  {
    id: "hol_day_after_deepavali_2026",
    title: "The day after Deepavali",
    category: EVENT_CATEGORIES.HOLIDAY,
    startDate: "2026-11-09",
    endDate: "2026-11-09",
    dayDescription: "Monday",
    suspendsTimetable: true,
    description: "Official post-Deepavali holiday."
  },
  {
    id: "hol_christmas_2026",
    title: "Christmas",
    category: EVENT_CATEGORIES.HOLIDAY,
    startDate: "2026-12-25",
    endDate: "2026-12-25",
    dayDescription: "Friday",
    suspendsTimetable: true,
    description: "Christmas public holiday."
  },
  {
    id: "hol_pongal_2027",
    title: "Pongal / Sankranthi 2027",
    category: EVENT_CATEGORIES.HOLIDAY,
    startDate: "2027-01-14",
    endDate: "2027-01-16",
    dayDescription: "Thursday to Saturday",
    suspendsTimetable: true,
    description: "Confirmed Sankranthi festive break (multi-day extension subject to annual 2027 gazette release)."
  },
  {
    id: "hol_republic_2027",
    title: "Republic Day 2027",
    category: EVENT_CATEGORIES.HOLIDAY,
    startDate: "2027-01-26",
    endDate: "2027-01-26",
    dayDescription: "Tuesday",
    suspendsTimetable: true,
    description: "National Holiday 2027."
  },
  {
    id: "hol_ambedkar_2027",
    title: "Dr. B. R. Ambedkar Jayanthi 2027",
    category: EVENT_CATEGORIES.HOLIDAY,
    startDate: "2027-04-14",
    endDate: "2027-04-14",
    dayDescription: "Wednesday",
    suspendsTimetable: true,
    description: "Gazetted Public Holiday 2027."
  }
];

// Helper map: date string "YYYY-MM-DD" -> holiday item
export const DATE_TO_OFFICIAL_HOLIDAY = {};
OFFICIAL_HOLIDAYS.forEach(h => {
  const cur = new Date(`${h.startDate}T00:00:00`);
  const end = new Date(`${h.endDate}T00:00:00`);
  while (cur <= end) {
    const key = cur.toISOString().slice(0, 10);
    DATE_TO_OFFICIAL_HOLIDAY[key] = h;
    cur.setDate(cur.getDate() + 1);
  }
});

// A. III and IV Year B.Tech Academic Events, Exams, and Deadlines
const EVENTS_Y23_Y24 = [
  // Odd Semester
  {
    id: "y24_odd_orient",
    title: "Odd Semester Orientation and Registrations",
    category: EVENT_CATEGORIES.ACADEMIC,
    term: "Odd Semester",
    startDate: "2026-06-29",
    endDate: "2026-07-04",
    description: "Odd Semester Orientation and course registration period."
  },
  {
    id: "y24_odd_commence",
    title: "Commencement of Classwork",
    category: EVENT_CATEGORIES.ACADEMIC,
    term: "Odd Semester",
    startDate: "2026-07-17",
    endDate: "2026-07-17",
    description: "First instructional day of Odd Semester classwork."
  },
  {
    id: "y24_odd_insem1",
    title: "Semester In-Semester 1 Examinations",
    category: EVENT_CATEGORIES.EXAM,
    term: "Odd Semester",
    startDate: "2026-09-07",
    endDate: "2026-09-12",
    description: "In-Semester 1 Theory examinations."
  },
  {
    id: "y24_odd_recheck1",
    title: "Last date to request recheck for Semester In-1 examinations",
    category: EVENT_CATEGORIES.DEADLINE,
    term: "Odd Semester",
    startDate: "2026-08-27",
    endDate: "2026-08-27",
    description: "Recheck request submission deadline."
  },
  {
    id: "y24_odd_recheck2",
    title: "Last date to request recheck for Semester In-2 examinations",
    category: EVENT_CATEGORIES.DEADLINE,
    term: "Odd Semester",
    startDate: "2026-10-07",
    endDate: "2026-10-07",
    description: "Recheck request submission deadline."
  },
  {
    id: "y24_odd_lab_insem",
    title: "Lab In-Semester Examinations",
    category: EVENT_CATEGORIES.EXAM,
    term: "Odd Semester",
    startDate: "2026-10-12",
    endDate: "2026-10-17",
    description: "Laboratory practical continuous evaluation examinations."
  },
  {
    id: "y24_odd_immersion",
    title: "Techno-Management Immersion Week",
    category: EVENT_CATEGORIES.ACADEMIC,
    term: "Odd Semester",
    startDate: "2026-10-30",
    endDate: "2026-10-31",
    description: "Techno-Management technical exhibits and immersion workshops."
  },
  {
    id: "y24_odd_fee_deadline",
    title: "Last date to pay end-exam fee",
    category: EVENT_CATEGORIES.DEADLINE,
    term: "Odd Semester",
    startDate: "2026-10-31",
    endDate: "2026-10-31",
    description: "Payment portal closes for semester-end examination fees."
  },
  {
    id: "y24_odd_insem2",
    title: "Semester In-Semester 2 Examinations",
    category: EVENT_CATEGORIES.EXAM,
    term: "Odd Semester",
    startDate: "2026-11-09",
    endDate: "2026-11-14",
    description: "In-Semester 2 continuous evaluation examinations."
  },
  {
    id: "y24_odd_last_inst",
    title: "Last instructional day",
    category: EVENT_CATEGORIES.DEADLINE,
    term: "Odd Semester",
    startDate: "2026-11-12",
    endDate: "2026-11-12",
    description: "Final day of classwork for the Odd Semester."
  },
  {
    id: "y24_odd_detention",
    title: "Declaration of detention list",
    category: EVENT_CATEGORIES.DEADLINE,
    term: "Odd Semester",
    startDate: "2026-11-13",
    endDate: "2026-11-13",
    description: "Publication of attendance detention list for end examinations."
  },
  {
    id: "y24_odd_end_exams",
    title: "Semester-End Theory and Lab Examinations",
    category: EVENT_CATEGORIES.EXAM,
    term: "Odd Semester",
    startDate: "2026-11-16",
    endDate: "2026-11-29",
    description: "Comprehensive Semester-End Theory and Practical Lab Examinations."
  },

  // Even Semester
  {
    id: "y24_even_orient",
    title: "Even Semester Orientation and Registrations",
    category: EVENT_CATEGORIES.ACADEMIC,
    term: "Even Semester",
    startDate: "2026-11-30",
    endDate: "2026-12-05",
    description: "Even Semester course registration and academic orientation."
  },
  {
    id: "y24_even_commence",
    title: "Commencement of Classwork",
    category: EVENT_CATEGORIES.ACADEMIC,
    term: "Even Semester",
    startDate: "2026-12-22",
    endDate: "2026-12-22",
    description: "Commencement of Even Semester instruction."
  },
  {
    id: "y24_even_insem1",
    title: "Semester In-Semester 1 Examinations",
    category: EVENT_CATEGORIES.EXAM,
    term: "Even Semester",
    startDate: "2027-02-01",
    endDate: "2027-02-03",
    description: "In-Semester 1 theory exams."
  },
  {
    id: "y24_even_recheck1",
    title: "Last date to request recheck for Semester In-1 examinations",
    category: EVENT_CATEGORIES.DEADLINE,
    term: "Even Semester",
    startDate: "2027-02-10",
    endDate: "2027-02-10",
    description: "Even Semester In-1 recheck request deadline."
  },
  {
    id: "y24_even_cultural",
    title: "Cultural Immersion Week",
    category: EVENT_CATEGORIES.ACADEMIC,
    term: "Even Semester",
    startDate: "2027-03-12",
    endDate: "2027-03-13",
    description: "Annual cultural immersion festival and university celebrations."
  },
  {
    id: "y24_even_lab_insem",
    title: "Lab In-Semester Examinations",
    category: EVENT_CATEGORIES.EXAM,
    term: "Even Semester",
    startDate: "2027-03-15",
    endDate: "2027-03-20",
    description: "Laboratory In-Semester evaluations."
  },
  {
    id: "y24_even_recheck2",
    title: "Last date to request recheck for Semester In-2 examinations",
    category: EVENT_CATEGORIES.DEADLINE,
    term: "Even Semester",
    startDate: "2027-03-18",
    endDate: "2027-03-18",
    description: "Even Semester In-2 recheck deadline."
  },
  {
    id: "y24_even_fee_deadline",
    title: "Last date to pay end-exam fee",
    category: EVENT_CATEGORIES.DEADLINE,
    term: "Even Semester",
    startDate: "2027-04-03",
    endDate: "2027-04-03",
    description: "Final deadline for payment of Even Semester end-exam fees."
  },
  {
    id: "y24_even_insem2",
    title: "Semester In-Semester 2 Examinations",
    category: EVENT_CATEGORIES.EXAM,
    term: "Even Semester",
    startDate: "2027-04-12",
    endDate: "2027-04-17",
    description: "In-Semester 2 examination cycle."
  },
  {
    id: "y24_even_last_inst",
    title: "Last instructional day",
    category: EVENT_CATEGORIES.DEADLINE,
    term: "Even Semester",
    startDate: "2027-04-14",
    endDate: "2027-04-14",
    description: "Final instructional day of Even Semester."
  },
  {
    id: "y24_even_detention",
    title: "Declaration of detention list",
    category: EVENT_CATEGORIES.DEADLINE,
    term: "Even Semester",
    startDate: "2027-04-15",
    endDate: "2027-04-15",
    description: "Publication of detention list for Even Semester."
  },
  {
    id: "y24_even_end_exams",
    title: "Semester-End Theory and Lab Examinations",
    category: EVENT_CATEGORIES.EXAM,
    term: "Even Semester",
    startDate: "2027-04-19",
    endDate: "2027-05-02",
    description: "Even Semester End Theory and Practical Examinations."
  },

  // Summer Term (III and IV Year)
  {
    id: "y24_summer_intern_4w",
    title: "Four-Week Summer Technical Internship",
    category: EVENT_CATEGORIES.INTERNSHIP,
    term: "Summer Term",
    startDate: "2027-05-03",
    endDate: "2027-05-29",
    description: "Four-week specialized technical industry internship."
  },
  {
    id: "y24_summer_intern_8w",
    title: "Eight-Week Summer Internship",
    category: EVENT_CATEGORIES.INTERNSHIP,
    term: "Summer Term",
    startDate: "2027-05-03",
    endDate: "2027-06-26",
    description: "Eight-week corporate / research summer internship."
  },
  {
    id: "y24_summer_orient",
    title: "Summer Term Orientation and Registrations",
    category: EVENT_CATEGORIES.ACADEMIC,
    term: "Summer Term",
    startDate: "2027-05-28",
    endDate: "2027-05-29",
    description: "Registration and enrollment for Summer remedial/fast-track courses."
  },
  {
    id: "y24_summer_insem1",
    title: "Semester In-Semester 1 Examinations",
    category: EVENT_CATEGORIES.EXAM,
    term: "Summer Term",
    startDate: "2027-06-14",
    endDate: "2027-06-15",
    verificationFlag: true,
    description: "Summer Term In-1 Examinations (Flagged for verification against original PDF)."
  },
  {
    id: "y24_summer_lab_insem",
    title: "Lab In-Semester Examinations",
    category: EVENT_CATEGORIES.EXAM,
    term: "Summer Term",
    startDate: "2027-06-18",
    endDate: "2027-06-19",
    verificationFlag: true,
    description: "Summer Term Lab Continuous Evaluations (Flagged for verification)."
  },
  {
    id: "y24_summer_last_inst",
    title: "Summer Term Last Instructional Day",
    category: EVENT_CATEGORIES.DEADLINE,
    term: "Summer Term",
    startDate: "2027-07-03",
    endDate: "2027-07-03",
    description: "Conclusion of Summer Term instructional classes."
  },
  {
    id: "y24_summer_insem2",
    title: "Semester In-Semester 2 Examinations",
    category: EVENT_CATEGORIES.EXAM,
    term: "Summer Term",
    startDate: "2027-07-05",
    endDate: "2027-07-10",
    verificationFlag: true,
    description: "Summer In-2 Examinations (Flagged for verification)."
  },
  {
    id: "y24_summer_end_exams",
    title: "Semester-End Theory and Lab Examinations",
    category: EVENT_CATEGORIES.EXAM,
    term: "Summer Term",
    startDate: "2027-07-08",
    endDate: "2027-07-10",
    verificationFlag: true,
    description: "Summer Term End Theory and Practical Examinations (Flagged for verification)."
  }
];

// B. II Year B.Tech Regular Semester Program
const EVENTS_Y25_SEMESTER = [
  // Odd Semester
  {
    id: "y25sem_odd_orient",
    title: "Odd Semester Orientation and Registrations",
    category: EVENT_CATEGORIES.ACADEMIC,
    term: "Odd Semester",
    startDate: "2026-06-29",
    endDate: "2026-07-04",
    description: "Odd Semester Orientation and course registration."
  },
  {
    id: "y25sem_odd_commence",
    title: "Commencement of Classwork",
    category: EVENT_CATEGORIES.ACADEMIC,
    term: "Odd Semester",
    startDate: "2026-07-17",
    endDate: "2026-07-17",
    description: "Classwork commencement for II Year Regular Semester."
  },
  {
    id: "y25sem_odd_insem1",
    title: "Semester In-Semester 1 Examinations",
    category: EVENT_CATEGORIES.EXAM,
    term: "Odd Semester",
    startDate: "2026-08-20",
    endDate: "2026-08-22",
    description: "In-Semester 1 Examinations."
  },
  {
    id: "y25sem_odd_recheck1",
    title: "Last date to request recheck for Semester In-1 examinations",
    category: EVENT_CATEGORIES.DEADLINE,
    term: "Odd Semester",
    startDate: "2026-08-27",
    endDate: "2026-08-27",
    description: "Recheck request submission deadline."
  },
  {
    id: "y25sem_odd_insem2",
    title: "Semester In-Semester 2 Examinations",
    category: EVENT_CATEGORIES.EXAM,
    term: "Odd Semester",
    startDate: "2026-09-28",
    endDate: "2026-09-30",
    description: "In-Semester 2 Examinations."
  },
  {
    id: "y25sem_odd_recheck2",
    title: "Last date to request recheck for Semester In-2 examinations",
    category: EVENT_CATEGORIES.DEADLINE,
    term: "Odd Semester",
    startDate: "2026-10-07",
    endDate: "2026-10-07",
    description: "In-Semester 2 paper verification deadline."
  },
  {
    id: "y25sem_odd_lab_insem",
    title: "Lab In-Semester Examinations",
    category: EVENT_CATEGORIES.EXAM,
    term: "Odd Semester",
    startDate: "2026-10-12",
    endDate: "2026-10-17",
    description: "Practical Laboratory In-Semester evaluations."
  },
  {
    id: "y25sem_odd_immersion",
    title: "Techno-Management Immersion Week",
    category: EVENT_CATEGORIES.ACADEMIC,
    term: "Odd Semester",
    startDate: "2026-10-30",
    endDate: "2026-10-31",
    description: "Techno-Management exhibits, technical challenges, and workshops."
  },
  {
    id: "y25sem_odd_fee_deadline",
    title: "Last date to pay end-exam fee",
    category: EVENT_CATEGORIES.DEADLINE,
    term: "Odd Semester",
    startDate: "2026-10-31",
    endDate: "2026-10-31",
    description: "End-examination fee payment portal closes."
  },
  {
    id: "y25sem_odd_last_inst",
    title: "Last instructional day",
    category: EVENT_CATEGORIES.DEADLINE,
    term: "Odd Semester",
    startDate: "2026-11-12",
    endDate: "2026-11-12",
    description: "Last day of formal class instruction for Odd Semester."
  },
  {
    id: "y25sem_odd_detention",
    title: "Declaration of detention list",
    category: EVENT_CATEGORIES.DEADLINE,
    term: "Odd Semester",
    startDate: "2026-11-13",
    endDate: "2026-11-13",
    description: "Detention list announcement."
  },
  {
    id: "y25sem_odd_end_exams",
    title: "Semester-End Theory and Lab Examinations",
    category: EVENT_CATEGORIES.EXAM,
    term: "Odd Semester",
    startDate: "2026-11-16",
    endDate: "2026-11-29",
    description: "Odd Semester-End Theory and Practical Examinations."
  },

  // Even Semester
  {
    id: "y25sem_even_orient",
    title: "Even Semester Orientation and Registrations",
    category: EVENT_CATEGORIES.ACADEMIC,
    term: "Even Semester",
    startDate: "2026-11-30",
    endDate: "2026-12-05",
    description: "Even Semester registration and orientation window."
  },
  {
    id: "y25sem_even_commence",
    title: "Commencement of Classwork",
    category: EVENT_CATEGORIES.ACADEMIC,
    term: "Even Semester",
    startDate: "2026-12-22",
    endDate: "2026-12-22",
    description: "Commencement of Even Semester classwork."
  },
  {
    id: "y25sem_even_insem1",
    title: "Semester In-Semester 1 Examinations",
    category: EVENT_CATEGORIES.EXAM,
    term: "Even Semester",
    startDate: "2027-02-01",
    endDate: "2027-02-03",
    description: "Even Semester In-1 Examinations."
  },
  {
    id: "y25sem_even_recheck1",
    title: "Last date to request recheck for Semester In-1 examinations",
    category: EVENT_CATEGORIES.DEADLINE,
    term: "Even Semester",
    startDate: "2027-02-10",
    endDate: "2027-02-10",
    description: "In-1 recheck request deadline."
  },
  {
    id: "y25sem_even_insem2",
    title: "Semester In-Semester 2 Examinations",
    category: EVENT_CATEGORIES.EXAM,
    term: "Even Semester",
    startDate: "2027-03-11",
    endDate: "2027-03-13",
    description: "In-Semester 2 Theory examinations."
  },
  {
    id: "y25sem_even_cultural",
    title: "Cultural Immersion Week",
    category: EVENT_CATEGORIES.ACADEMIC,
    term: "Even Semester",
    startDate: "2027-03-12",
    endDate: "2027-03-13",
    description: "Campus cultural events, clubs, and artistic showcases."
  },
  {
    id: "y25sem_even_recheck2",
    title: "Last date to request recheck for Semester In-2 examinations",
    category: EVENT_CATEGORIES.DEADLINE,
    term: "Even Semester",
    startDate: "2027-03-18",
    endDate: "2027-03-18",
    description: "In-2 recheck submission deadline."
  },
  {
    id: "y25sem_even_lab_insem",
    title: "Lab In-Semester Examinations",
    category: EVENT_CATEGORIES.EXAM,
    term: "Even Semester",
    startDate: "2027-03-22",
    endDate: "2027-03-27",
    description: "Lab continuous assessment exams."
  },
  {
    id: "y25sem_even_fee_deadline",
    title: "Last date to pay end-exam fee",
    category: EVENT_CATEGORIES.DEADLINE,
    term: "Even Semester",
    startDate: "2027-03-27",
    endDate: "2027-03-27",
    description: "End-exam fee deadline for II Year Regular Semester."
  },
  {
    id: "y25sem_even_last_inst",
    title: "Last instructional day",
    category: EVENT_CATEGORIES.DEADLINE,
    term: "Even Semester",
    startDate: "2027-04-14",
    endDate: "2027-04-14",
    description: "Final instructional day for Even Semester."
  },
  {
    id: "y25sem_even_detention",
    title: "Declaration of detention list",
    category: EVENT_CATEGORIES.DEADLINE,
    term: "Even Semester",
    startDate: "2027-04-15",
    endDate: "2027-04-15",
    description: "Publication of detention list."
  },
  {
    id: "y25sem_even_end_exams",
    title: "Semester-End Theory and Lab Examinations",
    category: EVENT_CATEGORIES.EXAM,
    term: "Even Semester",
    startDate: "2027-04-12",
    endDate: "2027-04-25",
    description: "Semester-End Theory & Practical Examinations."
  },

  // Summer Term (II Year Regular)
  {
    id: "y25sem_summer_intern_4w",
    title: "Four-Week Summer Technical Internship",
    category: EVENT_CATEGORIES.INTERNSHIP,
    term: "Summer Term",
    startDate: "2027-05-02",
    endDate: "2027-05-29",
    description: "Four-week technical skill immersion internship."
  },
  {
    id: "y25sem_summer_intern_8w",
    title: "Eight-Week Summer Internship",
    category: EVENT_CATEGORIES.INTERNSHIP,
    term: "Summer Term",
    startDate: "2027-05-02",
    endDate: "2027-06-26",
    description: "Eight-week comprehensive summer industry internship."
  },
  {
    id: "y25sem_summer_orient",
    title: "Summer Term Orientation and Registrations",
    category: EVENT_CATEGORIES.ACADEMIC,
    term: "Summer Term",
    startDate: "2027-05-28",
    endDate: "2027-05-29",
    description: "Summer term course enrollments."
  },
  {
    id: "y25sem_summer_insem1",
    title: "Semester In-Semester 1 Examinations",
    category: EVENT_CATEGORIES.EXAM,
    term: "Summer Term",
    startDate: "2027-06-14",
    endDate: "2027-06-15",
    description: "Summer In-1 Examinations."
  },
  {
    id: "y25sem_summer_lab_insem",
    title: "Lab In-Semester Examinations",
    category: EVENT_CATEGORIES.EXAM,
    term: "Summer Term",
    startDate: "2027-06-18",
    endDate: "2027-06-19",
    description: "Summer term lab evaluations."
  },
  {
    id: "y25sem_summer_last_inst",
    title: "Summer Term Last Instructional Day",
    category: EVENT_CATEGORIES.DEADLINE,
    term: "Summer Term",
    startDate: "2027-07-03",
    endDate: "2027-07-03",
    description: "Summer term instruction ends."
  },
  {
    id: "y25sem_summer_insem2",
    title: "Semester In-Semester 2 Examinations",
    category: EVENT_CATEGORIES.EXAM,
    term: "Summer Term",
    startDate: "2027-07-05",
    endDate: "2027-07-10",
    description: "Summer In-2 Examinations."
  },
  {
    id: "y25sem_summer_end_exams",
    title: "Semester-End Theory and Lab Examinations",
    category: EVENT_CATEGORIES.EXAM,
    term: "Summer Term",
    startDate: "2027-07-08",
    endDate: "2027-07-10",
    description: "Summer End Theory and Practical Examinations."
  }
];

// C. II Year B.Tech Trimester Program (PBL)
const EVENTS_Y25_TRIMESTER = [
  // Trimester 4
  {
    id: "y25tri_t4_orient",
    title: "T4 Orientation and Registrations",
    category: EVENT_CATEGORIES.ACADEMIC,
    term: "Trimester 4",
    startDate: "2026-07-13",
    endDate: "2026-07-18",
    description: "Trimester 4 orientation and PBL project/course registration."
  },
  {
    id: "y25tri_t4_commence",
    title: "Commencement of Classwork",
    category: EVENT_CATEGORIES.ACADEMIC,
    term: "Trimester 4",
    startDate: "2026-07-23",
    endDate: "2026-07-23",
    description: "Classwork commencement for Trimester 4."
  },
  {
    id: "y25tri_t4_midterm",
    title: "Mid-Term Exams Along with Classwork",
    category: EVENT_CATEGORIES.EXAM,
    term: "Trimester 4",
    startDate: "2026-09-04",
    endDate: "2026-09-08",
    description: "Mid-Term evaluations conducted alongside regular instruction."
  },
  {
    id: "y25tri_t4_recheck",
    title: "Last date to request recheck for Mid-Term Exams",
    category: EVENT_CATEGORIES.DEADLINE,
    term: "Trimester 4",
    startDate: "2026-09-12",
    endDate: "2026-09-12",
    description: "Mid-Term paper verification and recheck request deadline."
  },
  {
    id: "y25tri_t4_fee",
    title: "Last date to pay end-exam fee",
    category: EVENT_CATEGORIES.DEADLINE,
    term: "Trimester 4",
    startDate: "2026-09-26",
    endDate: "2026-09-26",
    description: "Examination fee payment portal deadline."
  },
  {
    id: "y25tri_t4_lab",
    title: "Lab Exams Along with Classwork",
    category: EVENT_CATEGORIES.EXAM,
    term: "Trimester 4",
    startDate: "2026-10-12",
    endDate: "2026-10-17",
    description: "Laboratory and project evaluations conducted alongside classwork."
  },
  {
    id: "y25tri_t4_last_inst",
    title: "Last instructional day",
    category: EVENT_CATEGORIES.DEADLINE,
    term: "Trimester 4",
    startDate: "2026-10-15",
    endDate: "2026-10-15",
    description: "Final day of class instruction for Trimester 4."
  },
  {
    id: "y25tri_t4_detention",
    title: "Declaration of detention list",
    category: EVENT_CATEGORIES.DEADLINE,
    term: "Trimester 4",
    startDate: "2026-10-16",
    endDate: "2026-10-16",
    description: "Attendance detention list announcement."
  },
  {
    id: "y25tri_t4_immersion",
    title: "Techno-Management Immersion Week",
    category: EVENT_CATEGORIES.ACADEMIC,
    term: "Trimester 4",
    startDate: "2026-10-30",
    endDate: "2026-10-31",
    description: "Immersion week exhibits and competitions."
  },
  {
    id: "y25tri_t4_end_exams",
    title: "Semester-End Theory Exams and Hackathon",
    category: EVENT_CATEGORIES.EXAM,
    term: "Trimester 4",
    startDate: "2026-10-26",
    endDate: "2026-11-01",
    description: "Comprehensive Trimester-End Theory Exams and PBL Hackathon."
  },

  // Trimester 5
  {
    id: "y25tri_t5_orient",
    title: "T5 Orientation and Registrations",
    category: EVENT_CATEGORIES.ACADEMIC,
    term: "Trimester 5",
    startDate: "2026-10-05",
    endDate: "2026-10-07",
    description: "Trimester 5 orientation and registration period."
  },
  {
    id: "y25tri_t5_commence",
    title: "Commencement of Classwork",
    category: EVENT_CATEGORIES.ACADEMIC,
    term: "Trimester 5",
    startDate: "2026-11-04",
    endDate: "2026-11-04",
    description: "Classwork commences for Trimester 5."
  },
  {
    id: "y25tri_t5_midterm",
    title: "Mid-Term Exams Along with Classwork",
    category: EVENT_CATEGORIES.EXAM,
    term: "Trimester 5",
    startDate: "2026-12-14",
    endDate: "2026-12-19",
    description: "Trimester 5 Mid-Term examinations."
  },
  {
    id: "y25tri_t5_recheck",
    title: "Last date to request recheck for Mid-Term Exams",
    category: EVENT_CATEGORIES.DEADLINE,
    term: "Trimester 5",
    startDate: "2026-12-24",
    endDate: "2026-12-24",
    description: "Mid-Term paper recheck request deadline."
  },
  {
    id: "y25tri_t5_fee",
    title: "Last date to pay end-exam fee",
    category: EVENT_CATEGORIES.DEADLINE,
    term: "Trimester 5",
    startDate: "2027-01-09",
    endDate: "2027-01-09",
    description: "Portal deadline for end-exam fees."
  },
  {
    id: "y25tri_t5_lab",
    title: "Lab Exams",
    category: EVENT_CATEGORIES.EXAM,
    term: "Trimester 5",
    startDate: "2027-01-18",
    endDate: "2027-01-23",
    description: "Trimester 5 practical and laboratory examinations."
  },
  {
    id: "y25tri_t5_last_inst",
    title: "Last instructional day",
    category: EVENT_CATEGORIES.DEADLINE,
    term: "Trimester 5",
    startDate: "2027-01-28",
    endDate: "2027-01-28",
    description: "Instructional classes conclude for Trimester 5."
  },
  {
    id: "y25tri_t5_detention",
    title: "Declaration of detention list",
    category: EVENT_CATEGORIES.DEADLINE,
    term: "Trimester 5",
    startDate: "2027-01-29",
    endDate: "2027-01-29",
    description: "Detention list announcement."
  },
  {
    id: "y25tri_t5_end_exams",
    title: "Semester-End Theory Exams and Hackathon",
    category: EVENT_CATEGORIES.EXAM,
    term: "Trimester 5",
    startDate: "2027-02-01",
    endDate: "2027-02-07",
    description: "End Theory Examinations and continuous PBL Hackathon."
  },

  // Trimester 6
  {
    id: "y25tri_t6_orient",
    title: "T6 Orientation and Registrations",
    category: EVENT_CATEGORIES.ACADEMIC,
    term: "Trimester 6",
    startDate: "2027-01-25",
    endDate: "2027-01-27",
    description: "Trimester 6 orientation and registrations."
  },
  {
    id: "y25tri_t6_commence",
    title: "Commencement of Classwork",
    category: EVENT_CATEGORIES.ACADEMIC,
    term: "Trimester 6",
    startDate: "2027-02-09",
    endDate: "2027-02-09",
    description: "Classwork commences for Trimester 6."
  },
  {
    id: "y25tri_t6_cultural",
    title: "Cultural Immersion Week",
    category: EVENT_CATEGORIES.ACADEMIC,
    term: "Trimester 6",
    startDate: "2027-03-12",
    endDate: "2027-03-13",
    description: "Cultural immersion week events."
  },
  {
    id: "y25tri_t6_midterm",
    title: "Mid-Term Exams Along with Classwork",
    category: EVENT_CATEGORIES.EXAM,
    term: "Trimester 6",
    startDate: "2027-03-22",
    endDate: "2027-03-27",
    description: "Trimester 6 Mid-Term examinations."
  },
  {
    id: "y25tri_t6_recheck",
    title: "Last date to request recheck for Mid-Term Exams",
    category: EVENT_CATEGORIES.DEADLINE,
    term: "Trimester 6",
    startDate: "2027-03-31",
    endDate: "2027-03-31",
    description: "Mid-Term recheck request deadline."
  },
  {
    id: "y25tri_t6_fee",
    title: "Last date to pay end-exam fee",
    category: EVENT_CATEGORIES.DEADLINE,
    term: "Trimester 6",
    startDate: "2027-04-10",
    endDate: "2027-04-10",
    description: "End examination fee payment deadline."
  },
  {
    id: "y25tri_t6_lab",
    title: "Lab Exams Along with Classwork",
    category: EVENT_CATEGORIES.EXAM,
    term: "Trimester 6",
    startDate: "2027-04-19",
    endDate: "2027-04-24",
    description: "Laboratory practical evaluations."
  },
  {
    id: "y25tri_t6_last_inst",
    title: "Last instructional day",
    category: EVENT_CATEGORIES.DEADLINE,
    term: "Trimester 6",
    startDate: "2027-04-29",
    endDate: "2027-04-29",
    description: "Last day of classes for Trimester 6."
  },
  {
    id: "y25tri_t6_detention",
    title: "Declaration of detention list",
    category: EVENT_CATEGORIES.DEADLINE,
    term: "Trimester 6",
    startDate: "2027-04-30",
    endDate: "2027-04-30",
    description: "Declaration of attendance detention list."
  },
  {
    id: "y25tri_t6_end_exams",
    title: "Semester-End Theory Exams and Hackathon",
    category: EVENT_CATEGORIES.EXAM,
    term: "Trimester 6",
    startDate: "2027-05-02",
    endDate: "2027-05-09",
    description: "Comprehensive Theory Examinations and PBL Capstone Hackathon."
  },

  // Summer Term (II Year PBL)
  {
    id: "y25tri_summer_intern_3w",
    title: "Three-Week Summer Technical Internship",
    category: EVENT_CATEGORIES.INTERNSHIP,
    term: "Summer Term",
    startDate: "2027-05-10",
    endDate: "2027-05-29",
    description: "Three-week intensive project internship."
  },
  {
    id: "y25tri_summer_intern_8w",
    title: "Eight-Week Summer Internship",
    category: EVENT_CATEGORIES.INTERNSHIP,
    term: "Summer Term",
    startDate: "2027-05-10",
    endDate: "2027-07-03",
    description: "Eight-week corporate/industrial internship."
  },
  {
    id: "y25tri_summer_orient",
    title: "Summer Term Orientation and Registrations",
    category: EVENT_CATEGORIES.ACADEMIC,
    term: "Summer Term",
    startDate: "2027-05-28",
    endDate: "2027-05-29",
    description: "Registration for Summer Term coursework."
  },
  {
    id: "y25tri_summer_commence",
    title: "Commencement of Summer Term Classwork",
    category: EVENT_CATEGORIES.ACADEMIC,
    term: "Summer Term",
    startDate: "2027-05-31",
    endDate: "2027-05-31",
    description: "Summer term instruction begins."
  },
  {
    id: "y25tri_summer_midterm",
    title: "Mid-Term Exams Along with Classwork",
    category: EVENT_CATEGORIES.EXAM,
    term: "Summer Term",
    startDate: "2027-06-18",
    endDate: "2027-06-19",
    description: "Summer Mid-Term examinations."
  },
  {
    id: "y25tri_summer_lab",
    title: "Lab In-Semester Exams Along with Classwork",
    category: EVENT_CATEGORIES.EXAM,
    term: "Summer Term",
    startDate: "2027-06-29",
    endDate: "2027-06-30",
    description: "Summer Lab In-Semester practical exams."
  },
  {
    id: "y25tri_summer_next_reg",
    title: "2027-2028 Odd Semester Registrations",
    category: EVENT_CATEGORIES.ACADEMIC,
    term: "Summer Term",
    startDate: "2027-06-28",
    endDate: "2027-07-03",
    description: "Registration for the upcoming 2027-2028 Academic Year."
  },
  {
    id: "y25tri_summer_last_inst",
    title: "Last instructional day",
    category: EVENT_CATEGORIES.DEADLINE,
    term: "Summer Term",
    startDate: "2027-07-07",
    endDate: "2027-07-07",
    description: "Summer instruction concludes."
  },
  {
    id: "y25tri_summer_end_exams",
    title: "Semester-End Theory Exams and Hackathon",
    category: EVENT_CATEGORIES.EXAM,
    term: "Summer Term",
    startDate: "2027-07-08",
    endDate: "2027-07-11",
    description: "Summer End Theory Examinations and Hackathon."
  },
  {
    id: "y25tri_next_year_commence",
    title: "2027-2028 Academic Year Commencement",
    category: EVENT_CATEGORIES.ACADEMIC,
    term: "Summer Term",
    startDate: "2027-07-13",
    endDate: "2027-07-13",
    description: "Official start of the 2027-2028 Academic Year."
  }
];

// D. I Year B.Tech Trimester Program (PBL)
const EVENTS_Y26_TRIMESTER = [
  // Trimester 1
  {
    id: "y26tri_t1_orient",
    title: "T1 Orientation",
    category: EVENT_CATEGORIES.ACADEMIC,
    term: "Trimester 1",
    startDate: "2026-07-09",
    endDate: "2026-07-09",
    description: "First Year engineering orientation ceremony."
  },
  {
    id: "y26tri_t1_induction",
    title: "Induction Programme",
    category: EVENT_CATEGORIES.ACADEMIC,
    term: "Trimester 1",
    startDate: "2026-07-10",
    endDate: "2026-08-01",
    description: "Comprehensive student induction, campus familiarization, and foundation courses."
  },
  {
    id: "y26tri_t1_reg",
    title: "T1 Registrations",
    category: EVENT_CATEGORIES.ACADEMIC,
    term: "Trimester 1",
    startDate: "2026-07-27",
    endDate: "2026-08-01",
    description: "Trimester 1 course and lab registration."
  },
  {
    id: "y26tri_t1_commence",
    title: "Commencement of Classwork",
    category: EVENT_CATEGORIES.ACADEMIC,
    term: "Trimester 1",
    startDate: "2026-08-03",
    endDate: "2026-08-03",
    description: "First year engineering classwork begins."
  },
  {
    id: "y26tri_t1_midterm",
    title: "Mid-Term Exams Along with Classwork",
    category: EVENT_CATEGORIES.EXAM,
    term: "Trimester 1",
    startDate: "2026-09-14",
    endDate: "2026-09-19",
    description: "Mid-Term evaluations conducted along with classwork."
  },
  {
    id: "y26tri_t1_recheck",
    title: "Last date to request recheck for Mid-Term Exams",
    category: EVENT_CATEGORIES.DEADLINE,
    term: "Trimester 1",
    startDate: "2026-09-24",
    endDate: "2026-09-24",
    description: "Mid-Term recheck application deadline."
  },
  {
    id: "y26tri_t1_fee",
    title: "Last date to pay end-exam fee",
    category: EVENT_CATEGORIES.DEADLINE,
    term: "Trimester 1",
    startDate: "2026-10-03",
    endDate: "2026-10-03",
    description: "End examination fee payment deadline."
  },
  {
    id: "y26tri_t1_lab",
    title: "Term-End Lab Exams Along with Classwork",
    category: EVENT_CATEGORIES.EXAM,
    term: "Trimester 1",
    startDate: "2026-10-05",
    endDate: "2026-10-10",
    description: "Laboratory practical evaluations."
  },
  {
    id: "y26tri_t1_last_inst",
    title: "Last instructional day",
    category: EVENT_CATEGORIES.DEADLINE,
    term: "Trimester 1",
    startDate: "2026-10-14",
    endDate: "2026-10-14",
    description: "Instruction for Trimester 1 ends."
  },
  {
    id: "y26tri_t1_detention",
    title: "Declaration of detention list",
    category: EVENT_CATEGORIES.DEADLINE,
    term: "Trimester 1",
    startDate: "2026-10-16",
    endDate: "2026-10-16",
    description: "Detention list announcement."
  },
  {
    id: "y26tri_t1_immersion",
    title: "Techno-Management Immersion Week",
    category: EVENT_CATEGORIES.ACADEMIC,
    term: "Trimester 1",
    startDate: "2026-10-30",
    endDate: "2026-10-31",
    description: "Techno-Management immersion workshops."
  },
  {
    id: "y26tri_t1_end_exams",
    title: "Semester-End Theory Exams and Hackathon",
    category: EVENT_CATEGORIES.EXAM,
    term: "Trimester 1",
    startDate: "2026-10-26",
    endDate: "2026-11-01",
    description: "Comprehensive Term-End Theory Exams and 24-hr PBL Hackathon."
  },

  // Trimester 2
  {
    id: "y26tri_t2_orient",
    title: "T2 Orientation and Registrations",
    category: EVENT_CATEGORIES.ACADEMIC,
    term: "Trimester 2",
    startDate: "2026-10-12",
    endDate: "2026-10-14",
    description: "Trimester 2 orientation and course selection."
  },
  {
    id: "y26tri_t2_commence",
    title: "Commencement of Classwork",
    category: EVENT_CATEGORIES.ACADEMIC,
    term: "Trimester 2",
    startDate: "2026-11-04",
    endDate: "2026-11-04",
    description: "Instruction commences for Trimester 2."
  },
  {
    id: "y26tri_t2_midterm",
    title: "Mid-Term Exams Along with Classwork",
    category: EVENT_CATEGORIES.EXAM,
    term: "Trimester 2",
    startDate: "2026-12-17",
    endDate: "2026-12-23",
    description: "Trimester 2 Mid-Term continuous exams."
  },
  {
    id: "y26tri_t2_recheck",
    title: "Last date to request recheck for Mid-Term Exams",
    category: EVENT_CATEGORIES.DEADLINE,
    term: "Trimester 2",
    startDate: "2026-12-26",
    endDate: "2026-12-26",
    description: "Mid-Term paper recheck submission deadline."
  },
  {
    id: "y26tri_t2_fee",
    title: "Last date to pay end-exam fee",
    category: EVENT_CATEGORIES.DEADLINE,
    term: "Trimester 2",
    startDate: "2027-01-09",
    endDate: "2027-01-09",
    description: "End examination fee payment deadline."
  },
  {
    id: "y26tri_t2_lab",
    title: "Term-End Lab Exams Along with Classwork",
    category: EVENT_CATEGORIES.EXAM,
    term: "Trimester 2",
    startDate: "2027-01-18",
    endDate: "2027-01-23",
    description: "Practical laboratory term-end evaluations."
  },
  {
    id: "y26tri_t2_last_inst",
    title: "Last instructional day",
    category: EVENT_CATEGORIES.DEADLINE,
    term: "Trimester 2",
    startDate: "2027-01-27",
    endDate: "2027-01-27",
    description: "Instruction concludes for Trimester 2."
  },
  {
    id: "y26tri_t2_detention",
    title: "Declaration of detention list",
    category: EVENT_CATEGORIES.DEADLINE,
    term: "Trimester 2",
    startDate: "2027-01-29",
    endDate: "2027-01-29",
    description: "Publication of attendance detention list."
  },
  {
    id: "y26tri_t2_end_exams",
    title: "Semester-End Theory Exams and Hackathon",
    category: EVENT_CATEGORIES.EXAM,
    term: "Trimester 2",
    startDate: "2027-02-01",
    endDate: "2027-02-07",
    description: "Trimester 2 Theory Examinations and Hackathon."
  },

  // Trimester 3
  {
    id: "y26tri_t3_orient",
    title: "T3 Orientation and Registrations",
    category: EVENT_CATEGORIES.ACADEMIC,
    term: "Trimester 3",
    startDate: "2027-01-21",
    endDate: "2027-01-22",
    description: "Trimester 3 orientation and registrations."
  },
  {
    id: "y26tri_t3_commence",
    title: "Commencement of Classwork",
    category: EVENT_CATEGORIES.ACADEMIC,
    term: "Trimester 3",
    startDate: "2027-02-09",
    endDate: "2027-02-09",
    description: "Trimester 3 classwork begins."
  },
  {
    id: "y26tri_t3_cultural",
    title: "Cultural Immersion Week",
    category: EVENT_CATEGORIES.ACADEMIC,
    term: "Trimester 3",
    startDate: "2027-03-12",
    endDate: "2027-03-13",
    description: "Cultural immersion week activities."
  },
  {
    id: "y26tri_t3_midterm",
    title: "Mid-Term Exams Along with Classwork",
    category: EVENT_CATEGORIES.EXAM,
    term: "Trimester 3",
    startDate: "2027-03-22",
    endDate: "2027-03-27",
    description: "Mid-Term evaluations along with classes."
  },
  {
    id: "y26tri_t3_recheck",
    title: "Last date to request recheck for Mid-Term Exams",
    category: EVENT_CATEGORIES.DEADLINE,
    term: "Trimester 3",
    startDate: "2027-03-31",
    endDate: "2027-03-31",
    description: "Mid-Term recheck application deadline."
  },
  {
    id: "y26tri_t3_fee",
    title: "Last date to pay end-exam fee",
    category: EVENT_CATEGORIES.DEADLINE,
    term: "Trimester 3",
    startDate: "2027-04-10",
    endDate: "2027-04-10",
    description: "End examination fee payment deadline."
  },
  {
    id: "y26tri_t3_lab",
    title: "Term-End Lab Exams Along with Classwork",
    category: EVENT_CATEGORIES.EXAM,
    term: "Trimester 3",
    startDate: "2027-04-19",
    endDate: "2027-04-24",
    description: "Laboratory continuous practical exams."
  },
  {
    id: "y26tri_t3_last_inst",
    title: "Last instructional day",
    category: EVENT_CATEGORIES.DEADLINE,
    term: "Trimester 3",
    startDate: "2027-04-28",
    endDate: "2027-04-28",
    description: "Trimester 3 instruction ends."
  },
  {
    id: "y26tri_t3_detention",
    title: "Declaration of detention list",
    category: EVENT_CATEGORIES.DEADLINE,
    term: "Trimester 3",
    startDate: "2027-04-30",
    endDate: "2027-04-30",
    description: "Detention list publication."
  },
  {
    id: "y26tri_t3_end_exams",
    title: "Semester-End Theory Exams and Hackathon",
    category: EVENT_CATEGORIES.EXAM,
    term: "Trimester 3",
    startDate: "2027-05-03",
    endDate: "2027-05-09",
    description: "Trimester-End Theory Examinations and Hackathon."
  },

  // Summer Term (I Year PBL)
  {
    id: "y26tri_summer_intern_4w",
    title: "Four-Week Summer Social Internship",
    category: EVENT_CATEGORIES.INTERNSHIP,
    term: "Summer Term",
    startDate: "2027-05-10",
    endDate: "2027-06-05",
    description: "Four-week Community Social Internship (compulsory field project)."
  },
  {
    id: "y26tri_summer_intern_8w",
    title: "Eight-Week Summer Internship",
    category: EVENT_CATEGORIES.INTERNSHIP,
    term: "Summer Term",
    startDate: "2027-05-10",
    endDate: "2027-07-03",
    description: "Eight-week technical/social summer internship."
  },
  {
    id: "y26tri_summer_orient",
    title: "Summer Term Orientation and Registrations",
    category: EVENT_CATEGORIES.ACADEMIC,
    term: "Summer Term",
    startDate: "2027-05-28",
    endDate: "2027-05-29",
    description: "Summer Term course registration."
  },
  {
    id: "y26tri_summer_commence",
    title: "Commencement of Summer Term Classwork",
    category: EVENT_CATEGORIES.ACADEMIC,
    term: "Summer Term",
    startDate: "2027-05-31",
    endDate: "2027-05-31",
    description: "Summer Term instruction begins."
  },
  {
    id: "y26tri_summer_midterm",
    title: "Mid-Term Exams Along with Classwork",
    category: EVENT_CATEGORIES.EXAM,
    term: "Summer Term",
    startDate: "2027-06-18",
    endDate: "2027-06-19",
    description: "Summer Mid-Term examinations."
  },
  {
    id: "y26tri_summer_lab",
    title: "Term-End Lab Exams",
    category: EVENT_CATEGORIES.EXAM,
    term: "Summer Term",
    startDate: "2027-06-29",
    endDate: "2027-06-30",
    description: "Summer Term-End practical evaluations."
  },
  {
    id: "y26tri_summer_next_reg",
    title: "2027-2028 Odd Semester Registrations",
    category: EVENT_CATEGORIES.ACADEMIC,
    term: "Summer Term",
    startDate: "2027-06-28",
    endDate: "2027-07-03",
    description: "Registrations for next academic year."
  },
  {
    id: "y26tri_summer_last_inst",
    title: "Last instructional day",
    category: EVENT_CATEGORIES.DEADLINE,
    term: "Summer Term",
    startDate: "2027-07-07",
    endDate: "2027-07-07",
    description: "Summer term last instructional day."
  },
  {
    id: "y26tri_summer_end_exams",
    title: "Semester-End Theory Exams and Hackathon",
    category: EVENT_CATEGORIES.EXAM,
    term: "Summer Term",
    startDate: "2027-07-08",
    endDate: "2027-07-11",
    description: "Summer End Theory Exams and Hackathon."
  },
  {
    id: "y26tri_next_year_commence",
    title: "2027-2028 Academic Year Commencement",
    category: EVENT_CATEGORIES.ACADEMIC,
    term: "Summer Term",
    startDate: "2027-07-13",
    endDate: "2027-07-13",
    description: "Academic year 2027-2028 commencement."
  }
];

export const PROGRAM_EVENT_MAP = {
  [PROGRAM_KEYS.Y26_TRIMESTER]: EVENTS_Y26_TRIMESTER,
  [PROGRAM_KEYS.Y25_SEMESTER]: EVENTS_Y25_SEMESTER,
  [PROGRAM_KEYS.Y25_TRIMESTER]: EVENTS_Y25_TRIMESTER,
  [PROGRAM_KEYS.Y24_SEMESTER]: EVENTS_Y23_Y24,
  [PROGRAM_KEYS.Y23_SEMESTER]: EVENTS_Y23_Y24
};

/**
 * Format a Date or date string to readable "DD MMM YYYY"
 * Example: "2026-10-21" -> "21 Oct 2026"
 */
export function formatDDMMMYYYY(dateInput) {
  if (!dateInput) return "";
  let dateObj;
  if (typeof dateInput === "string") {
    // If format is YYYY-MM-DD
    const parts = dateInput.slice(0, 10).split("-");
    if (parts.length === 3) {
      dateObj = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
    } else {
      dateObj = new Date(dateInput);
    }
  } else {
    dateObj = dateInput;
  }
  if (isNaN(dateObj.getTime())) return String(dateInput);

  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const day = String(dateObj.getDate()).padStart(2, "0");
  const month = months[dateObj.getMonth()];
  const year = dateObj.getFullYear();
  return `${day} ${month} ${year}`;
}

/**
 * Format a date range into standard readable string
 */
export function formatDateRange(startDate, endDate) {
  if (!startDate) return "";
  if (!endDate || startDate === endDate) {
    return formatDDMMMYYYY(startDate);
  }
  return `${formatDDMMMYYYY(startDate)} - ${formatDDMMMYYYY(endDate)}`;
}

/**
 * Get status of an event relative to a reference date: 'upcoming' | 'ongoing' | 'completed'
 */
export function getEventStatus(startDate, endDate, refDate = new Date()) {
  const refKey = typeof refDate === "string" ? refDate.slice(0, 10) : refDate.toISOString().slice(0, 10);
  const startKey = (startDate || "").slice(0, 10);
  const endKey = (endDate || startDate || "").slice(0, 10);

  if (endKey < refKey) return "completed";
  if (startKey <= refKey && endKey >= refKey) return "ongoing";
  return "upcoming";
}

/**
 * Retrieve the full list of events for a given program, including official holidays
 */
export function getProgramEvents(programKey) {
  const specificEvents = PROGRAM_EVENT_MAP[programKey] || PROGRAM_EVENT_MAP[PROGRAM_KEYS.Y25_SEMESTER];
  // Add program-level metadata to each event
  const enrichedSpecific = specificEvents.map(e => ({
    ...e,
    isHoliday: false,
    displayDates: formatDateRange(e.startDate, e.endDate)
  }));

  // Map official holidays into the event collection with program reference
  const holidays = OFFICIAL_HOLIDAYS.map(h => ({
    ...h,
    isHoliday: true,
    term: "Official Holiday",
    displayDates: formatDateRange(h.startDate, h.endDate)
  }));

  // Combine and sort chronologically by startDate
  return [...enrichedSpecific, ...holidays].sort((a, b) => a.startDate.localeCompare(b.startDate));
}

/**
 * Auto-detect student's default program from ERP credentials / ID
 */
export function detectStudentProgram(erpId, fallback = PROGRAM_KEYS.Y25_SEMESTER) {
  if (!erpId) return fallback;
  const strId = String(erpId).trim();

  // Pattern detection:
  // e.g. 26... -> Y26 (1st year Trimester PBL)
  // e.g. 25... -> Y25 (2nd year Regular semester by default)
  // e.g. 24... -> Y24 (3rd year)
  // e.g. 23... -> Y23 (4th year)
  if (strId.startsWith("26")) return PROGRAM_KEYS.Y26_TRIMESTER;
  if (strId.startsWith("25")) return PROGRAM_KEYS.Y25_SEMESTER;
  if (strId.startsWith("24")) return PROGRAM_KEYS.Y24_SEMESTER;
  if (strId.startsWith("23")) return PROGRAM_KEYS.Y23_SEMESTER;

  return fallback;
}

/**
 * Determine the current active term for a program based on current date
 */
export function getCurrentTerm(programKey, refDate = new Date()) {
  const refKey = typeof refDate === "string" ? refDate.slice(0, 10) : refDate.toISOString().slice(0, 10);
  const events = PROGRAM_EVENT_MAP[programKey] || [];

  // Group events by term to find active date ranges
  const termRanges = {};
  events.forEach(e => {
    if (!e.term || e.term === "Official Holiday") return;
    if (!termRanges[e.term]) {
      termRanges[e.term] = { min: e.startDate, max: e.endDate };
    } else {
      if (e.startDate < termRanges[e.term].min) termRanges[e.term].min = e.startDate;
      if (e.endDate > termRanges[e.term].max) termRanges[e.term].max = e.endDate;
    }
  });

  for (const [term, range] of Object.entries(termRanges)) {
    if (refKey >= range.min && refKey <= range.max) {
      return term;
    }
  }

  // If before first term
  const sortedTerms = Object.keys(termRanges).sort((a, b) => termRanges[a].min.localeCompare(termRanges[b].min));
  if (sortedTerms.length > 0) {
    if (refKey < termRanges[sortedTerms[0]].min) return sortedTerms[0];
    return sortedTerms[sortedTerms.length - 1];
  }

  return "Academic Year 2026-2027";
}

/**
 * Calculate dashboard summary cards:
 * - Next Examination
 * - Upcoming Official Holiday
 * - Upcoming Deadline
 * - Next Academic Event
 * - Upcoming Internships
 * - Completed Events Count
 */
export function calculateDashboardStats(programKey, refDate = new Date()) {
  const refKey = typeof refDate === "string" ? refDate.slice(0, 10) : refDate.toISOString().slice(0, 10);
  const allEvents = getProgramEvents(programKey);

  let nextExam = null;
  let nextHoliday = null;
  let nextDeadline = null;
  let nextAcademic = null;
  let nextInternship = null;

  const completedEvents = [];
  const upcomingEvents = [];

  for (const item of allEvents) {
    const status = getEventStatus(item.startDate, item.endDate, refDate);
    if (status === "completed") {
      completedEvents.push(item);
    } else {
      upcomingEvents.push(item);
      // Next Exam
      if (item.category === EVENT_CATEGORIES.EXAM && !nextExam && item.startDate >= refKey) {
        nextExam = item;
      }
      // Next Holiday (Confirmed official holiday only)
      if (item.category === EVENT_CATEGORIES.HOLIDAY && !nextHoliday && item.startDate >= refKey) {
        nextHoliday = item;
      }
      // Next Deadline
      if (item.category === EVENT_CATEGORIES.DEADLINE && !nextDeadline && item.startDate >= refKey) {
        nextDeadline = item;
      }
      // Next Academic Event
      if (item.category === EVENT_CATEGORIES.ACADEMIC && !nextAcademic && item.startDate >= refKey) {
        nextAcademic = item;
      }
      // Next Internship
      if (item.category === EVENT_CATEGORIES.INTERNSHIP && !nextInternship && item.startDate >= refKey) {
        nextInternship = item;
      }
    }
  }

  return {
    currentTerm: getCurrentTerm(programKey, refDate),
    nextExam,
    nextHoliday,
    nextDeadline,
    nextAcademic,
    nextInternship,
    completedCount: completedEvents.length,
    upcomingCount: upcomingEvents.length,
    totalEvents: allEvents.length
  };
}

/**
 * Get YYYY-MM-DD string in Asia/Kolkata timezone
 */
export function getKolkataDate(dateInput = new Date()) {
  try {
    const d = typeof dateInput === "string" ? new Date(dateInput.length === 10 ? `${dateInput}T00:00:00` : dateInput) : dateInput;
    const formatter = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Kolkata",
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    });
    return formatter.format(d);
  } catch {
    return (typeof dateInput === "string" ? dateInput : dateInput.toISOString()).slice(0, 10);
  }
}

/**
 * Checks if an academic calendar event is an examination fee or payment deadline
 */
export function isFeeEvent(event) {
  if (!event) return false;
  const id = (event.id || "").toLowerCase();
  const title = (event.title || "").toLowerCase();
  const desc = (event.description || "").toLowerCase();
  return id.includes("fee") || title.includes("fee") || desc.includes("fee");
}

/**
 * Personalized Reminder Rules Generator:
 * - Start ONLY 7 days before an event or deadline
 * - Do not show reminders for events more than 7 days away
 * - Examinations: 7 days, 3 days, 1 day, 0 days
 * - Examination fees: 7 days, 3 days, 1 day, 0 days (and daily overdue if pending)
 * - If fee is marked completed, stop all reminders for that fee immediately
 * - Academic events & deadlines: 1 day before, 0 days
 * - Official holidays: 1 day before
 * - If academic notifications are OFF, return []
 */
export const DEFAULT_REMINDER_PREFERENCES = {
  academicNotificationsEnabled: true,
  completedFeeIds: [],
  enabledCategories: {
    [EVENT_CATEGORIES.EXAM]: true,
    [EVENT_CATEGORIES.DEADLINE]: true,
    [EVENT_CATEGORIES.HOLIDAY]: true,
    [EVENT_CATEGORIES.ACADEMIC]: true,
    [EVENT_CATEGORIES.INTERNSHIP]: true
  },
  examOffsets: [7, 3, 1, 0],
  feeOffsets: [7, 3, 1, 0],
  deadlineOffsets: [1, 0],
  holidayOffsets: [1],
  academicOffsets: [1, 0],
  browserNotifications: true
};

export function generatePersonalizedReminders(
  programKey,
  customPreferences = DEFAULT_REMINDER_PREFERENCES,
  refDate = new Date()
) {
  const prefs = { ...DEFAULT_REMINDER_PREFERENCES, ...customPreferences };

  // Rule: If academic notifications are OFF, do not display any academic reminders
  if (prefs.academicNotificationsEnabled === false) {
    return [];
  }

  // Calculate current date in Asia/Kolkata timezone
  const refKey = getKolkataDate(refDate);
  const refTime = new Date(`${refKey}T00:00:00`).getTime();

  const completedFeeIds = Array.isArray(prefs.completedFeeIds) ? prefs.completedFeeIds : [];
  const allEvents = getProgramEvents(programKey);
  const reminders = [];

  allEvents.forEach((ev) => {
    if (prefs.enabledCategories && !prefs.enabledCategories[ev.category]) return;

    const isFee = isFeeEvent(ev);

    // Rule: If the fee is marked Completed, stop all reminders for that fee immediately
    if (isFee && completedFeeIds.includes(ev.id)) {
      return;
    }

    const eventStartDate = ev.startDate;
    const eventStartTime = new Date(`${eventStartDate}T00:00:00`).getTime();
    if (isNaN(eventStartTime)) return;

    // Calculate days until event in Asia/Kolkata
    const daysUntilEvent = Math.round((eventStartTime - refTime) / 86400000);

    // Rule: Reminder Activation Rule - Start ONLY 7 days before the relevant event or deadline
    // Do not show reminders for examinations, fee deadlines, or academic events that are more than 7 days away!
    if (daysUntilEvent > 7) {
      return;
    }

    // 1. Examination Fees
    if (isFee) {
      if (daysUntilEvent < 0) {
        // Fee remains pending after the deadline: send daily overdue reminders
        const daysOverdue = Math.abs(daysUntilEvent);
        reminders.push({
          id: `rem_fee_overdue_${ev.id}_${refKey}`,
          eventId: ev.id,
          eventTitle: ev.title,
          category: ev.category,
          term: ev.term || "General",
          startDate: ev.startDate,
          endDate: ev.endDate,
          formattedDates: ev.displayDates,
          daysBefore: daysUntilEvent,
          triggerDate: refKey,
          isPast: false,
          isDueToday: true,
          isOverdue: true,
          isFee: true,
          title: `⚠️ OVERDUE Fee Payment: ${ev.title}`,
          message: `Examination fee payment deadline passed on ${formatDDMMMYYYY(ev.startDate)} (${daysOverdue} day${daysOverdue === 1 ? "" : "s"} ago). Pay immediately to avoid hall ticket withholding.`
        });
      } else {
        // 0 to 7 days before fee deadline: triggers at 7d, 3d, 1d, 0d
        const offsets = prefs.feeOffsets || [7, 3, 1, 0];
        offsets.forEach((offset) => {
          const triggerTime = eventStartTime - offset * 86400000;
          const triggerKey = getKolkataDate(new Date(triggerTime));

          // Do not display old reminders or send a backlog
          if (triggerKey < refKey) return;

          const isDueToday = triggerKey === refKey;
          const isUpcoming = triggerKey > refKey;

          let prefix = "";
          if (offset === 0) prefix = "Fee Deadline Today:";
          else if (offset === 1) prefix = "Fee Deadline Tomorrow:";
          else prefix = `Fee Deadline in ${offset} days:`;

          reminders.push({
            id: `rem_fee_${ev.id}_${offset}d`,
            eventId: ev.id,
            eventTitle: ev.title,
            category: ev.category,
            term: ev.term || "General",
            startDate: ev.startDate,
            endDate: ev.endDate,
            formattedDates: ev.displayDates,
            daysBefore: offset,
            triggerDate: triggerKey,
            isPast: false,
            isDueToday,
            isUpcoming,
            isOverdue: false,
            isFee: true,
            title: `${prefix} ${ev.title}`,
            message: `Last date to pay examination fee is ${formatDDMMMYYYY(ev.startDate)}. Payment portal closing soon.`
          });
        });
      }
      return;
    }

    // 2. Examinations
    if (ev.category === EVENT_CATEGORIES.EXAM) {
      if (daysUntilEvent < 0) return; // Passed, no backlog

      // Offsets: 7 days, 3 days, 1 day before, and on the start date
      const offsets = prefs.examOffsets || [7, 3, 1, 0];
      offsets.forEach((offset) => {
        const triggerTime = eventStartTime - offset * 86400000;
        const triggerKey = getKolkataDate(new Date(triggerTime));

        // Do not display old reminders or send a backlog
        if (triggerKey < refKey) return;

        const isDueToday = triggerKey === refKey;
        const isUpcoming = triggerKey > refKey;

        let prefix = "";
        if (offset === 0) prefix = "Exam Starts Today:";
        else if (offset === 1) prefix = "Exam Tomorrow:";
        else prefix = `Exam in ${offset} days:`;

        reminders.push({
          id: `rem_${ev.id}_${offset}d`,
          eventId: ev.id,
          eventTitle: ev.title,
          category: ev.category,
          term: ev.term || "General",
          startDate: ev.startDate,
          endDate: ev.endDate,
          formattedDates: ev.displayDates,
          daysBefore: offset,
          triggerDate: triggerKey,
          isPast: false,
          isDueToday,
          isUpcoming,
          title: `${prefix} ${ev.title}`,
          message: `Official university examination scheduled on ${formatDateRange(ev.startDate, ev.endDate)}. Hall ticket and uniform compulsory.`
        });
      });
      return;
    }

    // 3. Regular Academic Events & Deadlines (within 7 days)
    if (
      ev.category === EVENT_CATEGORIES.ACADEMIC ||
      ev.category === EVENT_CATEGORIES.INTERNSHIP ||
      ev.category === EVENT_CATEGORIES.DEADLINE
    ) {
      if (daysUntilEvent < 0) return;

      const offsets = prefs.academicOffsets || [1, 0];
      offsets.forEach((offset) => {
        const triggerTime = eventStartTime - offset * 86400000;
        const triggerKey = getKolkataDate(new Date(triggerTime));

        if (triggerKey < refKey) return;

        const isDueToday = triggerKey === refKey;
        const isUpcoming = triggerKey > refKey;
        const prefix = offset === 0 ? "Today:" : "Tomorrow:";

        reminders.push({
          id: `rem_${ev.id}_${offset}d`,
          eventId: ev.id,
          eventTitle: ev.title,
          category: ev.category,
          term: ev.term || "General",
          startDate: ev.startDate,
          endDate: ev.endDate,
          formattedDates: ev.displayDates,
          daysBefore: offset,
          triggerDate: triggerKey,
          isPast: false,
          isDueToday,
          isUpcoming,
          title: `${prefix} ${ev.title}`,
          message: `${ev.category}: ${ev.title} on ${formatDateRange(ev.startDate, ev.endDate)}. ${ev.description || ""}`
        });
      });
      return;
    }

    // 4. Official Holidays
    if (ev.category === EVENT_CATEGORIES.HOLIDAY) {
      if (daysUntilEvent < 0) return;

      const offset = 1;
      const triggerTime = eventStartTime - offset * 86400000;
      const triggerKey = getKolkataDate(new Date(triggerTime));

      if (triggerKey < refKey) return;

      reminders.push({
        id: `rem_${ev.id}_1d`,
        eventId: ev.id,
        eventTitle: ev.title,
        category: ev.category,
        term: "Official Holiday",
        startDate: ev.startDate,
        endDate: ev.endDate,
        formattedDates: ev.displayDates,
        daysBefore: 1,
        triggerDate: triggerKey,
        isPast: false,
        isDueToday: triggerKey === refKey,
        isUpcoming: triggerKey > refKey,
        title: `Holiday Tomorrow: ${ev.title}`,
        message: `Timetable suspended tomorrow for ${ev.title}. No regular classes scheduled.`
      });
    }
  });

  // Sort: Overdue / Due Today first, then by trigger date ascending
  return reminders.sort((a, b) => {
    if (a.isOverdue && !b.isOverdue) return -1;
    if (!a.isOverdue && b.isOverdue) return 1;
    if (a.isDueToday && !b.isDueToday) return -1;
    if (!a.isDueToday && b.isDueToday) return 1;
    return a.triggerDate.localeCompare(b.triggerDate);
  });
}

/**
 * Calculates human readable relative difference in days from refDate to targetDate
 */
export function getDaysUntil(targetDateStr, refDate = new Date()) {
  if (!targetDateStr) return null;
  const refKey = typeof refDate === "string" ? refDate.slice(0, 10) : refDate.toISOString().slice(0, 10);
  const targetKey = targetDateStr.slice(0, 10);

  const refTime = new Date(`${refKey}T00:00:00`).getTime();
  const targetTime = new Date(`${targetKey}T00:00:00`).getTime();
  const diffDays = Math.round((targetTime - refTime) / 86400000);

  if (diffDays < 0) return { label: "Ended", days: diffDays, status: "completed" };
  if (diffDays === 0) return { label: "Today", days: 0, status: "today" };
  if (diffDays === 1) return { label: "Tomorrow", days: 1, status: "tomorrow" };
  return { label: `In ${diffDays} days`, days: diffDays, status: "upcoming" };
}

/**
 * Generates an iCalendar (.ics) string for 1-click importing into Google Calendar / Apple Calendar
 */
export function generateICalendar(programKey) {
  const events = getProgramEvents(programKey);
  const prog = PROGRAM_DEFINITIONS.find(p => p.key === programKey) || PROGRAM_DEFINITIONS[1];

  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    `PRODID:-//KL University//${prog.shortName}//EN`,
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:KLU Academic Calendar (${prog.shortName})`,
    "X-WR-TIMEZONE:Asia/Kolkata"
  ];

  events.forEach((ev) => {
    const sDate = ev.startDate.replace(/-/g, "");
    // End date in DTEND is exclusive for all-day events, so add 1 day
    const eD = new Date(`${ev.endDate || ev.startDate}T00:00:00`);
    eD.setDate(eD.getDate() + 1);
    const eDate = eD.toISOString().slice(0, 10).replace(/-/g, "");

    lines.push("BEGIN:VEVENT");
    lines.push(`UID:${ev.id}@klu.edu.in`);
    lines.push(`DTSTAMP:${new Date().toISOString().replace(/[-:]/g, "").slice(0, 15)}Z`);
    lines.push(`DTSTART;VALUE=DATE:${sDate}`);
    lines.push(`DTEND;VALUE=DATE:${eDate}`);
    lines.push(`SUMMARY:${ev.title.replace(/,/g, "\\,")}`);
    lines.push(`DESCRIPTION:${(ev.description || ev.category).replace(/,/g, "\\,")}`);
    lines.push(`CATEGORIES:${ev.category}`);
    lines.push("STATUS:CONFIRMED");
    lines.push("END:VEVENT");
  });

  lines.push("END:VCALENDAR");
  return lines.join("\r\n");
}

export function downloadICalendar(programKey) {
  const icsData = generateICalendar(programKey);
  const blob = new Blob([icsData], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.setAttribute("download", `KLU_Calendar_${programKey}_2026_2027.ics`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}


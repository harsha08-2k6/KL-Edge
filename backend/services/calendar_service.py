"""
KL-Edge Academic Calendar & Smart Reminder Service
Persistently stores official academic calendar events, student program preferences,
and executes Asia/Kolkata background scheduled reminder checks with de-duplication.
"""

import os
import json
import sqlite3
from datetime import datetime, date, timedelta
from typing import Dict, List, Any, Optional
try:
    from zoneinfo import ZoneInfo
except ImportError:
    import pytz
    ZoneInfo = lambda name: pytz.timezone(name)

KOLKATA_TZ = ZoneInfo("Asia/Kolkata")

DB_PATH = os.path.join(os.path.dirname(os.path.dirname(__file__)), "campus_map.db")

def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

# Official Calendar Datasets matching the official PDFs exactly
OFFICIAL_HOLIDAYS_DATA = [
    {
        "id": "hol_pongal_2026",
        "title": "Pongal Holidays",
        "category": "Official Holidays",
        "start_date": "2026-01-12",
        "end_date": "2026-01-17",
        "description": "Pongal Vacation (Bhogi: 14 Jan, Sankranthi: 15 Jan, Kanuma: 16 Jan). Timetable suspended.",
        "verification_flag": 0
    },
    {
        "id": "hol_republic_2026",
        "title": "Republic Day",
        "category": "Official Holidays",
        "start_date": "2026-01-26",
        "end_date": "2026-01-26",
        "description": "National Holiday. Mandatory flag hoisting; student social work compulsory.",
        "verification_flag": 0
    },
    {
        "id": "hol_sivarathri_2026",
        "title": "Maha Sivarathri",
        "category": "Official Holidays",
        "start_date": "2026-02-15",
        "end_date": "2026-02-15",
        "description": "Festival falling on Sunday.",
        "verification_flag": 0
    },
    {
        "id": "hol_ugadi_2026",
        "title": "Ugadi",
        "category": "Official Holidays",
        "start_date": "2026-03-19",
        "end_date": "2026-03-19",
        "description": "Telugu New Year official holiday.",
        "verification_flag": 0
    },
    {
        "id": "hol_ramzan_2026",
        "title": "Ramzan (Id-ul-Fitr)",
        "category": "Official Holidays",
        "start_date": "2026-03-21",
        "end_date": "2026-03-21",
        "description": "Id-ul-Fitr public holiday.",
        "verification_flag": 0
    },
    {
        "id": "hol_ramanavami_2026",
        "title": "Sri Ramanavami",
        "category": "Official Holidays",
        "start_date": "2026-03-27",
        "end_date": "2026-03-27",
        "description": "Sri Ramanavami public holiday.",
        "verification_flag": 0
    },
    {
        "id": "hol_ambedkar_2026",
        "title": "Dr. B. R. Ambedkar Jayanthi",
        "category": "Official Holidays",
        "start_date": "2026-04-14",
        "end_date": "2026-04-14",
        "description": "Dr. B.R. Ambedkar Jayanthi official holiday.",
        "verification_flag": 0
    },
    {
        "id": "hol_independence_2026",
        "title": "Independence Day",
        "category": "Official Holidays",
        "start_date": "2026-08-15",
        "end_date": "2026-08-15",
        "description": "National Holiday. Mandatory flag hoisting and social service activities.",
        "verification_flag": 0
    },
    {
        "id": "hol_varalakshmi_2026",
        "title": "Varalakshmi Vratham",
        "category": "Official Holidays",
        "start_date": "2026-08-28",
        "end_date": "2026-08-28",
        "description": "Varalakshmi Vratham festival holiday.",
        "verification_flag": 0
    },
    {
        "id": "hol_krishnashtami_2026",
        "title": "Krishnashtami",
        "category": "Official Holidays",
        "start_date": "2026-09-04",
        "end_date": "2026-09-04",
        "description": "Sri Krishnashtami holiday.",
        "verification_flag": 0
    },
    {
        "id": "hol_vinayaka_2026",
        "title": "Vinayaka Chavithi",
        "category": "Official Holidays",
        "start_date": "2026-09-14",
        "end_date": "2026-09-14",
        "description": "Vinayaka Chavithi holiday.",
        "verification_flag": 0
    },
    {
        "id": "hol_gandhi_2026",
        "title": "Mahatma Gandhi Jayanthi",
        "category": "Official Holidays",
        "start_date": "2026-10-02",
        "end_date": "2026-10-02",
        "description": "National Holiday. Swachhata campaign social work compulsory.",
        "verification_flag": 0
    },
    {
        "id": "hol_dussehra_2026",
        "title": "Dussehra Vacation",
        "category": "Official Holidays",
        "start_date": "2026-10-19",
        "end_date": "2026-10-24",
        "description": "Dussehra Vacation (Durgashtami 19 Oct, Mahanavami 20 Oct, Vijaya Dasami 21 Oct).",
        "verification_flag": 0
    },
    {
        "id": "hol_deepavali_sunday_2026",
        "title": "Deepavali",
        "category": "Official Holidays",
        "start_date": "2026-11-08",
        "end_date": "2026-11-08",
        "description": "Festival falling on Sunday.",
        "verification_flag": 0
    },
    {
        "id": "hol_day_after_deepavali_2026",
        "title": "The day after Deepavali",
        "category": "Official Holidays",
        "start_date": "2026-11-09",
        "end_date": "2026-11-09",
        "description": "Post-Deepavali official holiday.",
        "verification_flag": 0
    },
    {
        "id": "hol_christmas_2026",
        "title": "Christmas",
        "category": "Official Holidays",
        "start_date": "2026-12-25",
        "end_date": "2026-12-25",
        "description": "Christmas official holiday.",
        "verification_flag": 0
    },
    {
        "id": "hol_republic_2027",
        "title": "Republic Day 2027",
        "category": "Official Holidays",
        "start_date": "2027-01-26",
        "end_date": "2027-01-26",
        "description": "National Holiday 2027.",
        "verification_flag": 0
    },
    {
        "id": "hol_ambedkar_2027",
        "title": "Dr. B. R. Ambedkar Jayanthi 2027",
        "category": "Official Holidays",
        "start_date": "2027-04-14",
        "end_date": "2027-04-14",
        "description": "Official Public Holiday 2027.",
        "verification_flag": 0
    }
]

PROGRAM_SPECIFIC_EVENTS = {
    # A. III & IV Year B.Tech
    "y24_semester": [
        # Odd
        {"id": "y24_odd_orient", "term": "Odd Semester", "title": "Odd Semester Orientation and Registrations", "category": "Academic Events", "start_date": "2026-06-29", "end_date": "2026-07-04", "description": "Orientation & registrations"},
        {"id": "y24_odd_commence", "term": "Odd Semester", "title": "Commencement of Classwork", "category": "Academic Events", "start_date": "2026-07-17", "end_date": "2026-07-17", "description": "Classwork begins"},
        {"id": "y24_odd_insem1", "term": "Odd Semester", "title": "Semester In-Semester 1 Examinations", "category": "Examinations", "start_date": "2026-09-07", "end_date": "2026-09-12", "description": "In-Semester 1 exams"},
        {"id": "y24_odd_recheck1", "term": "Odd Semester", "title": "Last date to request recheck for Semester In-1 examinations", "category": "Important Deadlines", "start_date": "2026-08-27", "end_date": "2026-08-27", "description": "In-1 recheck deadline"},
        {"id": "y24_odd_recheck2", "term": "Odd Semester", "title": "Last date to request recheck for Semester In-2 examinations", "category": "Important Deadlines", "start_date": "2026-10-07", "end_date": "2026-10-07", "description": "In-2 recheck deadline"},
        {"id": "y24_odd_lab_insem", "term": "Odd Semester", "title": "Lab In-Semester Examinations", "category": "Examinations", "start_date": "2026-10-12", "end_date": "2026-10-17", "description": "Lab In-Semester exams"},
        {"id": "y24_odd_immersion", "term": "Odd Semester", "title": "Techno-Management Immersion Week", "category": "Academic Events", "start_date": "2026-10-30", "end_date": "2026-10-31", "description": "Immersion week"},
        {"id": "y24_odd_fee_deadline", "term": "Odd Semester", "title": "Last date to pay end-exam fee", "category": "Important Deadlines", "start_date": "2026-10-31", "end_date": "2026-10-31", "description": "End exam fee deadline"},
        {"id": "y24_odd_insem2", "term": "Odd Semester", "title": "Semester In-Semester 2 Examinations", "category": "Examinations", "start_date": "2026-11-09", "end_date": "2026-11-14", "description": "In-Semester 2 exams"},
        {"id": "y24_odd_last_inst", "term": "Odd Semester", "title": "Last instructional day", "category": "Important Deadlines", "start_date": "2026-11-12", "end_date": "2026-11-12", "description": "Instruction concludes"},
        {"id": "y24_odd_detention", "term": "Odd Semester", "title": "Declaration of detention list", "category": "Important Deadlines", "start_date": "2026-11-13", "end_date": "2026-11-13", "description": "Detention list declaration"},
        {"id": "y24_odd_end_exams", "term": "Odd Semester", "title": "Semester-End Theory and Lab Examinations", "category": "Examinations", "start_date": "2026-11-16", "end_date": "2026-11-29", "description": "End-term theory and lab exams"},
        # Even
        {"id": "y24_even_orient", "term": "Even Semester", "title": "Even Semester Orientation and Registrations", "category": "Academic Events", "start_date": "2026-11-30", "end_date": "2026-12-05", "description": "Orientation and registrations"},
        {"id": "y24_even_commence", "term": "Even Semester", "title": "Commencement of Classwork", "category": "Academic Events", "start_date": "2026-12-22", "end_date": "2026-12-22", "description": "Classwork begins"},
        {"id": "y24_even_insem1", "term": "Even Semester", "title": "Semester In-Semester 1 Examinations", "category": "Examinations", "start_date": "2027-02-01", "end_date": "2027-02-03", "description": "In-Sem 1 exams"},
        {"id": "y24_even_recheck1", "term": "Even Semester", "title": "Last date to request recheck for Semester In-1 examinations", "category": "Important Deadlines", "start_date": "2027-02-10", "end_date": "2027-02-10", "description": "Recheck deadline"},
        {"id": "y24_even_cultural", "term": "Even Semester", "title": "Cultural Immersion Week", "category": "Academic Events", "start_date": "2027-03-12", "end_date": "2027-03-13", "description": "Cultural Immersion"},
        {"id": "y24_even_lab_insem", "term": "Even Semester", "title": "Lab In-Semester Examinations", "category": "Examinations", "start_date": "2027-03-15", "end_date": "2027-03-20", "description": "Lab In-Sem evaluations"},
        {"id": "y24_even_recheck2", "term": "Even Semester", "title": "Last date to request recheck for Semester In-2 examinations", "category": "Important Deadlines", "start_date": "2027-03-18", "end_date": "2027-03-18", "description": "In-2 recheck deadline"},
        {"id": "y24_even_fee_deadline", "term": "Even Semester", "title": "Last date to pay end-exam fee", "category": "Important Deadlines", "start_date": "2027-04-03", "end_date": "2027-04-03", "description": "Fee payment deadline"},
        {"id": "y24_even_insem2", "term": "Even Semester", "title": "Semester In-Semester 2 Examinations", "category": "Examinations", "start_date": "2027-04-12", "end_date": "2027-04-17", "description": "In-Sem 2 exams"},
        {"id": "y24_even_last_inst", "term": "Even Semester", "title": "Last instructional day", "category": "Important Deadlines", "start_date": "2027-04-14", "end_date": "2027-04-14", "description": "Last instructional day"},
        {"id": "y24_even_detention", "term": "Even Semester", "title": "Declaration of detention list", "category": "Important Deadlines", "start_date": "2027-04-15", "end_date": "2027-04-15", "description": "Detention list announcement"},
        {"id": "y24_even_end_exams", "term": "Even Semester", "title": "Semester-End Theory and Lab Examinations", "category": "Examinations", "start_date": "2027-04-19", "end_date": "2027-05-02", "description": "End-term theory and lab exams"},
        # Summer
        {"id": "y24_summer_intern_4w", "term": "Summer Term", "title": "Four-Week Summer Technical Internship", "category": "Internships", "start_date": "2027-05-03", "end_date": "2027-05-29", "description": "Technical Internship"},
        {"id": "y24_summer_intern_8w", "term": "Summer Term", "title": "Eight-Week Summer Internship", "category": "Internships", "start_date": "2027-05-03", "end_date": "2027-06-26", "description": "Summer Internship"},
        {"id": "y24_summer_orient", "term": "Summer Term", "title": "Summer Term Orientation and Registrations", "category": "Academic Events", "start_date": "2027-05-28", "end_date": "2027-05-29", "description": "Summer enrollments"},
        {"id": "y24_summer_insem1", "term": "Summer Term", "title": "Semester In-Semester 1 Examinations", "category": "Examinations", "start_date": "2027-06-14", "end_date": "2027-06-15", "verification_flag": 1, "description": "Summer In-1 (Flagged for verification against original PDF)"},
        {"id": "y24_summer_lab_insem", "term": "Summer Term", "title": "Lab In-Semester Examinations", "category": "Examinations", "start_date": "2027-06-18", "end_date": "2027-06-19", "verification_flag": 1, "description": "Summer Lab In-Sem (Flagged for verification)"},
        {"id": "y24_summer_last_inst", "term": "Summer Term", "title": "Summer Term Last Instructional Day", "category": "Important Deadlines", "start_date": "2027-07-03", "end_date": "2027-07-03", "description": "Instruction concludes"},
        {"id": "y24_summer_insem2", "term": "Summer Term", "title": "Semester In-Semester 2 Examinations", "category": "Examinations", "start_date": "2027-07-05", "end_date": "2027-07-10", "verification_flag": 1, "description": "Summer In-2 (Flagged for verification)"},
        {"id": "y24_summer_end_exams", "term": "Summer Term", "title": "Semester-End Theory and Lab Examinations", "category": "Examinations", "start_date": "2027-07-08", "end_date": "2027-07-10", "verification_flag": 1, "description": "Summer End Exams (Flagged for verification)"}
    ],

    # B. II Year Regular Semester
    "y25_semester": [
        {"id": "y25sem_odd_orient", "term": "Odd Semester", "title": "Odd Semester Orientation and Registrations", "category": "Academic Events", "start_date": "2026-06-29", "end_date": "2026-07-04", "description": "Odd Semester orientation"},
        {"id": "y25sem_odd_commence", "term": "Odd Semester", "title": "Commencement of Classwork", "category": "Academic Events", "start_date": "2026-07-17", "end_date": "2026-07-17", "description": "Classwork begins"},
        {"id": "y25sem_odd_insem1", "term": "Odd Semester", "title": "Semester In-Semester 1 Examinations", "category": "Examinations", "start_date": "2026-08-20", "end_date": "2026-08-22", "description": "In-Semester 1"},
        {"id": "y25sem_odd_recheck1", "term": "Odd Semester", "title": "Last date to request recheck for Semester In-1 examinations", "category": "Important Deadlines", "start_date": "2026-08-27", "end_date": "2026-08-27", "description": "Recheck deadline"},
        {"id": "y25sem_odd_insem2", "term": "Odd Semester", "title": "Semester In-Semester 2 Examinations", "category": "Examinations", "start_date": "2026-09-28", "end_date": "2026-09-30", "description": "In-Semester 2"},
        {"id": "y25sem_odd_recheck2", "term": "Odd Semester", "title": "Last date to request recheck for Semester In-2 examinations", "category": "Important Deadlines", "start_date": "2026-10-07", "end_date": "2026-10-07", "description": "Recheck deadline"},
        {"id": "y25sem_odd_lab_insem", "term": "Odd Semester", "title": "Lab In-Semester Examinations", "category": "Examinations", "start_date": "2026-10-12", "end_date": "2026-10-17", "description": "Lab In-Semester evaluations"},
        {"id": "y25sem_odd_immersion", "term": "Odd Semester", "title": "Techno-Management Immersion Week", "category": "Academic Events", "start_date": "2026-10-30", "end_date": "2026-10-31", "description": "Techno-Management week"},
        {"id": "y25sem_odd_fee_deadline", "term": "Odd Semester", "title": "Last date to pay end-exam fee", "category": "Important Deadlines", "start_date": "2026-10-31", "end_date": "2026-10-31", "description": "End-exam fee deadline"},
        {"id": "y25sem_odd_last_inst", "term": "Odd Semester", "title": "Last instructional day", "category": "Important Deadlines", "start_date": "2026-11-12", "end_date": "2026-11-12", "description": "Last instructional day"},
        {"id": "y25sem_odd_detention", "term": "Odd Semester", "title": "Declaration of detention list", "category": "Important Deadlines", "start_date": "2026-11-13", "end_date": "2026-11-13", "description": "Detention list declaration"},
        {"id": "y25sem_odd_end_exams", "term": "Odd Semester", "title": "Semester-End Theory and Lab Examinations", "category": "Examinations", "start_date": "2026-11-16", "end_date": "2026-11-29", "description": "End-term examinations"},
        # Even
        {"id": "y25sem_even_orient", "term": "Even Semester", "title": "Even Semester Orientation and Registrations", "category": "Academic Events", "start_date": "2026-11-30", "end_date": "2026-12-05", "description": "Orientation and registrations"},
        {"id": "y25sem_even_commence", "term": "Even Semester", "title": "Commencement of Classwork", "category": "Academic Events", "start_date": "2026-12-22", "end_date": "2026-12-22", "description": "Classwork begins"},
        {"id": "y25sem_even_insem1", "term": "Even Semester", "title": "Semester In-Semester 1 Examinations", "category": "Examinations", "start_date": "2027-02-01", "end_date": "2027-02-03", "description": "In-Semester 1"},
        {"id": "y25sem_even_recheck1", "term": "Even Semester", "title": "Last date to request recheck for Semester In-1 examinations", "category": "Important Deadlines", "start_date": "2027-02-10", "end_date": "2027-02-10", "description": "Recheck deadline"},
        {"id": "y25sem_even_insem2", "term": "Even Semester", "title": "Semester In-Semester 2 Examinations", "category": "Examinations", "start_date": "2027-03-11", "end_date": "2027-03-13", "description": "In-Semester 2"},
        {"id": "y25sem_even_cultural", "term": "Even Semester", "title": "Cultural Immersion Week", "category": "Academic Events", "start_date": "2027-03-12", "end_date": "2027-03-13", "description": "Cultural Immersion"},
        {"id": "y25sem_even_recheck2", "term": "Even Semester", "title": "Last date to request recheck for Semester In-2 examinations", "category": "Important Deadlines", "start_date": "2027-03-18", "end_date": "2027-03-18", "description": "Recheck deadline"},
        {"id": "y25sem_even_lab_insem", "term": "Even Semester", "title": "Lab In-Semester Examinations", "category": "Examinations", "start_date": "2027-03-22", "end_date": "2027-03-27", "description": "Lab In-Semester evaluations"},
        {"id": "y25sem_even_fee_deadline", "term": "Even Semester", "title": "Last date to pay end-exam fee", "category": "Important Deadlines", "start_date": "2027-03-27", "end_date": "2027-03-27", "description": "End exam fee deadline"},
        {"id": "y25sem_even_last_inst", "term": "Even Semester", "title": "Last instructional day", "category": "Important Deadlines", "start_date": "2027-04-14", "end_date": "2027-04-14", "description": "Last instructional day"},
        {"id": "y25sem_even_detention", "term": "Even Semester", "title": "Declaration of detention list", "category": "Important Deadlines", "start_date": "2027-04-15", "end_date": "2027-04-15", "description": "Detention list announcement"},
        {"id": "y25sem_even_end_exams", "term": "Even Semester", "title": "Semester-End Theory and Lab Examinations", "category": "Examinations", "start_date": "2027-04-12", "end_date": "2027-04-25", "description": "Semester-End exams"},
        # Summer
        {"id": "y25sem_summer_intern_4w", "term": "Summer Term", "title": "Four-Week Summer Technical Internship", "category": "Internships", "start_date": "2027-05-02", "end_date": "2027-05-29", "description": "Technical Internship"},
        {"id": "y25sem_summer_intern_8w", "term": "Summer Term", "title": "Eight-Week Summer Internship", "category": "Internships", "start_date": "2027-05-02", "end_date": "2027-06-26", "description": "Summer Internship"},
        {"id": "y25sem_summer_orient", "term": "Summer Term", "title": "Summer Term Orientation and Registrations", "category": "Academic Events", "start_date": "2027-05-28", "end_date": "2027-05-29", "description": "Summer registrations"},
        {"id": "y25sem_summer_insem1", "term": "Summer Term", "title": "Semester In-Semester 1 Examinations", "category": "Examinations", "start_date": "2027-06-14", "end_date": "2027-06-15", "description": "Summer In-1 exams"},
        {"id": "y25sem_summer_lab_insem", "term": "Summer Term", "title": "Lab In-Semester Examinations", "category": "Examinations", "start_date": "2027-06-18", "end_date": "2027-06-19", "description": "Summer Lab In-Sem"},
        {"id": "y25sem_summer_last_inst", "term": "Summer Term", "title": "Summer Term Last Instructional Day", "category": "Important Deadlines", "start_date": "2027-07-03", "end_date": "2027-07-03", "description": "Instruction concludes"},
        {"id": "y25sem_summer_insem2", "term": "Summer Term", "title": "Semester In-Semester 2 Examinations", "category": "Examinations", "start_date": "2027-07-05", "end_date": "2027-07-10", "description": "Summer In-2 exams"},
        {"id": "y25sem_summer_end_exams", "term": "Summer Term", "title": "Semester-End Theory and Lab Examinations", "category": "Examinations", "start_date": "2027-07-08", "end_date": "2027-07-10", "description": "Summer End exams"}
    ],

    # C. II Year PBL Trimester
    "y25_trimester": [
        # T4
        {"id": "y25tri_t4_orient", "term": "Trimester 4", "title": "T4 Orientation and Registrations", "category": "Academic Events", "start_date": "2026-07-13", "end_date": "2026-07-18", "description": "T4 orientation and registration"},
        {"id": "y25tri_t4_commence", "term": "Trimester 4", "title": "Commencement of Classwork", "category": "Academic Events", "start_date": "2026-07-23", "end_date": "2026-07-23", "description": "Classwork begins"},
        {"id": "y25tri_t4_midterm", "term": "Trimester 4", "title": "Mid-Term Exams Along with Classwork", "category": "Examinations", "start_date": "2026-09-04", "end_date": "2026-09-08", "description": "Mid-Term exams"},
        {"id": "y25tri_t4_recheck", "term": "Trimester 4", "title": "Last date to request recheck for Mid-Term Exams", "category": "Important Deadlines", "start_date": "2026-09-12", "end_date": "2026-09-12", "description": "Recheck deadline"},
        {"id": "y25tri_t4_fee", "term": "Trimester 4", "title": "Last date to pay end-exam fee", "category": "Important Deadlines", "start_date": "2026-09-26", "end_date": "2026-09-26", "description": "Exam fee deadline"},
        {"id": "y25tri_t4_lab", "term": "Trimester 4", "title": "Lab Exams Along with Classwork", "category": "Examinations", "start_date": "2026-10-12", "end_date": "2026-10-17", "description": "Lab evaluations"},
        {"id": "y25tri_t4_last_inst", "term": "Trimester 4", "title": "Last instructional day", "category": "Important Deadlines", "start_date": "2026-10-15", "end_date": "2026-10-15", "description": "Instruction ends"},
        {"id": "y25tri_t4_detention", "term": "Trimester 4", "title": "Declaration of detention list", "category": "Important Deadlines", "start_date": "2026-10-16", "end_date": "2026-10-16", "description": "Detention list declaration"},
        {"id": "y25tri_t4_immersion", "term": "Trimester 4", "title": "Techno-Management Immersion Week", "category": "Academic Events", "start_date": "2026-10-30", "end_date": "2026-10-31", "description": "Immersion week"},
        {"id": "y25tri_t4_end_exams", "term": "Trimester 4", "title": "Semester-End Theory Exams and Hackathon", "category": "Examinations", "start_date": "2026-10-26", "end_date": "2026-11-01", "description": "End-theory exams and Hackathon"},
        # T5
        {"id": "y25tri_t5_orient", "term": "Trimester 5", "title": "T5 Orientation and Registrations", "category": "Academic Events", "start_date": "2026-10-05", "end_date": "2026-10-07", "description": "T5 orientation"},
        {"id": "y25tri_t5_commence", "term": "Trimester 5", "title": "Commencement of Classwork", "category": "Academic Events", "start_date": "2026-11-04", "end_date": "2026-11-04", "description": "Classwork begins"},
        {"id": "y25tri_t5_midterm", "term": "Trimester 5", "title": "Mid-Term Exams Along with Classwork", "category": "Examinations", "start_date": "2026-12-14", "end_date": "2026-12-19", "description": "Mid-Term exams"},
        {"id": "y25tri_t5_recheck", "term": "Trimester 5", "title": "Last date to request recheck for Mid-Term Exams", "category": "Important Deadlines", "start_date": "2026-12-24", "end_date": "2026-12-24", "description": "Recheck deadline"},
        {"id": "y25tri_t5_fee", "term": "Trimester 5", "title": "Last date to pay end-exam fee", "category": "Important Deadlines", "start_date": "2027-01-09", "end_date": "2027-01-09", "description": "Exam fee deadline"},
        {"id": "y25tri_t5_lab", "term": "Trimester 5", "title": "Lab Exams", "category": "Examinations", "start_date": "2027-01-18", "end_date": "2027-01-23", "description": "Lab exams"},
        {"id": "y25tri_t5_last_inst", "term": "Trimester 5", "title": "Last instructional day", "category": "Important Deadlines", "start_date": "2027-01-28", "end_date": "2027-01-28", "description": "Instruction ends"},
        {"id": "y25tri_t5_detention", "term": "Trimester 5", "title": "Declaration of detention list", "category": "Important Deadlines", "start_date": "2027-01-29", "end_date": "2027-01-29", "description": "Detention list declaration"},
        {"id": "y25tri_t5_end_exams", "term": "Trimester 5", "title": "Semester-End Theory Exams and Hackathon", "category": "Examinations", "start_date": "2027-02-01", "end_date": "2027-02-07", "description": "End-theory exams and Hackathon"},
        # T6
        {"id": "y25tri_t6_orient", "term": "Trimester 6", "title": "T6 Orientation and Registrations", "category": "Academic Events", "start_date": "2027-01-25", "end_date": "2027-01-27", "description": "T6 orientation"},
        {"id": "y25tri_t6_commence", "term": "Trimester 6", "title": "Commencement of Classwork", "category": "Academic Events", "start_date": "2027-02-09", "end_date": "2027-02-09", "description": "Classwork begins"},
        {"id": "y25tri_t6_cultural", "term": "Trimester 6", "title": "Cultural Immersion Week", "category": "Academic Events", "start_date": "2027-03-12", "end_date": "2027-03-13", "description": "Cultural Immersion"},
        {"id": "y25tri_t6_midterm", "term": "Trimester 6", "title": "Mid-Term Exams Along with Classwork", "category": "Examinations", "start_date": "2027-03-22", "end_date": "2027-03-27", "description": "Mid-Term exams"},
        {"id": "y25tri_t6_recheck", "term": "Trimester 6", "title": "Last date to request recheck for Mid-Term Exams", "category": "Important Deadlines", "start_date": "2027-03-31", "end_date": "2027-03-31", "description": "Recheck deadline"},
        {"id": "y25tri_t6_fee", "term": "Trimester 6", "title": "Last date to pay end-exam fee", "category": "Important Deadlines", "start_date": "2027-04-10", "end_date": "2027-04-10", "description": "Fee deadline"},
        {"id": "y25tri_t6_lab", "term": "Trimester 6", "title": "Lab Exams Along with Classwork", "category": "Examinations", "start_date": "2027-04-19", "end_date": "2027-04-24", "description": "Lab exams"},
        {"id": "y25tri_t6_last_inst", "term": "Trimester 6", "title": "Last instructional day", "category": "Important Deadlines", "start_date": "2027-04-29", "end_date": "2027-04-29", "description": "Instruction ends"},
        {"id": "y25tri_t6_detention", "term": "Trimester 6", "title": "Declaration of detention list", "category": "Important Deadlines", "start_date": "2027-04-30", "end_date": "2027-04-30", "description": "Detention list declaration"},
        {"id": "y25tri_t6_end_exams", "term": "Trimester 6", "title": "Semester-End Theory Exams and Hackathon", "category": "Examinations", "start_date": "2027-05-02", "end_date": "2027-05-09", "description": "End exams and Hackathon"},
        # Summer
        {"id": "y25tri_summer_intern_3w", "term": "Summer Term", "title": "Three-Week Summer Technical Internship", "category": "Internships", "start_date": "2027-05-10", "end_date": "2027-05-29", "description": "Technical Internship"},
        {"id": "y25tri_summer_intern_8w", "term": "Summer Term", "title": "Eight-Week Summer Internship", "category": "Internships", "start_date": "2027-05-10", "end_date": "2027-07-03", "description": "Summer Internship"},
        {"id": "y25tri_summer_orient", "term": "Summer Term", "title": "Summer Term Orientation and Registrations", "category": "Academic Events", "start_date": "2027-05-28", "end_date": "2027-05-29", "description": "Summer registrations"},
        {"id": "y25tri_summer_commence", "term": "Summer Term", "title": "Commencement of Summer Term Classwork", "category": "Academic Events", "start_date": "2027-05-31", "end_date": "2027-05-31", "description": "Classwork begins"},
        {"id": "y25tri_summer_midterm", "term": "Summer Term", "title": "Mid-Term Exams Along with Classwork", "category": "Examinations", "start_date": "2027-06-18", "end_date": "2027-06-19", "description": "Mid-Term exams"},
        {"id": "y25tri_summer_lab", "term": "Summer Term", "title": "Lab In-Semester Exams Along with Classwork", "category": "Examinations", "start_date": "2027-06-29", "end_date": "2027-06-30", "description": "Lab In-Semester exams"},
        {"id": "y25tri_summer_next_reg", "term": "Summer Term", "title": "2027-2028 Odd Semester Registrations", "category": "Academic Events", "start_date": "2027-06-28", "end_date": "2027-07-03", "description": "Odd Semester Registrations"},
        {"id": "y25tri_summer_last_inst", "term": "Summer Term", "title": "Last instructional day", "category": "Important Deadlines", "start_date": "2027-07-07", "end_date": "2027-07-07", "description": "Instruction ends"},
        {"id": "y25tri_summer_end_exams", "term": "Summer Term", "title": "Semester-End Theory Exams and Hackathon", "category": "Examinations", "start_date": "2027-07-08", "end_date": "2027-07-11", "description": "End exams and Hackathon"},
        {"id": "y25tri_next_year_commence", "term": "Summer Term", "title": "2027-2028 Academic Year Commencement", "category": "Academic Events", "start_date": "2027-07-13", "end_date": "2027-07-13", "description": "Academic year commencement"}
    ],

    # D. I Year PBL Trimester
    "y26_trimester": [
        # T1
        {"id": "y26tri_t1_orient", "term": "Trimester 1", "title": "T1 Orientation", "category": "Academic Events", "start_date": "2026-07-09", "end_date": "2026-07-09", "description": "T1 orientation"},
        {"id": "y26tri_t1_induction", "term": "Trimester 1", "title": "Induction Programme", "category": "Academic Events", "start_date": "2026-07-10", "end_date": "2026-08-01", "description": "Induction programme"},
        {"id": "y26tri_t1_reg", "term": "Trimester 1", "title": "T1 Registrations", "category": "Academic Events", "start_date": "2026-07-27", "end_date": "2026-08-01", "description": "T1 registrations"},
        {"id": "y26tri_t1_commence", "term": "Trimester 1", "title": "Commencement of Classwork", "category": "Academic Events", "start_date": "2026-08-03", "end_date": "2026-08-03", "description": "Classwork begins"},
        {"id": "y26tri_t1_midterm", "term": "Trimester 1", "title": "Mid-Term Exams Along with Classwork", "category": "Examinations", "start_date": "2026-09-14", "end_date": "2026-09-19", "description": "Mid-Term exams"},
        {"id": "y26tri_t1_recheck", "term": "Trimester 1", "title": "Last date to request recheck for Mid-Term Exams", "category": "Important Deadlines", "start_date": "2026-09-24", "end_date": "2026-09-24", "description": "Recheck deadline"},
        {"id": "y26tri_t1_fee", "term": "Trimester 1", "title": "Last date to pay end-exam fee", "category": "Important Deadlines", "start_date": "2026-10-03", "end_date": "2026-10-03", "description": "Exam fee deadline"},
        {"id": "y26tri_t1_lab", "term": "Trimester 1", "title": "Term-End Lab Exams Along with Classwork", "category": "Examinations", "start_date": "2026-10-05", "end_date": "2026-10-10", "description": "Lab exams"},
        {"id": "y26tri_t1_last_inst", "term": "Trimester 1", "title": "Last instructional day", "category": "Important Deadlines", "start_date": "2026-10-14", "end_date": "2026-10-14", "description": "Instruction ends"},
        {"id": "y26tri_t1_detention", "term": "Trimester 1", "title": "Declaration of detention list", "category": "Important Deadlines", "start_date": "2026-10-16", "end_date": "2026-10-16", "description": "Detention list declaration"},
        {"id": "y26tri_t1_immersion", "term": "Trimester 1", "title": "Techno-Management Immersion Week", "category": "Academic Events", "start_date": "2026-10-30", "end_date": "2026-10-31", "description": "Immersion week"},
        {"id": "y26tri_t1_end_exams", "term": "Trimester 1", "title": "Semester-End Theory Exams and Hackathon", "category": "Examinations", "start_date": "2026-10-26", "end_date": "2026-11-01", "description": "End exams and Hackathon"},
        # T2
        {"id": "y26tri_t2_orient", "term": "Trimester 2", "title": "T2 Orientation and Registrations", "category": "Academic Events", "start_date": "2026-10-12", "end_date": "2026-10-14", "description": "T2 orientation"},
        {"id": "y26tri_t2_commence", "term": "Trimester 2", "title": "Commencement of Classwork", "category": "Academic Events", "start_date": "2026-11-04", "end_date": "2026-11-04", "description": "Classwork begins"},
        {"id": "y26tri_t2_midterm", "term": "Trimester 2", "title": "Mid-Term Exams Along with Classwork", "category": "Examinations", "start_date": "2026-12-17", "end_date": "2026-12-23", "description": "Mid-Term exams"},
        {"id": "y26tri_t2_recheck", "term": "Trimester 2", "title": "Last date to request recheck for Mid-Term Exams", "category": "Important Deadlines", "start_date": "2026-12-26", "end_date": "2026-12-26", "description": "Recheck deadline"},
        {"id": "y26tri_t2_fee", "term": "Trimester 2", "title": "Last date to pay end-exam fee", "category": "Important Deadlines", "start_date": "2027-01-09", "end_date": "2027-01-09", "description": "Fee deadline"},
        {"id": "y26tri_t2_lab", "term": "Trimester 2", "title": "Term-End Lab Exams Along with Classwork", "category": "Examinations", "start_date": "2027-01-18", "end_date": "2027-01-23", "description": "Lab exams"},
        {"id": "y26tri_t2_last_inst", "term": "Trimester 2", "title": "Last instructional day", "category": "Important Deadlines", "start_date": "2027-01-27", "end_date": "2027-01-27", "description": "Instruction ends"},
        {"id": "y26tri_t2_detention", "term": "Trimester 2", "title": "Declaration of detention list", "category": "Important Deadlines", "start_date": "2027-01-29", "end_date": "2027-01-29", "description": "Detention list declaration"},
        {"id": "y26tri_t2_end_exams", "term": "Trimester 2", "title": "Semester-End Theory Exams and Hackathon", "category": "Examinations", "start_date": "2027-02-01", "end_date": "2027-02-07", "description": "End exams and Hackathon"},
        # T3
        {"id": "y26tri_t3_orient", "term": "Trimester 3", "title": "T3 Orientation and Registrations", "category": "Academic Events", "start_date": "2027-01-21", "end_date": "2027-01-22", "description": "T3 orientation"},
        {"id": "y26tri_t3_commence", "term": "Trimester 3", "title": "Commencement of Classwork", "category": "Academic Events", "start_date": "2027-02-09", "end_date": "2027-02-09", "description": "Classwork begins"},
        {"id": "y26tri_t3_cultural", "term": "Trimester 3", "title": "Cultural Immersion Week", "category": "Academic Events", "start_date": "2027-03-12", "end_date": "2027-03-13", "description": "Cultural Immersion"},
        {"id": "y26tri_t3_midterm", "term": "Trimester 3", "title": "Mid-Term Exams Along with Classwork", "category": "Examinations", "start_date": "2027-03-22", "end_date": "2027-03-27", "description": "Mid-Term exams"},
        {"id": "y26tri_t3_recheck", "term": "Trimester 3", "title": "Last date to request recheck for Mid-Term Exams", "category": "Important Deadlines", "start_date": "2027-03-31", "end_date": "2027-03-31", "description": "Recheck deadline"},
        {"id": "y26tri_t3_fee", "term": "Trimester 3", "title": "Last date to pay end-exam fee", "category": "Important Deadlines", "start_date": "2027-04-10", "end_date": "2027-04-10", "description": "Fee deadline"},
        {"id": "y26tri_t3_lab", "term": "Trimester 3", "title": "Term-End Lab Exams Along with Classwork", "category": "Examinations", "start_date": "2027-04-19", "end_date": "2027-04-24", "description": "Lab exams"},
        {"id": "y26tri_t3_last_inst", "term": "Trimester 3", "title": "Last instructional day", "category": "Important Deadlines", "start_date": "2027-04-28", "end_date": "2027-04-28", "description": "Instruction ends"},
        {"id": "y26tri_t3_detention", "term": "Trimester 3", "title": "Declaration of detention list", "category": "Important Deadlines", "start_date": "2027-04-30", "end_date": "2027-04-30", "description": "Detention list declaration"},
        {"id": "y26tri_t3_end_exams", "term": "Trimester 3", "title": "Semester-End Theory Exams and Hackathon", "category": "Examinations", "start_date": "2027-05-03", "end_date": "2027-05-09", "description": "End exams and Hackathon"},
        # Summer
        {"id": "y26tri_summer_intern_4w", "term": "Summer Term", "title": "Four-Week Summer Social Internship", "category": "Internships", "start_date": "2027-05-10", "end_date": "2027-06-05", "description": "Social Internship"},
        {"id": "y26tri_summer_intern_8w", "term": "Summer Term", "title": "Eight-Week Summer Internship", "category": "Internships", "start_date": "2027-05-10", "end_date": "2027-07-03", "description": "Summer Internship"},
        {"id": "y26tri_summer_orient", "term": "Summer Term", "title": "Summer Term Orientation and Registrations", "category": "Academic Events", "start_date": "2027-05-28", "end_date": "2027-05-29", "description": "Summer registrations"},
        {"id": "y26tri_summer_commence", "term": "Summer Term", "title": "Commencement of Summer Term Classwork", "category": "Academic Events", "start_date": "2027-05-31", "end_date": "2027-05-31", "description": "Classwork begins"},
        {"id": "y26tri_summer_midterm", "term": "Summer Term", "title": "Mid-Term Exams Along with Classwork", "category": "Examinations", "start_date": "2027-06-18", "end_date": "2027-06-19", "description": "Mid-Term exams"},
        {"id": "y26tri_summer_lab", "term": "Summer Term", "title": "Term-End Lab Exams", "category": "Examinations", "start_date": "2027-06-29", "end_date": "2027-06-30", "description": "Term-End Lab exams"},
        {"id": "y26tri_summer_next_reg", "term": "Summer Term", "title": "2027-2028 Odd Semester Registrations", "category": "Academic Events", "start_date": "2027-06-28", "end_date": "2027-07-03", "description": "Odd Semester Registrations"},
        {"id": "y26tri_summer_last_inst", "term": "Summer Term", "title": "Last instructional day", "category": "Important Deadlines", "start_date": "2027-07-07", "end_date": "2027-07-07", "description": "Instruction ends"},
        {"id": "y26tri_summer_end_exams", "term": "Summer Term", "title": "Semester-End Theory Exams and Hackathon", "category": "Examinations", "start_date": "2027-07-08", "end_date": "2027-07-11", "description": "End exams and Hackathon"},
        {"id": "y26tri_next_year_commence", "term": "Summer Term", "title": "2027-2028 Academic Year Commencement", "category": "Academic Events", "start_date": "2027-07-13", "end_date": "2027-07-13", "description": "Academic year commencement"}
    ]
}

# Third and Fourth Year share the same base calendar dataset
PROGRAM_SPECIFIC_EVENTS["y23_semester"] = PROGRAM_SPECIFIC_EVENTS["y24_semester"]


def init_calendar_db():
    """Create tables and seed initial academic events persistently."""
    conn = get_db()
    cursor = conn.cursor()

    cursor.execute("""
    CREATE TABLE IF NOT EXISTS academic_events (
        id TEXT PRIMARY KEY,
        program_key TEXT NOT NULL,
        term TEXT NOT NULL,
        title TEXT NOT NULL,
        category TEXT NOT NULL,
        start_date TEXT NOT NULL,
        end_date TEXT NOT NULL,
        description TEXT,
        verification_flag INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
    """)

    cursor.execute("""
    CREATE TABLE IF NOT EXISTS student_calendar_preferences (
        student_id TEXT PRIMARY KEY,
        program_key TEXT NOT NULL,
        preferences_json TEXT,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
    """)

    cursor.execute("""
    CREATE TABLE IF NOT EXISTS calendar_reminders (
        id TEXT PRIMARY KEY,
        student_id TEXT NOT NULL,
        event_id TEXT NOT NULL,
        days_before INTEGER NOT NULL,
        trigger_date TEXT NOT NULL,
        title TEXT NOT NULL,
        message TEXT NOT NULL,
        status TEXT DEFAULT 'pending',
        delivered_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
    """)

    cursor.execute("""
    CREATE INDEX IF NOT EXISTS idx_reminders_trigger 
    ON calendar_reminders(student_id, trigger_date, status)
    """)

    # Seed events for all programs
    for prog_key, events in PROGRAM_SPECIFIC_EVENTS.items():
        for ev in events:
            cursor.execute("""
            INSERT INTO academic_events (id, program_key, term, title, category, start_date, end_date, description, verification_flag)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET
                title=excluded.title,
                category=excluded.category,
                start_date=excluded.start_date,
                end_date=excluded.end_date,
                description=excluded.description,
                verification_flag=excluded.verification_flag
            """, (
                f"{prog_key}_{ev['id']}",
                prog_key,
                ev["term"],
                ev["title"],
                ev["category"],
                ev["start_date"],
                ev["end_date"],
                ev.get("description", ""),
                ev.get("verification_flag", 0)
            ))

    # Seed official holidays under common program key 'all_holidays'
    for hol in OFFICIAL_HOLIDAYS_DATA:
        cursor.execute("""
        INSERT INTO academic_events (id, program_key, term, title, category, start_date, end_date, description, verification_flag)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
            title=excluded.title,
            category=excluded.category,
            start_date=excluded.start_date,
            end_date=excluded.end_date,
            description=excluded.description,
            verification_flag=excluded.verification_flag
        """, (
            hol["id"],
            "all_holidays",
            "Official Holiday",
            hol["title"],
            hol["category"],
            hol["start_date"],
            hol["end_date"],
            hol.get("description", ""),
            hol.get("verification_flag", 0)
        ))

    conn.commit()
    conn.close()


def get_calendar_events(program_key: str) -> List[Dict[str, Any]]:
    """Retrieve all events for a given program, including official holidays."""
    conn = get_db()
    cursor = conn.cursor()

    cursor.execute("""
        SELECT * FROM academic_events 
        WHERE program_key = ? OR program_key = 'all_holidays'
        ORDER BY start_date ASC
    """, (program_key,))
    rows = cursor.fetchall()
    conn.close()

    events = []
    for r in rows:
        events.append({
            "id": r["id"],
            "programKey": r["program_key"],
            "term": r["term"],
            "title": r["title"],
            "category": r["category"],
            "startDate": r["start_date"],
            "endDate": r["end_date"],
            "description": r["description"],
            "verificationFlag": bool(r["verification_flag"])
        })
    return events


def get_student_preferences(student_id: str) -> Dict[str, Any]:
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM student_calendar_preferences WHERE student_id = ?", (student_id,))
    row = cursor.fetchone()
    conn.close()

    if row and row["preferences_json"]:
        try:
            return {
                "programKey": row["program_key"],
                "preferences": json.loads(row["preferences_json"])
            }
        except Exception:
            pass
    return {
        "programKey": None,
        "preferences": None
    }


def save_student_preferences(student_id: str, program_key: str, preferences: Dict[str, Any]):
    conn = get_db()
    cursor = conn.cursor()
    prefs_str = json.dumps(preferences)
    cursor.execute("""
        INSERT INTO student_calendar_preferences (student_id, program_key, preferences_json, updated_at)
        VALUES (?, ?, ?, CURRENT_TIMESTAMP)
        ON CONFLICT(student_id) DO UPDATE SET
            program_key=excluded.program_key,
            preferences_json=excluded.preferences_json,
            updated_at=CURRENT_TIMESTAMP
    """, (student_id, program_key, prefs_str))
    conn.commit()
    conn.close()


def generate_and_sync_reminders_for_student(student_id: str, program_key: str, custom_prefs: Optional[Dict[str, Any]] = None):
    """
    Generate reminders for a student using Asia/Kolkata local date.
    Strictly adheres to the 7-day activation window rule:
    - Only start reminders when an event enters its 7-day window (days_until <= 7).
    - Examinations: 7, 3, 1, 0 days.
    - Examination fees: 7, 3, 1, 0 days, plus daily overdue reminders after deadline.
    - If fee is marked completed, all reminders for that fee stop immediately.
    - If academic notifications are OFF, zero reminders generated.
    """
    now_kolkata = datetime.now(KOLKATA_TZ)
    today_str = now_kolkata.strftime("%Y-%m-%d")
    today_date = now_kolkata.date()

    conn = get_db()
    cursor = conn.cursor()

    # Load preferences
    prefs = custom_prefs or {}
    if not prefs:
        student_data = get_student_preferences(student_id)
        prefs = student_data.get("preferences") or {}

    # Rule: If academic notifications are OFF, do not display or store any academic reminders
    if prefs.get("academicNotificationsEnabled") is False:
        cursor.execute("DELETE FROM calendar_reminders WHERE student_id = ? AND status = 'pending'", (student_id,))
        conn.commit()
        conn.close()
        return 0

    completed_fee_ids = set(prefs.get("completedFeeIds") or [])

    # If fees were marked completed, remove any lingering pending reminders for those fees
    if completed_fee_ids:
        placeholders = ",".join("?" for _ in completed_fee_ids)
        cursor.execute(f"""
            DELETE FROM calendar_reminders 
            WHERE student_id = ? AND event_id IN ({placeholders}) AND status = 'pending'
        """, (student_id, *completed_fee_ids))

    events = get_calendar_events(program_key)
    generated_count = 0

    for ev in events:
        cat = ev["category"]
        title_lower = ev["title"].lower()
        desc_lower = (ev.get("description") or "").lower()
        is_fee = "fee" in ev["id"].lower() or "fee" in title_lower or "fee" in desc_lower

        # Rule: If fee is marked completed, stop all reminders for that fee immediately
        if is_fee and ev["id"] in completed_fee_ids:
            continue

        try:
            ev_start = datetime.strptime(ev["startDate"], "%Y-%m-%d").date()
        except Exception:
            continue

        # Calculate difference in days using Asia/Kolkata timezone
        days_until = (ev_start - today_date).days

        # Rule: Reminder Activation Rule - Start ONLY 7 days before the relevant event or deadline
        # Do not show reminders for examinations, fee deadlines, or academic events that are more than 7 days away!
        if days_until > 7:
            continue

        # 1. Examination Fees
        if is_fee:
            if days_until < 0:
                # Fee deadline passed and fee is still pending: daily overdue reminder
                reminder_id = f"{student_id}_{ev['id']}_overdue_{today_str}"
                title = f"⚠️ OVERDUE Fee Payment: {ev['title']}"
                days_overdue = abs(days_until)
                msg = f"Examination fee payment deadline passed on {ev['startDate']} ({days_overdue} day{'s' if days_overdue != 1 else ''} ago). Pay immediately to avoid hall ticket cancellation."
                cursor.execute("""
                INSERT OR IGNORE INTO calendar_reminders 
                (id, student_id, event_id, days_before, trigger_date, title, message, status)
                VALUES (?, ?, ?, ?, ?, ?, ?, 'pending')
                """, (reminder_id, student_id, ev["id"], days_until, today_str, title, msg))
                if cursor.rowcount > 0:
                    generated_count += 1
            else:
                # 0 to 7 days before fee deadline: triggers at 7d, 3d, 1d, 0d
                fee_offsets = [7, 3, 1, 0]
                for offset in fee_offsets:
                    trigger_d = ev_start - timedelta(days=offset)
                    trigger_str = trigger_d.strftime("%Y-%m-%d")

                    # Do not backlog old reminders
                    if trigger_str < today_str:
                        continue

                    reminder_id = f"{student_id}_{ev['id']}_{offset}d"
                    if offset == 0:
                        prefix = "Fee Deadline Today:"
                    elif offset == 1:
                        prefix = "Fee Deadline Tomorrow:"
                    else:
                        prefix = f"Fee Deadline in {offset} days:"

                    title = f"{prefix} {ev['title']}"
                    msg = f"Last date to pay examination fee is {ev['startDate']}. Payment portal closing soon."
                    cursor.execute("""
                    INSERT OR IGNORE INTO calendar_reminders 
                    (id, student_id, event_id, days_before, trigger_date, title, message, status)
                    VALUES (?, ?, ?, ?, ?, ?, ?, 'pending')
                    """, (reminder_id, student_id, ev["id"], offset, trigger_str, title, msg))
                    if cursor.rowcount > 0:
                        generated_count += 1
            continue

        # 2. Examinations
        if cat == "Examinations":
            if days_until < 0:
                continue  # Exam passed, no backlog

            exam_offsets = [7, 3, 1, 0]
            for offset in exam_offsets:
                trigger_d = ev_start - timedelta(days=offset)
                trigger_str = trigger_d.strftime("%Y-%m-%d")

                if trigger_str < today_str:
                    continue

                reminder_id = f"{student_id}_{ev['id']}_{offset}d"
                if offset == 0:
                    prefix = "Exam Starts Today:"
                elif offset == 1:
                    prefix = "Exam Tomorrow:"
                else:
                    prefix = f"Exam in {offset} days:"

                title = f"{prefix} {ev['title']}"
                msg = f"University examination scheduled on {ev['startDate']} to {ev['endDate']}. Hall ticket and uniform compulsory."
                cursor.execute("""
                INSERT OR IGNORE INTO calendar_reminders 
                (id, student_id, event_id, days_before, trigger_date, title, message, status)
                VALUES (?, ?, ?, ?, ?, ?, ?, 'pending')
                """, (reminder_id, student_id, ev["id"], offset, trigger_str, title, msg))
                if cursor.rowcount > 0:
                    generated_count += 1
            continue

        # 3. Regular Academic Events & Deadlines (within 7-day window)
        if cat in ("Academic Events", "Internships", "Important Deadlines"):
            if days_until < 0:
                continue

            for offset in [1, 0]:
                trigger_d = ev_start - timedelta(days=offset)
                trigger_str = trigger_d.strftime("%Y-%m-%d")

                if trigger_str < today_str:
                    continue

                reminder_id = f"{student_id}_{ev['id']}_{offset}d"
                prefix = "Today:" if offset == 0 else "Tomorrow:"
                title = f"{prefix} {ev['title']}"
                msg = f"{ev['category']} on {ev['startDate']}. {ev.get('description', '')}"
                cursor.execute("""
                INSERT OR IGNORE INTO calendar_reminders 
                (id, student_id, event_id, days_before, trigger_date, title, message, status)
                VALUES (?, ?, ?, ?, ?, ?, ?, 'pending')
                """, (reminder_id, student_id, ev["id"], offset, trigger_str, title, msg))
                if cursor.rowcount > 0:
                    generated_count += 1
            continue

        # 4. Official Holidays (within 7-day window: 1 day before)
        if cat == "Official Holidays":
            if days_until < 0:
                continue

            offset = 1
            trigger_d = ev_start - timedelta(days=offset)
            trigger_str = trigger_d.strftime("%Y-%m-%d")

            if trigger_str < today_str:
                continue

            reminder_id = f"{student_id}_{ev['id']}_{offset}d"
            title = f"Holiday Tomorrow: {ev['title']}"
            msg = f"Timetable suspended tomorrow for {ev['title']}. No regular classes scheduled."
            cursor.execute("""
            INSERT OR IGNORE INTO calendar_reminders 
            (id, student_id, event_id, days_before, trigger_date, title, message, status)
            VALUES (?, ?, ?, ?, ?, ?, ?, 'pending')
            """, (reminder_id, student_id, ev["id"], offset, trigger_str, title, msg))
            if cursor.rowcount > 0:
                generated_count += 1

    conn.commit()
    conn.close()
    return generated_count


def get_student_reminders(student_id: str) -> List[Dict[str, Any]]:
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT * FROM calendar_reminders
        WHERE student_id = ?
        ORDER BY trigger_date ASC
    """, (student_id,))
    rows = cursor.fetchall()
    conn.close()

    result = []
    for r in rows:
        result.append({
            "id": r["id"],
            "studentId": r["student_id"],
            "eventId": r["event_id"],
            "daysBefore": r["days_before"],
            "triggerDate": r["trigger_date"],
            "title": r["title"],
            "message": r["message"],
            "status": r["status"],
            "deliveredAt": r["delivered_at"]
        })
    return result


def mark_reminder_delivered(reminder_id: str):
    conn = get_db()
    cursor = conn.cursor()
    now_str = datetime.now(KOLKATA_TZ).isoformat()
    cursor.execute("""
        UPDATE calendar_reminders
        SET status = 'delivered', delivered_at = ?
        WHERE id = ?
    """, (now_str, reminder_id))
    conn.commit()
    conn.close()


def run_scheduled_calendar_job():
    """
    Background job triggered periodically (Asia/Kolkata timezone).
    Loops over enrolled students, evaluates calendar triggers, and marks due notifications.
    """
    now_kolkata = datetime.now(KOLKATA_TZ)
    today_str = now_kolkata.strftime("%Y-%m-%d")

    conn = get_db()
    cursor = conn.cursor()

    # Find distinct students who have preferences or default profiles
    cursor.execute("SELECT student_id, program_key FROM student_calendar_preferences")
    students = cursor.fetchall()

    for row in students:
        s_id = row["student_id"]
        p_key = row["program_key"]
        if s_id and p_key:
            generate_and_sync_reminders_for_student(s_id, p_key)

    # Deliver any reminders that have reached their trigger date and are pending
    cursor.execute("""
        SELECT id, student_id, title, message 
        FROM calendar_reminders
        WHERE trigger_date <= ? AND status = 'pending'
    """, (today_str,))
    due_reminders = cursor.fetchall()

    for r in due_reminders:
        cursor.execute("""
            UPDATE calendar_reminders
            SET status = 'delivered', delivered_at = CURRENT_TIMESTAMP
            WHERE id = ?
        """, (r["id"],))

    conn.commit()
    conn.close()
    return len(due_reminders)

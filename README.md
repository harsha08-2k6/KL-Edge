# KL Edge

A modern student utility platform for KL University ERP students.

## Features

- Attendance calculator based on KL ERP system
- Live ERP attendance sync
- Faculty cabin search
- Subject-wise attendance tracking
- Mobile + desktop responsive UI
- Local storage credential saving
- Captcha-based secure syncing
- Academic year & semester selection
- Offline-friendly experience

---

## How It Works

1. Student enters:
   - ERP ID
   - Password
   - Captcha

2. Credentials are stored only in browser local storage.

3. App fetches latest ERP data from KL ERP.

4. Every resync requires:
   - Fresh captcha
   - ERP verification

---

## Tech Stack

- React
- JavaScript
- Next.js / Vite
- Local Storage
- ERP Sync APIs

---

## Attendance Formula

KL ERP uses weighted attendance calculations.

Formula:

```math
Attendance % = (Present Weightage / Total Weightage) × 100

Theory and lab classes may have different weightages.


---

Security

No external credential storage

No backend password saving

Data stays on user's device

Captcha required for every sync



---

Future Features

Timetable integration

Attendance prediction

Smart bunk calculator

Internal marks tracker

Faculty rating system

Notifications & reminders



---

Installation

git clone https://github.com/harsha08-2k6/KL-Edge.git
cd KL-Edge
npm install
npm run dev


---

Goal

KL Edge simplifies the ERP experience with:

Better UI

Faster access

Smart attendance insights

Student-focused tools



---

Repository

https://github.com/harsha08-2k6/KL-Edge

# KL Attendance PWA

Mobile-first KL ERP attendance dashboard with local-only credentials, manual captcha sync, attendance analytics, faculty cabin search, and offline caching.

## Run locally

```bash
npm install
npm run dev
```

- Frontend: http://localhost:3000
- Backend: http://localhost:4000

## Security model

ERP ID and password are stored only in the student's browser `localStorage`. The backend receives credentials only during a manual sync request and does not persist them.

## ERP sync

The backend uses Puppeteer because KL ERP uses session cookies, captcha, and dynamic pages. Configure real ERP URLs and selectors through backend environment variables:

```bash
ERP_LOGIN_URL=https://example.edu/login
ERP_ATTENDANCE_URL=https://example.edu/attendance
ERP_ID_SELECTOR=#username
ERP_PASSWORD_SELECTOR=#password
ERP_CAPTCHA_SELECTOR=#captcha
ERP_SUBMIT_SELECTOR=button[type="submit"]
ERP_ATTENDANCE_TABLE_SELECTOR=table
```

Until those are configured, the ERP sync endpoints will return a configuration error and no data will be shown.

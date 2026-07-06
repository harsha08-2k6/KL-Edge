# KL Edge

A modern student utility platform built for K L University students to simplify ERP usage, attendance tracking, academic management, and daily student activities with automatic ERP synchronization every 10 minutes to keep information up to date.

## 🚀 Overview

KL Edge is designed to improve the overall student experience by providing a faster, cleaner, and more accessible interface compared to the traditional ERP workflow. The platform works seamlessly on both mobile and desktop devices and focuses on productivity, convenience, and real-time academic insights.

GitHub Repository: [KL Edge Repository](https://github.com/harsha08-2k6/KL-Edge.git)

---

## ✨ Features

### 📊 Attendance Management
- Real-time attendance tracking
- Attendance percentage calculator
- Subject-wise attendance analysis
- Required classes calculation for safe attendance percentage
- Shortage prediction system
- Attendance sync with ERP

### 📅 Timetable Access
- Daily timetable view
- Organized class schedules
- Easy timetable navigation
- Mobile-friendly timetable interface

### 🪑 Seating Plan
- Classroom seating plan access
- Easy student seat lookup
- Organized exam seating information

### 🎓 CGPA Calculator
- CGPA calculation system
- Semester-wise GPA tracking
- Academic performance analysis
- Easy grade estimation

### 👨‍🏫 Faculty Information
- Faculty cabin search
- Quick faculty access system
- Organized faculty directory

### 🔄 ERP Synchronization
- Automatic ERP synchronization every 10 minutes
- Keeps attendance, timetable, seating, and academic data up to date
- Manual sync available whenever needed
- Secure local storage based login flow
- Faster access after initial login
- Captcha-supported authentication flow

### 📱 Responsive Design
- Fully optimized for:
  - Mobile devices
  - Tablets
  - Desktop systems
- Modern responsive UI
- Smooth user experience across all screen sizes

### ⚡ Performance Optimizations
- Fast loading pages
- Lightweight frontend
- Efficient API handling
- Optimized state management
- Automatic background ERP synchronization every 10 minutes

### ⏱️ Automatic Background Refresh
- Automatically refreshes ERP data every 10 minutes
- Reduces the need for manual syncing
- Keeps academic information up to date while using the platform
- Lightweight scheduled synchronization

## 🆕 Latest Updates

- Added automatic ERP synchronization every 10 minutes
- Improved data freshness across attendance, timetable, and academic information
- Reduced the need for frequent manual refreshes
- Enhanced overall platform responsiveness

---

## 🛠️ Tech Stack

### Frontend
- React.js
- JavaScript
- HTML5
- CSS3

### Backend
- FastAPI

### Deployment
- Vercel (Frontend)
- Render / Cloud Hosting (Backend)

### Storage
- Browser Local Storage

---

## 🔐 Authentication & Privacy

- No student credentials are stored on external servers
- Credentials remain on the user's device
- Local storage based session management
- ERP authentication handled securely
- Captcha verification required during ERP sync

---

## 📂 Project Structure

```bash
KL-Edge/
│
├── backend/
│   ├── api/
│   ├── routes/
│   ├── services/
│   ├── utils/
│   └── main.py
│
├── frontend/
│   ├── public/
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   ├── services/
│   │   ├── hooks/
│   │   ├── styles/
│   │   └── App.js
│   │
│   └── package.json
│
├── assets/
├── README.md
└── requirements.txt
```

---

## 🎯 Main Objectives

- Simplify ERP usage
- Save student time
- Improve attendance management
- Provide quick academic access
- Build a clean and modern student platform
- Deliver better usability compared to traditional ERP systems

---

## 🌐 Platform Support

| Platform | Supported |
|---|---|
| Android | ✅ |
| iOS | ✅ |
| Windows | ✅ |
| macOS | ✅ |
| Tablets | ✅ |

---

## ⚙️ Installation

### Clone Repository

```bash
git clone https://github.com/harsha08-2k6/KL-Edge.git
```

### Frontend Setup

```bash
cd frontend
npm install
npm run dev
```

### Backend Setup

```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --reload
```

---

## 📈 Future Improvements

- Push notifications
- AI-based attendance predictions
- GPA calculator enhancements
- Exam scheduler
- Notes sharing system
- Assignment tracker
- Dark mode enhancements
- Offline support

---

## 🤝 Contributions

Contributions, feature requests, and improvements are welcome.

1. Fork the repository
2. Create a new branch
3. Commit your changes
4. Push to your branch
5. Open a Pull Request

---

## 📜 License

This project is intended for educational and student productivity purposes.

---

## ⭐ Support

If you found this project useful, consider giving it a star on GitHub.

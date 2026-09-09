# KL Edge

A modern student utility platform built for K L University students to simplify ERP usage, attendance tracking, academic management, and daily student activities with automatic ERP synchronization every 15 minutes and LMS synchronization every 30 minutes to keep information up to date.

## 🚀 Overview

KL Edge is designed to improve the overall student experience by providing a faster, cleaner, and more accessible interface compared to the traditional ERP workflow. The platform works seamlessly on both mobile and desktop devices and focuses on productivity, convenience, and real-time academic insights.

GitHub Repository: [KL Edge Repository](https://github.com/harsha08-2k6/KL-Edge.git)

---

## ✨ Features

### 📊 Attendance & Academic Management
- Real-time attendance tracking
- Attendance percentage calculator
- Subject-wise attendance analysis
- Required classes calculation for safe attendance percentage
- Shortage prediction system
- Detailed marks and results tracking

### 🗺️ Interactive Campus Map
- Complete campus layout with categorical POIs (academic, hostel, food, library, etc.)
- Shortest path routing and navigation between locations
- Location reviews, ratings, and student feedback
- Nearby facilities recommendations and filtering

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

### 🔄 ERP Synchronization & Authentication
- Automatic ERP synchronization every 15 minutes
- Keeps attendance, timetable, seating, and academic data up to date
- Manual sync available whenever needed
- Secure local storage based login flow
- Automatic Captcha resolution for seamless authentication
- Faster access after initial login

### 📚 LMS Integration (Moodle)
- Connect securely to the university LMS without storing passwords
- Live dashboard displaying upcoming assignments and deadlines
- Smart urgency indicators (Due soon, Overdue, etc.)
- Direct links to assignment submission portals
- Automatic background LMS synchronization every 30 minutes

### 📱 Responsive & PWA Design
- Fully optimized as a Progressive Web App (PWA) for:
  - Mobile devices
  - Tablets
  - Desktop systems
- Modern responsive UI with Tailwind CSS
- Smooth user experience across all screen sizes

### ⚡ Performance Optimizations
- Fast loading pages powered by Vite
- Lightweight frontend
- Efficient API handling with Redis caching
- Optimized state management

---

## 🛠️ Tech Stack

### Frontend
- **React.js** (built with **Vite**)
- **Tailwind CSS** (Styling & responsive design)
- **React Leaflet** (Interactive Campus Maps)
- **PWA** (Installable Progressive Web App)

### Backend
- **FastAPI** (Python web framework)
- **BeautifulSoup4** (ERP web scraping)
- **ddddocr** (Optical Character Recognition for automated Captcha bypassing)
- **Redis** (Data caching & session management)

### Deployment
- **Netlify / Vercel** (Frontend Hosting)
- **Render / Cloud Hosting** (Backend API Hosting)

### Storage
- Browser Local Storage

---

## 🔐 Authentication & Privacy

- No student credentials are stored on external servers
- Credentials remain on the user's device
- Local storage based session management
- ERP authentication handled securely
- Captcha verification automated securely on the backend

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
│   ├── requirements.txt
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
│   │   └── App.jsx
│   ├── package.json
│   ├── tailwind.config.js
│   └── vite.config.js
│
├── README.md
└── vercel.json
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
- Exam scheduler
- Notes sharing system
- Dark mode enhancements
- Offline support capabilities expansion

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

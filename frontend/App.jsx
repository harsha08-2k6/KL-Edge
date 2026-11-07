import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import { Suspense, lazy } from "react";

function lazyWithRetry(importer) {
  return lazy(async () => {
    try {
      const res = await importer();
      try {
        sessionStorage.removeItem("chunk_retry_" + window.location.pathname);
      } catch {}
      return res;
    } catch (err) {
      const isChunkError =
        err?.name === "ChunkLoadError" ||
        /failed to (fetch|load)/i.test(err?.message || "") ||
        /loading chunk/i.test(err?.message || "");

      let hasReloaded = false;
      try {
        hasReloaded = !!sessionStorage.getItem("chunk_retry_" + window.location.pathname);
      } catch {}

      if (isChunkError && !hasReloaded) {
        try {
          sessionStorage.setItem("chunk_retry_" + window.location.pathname, "true");
        } catch {}
        window.location.reload();
        return { default: () => null };
      }
      throw err;
    }
  });
}

const Home = lazyWithRetry(() => import("./pages/index.jsx"));
const Subjects = lazyWithRetry(() => import("./pages/subjects.jsx"));
const SubjectNames = lazyWithRetry(() => import("./pages/subject-names.jsx"));
const Timetable = lazyWithRetry(() => import("./pages/timetable.jsx"));
const Streak = lazyWithRetry(() => import("./pages/streak.jsx"));
const More = lazyWithRetry(() => import("./pages/more.jsx"));
const SeatingPlan = lazyWithRetry(() => import("./pages/seating-plan.jsx"));
const Cgpa = lazyWithRetry(() => import("./pages/cgpa.jsx"));
const Faculty = lazyWithRetry(() => import("./pages/faculty.jsx"));
const Settings = lazyWithRetry(() => import("./pages/settings.jsx"));
const Privacy = lazyWithRetry(() => import("./pages/privacy.jsx"));
const Documentation = lazyWithRetry(() => import("./pages/documentation.jsx"));
const Map = lazyWithRetry(() => import("./pages/map.jsx"));
const Assignments = lazyWithRetry(() => import("./pages/assignments.jsx"));
const Games = lazyWithRetry(() => import("./pages/games/index.jsx"));
const TicTacToe = lazyWithRetry(() => import("./pages/games/tic-tac-toe.jsx"));
const Snake = lazyWithRetry(() => import("./pages/games/snake.jsx"));
const CalendarPage = lazyWithRetry(() => import("./pages/calendar.jsx"));

export default function App() {
  return (
    <Router>
      <Suspense fallback={<div className="flex h-screen w-full items-center justify-center text-ink/50 font-bold">Loading...</div>}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/subjects" element={<Subjects />} />
          <Route path="/subject-names" element={<SubjectNames />} />
          <Route path="/timetable" element={<Timetable />} />
          <Route path="/streak" element={<Streak />} />
          <Route path="/more" element={<More />} />
          <Route path="/seating-plan" element={<SeatingPlan />} />
          <Route path="/cgpa" element={<Cgpa />} />
          <Route path="/faculty" element={<Faculty />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/privacy" element={<Privacy />} />
          <Route path="/documentation" element={<Documentation />} />
          <Route path="/map" element={<Map />} />
          <Route path="/assignments" element={<Assignments />} />
          <Route path="/calendar" element={<CalendarPage />} />
          <Route path="/more/games" element={<Games />} />
          <Route path="/more/games/tic-tac-toe" element={<TicTacToe />} />
          <Route path="/more/games/snake" element={<Snake />} />

          <Route path="/games" element={<Navigate to="/more/games" replace />} />
          <Route path="/games/tic-tac-toe" element={<Navigate to="/more/games/tic-tac-toe" replace />} />
          <Route path="/games/snake" element={<Navigate to="/more/games/snake" replace />} />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </Router>
  );
}

import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import { Suspense, lazy } from "react";

const Home = lazy(() => import("./pages/index.jsx"));
const Subjects = lazy(() => import("./pages/subjects.jsx"));
const SubjectNames = lazy(() => import("./pages/subject-names.jsx"));
const Timetable = lazy(() => import("./pages/timetable.jsx"));
const Streak = lazy(() => import("./pages/streak.jsx"));
const More = lazy(() => import("./pages/more.jsx"));
const SeatingPlan = lazy(() => import("./pages/seating-plan.jsx"));
const Cgpa = lazy(() => import("./pages/cgpa.jsx"));
const Faculty = lazy(() => import("./pages/faculty.jsx"));
const Settings = lazy(() => import("./pages/settings.jsx"));
const Privacy = lazy(() => import("./pages/privacy.jsx"));
const Documentation = lazy(() => import("./pages/documentation.jsx"));
const Map = lazy(() => import("./pages/map.jsx"));
const Assignments = lazy(() => import("./pages/assignments.jsx"));
const Games = lazy(() => import("./pages/games/index.jsx"));
const TicTacToe = lazy(() => import("./pages/games/tic-tac-toe.jsx"));
const Snake = lazy(() => import("./pages/games/snake.jsx"));

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

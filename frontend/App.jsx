import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import Home from "./pages/index.jsx";
import Subjects from "./pages/subjects.jsx";
import Timetable from "./pages/timetable.jsx";
import Faculty from "./pages/faculty.jsx";
import Settings from "./pages/settings.jsx";

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/subjects" element={<Subjects />} />
        <Route path="/timetable" element={<Timetable />} />
        <Route path="/faculty" element={<Faculty />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
}
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import Home from "./pages/index.jsx";
import Subjects from "./pages/subjects.jsx";
import SubjectNames from "./pages/subject-names.jsx";
import Timetable from "./pages/timetable.jsx";
import Marks from "./pages/marks.jsx";
import More from "./pages/more.jsx";
import SeatingPlan from "./pages/seating-plan.jsx";
import Cgpa from "./pages/cgpa.jsx";
import Faculty from "./pages/faculty.jsx";
import Settings from "./pages/settings.jsx";
import Privacy from "./pages/privacy.jsx";
import Documentation from "./pages/documentation.jsx";

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/subjects" element={<Subjects />} />
        <Route path="/subject-names" element={<SubjectNames />} />
        <Route path="/timetable" element={<Timetable />} />
        <Route path="/marks" element={<Marks />} />
        <Route path="/more" element={<More />} />
        <Route path="/seating-plan" element={<SeatingPlan />} />
        <Route path="/cgpa" element={<Cgpa />} />
        <Route path="/faculty" element={<Faculty />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/privacy" element={<Privacy />} />
        <Route path="/documentation" element={<Documentation />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
}

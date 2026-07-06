import { Armchair, BookMarked, ChevronRight, GraduationCap, ListChecks, Settings } from "lucide-react";
import { Link } from "react-router-dom";
import { Layout } from "../components/Layout.jsx";

const moreLinks = [
  { href: "/marks", label: "Marks", description: "View internal exam marks (Coming Soon).", icon: ListChecks },
  { href: "/cgpa", label: "CGPA", description: "Check your semester-wise CGPA.", icon: GraduationCap },
  { href: "/seating-plan", label: "Seating Plan", description: "Find your exam seating arrangements.", icon: Armchair },
  { href: "/subject-names", label: "Subject Names", description: "Edit names used inside the timetable.", icon: BookMarked },
  { href: "/settings", label: "Settings", description: "Configure login credentials and sync options for ERP access.", icon: Settings },
];

export default function More() {
  return (
    <Layout title="More">
      <div className="mt-2 flex flex-col gap-2">
        {moreLinks.map((item) => (
          <Link
            key={item.href}
            to={item.href}
            className="tap flex items-center justify-between rounded-xl border border-ink/10 bg-white p-4 shadow-soft"
          >
            <div className="flex items-center gap-4">
              <item.icon size={20} className="text-ink/70" />
              <div>
                <p className="font-bold text-ink">{item.label}</p>
                <p className="text-xs text-ink/60">{item.description}</p>
              </div>
            </div>
            <ChevronRight size={20} className="text-ink/40" />
          </Link>
        ))}
      </div>
    </Layout>
  );
}

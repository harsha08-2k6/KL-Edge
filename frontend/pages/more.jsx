import { Armchair, BookMarked, ChevronRight, Flame, Gamepad2, GraduationCap, MapPin, Settings } from "lucide-react";
import { Link } from "react-router-dom";
import { Layout } from "../components/Layout.jsx";

const moreLinks = [
  { href: "/map", label: "Campus Map", description: "Interactive map navigation with AI Assistant support.", icon: MapPin },
  { href: "/streak", label: "Streak", description: "View your active days and streak calendar.", icon: Flame },
  { href: "/cgpa", label: "CGPA", description: "Check your semester-wise CGPA.", icon: GraduationCap },
  { href: "/seating-plan", label: "Seating Plan", description: "Find your exam seating arrangements.", icon: Armchair },
  { href: "/subject-names", label: "Subject Names", description: "Edit names used inside the timetable.", icon: BookMarked },
  { href: "/settings", label: "Settings", description: "Configure login credentials and sync options for ERP access.", icon: Settings },
  { href: "/more/games", label: "Games", description: "Take a quick break", icon: Gamepad2 },
];

export default function More() {
  return (
    <Layout title="More">
      <div className="mt-2 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 md:gap-4">
        {moreLinks.map((item) => (
          <Link
            key={item.href}
            to={item.href}
            className="tap group flex flex-row items-center justify-between md:flex-col md:items-start md:justify-between rounded-xl border border-ink/10 bg-white p-4 md:p-5 shadow-soft hover:shadow-md hover:border-ink/20 transition-all"
          >
            <div className="flex items-center gap-4 md:flex-col md:items-start md:gap-3 w-full">
              <div className="flex shrink-0 items-center justify-center md:h-12 md:w-12 md:rounded-full md:bg-ink/5 md:group-hover:bg-ink/10 transition-colors">
                <item.icon size={20} className="text-ink/70 md:h-6 md:w-6" />
              </div>
              <div>
                <p className="font-bold text-ink md:text-lg">{item.label}</p>
                <p className="text-xs text-ink/60 md:mt-1">{item.description}</p>
              </div>
            </div>
            <ChevronRight size={20} className="text-ink/40 md:hidden" />
          </Link>
        ))}
      </div>

    </Layout>
  );
}

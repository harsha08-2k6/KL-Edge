import { Link, useLocation } from "react-router-dom";
import { BookOpenCheck, Calendar, Home, Search, Settings } from "lucide-react";

const navItems = [
  { href: "/", label: "Home", icon: Home },
  { href: "/subjects", label: "Subjects", icon: BookOpenCheck },
  { href: "/timetable", label: "Timetable", icon: Calendar },
  { href: "/faculty", label: "Faculty", icon: Search },
  { href: "/settings", label: "Settings", icon: Settings }
];

export function Layout({ children, title, action }) {
  const location = useLocation();

  return (
    <main className="app-shell mx-auto flex w-full max-w-3xl flex-col px-4 pt-5 sm:px-6">
      <header className="mb-5 flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-mint">KL Edge</p>
          <h1 className="mt-1 text-2xl font-black tracking-normal text-ink">{title}</h1>
        </div>
        {action}
      </header>

      {children}

      <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-ink/10 bg-paper/95 px-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-2 backdrop-blur">
        <div className="mx-auto grid max-w-3xl grid-cols-5 gap-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = location.pathname === item.href;

            return (
              <Link
                key={item.href}
                to={item.href}
                className={`tap flex flex-col items-center justify-center rounded-lg text-[11px] font-bold ${
                  active ? "bg-ink text-paper" : "text-ink/62"
                }`}
                title={item.label}
              >
                <Icon size={19} aria-hidden="true" />
                <span className="mt-1">{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </main>
  );
}


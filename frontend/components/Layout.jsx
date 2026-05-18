import { Link, useLocation } from "react-router-dom";
import { BookOpenCheck, Calendar, Home, MoreHorizontal, Users } from "lucide-react";

const navItems = [
  { href: "/", label: "Home", icon: Home },
  { href: "/subjects", label: "Subjects", icon: BookOpenCheck },
  { href: "/timetable", label: "Timetable", icon: Calendar },
  { href: "/faculty", label: "Faculty", icon: Users },
  {
    href: "/more",
    label: "More",
    icon: MoreHorizontal,
    aliases: ["/marks", "/seating-plan", "/settings", "/cgpa"]
  }
];

const widthClasses = {
  default: "max-w-2xl",
  wide: "max-w-3xl"
};

export function Layout({ children, title, action, width = "default" }) {
  const location = useLocation();
  const shellWidth = widthClasses[width] || widthClasses.default;

  return (
    <main className={`app-shell mx-auto flex w-full ${shellWidth} flex-col px-3 pt-3 sm:px-4`}>
      <header className="mb-3 flex items-center justify-between gap-3">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-mint">KL Edge</p>
          <h1 className="mt-0.5 text-xl font-black tracking-normal text-ink">{title}</h1>
        </div>
        {action}
      </header>

      {children}

      <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-ink/10 bg-paper/95 px-2 pb-[calc(0.35rem+env(safe-area-inset-bottom))] pt-1 backdrop-blur">
        <div className="mx-auto grid max-w-2xl grid-cols-5 gap-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = location.pathname === item.href || (item.aliases || []).includes(location.pathname);

            return (
              <Link
                key={item.href}
                to={item.href}
                className={`tap flex h-11 flex-col items-center justify-center rounded-md text-[10px] font-bold ${
                  active ? "bg-ink text-paper" : "text-ink/62"
                }`}
                title={item.label}
              >
                <Icon size={16} aria-hidden="true" />
                <span className="mt-0.5">{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </main>
  );
}

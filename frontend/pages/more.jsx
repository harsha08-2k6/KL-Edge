import { Calculator, ChevronRight, MapPin, Search, Settings } from "lucide-react";
import { Link } from "react-router-dom";
import { Layout } from "../components/Layout.jsx";

const moreItems = [
  {
    to: "/faculty",
    label: "Faculty",
    description: "Search cabin and department details",
    icon: Search
  },
  {
    to: "/seating-plan",
    label: "Seating Plan",
    description: "Find exam room and seat info",
    icon: MapPin
  },
  {
    to: "/cgpa",
    label: "CGPA",
    description: "Track overall grade points",
    icon: Calculator
  },
  {
    to: "/settings",
    label: "Settings",
    description: "ERP credentials and sync options",
    icon: Settings
  }
];

export default function More() {
  return (
    <Layout title="More">
      <section className="space-y-2.5">
        {moreItems.map((item) => {
          const Icon = item.icon;

          return (
            <Link
              key={item.to}
              to={item.to}
              className="tap flex items-center justify-between rounded-lg border border-ink/10 bg-white p-3 shadow-soft"
            >
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-surface text-ink/60">
                  <Icon size={18} aria-hidden="true" />
                </span>
                <div>
                  <p className="text-sm font-black text-ink">{item.label}</p>
                  <p className="text-xs font-semibold text-ink/45">{item.description}</p>
                </div>
              </div>
              <ChevronRight size={18} className="text-ink/30" aria-hidden="true" />
            </Link>
          );
        })}
      </section>
    </Layout>
  );
}

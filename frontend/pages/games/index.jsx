import { ChevronRight, Grid3X3, Worm } from "lucide-react";
import { Link } from "react-router-dom";
import { Layout } from "../../components/Layout.jsx";

const gamesLinks = [
  {
    href: "/more/games/tic-tac-toe",
    label: "Tic-Tac-Toe",
    description: "2-player local game with X/O turns, win checks, draws, and restart.",
    icon: Grid3X3,
    marker: "XO",
    tone: "bg-mint/10 text-mint"
  },
  {
    href: "/more/games/snake",
    label: "Snake",
    description: "Arrow/WASD controls, food, growth, speed-ups, score, and collisions.",
    icon: Worm,
    marker: "SN",
    tone: "bg-lime/25 text-ink"
  },

];

export default function Games() {
  return (
    <Layout title="Games" backTo="/more">
      <div className="mt-2 grid gap-2">
        {gamesLinks.map((item) => (
          <Link
            key={item.href}
            to={item.href}
            className="tap flex items-center justify-between rounded-xl border border-ink/10 bg-white p-4 shadow-soft transition-transform active:scale-[0.99]"
          >
            <div className="flex min-w-0 items-center gap-4">
              <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-lg ${item.tone}`}>
                <item.icon size={20} />
              </div>
              <div className="min-w-0">
                <p className="font-bold text-ink">
                  <span className="mr-2 text-xs font-black text-ink/35">{item.marker}</span>
                  {item.label}
                </p>
                <p className="mt-0.5 text-xs leading-relaxed text-ink/60">{item.description}</p>
              </div>
            </div>
            <ChevronRight size={20} className="ml-3 shrink-0 text-ink/40" />
          </Link>
        ))}
      </div>
    </Layout>
  );
}

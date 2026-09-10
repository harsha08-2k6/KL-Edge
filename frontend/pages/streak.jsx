import { useState, useEffect } from "react";
import { Layout } from "../components/Layout.jsx";
import { getStreakStats, logVisit, syncLeaderboard } from "../utils/streak.js";
import { readLocal, STORAGE_KEYS, writeLocal } from "../utils/storage.js";
import { Flame, Calendar as CalendarIcon, Info, Trophy, Users, Globe } from "lucide-react";

export default function Streak() {
  const [stats, setStats] = useState({ streak: 0, longestStreak: 0, totalActiveDays: 0, activeDaysThisMonth: 0, visits: [] });
  const [leaderboard, setLeaderboard] = useState([]);
  const [userRank, setUserRank] = useState(null);
  const [userData, setUserData] = useState(null);
  const [activeTab, setActiveTab] = useState("overall");
  
  const [isPublic, setIsPublic] = useState(() => {
    return readLocal("kl-edge.leaderboardPublic", true);
  });
  
  const credentials = readLocal(STORAGE_KEYS.credentials, { erpId: "" });
  const erpId = credentials.erpId;

  useEffect(() => {
    logVisit();
    const currentStats = getStreakStats();
    setStats(currentStats);
    
    if (erpId) {
      syncLeaderboard(erpId, currentStats, isPublic).then(() => fetchLeaderboard());
    }
  }, [isPublic, erpId, activeTab]);

  const fetchLeaderboard = async () => {
    try {
      const API_BASE = import.meta.env.VITE_API_BASE || "";
      const res = await fetch(`${API_BASE}/api/leaderboard?erpId=${erpId}&group=${activeTab}`);
      const data = await res.json();
      setLeaderboard(data.leaderboard || []);
      setUserRank(data.userRank);
      setUserData(data.userData);
    } catch (e) {
      console.error(e);
    }
  };

  const togglePrivacy = () => {
    const nextVal = !isPublic;
    setIsPublic(nextVal);
    writeLocal("kl-edge.leaderboardPublic", nextVal);
  };

  const visitsSet = new Set(stats.visits);
  
  // Basic calendar logic
  const today = new Date();
  const currentMonth = today.getMonth();
  const currentYear = today.getFullYear();
  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  const firstDayOfMonth = new Date(currentYear, currentMonth, 1).getDay(); // 0 is Sunday
  
  const firstDayShifted = firstDayOfMonth === 0 ? 6 : firstDayOfMonth - 1;

  const calendarDays = [];
  for (let i = 0; i < firstDayShifted; i++) {
    calendarDays.push(null);
  }
  for (let i = 1; i <= daysInMonth; i++) {
    const d = new Date(currentYear, currentMonth, i);
    const dateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
    calendarDays.push({
      date: i,
      dateStr,
      isSunday: d.getDay() === 0,
      isVisited: visitsSet.has(dateStr),
      isFuture: d > today
    });
  }

  const weekDays = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

  return (
    <Layout title="Your Streak">
      <div className="space-y-4">
        
        {/* MY STREAK Section */}
        <div className="rounded-xl border border-ink/10 bg-white p-5 shadow-soft">
          <div className="flex items-center gap-2 mb-4">
            <Flame size={20} className="text-orange-500" />
            <h2 className="text-sm font-black text-ink uppercase tracking-wider">MY STREAK</h2>
          </div>
          <hr className="mb-4 border-ink/5" />
          
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-orange-500/10 text-orange-600">
                <Flame size={28} />
              </div>
              <div>
                <p className="text-3xl font-black text-ink">{stats.streak} Days</p>
                <div className="flex gap-3 text-[11px] font-bold text-ink/50 mt-1">
                  <span>Longest: {stats.longestStreak} Days</span>
                  <span>Active Days: {stats.totalActiveDays}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Privacy Setting */}
        <div className="flex items-center justify-between rounded-xl border border-ink/10 bg-white p-4 shadow-soft">
          <div className="min-w-0 flex-1">
            <h4 className="text-sm font-black text-ink">Appear on leaderboard: {isPublic ? "ON" : "OFF"}</h4>
          </div>
          <button
            type="button"
            onClick={togglePrivacy}
            className="relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-mint/20"
            style={{ backgroundColor: isPublic ? "var(--mint, #10b981)" : "rgba(18, 21, 31, 0.12)" }}
          >
            <span className="sr-only">Toggle Privacy</span>
            <span
              className="pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow transition duration-200 ease-in-out"
              style={{ transform: isPublic ? "translateX(20px)" : "translateX(0px)" }}
            />
          </button>
        </div>

        {/* LEADERBOARD Section */}
        <div className="rounded-xl border border-ink/10 bg-white p-5 shadow-soft">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Trophy size={20} className="text-[#FFD700]" />
              <h2 className="text-sm font-black text-ink uppercase tracking-wider">STREAK LEADERBOARD</h2>
            </div>
          </div>
          
          <div className="flex bg-surface p-1 rounded-lg mb-4">
            <button 
              onClick={() => setActiveTab("batch")}
              className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs font-bold rounded-md transition-colors ${activeTab === 'batch' ? 'bg-white shadow-sm text-ink' : 'text-ink/60'}`}
            >
              <Users size={14} /> My Batch
            </button>
            <button 
              onClick={() => setActiveTab("overall")}
              className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs font-bold rounded-md transition-colors ${activeTab === 'overall' ? 'bg-white shadow-sm text-ink' : 'text-ink/60'}`}
            >
              <Globe size={14} /> Overall
            </button>
          </div>

          <div className="space-y-3">
            {leaderboard.map((user, idx) => {
              const rank = idx + 1;
              let medal = "";
              if (rank === 1) medal = "🥇";
              else if (rank === 2) medal = "🥈";
              else if (rank === 3) medal = "🥉";
              
              const isMe = user.erp_id === erpId || (user.erp_id.includes("***") && userRank === rank && isPublic);

              return (
                <div key={idx} className={`flex items-center justify-between p-2 rounded-lg ${isMe ? 'bg-orange-500/10 border border-orange-500/20' : ''}`}>
                  <div className="flex items-center gap-3">
                    <span className="w-6 text-center font-bold text-sm text-ink/60">{medal || `${rank}.`}</span>
                    <span className={`font-black text-sm ${isMe ? 'text-orange-600' : 'text-ink'}`}>
                      {user.erp_id} {isMe ? '(You)' : ''}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 text-sm font-bold text-ink">
                    <Flame size={14} className="text-orange-500" />
                    {user.current_streak} days
                  </div>
                </div>
              );
            })}
            
            {leaderboard.length === 0 && (
              <div className="text-center py-4 text-ink/40 text-xs font-bold">No data available yet</div>
            )}
            
            {/* Show current user rank if not in top list */}
            {userRank && userRank > leaderboard.length && (
              <>
                <div className="text-center text-ink/30 pb-1">...</div>
                <div className="flex items-center justify-between p-2 rounded-lg bg-orange-500/10 border border-orange-500/20">
                  <div className="flex items-center gap-3">
                    <span className="w-6 text-center font-bold text-sm text-ink/60">{userRank}.</span>
                    <span className="font-black text-sm text-orange-600">
                      {erpId} (You)
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 text-sm font-bold text-ink">
                    <Flame size={14} className="text-orange-500" />
                    {stats.streak} days
                  </div>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Info Card */}
        <div className="flex items-start gap-3 rounded-xl border border-ink/10 bg-white p-4 shadow-soft">
          <Info className="mt-0.5 text-mint shrink-0" size={18} />
          <p className="text-xs font-bold text-ink/70">
            Sundays missed don't affect your streak. However, visiting on Sundays will increase it!
          </p>
        </div>

        {/* Calendar */}
        <div className="rounded-xl border border-ink/10 bg-white p-5 shadow-soft mb-8">
          <div className="flex items-center gap-2 mb-4">
            <CalendarIcon size={18} className="text-ink/60" />
            <h3 className="text-base font-black text-ink">
              {today.toLocaleString('default', { month: 'long' })} {currentYear}
            </h3>
          </div>
          
          <div className="grid grid-cols-7 gap-2">
            {weekDays.map((day, idx) => (
              <div key={idx} className="text-center text-[10px] font-black text-ink/40 uppercase">
                {day}
              </div>
            ))}
            
            {calendarDays.map((dayInfo, idx) => {
              if (!dayInfo) {
                return <div key={`empty-${idx}`} className="h-8"></div>;
              }
              
              let bgColor = "bg-surface text-ink/40"; // default unvisited past
              let icon = null;
              
              if (dayInfo.isFuture) {
                bgColor = "bg-surface/50 text-ink/20";
              } else if (dayInfo.isVisited) {
                bgColor = "bg-orange-500/20 text-orange-600 font-bold border border-orange-500/30";
                icon = "🔥";
              } else if (dayInfo.isSunday) {
                bgColor = "bg-mint/10 text-mint font-bold border border-mint/20"; // Missed Sunday (Neutral)
                icon = "Rest";
              } else {
                bgColor = "bg-coral/10 text-coral font-bold border border-coral/20";
                icon = "❌";
              }
              
              return (
                <div 
                  key={dayInfo.dateStr}
                  className={`flex flex-col items-center justify-center rounded-lg h-10 w-full ${bgColor} transition-colors`}
                  title={dayInfo.dateStr}
                >
                  <span className="text-[11px] leading-none">{dayInfo.date}</span>
                  {icon && (
                    <span className="text-[8px] mt-0.5" style={{ fontSize: icon === 'Rest' ? '8px' : '10px' }}>
                      {icon}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </Layout>
  );
}

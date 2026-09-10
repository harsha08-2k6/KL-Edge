import { useState, useEffect } from "react";
import { Layout } from "../components/Layout.jsx";
import { readLocal, STORAGE_KEYS, writeLocal } from "../utils/storage.js";
import { Footprints, Trophy, Info, AlertTriangle, Users, Globe, RefreshCcw } from "lucide-react";

export default function Steps() {
  const [isEnabled, setIsEnabled] = useState(() => {
    return readLocal("kl-edge.stepsEnabled", false);
  });
  
  const [isSupported, setIsSupported] = useState(true);
  const [checkingSupport, setCheckingSupport] = useState(false);
  
  const [stats, setStats] = useState({ todaySteps: 0, totalSteps: 0, edgePoints: 0, lastSynced: null });
  const [leaderboard, setLeaderboard] = useState([]);
  const [userRank, setUserRank] = useState(null);
  const [userData, setUserData] = useState(null);
  const [activeTab, setActiveTab] = useState("overall");
  
  const [isPublic, setIsPublic] = useState(() => {
    return readLocal("kl-edge.stepsPublic", false);
  });
  
  const credentials = readLocal(STORAGE_KEYS.credentials, { erpId: "" });
  const erpId = credentials.erpId;
  const API_BASE = import.meta.env.VITE_API_BASE || "";

  useEffect(() => {
    if (isEnabled) {
      checkDeviceSupport();
    }
  }, [isEnabled]);

  useEffect(() => {
    if (isEnabled && isSupported && erpId) {
      fetchMyStats();
      fetchLeaderboard();
    }
  }, [isEnabled, isSupported, isPublic, erpId, activeTab]);

  const checkDeviceSupport = () => {
    setCheckingSupport(true);
    // Simulate checking for a native health API
    setTimeout(() => {
      // BYPASS: Forcing this to true so you can see the UI during development
      setIsSupported(true);
      setCheckingSupport(false);
    }, 800);
  };

  const toggleEnable = () => {
    const nextVal = !isEnabled;
    setIsEnabled(nextVal);
    writeLocal("kl-edge.stepsEnabled", nextVal);
  };

  const togglePrivacy = () => {
    const nextVal = !isPublic;
    setIsPublic(nextVal);
    writeLocal("kl-edge.stepsPublic", nextVal);
    
    if (isEnabled && isSupported && erpId) {
      syncSteps(stats.todaySteps, stats.totalSteps, nextVal);
    }
  };

  const fetchMyStats = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/steps/me?erpId=${erpId}`);
      if (res.ok) {
        const data = await res.json();
        setStats({
          todaySteps: data.today_steps || 0,
          totalSteps: data.total_steps || 0,
          edgePoints: data.edge_points || 0,
          lastSynced: data.last_synced || new Date().toISOString()
        });
      }
    } catch (e) {
      console.error(e);
    }
  };

  const fetchLeaderboard = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/steps/leaderboard?erpId=${erpId}&group=${activeTab}`);
      if (res.ok) {
        const data = await res.json();
        setLeaderboard(data.leaderboard || []);
        setUserRank(data.userRank);
        setUserData(data.userData);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const syncSteps = async (today, total, pub) => {
    try {
      await fetch(`${API_BASE}/api/steps/sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          erpId,
          todaySteps: today,
          totalSteps: total,
          isPublic: pub
        })
      });
      fetchMyStats();
    } catch (e) {
      console.error(e);
    }
  };

  // Helper function to format large numbers
  const fmt = (num) => new Intl.NumberFormat('en-US').format(num);

  if (!isEnabled) {
    return (
      <Layout title="Steps Counter">
        <div className="flex flex-col items-center justify-center py-12 px-4 space-y-6">
          <div className="h-24 w-24 rounded-full bg-blue-500/10 flex items-center justify-center text-blue-500">
            <Footprints size={48} />
          </div>
          
          <div className="text-center space-y-2">
            <h2 className="text-xl font-black text-ink">Steps Counter</h2>
            <p className="text-sm font-bold text-ink/60 max-w-xs mx-auto">
              Enable Steps Counter to track your steps and earn Edge Points.
            </p>
          </div>

          <div className="flex items-center justify-between w-full max-w-xs rounded-xl border border-ink/10 bg-white p-4 shadow-soft">
            <span className="text-sm font-black text-ink">Steps Counter: <span className="text-coral">OFF</span></span>
            <button
              type="button"
              onClick={toggleEnable}
              className="relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500/20 bg-ink/10"
            >
              <span className="sr-only">Toggle Steps</span>
              <span className="pointer-events-none inline-block h-5 w-5 transform translate-x-0 rounded-full bg-white shadow transition duration-200 ease-in-out" />
            </button>
          </div>
        </div>
      </Layout>
    );
  }

  if (checkingSupport) {
    return (
      <Layout title="Steps Counter">
        <div className="flex flex-col items-center justify-center py-20">
          <RefreshCcw className="animate-spin text-blue-500 mb-4" size={32} />
          <p className="text-sm font-bold text-ink/60">Checking device capabilities...</p>
        </div>
      </Layout>
    );
  }

  if (!isSupported) {
    return (
      <Layout title="Steps Counter">
        <div className="space-y-4">
          <div className="flex items-center justify-between rounded-xl border border-ink/10 bg-white p-4 shadow-soft">
            <span className="text-sm font-black text-ink">Steps Counter: <span className="text-mint">ON</span></span>
            <button
              type="button"
              onClick={toggleEnable}
              className="relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500/20 bg-mint"
            >
              <span className="sr-only">Toggle Steps</span>
              <span className="pointer-events-none inline-block h-5 w-5 transform translate-x-5 rounded-full bg-white shadow transition duration-200 ease-in-out" />
            </button>
          </div>

          <div className="rounded-xl border border-coral/20 bg-coral/5 p-6 text-center space-y-3">
            <AlertTriangle className="text-coral mx-auto" size={32} />
            <h3 className="text-base font-black text-ink">Not Supported</h3>
            <p className="text-sm font-bold text-ink/70">
              Step tracking is currently unavailable on this device/browser.
            </p>
            <p className="text-xs font-bold text-ink/50 mt-2">
              Standard web browsers cannot securely access Apple Health or Google Fit data natively. The KL-Edge backend is structured to receive this data when an integrated app wrapper becomes available.
            </p>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout title="Steps Counter">
      <div className="space-y-4">
        
        <div className="flex items-center justify-between rounded-xl border border-ink/10 bg-white p-4 shadow-soft">
          <span className="text-sm font-black text-ink">Steps Counter: <span className="text-mint">ON</span></span>
          <button
            type="button"
            onClick={toggleEnable}
            className="relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500/20 bg-mint"
          >
            <span className="sr-only">Toggle Steps</span>
            <span className="pointer-events-none inline-block h-5 w-5 transform translate-x-5 rounded-full bg-white shadow transition duration-200 ease-in-out" />
          </button>
        </div>

        {/* Dashboard */}
        <div className="rounded-xl border border-ink/10 bg-white p-5 shadow-soft">
          <div className="flex items-center gap-2 mb-4">
            <Footprints size={20} className="text-blue-500" />
            <h2 className="text-sm font-black text-ink uppercase tracking-wider">STEPS COUNTER</h2>
          </div>
          <hr className="mb-4 border-ink/5" />
          
          <div className="space-y-5">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-xs font-bold text-ink/50 uppercase tracking-wide">Today</p>
                <p className="text-3xl font-black text-ink">{fmt(stats.todaySteps)} <span className="text-sm">steps</span></p>
              </div>
              <button
                onClick={() => {
                  const newToday = stats.todaySteps + 1000;
                  const newTotal = stats.totalSteps + 1000;
                  setStats(s => ({ ...s, todaySteps: newToday, totalSteps: newTotal }));
                  syncSteps(newToday, newTotal, isPublic);
                }}
                className="tap px-3 py-1.5 bg-blue-500/10 text-blue-600 rounded-lg text-xs font-bold hover:bg-blue-500/20"
              >
                +1,000 Steps
              </button>
            </div>
            
            <div className="flex items-center gap-2 bg-yellow-500/10 text-yellow-600 px-3 py-1.5 rounded-lg w-fit">
              <span className="font-bold text-sm">⭐ +{fmt(stats.edgePoints)} Edge Points</span>
            </div>

            <div>
              <p className="text-xs font-bold text-ink/50 uppercase tracking-wide">Total</p>
              <p className="text-xl font-black text-ink">{fmt(stats.totalSteps)} <span className="text-xs">steps</span></p>
            </div>
            
            {stats.lastSynced && (
              <p className="text-[10px] font-bold text-ink/40">
                Last synced: {new Date(stats.lastSynced).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
              </p>
            )}
          </div>
        </div>

        {/* Privacy Setting */}
        <div className="flex items-center justify-between rounded-xl border border-ink/10 bg-white p-4 shadow-soft">
          <div className="min-w-0 flex-1">
            <h4 className="text-sm font-black text-ink">Show me on Steps Leaderboard: {isPublic ? "ON" : "OFF"}</h4>
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

        {/* Leaderboard */}
        <div className="rounded-xl border border-ink/10 bg-white p-5 shadow-soft mb-8">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Trophy size={20} className="text-[#FFD700]" />
              <h2 className="text-sm font-black text-ink uppercase tracking-wider">STEPS LEADERBOARD</h2>
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
                <div key={idx} className={`flex items-center justify-between p-2 rounded-lg ${isMe ? 'bg-blue-500/10 border border-blue-500/20' : ''}`}>
                  <div className="flex items-center gap-3">
                    <span className="w-6 text-center font-bold text-sm text-ink/60">{medal || `${rank}.`}</span>
                    <span className={`font-black text-sm ${isMe ? 'text-blue-600' : 'text-ink'}`}>
                      {user.erp_id}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 text-sm font-bold text-ink">
                    <Footprints size={14} className="text-blue-500" />
                    {fmt(user.total_steps)}
                  </div>
                </div>
              );
            })}
            
            {leaderboard.length === 0 && (
              <div className="text-center py-4 text-ink/40 text-xs font-bold">No data available yet</div>
            )}
            
            {/* Show current user rank if not in top list */}
            {userRank && userRank > leaderboard.length && isPublic && (
              <>
                <div className="text-center text-ink/30 pb-1">...</div>
                <div className="flex items-center justify-between p-2 rounded-lg bg-blue-500/10 border border-blue-500/20">
                  <div className="flex items-center gap-3">
                    <span className="w-6 text-center font-bold text-sm text-ink/60">{userRank}.</span>
                    <span className="font-black text-sm text-blue-600">
                      {erpId} (You)
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 text-sm font-bold text-ink">
                    <Footprints size={14} className="text-blue-500" />
                    {fmt(stats.totalSteps)}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>

      </div>
    </Layout>
  );
}

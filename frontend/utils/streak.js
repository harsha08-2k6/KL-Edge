import { readLocal, writeLocal } from "./storage.js";

const STREAK_KEY = "kl-edge.streakData";

// Returns a date string in YYYY-MM-DD format (local time)
function formatDateStr(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

export function getTodayStr() {
    return formatDateStr(new Date());
}

const inFlightLogVisits = new Map();
const inFlightVisits = new Map();
const cachedVisitsMemory = new Map();

export async function fetchVisits(erpId) {
    if (!erpId) return [];
    
    // Check in-memory cache with 60-second TTL
    const now = Date.now();
    if (cachedVisitsMemory.has(erpId)) {
        const { timestamp, visits } = cachedVisitsMemory.get(erpId);
        if (now - timestamp < 60000) {
            return visits;
        }
    }

    // Deduplicate in-flight fetch
    if (inFlightVisits.has(erpId)) {
        return inFlightVisits.get(erpId);
    }

    const t0 = performance.now();
    const fetchPromise = (async () => {
        try {
            const API_BASE = import.meta.env.VITE_API_BASE || "";
            const res = await fetch(`${API_BASE}/api/streak/visits?erpId=${erpId}`);
            const data = await res.json();
            const visits = data.visits || [];
            cachedVisitsMemory.set(erpId, { timestamp: Date.now(), visits });
            const dur = performance.now() - t0;
            console.log(`[streak:timing] fetchVisits(${erpId}) took ${dur.toFixed(2)}ms (count: ${visits.length})`);
            return visits;
        } catch (e) {
            console.error("Failed to fetch visits", e);
            return [];
        } finally {
            inFlightVisits.delete(erpId);
        }
    })();

    inFlightVisits.set(erpId, fetchPromise);
    return fetchPromise;
}

// Function to log today's visit with duplicate prevention & timing metrics
export async function logVisit(erpId) {
    if (!erpId) return { status: "skipped" };
    const todayStr = getTodayStr(); // Using local time from device
    const lastLoggedKey = `kl-edge.lastLoggedVisit_${erpId}`;

    // 1. Skip network request if today's visit is already confirmed in local storage
    if (readLocal(lastLoggedKey, "") === todayStr) {
        return { status: "ok", cached: true };
    }

    // 2. Deduplicate in-flight concurrent requests for the same erpId
    if (inFlightLogVisits.has(erpId)) {
        return inFlightLogVisits.get(erpId);
    }

    const t0 = performance.now();
    const logPromise = (async () => {
        try {
            const API_BASE = import.meta.env.VITE_API_BASE || "";
            const res = await fetch(`${API_BASE}/api/streak/log`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ erpId, date: todayStr })
            });
            const data = await res.json();
            writeLocal(lastLoggedKey, todayStr);
            const dur = performance.now() - t0;
            console.log(`[streak:timing] logVisit(${erpId}) took ${dur.toFixed(2)}ms (status: ${data.status})`);
            return data;
        } catch (e) {
            console.error("Failed to log visit", e);
            return { status: "error", error: e };
        } finally {
            inFlightLogVisits.delete(erpId);
        }
    })();

    inFlightLogVisits.set(erpId, logPromise);
    return logPromise;
}

// Function to calculate current streak
export function getStreakStats(visitsArray) {
    const visits = new Set(visitsArray || []);
    let streak = 0;
    
    let iterDate = new Date();
    iterDate.setHours(0, 0, 0, 0);
    
    const todayStr = formatDateStr(iterDate);
    
    // If today is visited, start streak at 1, then check yesterday
    // If today is not visited, start checking from yesterday (streak not broken until day ends)
    if (visits.has(todayStr)) {
        streak = 1;
    }
    
    iterDate.setDate(iterDate.getDate() - 1);
    
    while (true) {
        const iterStr = formatDateStr(iterDate);
        const isVisited = visits.has(iterStr);
        const isSunday = iterDate.getDay() === 0; // 0 is Sunday
        
        if (isVisited) {
            streak++;
        } else {
            if (!isSunday) {
                // Missed a non-Sunday day. Streak breaks.
                break;
            }
            // Missed a Sunday. Do nothing, just continue checking past days.
        }
        
        iterDate.setDate(iterDate.getDate() - 1);
    }
    
    // Active days this month
    const thisMonth = new Date().getMonth();
    const thisYear = new Date().getFullYear();
    const activeDaysThisMonth = Array.from(visits).filter(dateStr => {
        const [y, m, d] = dateStr.split("-").map(Number);
        return y === thisYear && (m - 1) === thisMonth;
    }).length;
    
    // Calculate longest streak
    let currentLongest = 0;
    let tempStreak = 0;
    const sortedVisits = Array.from(visits).sort((a, b) => new Date(a) - new Date(b));
    
    if (sortedVisits.length > 0) {
        let prevDate = new Date(sortedVisits[0]);
        prevDate.setHours(0,0,0,0);
        tempStreak = 1;
        currentLongest = 1;
        
        for (let i = 1; i < sortedVisits.length; i++) {
            const currDate = new Date(sortedVisits[i]);
            currDate.setHours(0,0,0,0);
            
            const diffDays = Math.round((currDate - prevDate) / (1000 * 60 * 60 * 24));
            
            if (diffDays === 1) {
                tempStreak++;
            } else if (diffDays > 1) {
                // Check if intermediate days were all Sundays
                let allSundays = true;
                let testDate = new Date(prevDate);
                testDate.setDate(testDate.getDate() + 1);
                while (testDate < currDate) {
                    if (testDate.getDay() !== 0) {
                        allSundays = false;
                        break;
                    }
                    testDate.setDate(testDate.getDate() + 1);
                }
                
                if (allSundays) {
                    tempStreak++; // Keep streak alive, but only increment once for the visited day
                } else {
                    tempStreak = 1; // Broken streak
                }
            }
            
            if (tempStreak > currentLongest) {
                currentLongest = tempStreak;
            }
            prevDate = currDate;
        }
    }

    // Longest streak is at least the current streak
    if (streak > currentLongest) {
        currentLongest = streak;
    }

    return {
        streak,
        longestStreak: currentLongest,
        activeDaysThisMonth,
        totalActiveDays: visits.size,
        visits: Array.from(visits)
    };
}

export async function syncLeaderboard(erpId, stats, isPublic = true) {
    if (!erpId) return;
    const t0 = performance.now();
    try {
        const API_BASE = import.meta.env.VITE_API_BASE || "";
        const res = await fetch(`${API_BASE}/api/leaderboard/update`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                erpId,
                streak: stats.streak,
                longestStreak: stats.longestStreak,
                activeDays: stats.totalActiveDays,
                isPublic
            })
        });
        const data = await res.json();
        const dur = performance.now() - t0;
        console.log(`[streak:timing] syncLeaderboard(${erpId}) took ${dur.toFixed(2)}ms (skipped: ${!!data.skipped})`);
        return data;
    } catch (e) {
        console.error("Failed to sync leaderboard", e);
    }
}

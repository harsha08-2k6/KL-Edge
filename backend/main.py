import os
import time
import asyncio
from datetime import datetime, timedelta
import sqlite3
import base64

from fastapi import FastAPI, HTTPException, File, UploadFile, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, HTMLResponse
from pydantic import BaseModel
from typing import Optional

from erp_scraper import (
    AppError,
    LOGIN_URL,
    create_captcha_session,
    get_captcha_session,
    load_faculty,
    perform_login,
    redis_client,
    sync_attendance,
    sync_cgpa,
    sync_marks,
    sync_seating_plan,
    sync_timetable,
    filter_seating_plan,
    clone_session,
    get_menu_data
)
import json
from routes.map import router as map_router
from routes.calendar import router as calendar_router
from services.calendar_service import init_calendar_db, run_scheduled_calendar_job
from services.lms_scraper import authenticate_lms, get_lms_assignments
from fastapi import Header
from supabase_client import get_supabase


# Redis key for faculty cache
FACULTY_CACHE_KEY = "faculty_cache"
FACULTY_CACHE_TTL_SECONDS = 86400  # 24 hours



def cached_faculty():
    """Get cached faculty data from Redis if available."""
    if redis_client is None:
        return None
    try:
        cached = redis_client.get(FACULTY_CACHE_KEY)
        if cached:
            return json.loads(cached)
    except Exception:
        pass
    return None


def cache_faculty(faculty_data):
    """Cache faculty data in Redis."""
    if redis_client is None:
        return
    try:
        redis_client.setex(
            FACULTY_CACHE_KEY,
            FACULTY_CACHE_TTL_SECONDS,
            json.dumps(faculty_data)
        )
    except Exception:
        pass


def get_db_connection():
    db_path = os.path.join(os.path.dirname(__file__), "campus_map.db")
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    return conn




# In-memory L1 cache for KV caching (Timetable, Seating Plan, etc.)
_l1_kv_cache: dict[str, tuple[float, any]] = {}
L1_CACHE_TTL_SECONDS = 300.0  # 5 minutes in-memory cache


def init_kv_cache():
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("CREATE TABLE IF NOT EXISTS kv_cache (key TEXT PRIMARY KEY, value TEXT)")
        conn.commit()
        conn.close()
    except Exception as e:
        print(f"[cache:init] SQLite error: {e}", flush=True)


init_kv_cache()


def get_cached_json(key: str):
    # 1. Fast in-memory L1 cache check (<0.01ms)
    now = time.time()
    if key in _l1_kv_cache:
        cached_ts, val = _l1_kv_cache[key]
        if now - cached_ts < L1_CACHE_TTL_SECONDS:
            return val

    # 2. Redis cache check
    if redis_client is not None:
        try:
            cached = redis_client.get(key)
            if cached:
                val = json.loads(cached)
                _l1_kv_cache[key] = (now, val)
                return val
        except Exception:
            pass

    # 3. SQLite persistent cache check
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT value FROM kv_cache WHERE key = ?", (key,))
        row = cursor.fetchone()
        conn.close()
        if row:
            val = json.loads(row["value"])
            _l1_kv_cache[key] = (now, val)
            return val
    except Exception as e:
        print(f"[cache:get] SQLite error: {e}", flush=True)
    return None


def set_cached_json(key: str, value):
    now = time.time()
    _l1_kv_cache[key] = (now, value)

    if redis_client is not None:
        try:
            redis_client.set(key, json.dumps(value))
            return
        except Exception:
            pass
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("INSERT OR REPLACE INTO kv_cache (key, value) VALUES (?, ?)", (key, json.dumps(value)))
        conn.commit()
        conn.close()
    except Exception as e:
        print(f"[cache:set] SQLite error: {e}", flush=True)





TIMETABLE_CACHE_TTL_SECONDS = int(os.getenv("TIMETABLE_CACHE_TTL_SECONDS", "604800"))  # 7 days


def make_timetable_cache_key(erp_id: str, academic_year: str, semester_id: str) -> str:
    c_id = (erp_id or "").strip().lower()
    c_year = (academic_year or "").strip().lower().replace(" ", "")
    c_sem = (semester_id or "").strip().lower().replace(" ", "")
    return f"timetable:{c_id}:{c_year}:{c_sem}"


def get_cached_timetable(erp_id: str, academic_year: str, semester_id: str) -> Optional[dict]:
    if not erp_id or not academic_year or not semester_id:
        return None
    key = make_timetable_cache_key(erp_id, academic_year, semester_id)
    cached = get_cached_json(key)
    if not cached or not isinstance(cached, dict):
        return None
    cached_at = cached.get("_cached_at")
    if cached_at:
        try:
            cached_time = datetime.fromisoformat(cached_at.replace("Z", ""))
            if datetime.utcnow() - cached_time > timedelta(seconds=TIMETABLE_CACHE_TTL_SECONDS):
                return None
        except Exception:
            pass
    return cached


def set_cached_timetable(erp_id: str, academic_year: str, semester_id: str, data: dict):
    if not erp_id or not academic_year or not semester_id or not data or not data.get("grid"):
        return
    key = make_timetable_cache_key(erp_id, academic_year, semester_id)
    to_store = dict(data)
    now_iso = f"{datetime.utcnow().isoformat()}Z"
    to_store["_cached_at"] = now_iso
    to_store["cachedAt"] = now_iso
    to_store["refreshedAt"] = data.get("refreshedAt") or now_iso
    to_store["cached"] = True
    to_store["source"] = "cache"
    set_cached_json(key, to_store)


def make_seating_cache_key(erp_id: str, academic_year: str, semester_id: str) -> str:
    c_id = (erp_id or "").strip().lower()
    c_year = (academic_year or "").strip().lower().replace(" ", "")
    c_sem = (semester_id or "").strip().lower().replace(" ", "")
    return f"seating:{c_id}:{c_year}:{c_sem}"


def get_cached_seating_plan(erp_id: str, academic_year: str, semester_id: str) -> Optional[list]:
    if not erp_id or not academic_year or not semester_id:
        return None
    key = make_seating_cache_key(erp_id, academic_year, semester_id)
    cached = get_cached_json(key)
    if cached and isinstance(cached, list):
        return cached
    return None


def set_cached_seating_plan(erp_id: str, academic_year: str, semester_id: str, data: list):
    if not erp_id or not academic_year or not semester_id or data is None:
        return
    key = make_seating_cache_key(erp_id, academic_year, semester_id)
    set_cached_json(key, data)


def make_cgpa_cache_key(erp_id: str) -> str:
    c_id = (erp_id or "").strip().lower()
    return f"cgpa:{c_id}"


def get_cached_cgpa(erp_id: str) -> Optional[dict]:
    if not erp_id:
        return None
    key = make_cgpa_cache_key(erp_id)
    cached = get_cached_json(key)
    if cached and isinstance(cached, dict):
        return cached
    return None


def set_cached_cgpa(erp_id: str, data: dict):
    if not erp_id or not data:
        return
    key = make_cgpa_cache_key(erp_id)
    set_cached_json(key, data)


async def run_full_sync(payload: dict) -> dict:
    total_start = time.time()

    # 1. Authenticate once and reuse the valid ERP session
    login_start = time.time()
    session = await perform_login(payload)
    login_dur = time.time() - login_start
    print(f"[erp:sync] ERP authentication completed in {login_dur:.3f}s", flush=True)

    async def safe_sync(label, handler, fallback):
        t0 = time.time()
        try:
            res = await handler()
            dur = time.time() - t0
            return res, None, dur
        except AppError as exc:
            dur = time.time() - t0
            if os.getenv("ERP_DEBUG", "").lower() in {"1", "true", "yes"}:
                print(f"[erp:{label}] {exc.message}", flush=True)
            return fallback, exc.message, dur
        except Exception as exc:
            dur = time.time() - t0
            if os.getenv("ERP_DEBUG", "").lower() in {"1", "true", "yes"}:
                print(f"[erp:{label}] {exc}", flush=True)
            return fallback, str(exc), dur

    erp_id = payload.get("erpId", "")
    academic_year = payload.get("academicYear", "")
    semester_id = payload.get("semesterId", "")
    force_refresh = bool(payload.get("forceRefresh") or payload.get("refreshTimetable"))

    feature_statuses = {}
    now_iso = f"{datetime.utcnow().isoformat()}Z"

    # Smart cache checks for static / infrequently changing modules
    cached_tt = get_cached_timetable(erp_id, academic_year, semester_id) if not force_refresh else None
    cached_seating = get_cached_seating_plan(erp_id, academic_year, semester_id) if not force_refresh else None
    cached_cgpa = get_cached_cgpa(erp_id) if not force_refresh else None

    # Pre-cache menu-student.json once on session so all live modules share the cached menu
    try:
        await get_menu_data(session)
    except Exception:
        pass

    # Build active sync tasks dynamically:
    # 1. Attendance is ALWAYS scraped live (changes dynamically as classes happen)
    tasks = [
        safe_sync("attendance", lambda: sync_attendance(payload, session=session), [])
    ]
    task_keys = ["attendance"]

    # 2. Timetable: only scrape live if cache is empty or student requested force refresh
    need_tt_scrape = force_refresh or not (cached_tt and cached_tt.get("grid"))
    if need_tt_scrape:
        tasks.append(safe_sync("timetable", lambda: sync_timetable(payload, session=session), None))
        task_keys.append("timetable")
    else:
        print(f"[erp:sync] Timetable served from fast cache for {erp_id} (skipping 15s scrape)", flush=True)

    # 3. Seating Plan: only scrape live if cache is empty or student requested force refresh
    need_seat_scrape = force_refresh or not (cached_seating is not None and len(cached_seating) > 0)
    if need_seat_scrape:
        tasks.append(safe_sync("seating-plan", lambda: sync_seating_plan(payload, session=session), None))
        task_keys.append("seating-plan")
    else:
        print(f"[erp:sync] Seating plan served from fast cache for {erp_id} (skipping 14s scrape)", flush=True)

    # 4. CGPA: only scrape live if cache is empty or student requested force refresh
    need_cgpa_scrape = force_refresh or not (cached_cgpa and (cached_cgpa.get("value") is not None or cached_cgpa.get("subjects") or cached_cgpa.get("semesters")))
    if need_cgpa_scrape:
        tasks.append(safe_sync("cgpa", lambda: sync_cgpa(payload, session=session), None))
        task_keys.append("cgpa")
    else:
        print(f"[erp:sync] CGPA served from fast cache for {erp_id} (skipping 13s scrape)", flush=True)

    # Execute active sync operations concurrently using asyncio.gather
    raw_sync_results = await asyncio.gather(*tasks, return_exceptions=True)
    results_map = dict(zip(task_keys, raw_sync_results))

    # Unpack attendance result safely
    att_res = results_map.get("attendance")
    attendance, att_err, att_dur = ([], str(att_res), 0.0) if isinstance(att_res, Exception) else (att_res or ([], None, 0.0))

    # Unpack timetable result safely
    if need_tt_scrape:
        tt_res = results_map.get("timetable")
        timetable, tt_err, tt_dur = (None, str(tt_res), 0.0) if isinstance(tt_res, Exception) else (tt_res or (None, None, 0.0))
    else:
        timetable, tt_err, tt_dur = (cached_tt, None, 0.0)

    # Unpack seating plan result safely
    if need_seat_scrape:
        seat_res = results_map.get("seating-plan")
        seating_plan, seat_err, seat_dur = (None, str(seat_res), 0.0) if isinstance(seat_res, Exception) else (seat_res or (None, None, 0.0))
    else:
        seating_plan, seat_err, seat_dur = (cached_seating, None, 0.0)

    # Unpack cgpa result safely
    if need_cgpa_scrape:
        cgpa_res = results_map.get("cgpa")
        cgpa, cgpa_err, cgpa_dur = (None, str(cgpa_res), 0.0) if isinstance(cgpa_res, Exception) else (cgpa_res or (None, None, 0.0))
        if cgpa and (cgpa.get("value") is not None or cgpa.get("subjects") or cgpa.get("semesters")):
            set_cached_cgpa(erp_id, cgpa)
    else:
        cgpa, cgpa_err, cgpa_dur = (cached_cgpa, None, 0.0)

    if att_err:
        feature_statuses["attendance"] = {
            "status": "failed",
            "source": "live",
            "error": att_err,
            "duration_seconds": round(att_dur, 3)
        }
    elif attendance and len(attendance) > 0:
        feature_statuses["attendance"] = {
            "status": "success",
            "source": "live",
            "refreshedAt": now_iso,
            "count": len(attendance),
            "duration_seconds": round(att_dur, 3)
        }
    else:
        feature_statuses["attendance"] = {
            "status": "empty",
            "source": "live",
            "refreshedAt": now_iso,
            "count": 0,
            "duration_seconds": round(att_dur, 3)
        }

    # Timetable processing
    if timetable and timetable.get("grid"):
        refreshed_at = timetable.get("refreshedAt") or f"{datetime.utcnow().isoformat()}Z"
        timetable["source"] = "live"
        timetable["cached"] = False
        timetable["refreshedAt"] = refreshed_at
        set_cached_timetable(erp_id, academic_year, semester_id, timetable)
        feature_statuses["timetable"] = {
            "status": "success",
            "source": "live",
            "cached": False,
            "refreshedAt": refreshed_at,
            "count": len(timetable.get("grid", [])),
            "mappingsCount": len(timetable.get("mappings", [])),
            "duration_seconds": round(tt_dur, 3)
        }
        print(f"[erp:sync] Timetable source: LIVE | Refreshed at: {refreshed_at} | Rows: {feature_statuses['timetable']['count']} | Mappings: {feature_statuses['timetable']['mappingsCount']} | Duration: {tt_dur:.3f}s", flush=True)
    elif cached_tt and cached_tt.get("grid"):
        timetable = dict(cached_tt)
        cached_at = timetable.get("cachedAt") or timetable.get("_cached_at") or "unknown"
        refreshed_at = timetable.get("refreshedAt") or cached_at
        timetable["source"] = "cache"
        timetable["cached"] = True
        timetable["cachedAt"] = cached_at
        timetable["refreshedAt"] = refreshed_at
        feature_statuses["timetable"] = {
            "status": "cached",
            "source": "cache",
            "cached": True,
            "cachedAt": cached_at,
            "refreshedAt": refreshed_at,
            "fallback": True,
            "count": len(timetable.get("grid", [])),
            "mappingsCount": len(timetable.get("mappings", [])),
            "duration_seconds": round(tt_dur, 3)
        }
        print(f"[erp:sync] Timetable source: CACHE (FALLBACK) | Cached at: {cached_at} | Rows: {feature_statuses['timetable']['count']} | Mappings: {feature_statuses['timetable']['mappingsCount']}", flush=True)
    elif tt_err:
        feature_statuses["timetable"] = {
            "status": "failed",
            "source": "live",
            "cached": False,
            "error": tt_err,
            "duration_seconds": round(tt_dur, 3)
        }
    else:
        feature_statuses["timetable"] = {
            "status": "empty",
            "source": "live",
            "cached": False,
            "refreshedAt": now_iso,
            "count": 0,
            "mappingsCount": 0,
            "duration_seconds": round(tt_dur, 3)
        }

    # Seating Plan processing
    if not need_seat_scrape and cached_seating:
        feature_statuses["seatingPlan"] = {
            "status": "cached",
            "source": "cache",
            "cached": True,
            "refreshedAt": now_iso,
            "count": len(cached_seating),
            "duration_seconds": 0.0
        }
    elif seat_err:
        feature_statuses["seatingPlan"] = {
            "status": "failed",
            "source": "live",
            "error": seat_err,
            "duration_seconds": round(seat_dur, 3)
        }
    elif seating_plan and len(seating_plan) > 0:
        set_cached_seating_plan(erp_id, academic_year, semester_id, seating_plan)
        feature_statuses["seatingPlan"] = {
            "status": "success",
            "source": "live",
            "refreshedAt": now_iso,
            "count": len(seating_plan),
            "duration_seconds": round(seat_dur, 3)
        }
    elif seating_plan is not None and len(seating_plan) == 0:
        set_cached_seating_plan(erp_id, academic_year, semester_id, [])
        feature_statuses["seatingPlan"] = {
            "status": "empty",
            "source": "live",
            "refreshedAt": now_iso,
            "count": 0,
            "duration_seconds": round(seat_dur, 3)
        }
    else:
        feature_statuses["seatingPlan"] = {
            "status": "unknown",
            "source": "live",
            "duration_seconds": round(seat_dur, 3)
        }

    # CGPA processing
    if not need_cgpa_scrape and cached_cgpa:
        feature_statuses["cgpa"] = {
            "status": "cached",
            "source": "cache",
            "cached": True,
            "refreshedAt": now_iso,
            "count": len(cached_cgpa.get("subjects", [])),
            "duration_seconds": 0.0,
            "value": cached_cgpa.get("value")
        }
    elif cgpa_err:
        feature_statuses["cgpa"] = {
            "status": "failed",
            "source": "live",
            "error": cgpa_err,
            "duration_seconds": round(cgpa_dur, 3)
        }
    elif cgpa and (cgpa.get("value") is not None or cgpa.get("subjects") or cgpa.get("semesters")):
        cgpa_count = len(cgpa.get("subjects", []))
        feature_statuses["cgpa"] = {
            "status": "success",
            "source": "live",
            "refreshedAt": now_iso,
            "count": cgpa_count,
            "duration_seconds": round(cgpa_dur, 3),
            "value": cgpa.get("value")
        }
    elif cgpa is not None:
        feature_statuses["cgpa"] = {
            "status": "empty",
            "source": "live",
            "refreshedAt": now_iso,
            "count": 0,
            "duration_seconds": round(cgpa_dur, 3)
        }
    else:
        feature_statuses["cgpa"] = {
            "status": "unknown",
            "source": "live",
            "duration_seconds": round(cgpa_dur, 3)
        }

    total_dur = time.time() - total_start
    features_sum_dur = round(att_dur + tt_dur + seat_dur + cgpa_dur, 3)

    feature_statuses["auth"] = {
        "status": "success",
        "duration_seconds": round(login_dur, 3)
    }
    feature_statuses["total"] = {
        "duration_seconds": round(total_dur, 3),
        "features_duration_seconds": features_sum_dur,
        "overhead_seconds": round(max(0.0, total_dur - login_dur - features_sum_dur), 3)
    }

    tt_src = feature_statuses["timetable"].get("source", "unknown").upper()
    print(
        f"[erp:sync] Total end-to-end sync duration: {total_dur:.3f}s "
        f"[Auth: {login_dur:.3f}s | Attendance: {att_dur:.3f}s | Timetable ({tt_src}): {tt_dur:.3f}s | "
        f"Seating: {seat_dur:.3f}s | CGPA: {cgpa_dur:.3f}s | Sum: {features_sum_dur:.3f}s]",
        flush=True
    )

    return {
        "status": feature_statuses,
        "featureStatus": feature_statuses,
        "attendance": attendance,
        "timetable": timetable,
        "marks": [],
        "seatingPlan": seating_plan,
        "cgpa": cgpa,
        "syncedAt": now_iso,
        "totalDurationSeconds": round(total_dur, 3),
        "authDurationSeconds": round(login_dur, 3)
    }





class StreakUpdate(BaseModel):
    erpId: str
    streak: int
    longestStreak: int
    activeDays: int
    isPublic: bool

class StepsSync(BaseModel):
    erpId: str
    todaySteps: int
    totalSteps: int
    isPublic: bool

class VisitLog(BaseModel):
    erpId: str
    date: str = None

def init_leaderboard_db():
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS leaderboard (
            erp_id TEXT PRIMARY KEY,
            current_streak INTEGER,
            longest_streak INTEGER,
            active_days INTEGER,
            last_updated TEXT,
            is_public BOOLEAN
        )
    ''')
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS steps_data (
            erp_id TEXT PRIMARY KEY,
            today_steps INTEGER,
            total_steps INTEGER,
            edge_points INTEGER,
            last_synced TEXT,
            is_public BOOLEAN
        )
    ''')
    conn.commit()
    conn.close()

app = FastAPI()

STEPS_TO_POINTS_RATE = 100

async def calendar_background_scheduler():
    while True:
        try:
            run_scheduled_calendar_job()
        except Exception as e:
            print(f"[calendar:scheduler] error: {e}", flush=True)
        await asyncio.sleep(900)

@app.on_event("startup")
async def startup_event():
    from services.map_db import init_db
    init_db()
    init_leaderboard_db()
    try:
        init_calendar_db()
        asyncio.create_task(calendar_background_scheduler())
    except Exception as e:
        print(f"[calendar:init] error: {e}", flush=True)

raw_origins = os.getenv("FRONTEND_ORIGIN", "*")
origin_allow_list = [origin.strip() for origin in raw_origins.split(",") if origin.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"] if "*" in origin_allow_list else origin_allow_list,
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"]
)

app.include_router(map_router)
app.include_router(calendar_router)

@app.get("/api/portal-status")
def portal_status():
    status = "offline"
    if redis_client is not None:
        try:
            val = redis_client.get("portal_status")
            if val:
                status = val
        except Exception:
            pass
    return {"status": status}

# In-memory caches for streak, leaderboard, and visits to eliminate Supabase latency
_logged_visits_cache: set[tuple[str, str]] = set()  # (erp_id, date_str)
_known_user_streaks: set[str] = set()               # erp_id set
_user_visits_cache: dict[str, tuple[float, list[str]]] = {}  # erp_id -> (timestamp, [visit_dates])
_leaderboard_cache: dict[str, tuple[float, list[dict]]] = {}  # cache_key -> (timestamp, [users])
_last_leaderboard_update: dict[str, tuple[tuple, float]] = {}  # erp_id -> (payload_tuple, timestamp)

VISITS_CACHE_TTL = 180.0       # 3 minutes
LEADERBOARD_CACHE_TTL = 60.0  # 1 minute


@app.post("/api/leaderboard/update")
async def update_leaderboard(payload: StreakUpdate):
    t_start = time.perf_counter()
    supabase = get_supabase()
    if not supabase:
        return {"status": "error", "message": "Supabase not configured"}

    # Avoid duplicate writes if values have not changed within 5 minutes
    last_update = _last_leaderboard_update.get(payload.erpId)
    now_ts = time.time()
    payload_tuple = (payload.streak, payload.longestStreak, payload.activeDays, payload.isPublic)
    if last_update and last_update[0] == payload_tuple and (now_ts - last_update[1]) < 300:
        elapsed_ms = (time.perf_counter() - t_start) * 1000
        return {"status": "ok", "skipped": True, "elapsedMs": round(elapsed_ms, 2)}

    import datetime as dt
    # Force IST timezone (UTC+5:30) for the timestamp
    ist_tz = dt.timezone(dt.timedelta(hours=5, minutes=30))
    now = dt.datetime.now(ist_tz).isoformat()
    
    data = {
        "user_id": payload.erpId,
        "current_streak": payload.streak,
        "longest_streak": payload.longestStreak,
        "active_days": payload.activeDays,
        "last_updated": now,
        "is_public": payload.isPublic
    }
    
    def _execute_upsert():
        supabase.table("user_streaks").upsert(data, on_conflict="user_id").execute()
        _leaderboard_cache.clear()  # Invalidate cached leaderboard
        _known_user_streaks.add(payload.erpId)
        _last_leaderboard_update[payload.erpId] = (payload_tuple, time.time())

    try:
        await asyncio.to_thread(_execute_upsert)
        elapsed_ms = (time.perf_counter() - t_start) * 1000
        print(f"[api:leaderboard:update] user={payload.erpId} updated in {elapsed_ms:.2f}ms", flush=True)
        return {"status": "ok", "elapsedMs": round(elapsed_ms, 2)}
    except Exception as e:
        print(f"Failed to update leaderboard in Supabase: {e}", flush=True)
        return {"status": "error", "message": str(e)}


@app.get("/api/leaderboard")
async def get_leaderboard(erpId: str, group: str = "overall"):
    t_start = time.perf_counter()
    supabase = get_supabase()
    if not supabase:
        return {"leaderboard": [], "userRank": None, "userData": None}
    
    now = time.time()
    cache_entry = _leaderboard_cache.get("all")
    if cache_entry and (now - cache_entry[0] < LEADERBOARD_CACHE_TTL):
        all_users = cache_entry[1]
    else:
        def _fetch_all_streaks():
            res = supabase.table("user_streaks").select("*").gt("current_streak", 0).order("current_streak", desc=True).order("active_days", desc=True).execute()
            return res.data or []

        try:
            all_users = await asyncio.to_thread(_fetch_all_streaks)
            _leaderboard_cache["all"] = (now, all_users)
        except Exception as e:
            print(f"Failed to fetch leaderboard from Supabase: {e}", flush=True)
            all_users = []

    if group != "overall":
        # Filter by batch year (e.g. "23")
        batch_prefix = erpId[:2] if len(erpId) >= 2 else erpId
        filtered_users = [u for u in all_users if str(u.get("user_id", "")).startswith(batch_prefix)]
    else:
        filtered_users = all_users

    user_rank = None
    user_data = None
    for idx, u in enumerate(filtered_users):
        if u.get("user_id") == erpId:
            user_rank = idx + 1
            user_data = {
                "erp_id": u["user_id"],
                "current_streak": u["current_streak"],
                "longest_streak": u["longest_streak"],
                "active_days": u["active_days"]
            }
            break

    top_public = []
    for u in filtered_users:
        if u.get("is_public", True):
            mapped_u = {
                "erp_id": u["user_id"],
                "current_streak": u["current_streak"],
                "longest_streak": u["longest_streak"],
                "active_days": u["active_days"]
            }
            top_public.append(mapped_u)
        if len(top_public) >= 50:
            break

    elapsed_ms = (time.perf_counter() - t_start) * 1000
    return {
        "leaderboard": top_public,
        "userRank": user_rank,
        "userData": user_data,
        "elapsedMs": round(elapsed_ms, 2)
    }


@app.post("/api/streak/log")
async def log_streak_visit(payload: VisitLog):
    t_start = time.perf_counter()
    from supabase_client import get_supabase, get_init_error
    supabase = get_supabase()
    if not supabase:
        return {"status": "error", "message": f"Supabase not configured: {get_init_error()}"}
    
    import datetime as dt
    # Get current time in IST (UTC+5:30)
    ist_offset = dt.timedelta(hours=5, minutes=30)
    ist_now = dt.datetime.utcnow() + ist_offset
    
    # Use the date provided by frontend to avoid timezone issues, fallback to IST server today
    today = payload.date if payload.date else ist_now.date().isoformat()
    cache_key = (payload.erpId, today)
    
    # 1. Fast in-memory check (<0.01ms) - completely avoids Supabase and network
    if cache_key in _logged_visits_cache:
        elapsed_ms = (time.perf_counter() - t_start) * 1000
        print(f"[api:streak:log] user={payload.erpId} date={today} cached=True elapsed={elapsed_ms:.2f}ms", flush=True)
        return {"status": "ok", "cached": True, "elapsedMs": round(elapsed_ms, 2)}
    
    # 2. Execute database operations in a background worker thread to NEVER block the event loop
    def _execute_streak_log():
        t_db_start = time.perf_counter()
        # Ensure user_streaks record exists first to satisfy foreign key
        if payload.erpId not in _known_user_streaks:
            supabase.table("user_streaks").upsert({"user_id": payload.erpId}, on_conflict="user_id").execute()
            _known_user_streaks.add(payload.erpId)
            
        # Upsert visit in a single database round trip
        supabase.table("user_visits").upsert(
            {"user_id": payload.erpId, "visit_date": today},
            on_conflict="user_id,visit_date"
        ).execute()
        
        # Populate in-memory caches
        _logged_visits_cache.add(cache_key)
        if payload.erpId in _user_visits_cache:
            ts, visits_list = _user_visits_cache[payload.erpId]
            if today not in visits_list:
                visits_list.append(today)
                _user_visits_cache[payload.erpId] = (time.time(), visits_list)
        return time.perf_counter() - t_db_start

    try:
        db_duration = await asyncio.to_thread(_execute_streak_log)
        elapsed_ms = (time.perf_counter() - t_start) * 1000
        print(f"[api:streak:log] user={payload.erpId} date={today} db_time={db_duration:.3f}s total_elapsed={elapsed_ms:.2f}ms", flush=True)
        return {
            "status": "ok",
            "cached": False,
            "elapsedMs": round(elapsed_ms, 2),
            "dbTimeSeconds": round(db_duration, 3)
        }
    except Exception as e:
        elapsed_ms = (time.perf_counter() - t_start) * 1000
        print(f"Failed to log visit in Supabase: {e} (elapsed={elapsed_ms:.2f}ms)", flush=True)
        return {"status": "error", "message": str(e), "elapsedMs": round(elapsed_ms, 2)}


@app.get("/api/streak/visits")
async def get_streak_visits(erpId: str):
    t_start = time.perf_counter()
    supabase = get_supabase()
    if not supabase:
        return {"visits": []}
    
    now = time.time()
    if erpId in _user_visits_cache:
        cached_ts, cached_visits = _user_visits_cache[erpId]
        if now - cached_ts < VISITS_CACHE_TTL:
            elapsed_ms = (time.perf_counter() - t_start) * 1000
            print(f"[api:streak:visits] user={erpId} cached=True count={len(cached_visits)} elapsed={elapsed_ms:.2f}ms", flush=True)
            return {"visits": cached_visits, "cached": True, "elapsedMs": round(elapsed_ms, 2)}
    
    def _fetch_visits():
        res = supabase.table("user_visits").select("visit_date").eq("user_id", erpId).execute()
        return [row["visit_date"] for row in res.data]

    try:
        visits = await asyncio.to_thread(_fetch_visits)
        _user_visits_cache[erpId] = (time.time(), visits)
        elapsed_ms = (time.perf_counter() - t_start) * 1000
        print(f"[api:streak:visits] user={erpId} db_fetch count={len(visits)} elapsed={elapsed_ms:.2f}ms", flush=True)
        return {"visits": visits, "cached": False, "elapsedMs": round(elapsed_ms, 2)}
    except Exception as e:
        print(f"Failed to fetch visits from Supabase: {e}", flush=True)
        return {"visits": []}

@app.post("/api/steps/sync")
async def sync_steps(payload: StepsSync):
    conn = get_db_connection()
    cursor = conn.cursor()
    now = datetime.utcnow().isoformat() + "Z"
    
    # Calculate edge points based on total steps
    edge_points = payload.totalSteps // STEPS_TO_POINTS_RATE
    
    cursor.execute("""
        INSERT INTO steps_data (erp_id, today_steps, total_steps, edge_points, last_synced, is_public)
        VALUES (?, ?, ?, ?, ?, ?)
        ON CONFLICT(erp_id) DO UPDATE SET
            today_steps=excluded.today_steps,
            total_steps=excluded.total_steps,
            edge_points=excluded.edge_points,
            last_synced=excluded.last_synced,
            is_public=excluded.is_public
    """, (payload.erpId, payload.todaySteps, payload.totalSteps, edge_points, now, payload.isPublic))
    conn.commit()
    conn.close()
    return {"status": "ok", "edgePoints": edge_points}

@app.get("/api/steps/leaderboard")
async def get_steps_leaderboard(erpId: str, group: str = "overall"):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM steps_data ORDER BY total_steps DESC")
    all_users = cursor.fetchall()
    conn.close()

    if group != "overall":
        batch_prefix = erpId[:2] if len(erpId) >= 2 else erpId
        filtered_users = [u for u in all_users if u["erp_id"].startswith(batch_prefix)]
    else:
        filtered_users = all_users

    user_rank = None
    user_data = None
    for idx, u in enumerate(filtered_users):
        if u["erp_id"] == erpId:
            user_rank = idx + 1
            user_data = dict(u)
            break

    top_public = [dict(u) for u in filtered_users if u["is_public"]][:50]
    
    for u in top_public:
        if u["erp_id"] != erpId:
            u["erp_id"] = u["erp_id"][:5] + "***" if len(u["erp_id"]) >= 5 else u["erp_id"]

    return {
        "leaderboard": top_public,
        "userRank": user_rank,
        "userData": user_data
    }

@app.get("/api/steps/me")
async def get_my_steps(erpId: str):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM steps_data WHERE erp_id = ?", (erpId,))
    row = cursor.fetchone()
    conn.close()
    
    if row:
        return dict(row)
    return {"today_steps": 0, "total_steps": 0, "edge_points": 0, "is_public": False}


class SyncRequest(BaseModel):
    erpId: str
    password: str
    captcha: str = ""
    academicYear: str
    semesterId: str
    captchaSessionId: str = ""
    forceRefresh: Optional[bool] = False
    refreshTimetable: Optional[bool] = False


@app.exception_handler(AppError)
async def app_error_handler(_request, exc: AppError):
    return JSONResponse(status_code=exc.status_code, content={"error": exc.message})


@app.exception_handler(HTTPException)
async def http_error_handler(_request, exc: HTTPException):
    return JSONResponse(status_code=exc.status_code, content={"error": exc.detail})


@app.exception_handler(Exception)
async def unhandled_error_handler(_request, exc: Exception):
    return JSONResponse(status_code=500, content={"error": str(exc) or "Unexpected server error"})


@app.get("/", response_class=HTMLResponse)
def read_root():
    return """<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>KL Edge API - Active</title>
    <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700&display=swap" rel="stylesheet">
    <style>
        :root {
            --bg-color: #0b0f19;
            --card-bg: rgba(20, 27, 45, 0.7);
            --border-color: rgba(255, 255, 255, 0.08);
            --text-primary: #ffffff;
            --text-secondary: #94a3b8;
            --accent-glow: linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%);
            --accent-green: #10b981;
        }

        * {
            box-sizing: border-box;
            margin: 0;
            padding: 0;
        }

        body {
            font-family: 'Outfit', sans-serif;
            background-color: var(--bg-color);
            color: var(--text-primary);
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            overflow: hidden;
            position: relative;
        }

        body::before {
            content: '';
            position: absolute;
            width: 300px;
            height: 300px;
            background: radial-gradient(circle, rgba(59, 130, 246, 0.15) 0%, rgba(139, 92, 246, 0.15) 50%, transparent 100%);
            top: 20%;
            left: 20%;
            border-radius: 50%;
            filter: blur(80px);
            z-index: 0;
        }

        body::after {
            content: '';
            position: absolute;
            width: 300px;
            height: 300px;
            background: radial-gradient(circle, rgba(139, 92, 246, 0.15) 0%, rgba(59, 130, 246, 0.15) 50%, transparent 100%);
            bottom: 20%;
            right: 20%;
            border-radius: 50%;
            filter: blur(80px);
            z-index: 0;
        }

        .container {
            z-index: 1;
            width: 100%;
            max-width: 480px;
            padding: 20px;
        }

        .card {
            background: var(--card-bg);
            backdrop-filter: blur(16px);
            -webkit-backdrop-filter: blur(16px);
            border: 1px solid var(--border-color);
            border-radius: 24px;
            padding: 40px 30px;
            box-shadow: 0 20px 40px rgba(0, 0, 0, 0.3);
            text-align: center;
            animation: fadeIn 0.8s ease-out;
        }

        @keyframes fadeIn {
            from {
                opacity: 0;
                transform: translateY(20px);
            }
            to {
                opacity: 1;
                transform: translateY(0);
            }
        }

        .logo-container {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            width: 80px;
            height: 80px;
            border-radius: 20px;
            background: var(--accent-glow);
            margin-bottom: 24px;
            box-shadow: 0 10px 25px rgba(59, 130, 246, 0.3);
            position: relative;
        }

        .logo-container svg {
            width: 40px;
            height: 40px;
            fill: none;
            stroke: #ffffff;
            stroke-width: 2;
        }

        .badge {
            display: inline-flex;
            align-items: center;
            gap: 6px;
            background: rgba(16, 185, 129, 0.1);
            color: var(--accent-green);
            padding: 6px 12px;
            border-radius: 100px;
            font-size: 14px;
            font-weight: 500;
            margin-bottom: 16px;
            border: 1px solid rgba(16, 185, 129, 0.2);
        }

        .badge-dot {
            width: 8px;
            height: 8px;
            background-color: var(--accent-green);
            border-radius: 50%;
            display: inline-block;
            box-shadow: 0 0 10px var(--accent-green);
            animation: pulse 2s infinite;
        }

        @keyframes pulse {
            0% {
                transform: scale(0.95);
                box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.7);
            }
            70% {
                transform: scale(1);
                box-shadow: 0 0 0 8px rgba(16, 185, 129, 0);
            }
            100% {
                transform: scale(0.95);
                box-shadow: 0 0 0 0 rgba(16, 185, 129, 0);
            }
        }

        h1 {
            font-size: 28px;
            font-weight: 700;
            margin-bottom: 8px;
            background: linear-gradient(180deg, #ffffff 0%, #cbd5e1 100%);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
        }

        p {
            color: var(--text-secondary);
            font-size: 15px;
            line-height: 1.6;
            margin-bottom: 30px;
        }

        .btn-group {
            display: flex;
            flex-direction: column;
            gap: 12px;
        }

        .btn {
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 8px;
            padding: 14px;
            border-radius: 12px;
            font-size: 15px;
            font-weight: 600;
            text-decoration: none;
            transition: all 0.2s ease;
            cursor: pointer;
        }

        .btn-primary {
            background: var(--accent-glow);
            color: #ffffff;
            box-shadow: 0 4px 15px rgba(59, 130, 246, 0.2);
        }

        .btn-primary:hover {
            transform: translateY(-2px);
            box-shadow: 0 6px 20px rgba(59, 130, 246, 0.3);
        }

        .btn-secondary {
            background: rgba(255, 255, 255, 0.05);
            color: #cbd5e1;
            border: 1px solid var(--border-color);
        }

        .btn-secondary:hover {
            background: rgba(255, 255, 255, 0.1);
            color: #ffffff;
            transform: translateY(-2px);
        }

        .footer {
            margin-top: 30px;
            font-size: 12px;
            color: rgba(148, 163, 184, 0.5);
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="card">
            <div class="logo-container">
                <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
            </div>
            <div>
                <span class="badge">
                    <span class="badge-dot"></span>
                    API Active
                </span>
            </div>
            <h1>KL Edge Server</h1>
            <p>The backend synchronization engine and API for the KL Edge student portal is running smoothly.</p>
            <div class="btn-group">
                <a href="/docs" class="btn btn-primary">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 4px;">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                        <polyline points="14 2 14 8 20 8"/>
                        <line x1="16" y1="13" x2="8" y2="13"/>
                        <line x1="16" y1="17" x2="8" y2="17"/>
                        <polyline points="10 9 9 9 8 9"/>
                    </svg>
                    Explore API Docs
                </a>
                <a href="/health" class="btn btn-secondary">Check System Health</a>
            </div>
            <div class="footer">
                KL Edge • v1.0.0
            </div>
        </div>
    </div>
</body>
</html>"""


@app.get("/health")
def health_check():
    return {"ok": True}


@app.get("/api/portal-status")
def get_portal_status():
    import requests
    try:
        # Check if ERP login page is reachable (HEAD request is light)
        r = requests.head(LOGIN_URL, timeout=4)
        if r.status_code < 500:
            return {"status": "online"}
    except Exception:
        pass

    try:
        # Fallback to GET check
        r = requests.get(LOGIN_URL, timeout=4)
        if r.status_code < 500:
            return {"status": "online"}
    except Exception:
        pass

    return {"status": "offline"}


@app.get("/api/captcha")
async def get_captcha():
    result = await create_captcha_session()
    return JSONResponse(content=result, headers={"Cache-Control": "no-store"})


@app.post("/api/sync")
async def sync_attendance_route(body: SyncRequest):
    if not all([body.erpId, body.password, body.academicYear, body.semesterId]):
        raise AppError(
            "ERP ID, password, academic year, and semester are required.",
            400
        )

    session_id = body.captchaSessionId
    if not session_id:
        try:
            captcha_res = await create_captcha_session()
            session_id = captcha_res["sessionId"]
        except Exception as exc:
            raise AppError(f"Failed to initialize CAPTCHA session: {str(exc)}", 502)

    captcha_session = get_captcha_session(session_id)
    if not captcha_session:
        try:
            captcha_res = await create_captcha_session()
            session_id = captcha_res["sessionId"]
        except Exception as exc:
            raise AppError(f"Failed to re-initialize CAPTCHA session: {str(exc)}", 502)

    payload = body.model_dump()
    payload["captchaSessionId"] = session_id
    
    result = await run_full_sync(payload)
    result["captchaSessionId"] = session_id
    return result


@app.get("/api/timetable")
async def get_timetable_route(erpId: str, academicYear: str, semesterId: str):
    t_start = time.perf_counter()
    if not erpId or not academicYear or not semesterId:
        raise HTTPException(status_code=400, detail="erpId, academicYear, and semesterId are required.")
    cached = get_cached_timetable(erpId, academicYear, semesterId)
    elapsed_ms = (time.perf_counter() - t_start) * 1000
    if cached:
        print(f"[api:timetable] user={erpId} cached=True elapsed={elapsed_ms:.2f}ms", flush=True)
        cached_resp = dict(cached)
        cached_resp["elapsedMs"] = round(elapsed_ms, 2)
        return cached_resp
    print(f"[api:timetable] user={erpId} cached=False elapsed={elapsed_ms:.2f}ms", flush=True)
    return {
        "grid": [],
        "mappings": [],
        "academicYear": academicYear,
        "semesterId": semesterId,
        "status": "empty",
        "message": "No cached timetable found. Please sync.",
        "elapsedMs": round(elapsed_ms, 2)
    }


@app.get("/api/seating-plan")
async def get_seating_plan_route(erpId: str, academicYear: str, semesterId: str):
    t_start = time.perf_counter()
    if not erpId or not academicYear or not semesterId:
        raise HTTPException(status_code=400, detail="erpId, academicYear, and semesterId are required.")
    cached = get_cached_seating_plan(erpId, academicYear, semesterId)
    if cached is not None and len(cached) > 0:
        filtered = filter_seating_plan(cached, academicYear, semesterId, erpId)
        if filtered:
            elapsed_ms = (time.perf_counter() - t_start) * 1000
            print(f"[api:seating-plan] user={erpId} count={len(filtered)} elapsed={elapsed_ms:.2f}ms", flush=True)
            return {
                "seatingPlan": filtered,
                "academicYear": academicYear,
                "semesterId": semesterId,
                "status": "ok",
                "count": len(filtered),
                "elapsedMs": round(elapsed_ms, 2)
            }
    elapsed_ms = (time.perf_counter() - t_start) * 1000
    print(f"[api:seating-plan] user={erpId} count=0 elapsed={elapsed_ms:.2f}ms", flush=True)
    return {
        "seatingPlan": [],
        "academicYear": academicYear,
        "semesterId": semesterId,
        "status": "empty",
        "message": "No seating plan available for the selected academic year and semester.",
        "elapsedMs": round(elapsed_ms, 2)
    }


@app.post("/api/timetable/sync")
async def sync_timetable_only_route(body: SyncRequest):
    if not all([body.erpId, body.password, body.academicYear, body.semesterId]):
        raise AppError("ERP ID, password, academic year, and semester are required.", 400)

    # Check cache first if not forced
    if not (body.forceRefresh or body.refreshTimetable):
        cached = get_cached_timetable(body.erpId, body.academicYear, body.semesterId)
        if cached and cached.get("grid"):
            return cached

    session_id = body.captchaSessionId
    if not session_id:
        try:
            captcha_res = await create_captcha_session()
            session_id = captcha_res["sessionId"]
        except Exception as exc:
            raise AppError(f"Failed to initialize CAPTCHA session: {str(exc)}", 502)

    payload = body.model_dump()
    payload["captchaSessionId"] = session_id

    session = await perform_login(payload)
    timetable = await sync_timetable(payload, session=session)
    if timetable and timetable.get("grid"):
        set_cached_timetable(body.erpId, body.academicYear, body.semesterId, timetable)
    return timetable


@app.get("/api/faculty")
def get_faculty():
    # Try to get cached faculty data from Redis
    cached = cached_faculty()
    if cached is not None:
        return JSONResponse(
            content=cached,
            headers={"Cache-Control": "public, max-age=3600, s-maxage=86400"}
        )
    
    # Load from file and cache it
    faculty_data = load_faculty()
    if faculty_data:
        cache_faculty(faculty_data)
    
    return JSONResponse(
        content=faculty_data,
        headers={"Cache-Control": "public, max-age=3600, s-maxage=86400"}
    )

class LmsConnectRequest(BaseModel):
    username: str
    password: str

@app.post("/api/lms/connect")
def connect_lms(body: LmsConnectRequest):
    try:
        result = authenticate_lms(body.username, body.password)
        return result
    except Exception as e:
        raise AppError(str(e), 401)

@app.get("/api/lms/assignments")
def lms_assignments(authorization: str = Header(None)):
    if not authorization or not authorization.startswith("Bearer "):
        raise AppError("Missing or invalid authorization header", 401)
    
    token = authorization.split(" ")[1]
    try:
        assignments = get_lms_assignments(token)
        return {"assignments": assignments, "syncedAt": f"{datetime.utcnow().isoformat()}Z"}
    except Exception as e:
        error_msg = str(e)
        if "expired" in error_msg.lower() or "session" in error_msg.lower():
            raise AppError(error_msg, 401)
        raise AppError("Failed to fetch assignments: " + error_msg, 500)

@app.post("/api/lms/disconnect")
def disconnect_lms(authorization: str = Header(None)):
    if not authorization or not authorization.startswith("Bearer "):
        raise AppError("Missing or invalid authorization header", 401)
    
    return {"message": "Disconnected successfully"}

class LmsSyncRequest(BaseModel):
    username: Optional[str] = None
    password: Optional[str] = None

@app.post("/api/lms/sync")
def sync_lms(body: LmsSyncRequest, authorization: Optional[str] = Header(None)):
    token = None
    if authorization and authorization.startswith("Bearer "):
        parts = authorization.split(" ", 1)
        if len(parts) == 2 and parts[1].strip():
            token = parts[1].strip()

    # 1. If valid token is available, attempt to retrieve assignments
    if token:
        try:
            assignments = get_lms_assignments(token)
            return {
                "assignments": assignments,
                "lmsToken": token,
                "syncedAt": f"{datetime.utcnow().isoformat()}Z"
            }
        except Exception as e:
            error_msg = str(e)
            is_session_err = "expired" in error_msg.lower() or "session" in error_msg.lower()
            if not is_session_err or not (body.username and body.password):
                raise AppError(error_msg, 401 if is_session_err else 500)

    # 2. If token expired or not provided, re-authenticate using provided credentials
    if body.username and body.password:
        try:
            auth_res = authenticate_lms(body.username, body.password)
            new_token = auth_res["lmsToken"]
            assignments = get_lms_assignments(new_token)
            return {
                "assignments": assignments,
                "lmsToken": new_token,
                "syncedAt": f"{datetime.utcnow().isoformat()}Z"
            }
        except Exception as e:
            raise AppError(str(e), 401)

    raise AppError("Missing LMS session token or credentials. Please connect your LMS account.", 401)

if __name__ == "__main__":
    import uvicorn
    # Use reload=True for development, which might be causing the issue on Windows.
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)

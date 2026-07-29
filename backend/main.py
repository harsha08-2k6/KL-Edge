import os
import asyncio
from datetime import datetime
import sqlite3

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, HTMLResponse
from pydantic import BaseModel

from erp_scraper import (
    AppError,
    LOGIN_URL,
    create_captcha_session,
    get_captcha_session,
    load_faculty,
    redis_client,
    sync_attendance,
    sync_cgpa,
    sync_marks,
    sync_seating_plan,
    sync_timetable
)
import json
from routes.map import router as map_router


# Redis key for faculty cache
FACULTY_CACHE_KEY = "faculty_cache"
FACULTY_CACHE_TTL_SECONDS = 86400  # 24 hours
AUTO_SYNC_USER_IDS_KEY = "auto_sync_user_ids"
AUTO_SYNC_INTERVAL_SECONDS = int(os.getenv("ERP_AUTO_SYNC_INTERVAL_SECONDS", "600"))
auto_sync_task = None
auto_sync_profiles_memory = {}
latest_syncs_memory = {}
auto_sync_user_ids_memory = set()


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


def get_cached_json(key: str):
    if redis_client is not None:
        try:
            cached = redis_client.get(key)
            if cached:
                return json.loads(cached)
        except Exception:
            pass
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("CREATE TABLE IF NOT EXISTS kv_cache (key TEXT PRIMARY KEY, value TEXT)")
        cursor.execute("SELECT value FROM kv_cache WHERE key = ?", (key,))
        row = cursor.fetchone()
        conn.close()
        if row:
            return json.loads(row["value"])
    except Exception as e:
        print(f"[cache:get] SQLite error: {e}", flush=True)
    return None


def set_cached_json(key: str, value):
    if redis_client is not None:
        try:
            redis_client.set(key, json.dumps(value))
            return
        except Exception:
            pass
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("CREATE TABLE IF NOT EXISTS kv_cache (key TEXT PRIMARY KEY, value TEXT)")
        cursor.execute("INSERT OR REPLACE INTO kv_cache (key, value) VALUES (?, ?)", (key, json.dumps(value)))
        conn.commit()
        conn.close()
    except Exception as e:
        print(f"[cache:set] SQLite error: {e}", flush=True)


def get_auto_sync_profile(erp_id: str):
    if not erp_id:
        return None
    cached = get_cached_json(f"auto_sync_profile:{erp_id}")
    if cached is not None:
        return cached
    return auto_sync_profiles_memory.get(erp_id)


def save_auto_sync_profile(payload: dict):
    erp_id = payload.get("erpId", "")
    if not erp_id:
        return
    profile = {
        "erpId": erp_id,
        "password": payload.get("password", ""),
        "academicYear": payload.get("academicYear", ""),
        "semesterId": payload.get("semesterId", ""),
        "captchaSessionId": payload.get("captchaSessionId", "")
    }
    if not all(profile.values()):
        return
    auto_sync_profiles_memory[erp_id] = profile
    set_cached_json(f"auto_sync_profile:{erp_id}", profile)
    
    # Add user ID to active list for auto-sync
    auto_sync_user_ids_memory.add(erp_id)
    if redis_client is not None:
        try:
            redis_client.sadd(AUTO_SYNC_USER_IDS_KEY, erp_id)
        except Exception:
            pass
    
    # Save the updated list of users to SQLite cache list to survive restarts
    user_list = get_cached_json(AUTO_SYNC_USER_IDS_KEY) or []
    if erp_id not in user_list:
        user_list.append(erp_id)
        set_cached_json(AUTO_SYNC_USER_IDS_KEY, user_list)


def get_latest_sync_result(erp_id: str):
    if not erp_id:
        return None
    cached = get_cached_json(f"latest_sync_result:{erp_id}")
    if cached is not None:
        return cached
    return latest_syncs_memory.get(erp_id)


def save_latest_sync_result(erp_id: str, result: dict):
    if not erp_id:
        return
    latest_syncs_memory[erp_id] = result
    set_cached_json(f"latest_sync_result:{erp_id}", result)


def run_full_sync(payload: dict) -> dict:
    attendance = sync_attendance(payload)

    def safe_sync(label, handler, fallback):
        try:
            return handler()
        except AppError as exc:
            if os.getenv("ERP_DEBUG", "").lower() in {"1", "true", "yes"}:
                print(f"[erp:{label}] {exc.message}", flush=True)
            return fallback
        except Exception as exc:
            if os.getenv("ERP_DEBUG", "").lower() in {"1", "true", "yes"}:
                print(f"[erp:{label}] {exc}", flush=True)
            return fallback

    timetable = safe_sync("timetable", lambda: sync_timetable(payload), {"grid": [], "mappings": [], "status": "empty", "message": "Timetable sync failed."})
    seating_plan = safe_sync("seating-plan", lambda: sync_seating_plan(payload), [])
    cgpa = safe_sync("cgpa", lambda: sync_cgpa(payload), {})

    return {
        "attendance": attendance,
        "timetable": timetable,
        "marks": [],
        "seatingPlan": seating_plan,
        "cgpa": cgpa,
        "syncedAt": f"{datetime.utcnow().isoformat()}Z"
    }


async def auto_sync_loop():
    while True:
        await asyncio.sleep(AUTO_SYNC_INTERVAL_SECONDS)
        
        user_ids = []
        if redis_client is not None:
            try:
                members = redis_client.smembers(AUTO_SYNC_USER_IDS_KEY)
                user_ids = [m.decode("utf-8") if isinstance(m, bytes) else str(m) for m in members]
            except Exception:
                pass
        
        if not user_ids:
            user_ids = get_cached_json(AUTO_SYNC_USER_IDS_KEY) or []
            
        if not user_ids:
            user_ids = list(auto_sync_user_ids_memory)

        for erp_id in user_ids:
            profile = get_auto_sync_profile(erp_id)
            if not profile:
                continue

            session_id = profile.get("captchaSessionId") or ""
            captcha_session = get_captcha_session(session_id)
            if not captcha_session:
                if os.getenv("ERP_DEBUG", "").lower() in {"1", "true", "yes"}:
                    print(f"[erp:auto-sync] captcha session expired/missing for {erp_id}; generating new one...", flush=True)
                try:
                    captcha_res = create_captcha_session()
                    session_id = captcha_res["sessionId"]
                    profile["captchaSessionId"] = session_id
                    save_auto_sync_profile(profile)
                    captcha_session = get_captcha_session(session_id)
                except Exception as exc:
                    if os.getenv("ERP_DEBUG", "").lower() in {"1", "true", "yes"}:
                        print(f"[erp:auto-sync] failed creating captcha session for {erp_id}: {exc}", flush=True)
                    continue

            try:
                result = await asyncio.to_thread(run_full_sync, {**profile, "captcha": ""})
                save_latest_sync_result(erp_id, result)
                if os.getenv("ERP_DEBUG", "").lower() in {"1", "true", "yes"}:
                    print(f"[erp:auto-sync] refresh completed for {erp_id}", flush=True)
            except AppError as exc:
                if os.getenv("ERP_DEBUG", "").lower() in {"1", "true", "yes"}:
                    print(f"[erp:auto-sync] failed for {erp_id}: {exc.message}", flush=True)
            except Exception as exc:
                if os.getenv("ERP_DEBUG", "").lower() in {"1", "true", "yes"}:
                    print(f"[erp:auto-sync] failed for {erp_id}: {exc}", flush=True)


app = FastAPI()


@app.on_event("startup")
async def startup_auto_sync():
    from services.map_db import init_db
    init_db()
    global auto_sync_task
    if AUTO_SYNC_INTERVAL_SECONDS > 0:
        auto_sync_task = asyncio.create_task(auto_sync_loop())


@app.on_event("shutdown")
async def shutdown_auto_sync():
    global auto_sync_task
    if auto_sync_task:
        auto_sync_task.cancel()
        try:
            await auto_sync_task
        except (Exception, asyncio.CancelledError):
            pass
        auto_sync_task = None

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


class SyncRequest(BaseModel):
    erpId: str
    password: str
    captcha: str = ""
    academicYear: str
    semesterId: str
    captchaSessionId: str = ""


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
def get_captcha():
    result = create_captcha_session()
    return JSONResponse(content=result, headers={"Cache-Control": "no-store"})


@app.post("/api/sync")
def sync_attendance_route(body: SyncRequest):
    if not all([body.erpId, body.password, body.academicYear, body.semesterId]):
        raise AppError(
            "ERP ID, password, academic year, and semester are required.",
            400
        )

    session_id = body.captchaSessionId
    if not session_id:
        try:
            captcha_res = create_captcha_session()
            session_id = captcha_res["sessionId"]
        except Exception as exc:
            raise AppError(f"Failed to initialize CAPTCHA session: {str(exc)}", 502)

    captcha_session = get_captcha_session(session_id)
    if not captcha_session:
        try:
            captcha_res = create_captcha_session()
            session_id = captcha_res["sessionId"]
        except Exception as exc:
            raise AppError(f"Failed to re-initialize CAPTCHA session: {str(exc)}", 502)

    payload = body.model_dump()
    payload["captchaSessionId"] = session_id
    
    result = run_full_sync(payload)
    save_auto_sync_profile(payload)
    save_latest_sync_result(body.erpId, result)
    
    result["captchaSessionId"] = session_id
    return result


@app.get("/api/latest-sync")
def latest_sync(erpId: str = ""):
    if not erpId:
        raise AppError("ERP ID is required.", 400)
    latest = get_latest_sync_result(erpId)
    if not latest:
        raise AppError("No synced data available yet.", 404)
    return JSONResponse(content=latest, headers={"Cache-Control": "no-store"})


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


if __name__ == "__main__":
    import uvicorn
    # Use reload=True for development, which might be causing the issue on Windows.
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)

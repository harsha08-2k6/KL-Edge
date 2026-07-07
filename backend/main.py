import os
import asyncio
from datetime import datetime

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
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


def get_cached_json(key: str):
    if redis_client is None:
        return None
    try:
        cached = redis_client.get(key)
        if cached:
            return json.loads(cached)
    except Exception:
        pass
    return None


def set_cached_json(key: str, value):
    if redis_client is None:
        return
    try:
        redis_client.set(key, json.dumps(value))
    except Exception:
        pass


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
        except Exception:
            pass
        auto_sync_task = None

raw_origins = os.getenv("FRONTEND_ORIGIN", "*")
origin_allow_list = [origin.strip() for origin in raw_origins.split(",") if origin.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"] if "*" in origin_allow_list else origin_allow_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"]
)


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

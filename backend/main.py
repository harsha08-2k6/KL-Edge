import os
from datetime import datetime

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from erp_scraper import (
    AppError,
    LOGIN_URL,
    close_captcha_session,
    create_captcha_session,
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


app = FastAPI()

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
    captcha: str
    academicYear: str
    semesterId: str
    captchaSessionId: str


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
    if not all([body.erpId, body.password, body.captcha, body.academicYear, body.semesterId, body.captchaSessionId]):
        raise AppError(
            "ERP ID, password, captcha, captcha session, academic year, and semester are required.",
            400
        )

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

    try:
        payload = body.model_dump()
        attendance = sync_attendance(payload)
        timetable = safe_sync("timetable", lambda: sync_timetable(payload), {"grid": [], "mappings": [], "status": "empty", "message": "Timetable sync failed."})
        # marks = safe_sync("marks", lambda: sync_marks(payload), [])
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
    finally:
        # We only close the session AFTER both sync operations are done
        close_captcha_session(body.captchaSessionId)


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

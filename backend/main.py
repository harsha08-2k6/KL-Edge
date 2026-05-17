import os
from datetime import datetime

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from erp_scraper import (
    AppError,
    close_captcha_session,
    create_captcha_session,
    load_faculty,
    sync_attendance,
    sync_cgpa,
    sync_marks,
    sync_seating_plan,
    sync_timetable
)

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
        timetable = sync_timetable(payload)
        marks = safe_sync("marks", lambda: sync_marks(payload), [])
        seating_plan = safe_sync("seating-plan", lambda: sync_seating_plan(payload), [])
        cgpa = safe_sync("cgpa", lambda: sync_cgpa(payload), {})
        return {
            "attendance": attendance,
            "timetable": timetable,
            "marks": marks,
            "seatingPlan": seating_plan,
            "cgpa": cgpa,
            "syncedAt": f"{datetime.utcnow().isoformat()}Z"
        }
    finally:
        # We only close the session AFTER both sync operations are done
        close_captcha_session(body.captchaSessionId)


@app.get("/api/faculty")
def get_faculty():
    return load_faculty()

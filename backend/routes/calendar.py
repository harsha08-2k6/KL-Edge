from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel
from typing import Optional, List, Dict, Any

from services.calendar_service import (
    get_calendar_events,
    get_student_preferences,
    save_student_preferences,
    generate_and_sync_reminders_for_student,
    get_student_reminders,
    mark_reminder_delivered,
    run_scheduled_calendar_job
)

router = APIRouter(prefix="/api/calendar", tags=["academic_calendar"])

class PreferenceRequest(BaseModel):
    studentId: str
    programKey: str
    preferences: Optional[Dict[str, Any]] = None

class SyncRemindersRequest(BaseModel):
    studentId: str
    programKey: str

@router.get("/events")
def get_events_route(program: str = Query("y25_semester")):
    try:
        events = get_calendar_events(program)
        return {
            "program": program,
            "events": events,
            "count": len(events)
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch calendar events: {str(e)}")

@router.get("/preferences")
def get_preferences_route(studentId: str = Query(...)):
    try:
        return get_student_preferences(studentId)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch preferences: {str(e)}")

@router.post("/preferences")
def save_preferences_route(body: PreferenceRequest):
    try:
        save_student_preferences(body.studentId, body.programKey, body.preferences or {})
        # Automatically generate and sync reminders whenever preferences or program changes
        generate_and_sync_reminders_for_student(body.studentId, body.programKey, body.preferences)
        return {"status": "success", "message": "Preferences saved and reminders synchronized."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to save preferences: {str(e)}")

@router.get("/reminders")
def get_reminders_route(studentId: str = Query(...)):
    try:
        reminders = get_student_reminders(studentId)
        return {
            "studentId": studentId,
            "reminders": reminders,
            "count": len(reminders)
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch reminders: {str(e)}")

@router.post("/reminders/sync")
def sync_reminders_route(body: SyncRemindersRequest):
    try:
        count = generate_and_sync_reminders_for_student(body.studentId, body.programKey)
        reminders = get_student_reminders(body.studentId)
        return {
            "status": "success",
            "newRemindersCreated": count,
            "totalReminders": len(reminders),
            "reminders": reminders
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to sync reminders: {str(e)}")

@router.post("/reminders/{reminder_id}/deliver")
def deliver_reminder_route(reminder_id: str):
    try:
        mark_reminder_delivered(reminder_id)
        return {"status": "success", "reminderId": reminder_id}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to mark reminder: {str(e)}")

class FeeStatusRequest(BaseModel):
    studentId: str
    programKey: Optional[str] = None
    eventId: str
    completed: Optional[bool] = None
    status: Optional[str] = None

@router.post("/fee-status")
def toggle_fee_status_route(body: FeeStatusRequest):
    try:
        is_completed = body.completed
        if is_completed is None and body.status:
            is_completed = (body.status.lower() == "completed")
        if is_completed is None:
            is_completed = True

        current = get_student_preferences(body.studentId)
        prefs = current.get("preferences") or {}
        completed_fee_ids = set(prefs.get("completedFeeIds") or [])
        if is_completed:
            completed_fee_ids.add(body.eventId)
        else:
            completed_fee_ids.discard(body.eventId)
        prefs["completedFeeIds"] = list(completed_fee_ids)
        prog_key = body.programKey or current.get("programKey") or "y25_semester"
        save_student_preferences(body.studentId, prog_key, prefs)
        generate_and_sync_reminders_for_student(body.studentId, prog_key, prefs)
        return {
            "status": "success",
            "eventId": body.eventId,
            "completed": body.completed,
            "completedFeeIds": list(completed_fee_ids)
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to update fee status: {str(e)}")

@router.post("/scheduler/run")
def trigger_scheduler_route():
    try:
        processed = run_scheduled_calendar_job()
        return {"status": "success", "processedDueReminders": processed}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Scheduler error: {str(e)}")

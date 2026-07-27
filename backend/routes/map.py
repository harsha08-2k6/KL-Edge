from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional, List, Dict, Any

from services.map_db import (
    get_all_locations,
    get_location_by_id,
    get_reviews_for_location,
    add_review
)
from services.map_routing import find_shortest_path
from services.map_chat import parse_navigation_query

router = APIRouter(prefix="/api/map", tags=["map"])

class ReviewRequest(BaseModel):
    rating: int
    comment: str
    studentName: Optional[str] = "Student"

class ChatRequest(BaseModel):
    query: str
    currentLocationId: Optional[str] = "c_block"

@router.get("/locations")
def get_locations_route():
    try:
        locations = get_all_locations()
        # Add reviews to each location
        for loc in locations:
            loc["reviews"] = get_reviews_for_location(loc["id"])
        return locations
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")

@router.get("/route")
def get_route_route(from_id: str, to_id: str):
    if not from_id or not to_id:
        raise HTTPException(status_code=400, detail="Parameters 'from_id' and 'to_id' are required.")
    
    route = find_shortest_path(from_id, to_id)
    if not route:
        raise HTTPException(status_code=404, detail="Route not found between selected locations.")
    return route

@router.post("/locations/{location_id}/reviews")
def add_review_route(location_id: str, body: ReviewRequest):
    if body.rating < 1 or body.rating > 5:
        raise HTTPException(status_code=400, detail="Rating must be between 1 and 5.")
    
    loc = get_location_by_id(location_id)
    if not loc:
        raise HTTPException(status_code=404, detail="Location not found.")
        
    try:
        result = add_review(location_id, body.rating, body.comment, body.studentName)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to save review: {str(e)}")

@router.post("/chat")
def chat_route(body: ChatRequest):
    if not body.query:
        raise HTTPException(status_code=400, detail="Query cannot be empty.")
    try:
        response = parse_navigation_query(body.query, body.currentLocationId)
        return response
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"AI Navigator error: {str(e)}")

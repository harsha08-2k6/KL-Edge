from services.map_routing import GRAPH_NODES, find_shortest_path, get_haversine_distance
from services.map_db import get_all_locations

def parse_navigation_query(query: str, current_location_id: str = "c_block"):
    """
    Parses a natural language query and returns navigation data.
    Defaults user's current location to 'c_block' if not provided or invalid.
    """
    if not current_location_id or current_location_id not in GRAPH_NODES:
        current_location_id = "c_block"

    query_clean = query.lower().strip()
    
    # Retrieve all locations to get fresh DB states (menus, reviews, names)
    db_locations = get_all_locations()
    locations_by_id = {loc["id"]: loc for loc in db_locations}
    
    # Standard mapping for NLP keywords to IDs/Categories
    category_keywords = {
        "atm": ["atm", "cash", "bank", "sbi"],
        "washroom": ["washroom", "restroom", "toilet", "washrooms", "bathroom", "bathrooms"],
        "food": ["food", "cafeteria", "canteen", "coffee", "juice", "eat", "lunch", "breakfast", "nescafe", "starbucks", "court"],
        "parking": ["parking", "park", "cycle", "bicycle", "bike", "car"],
        "medical": ["medical", "health", "doctor", "clinic", "ambulance", "hospital", "sick"],
        "hostel": ["hostel", "hostels", "dorm", "dorms", "boys hostel", "girls hostel", "aravali", "vindhya", "tulip"],
        "library": ["library", "books", "study", "reading"],
        "sports": ["sports", "gym", "ground", "badminton", "play", "track", "fitness"]
    }
    
    # Specific location keyword mappings
    location_mappings = {
        "c_block": ["c block", "ece", "cse", "computer science", "electronics"],
        "rd_block": ["r&d", "research", "phd", "development block", "satish canteen 2"],
        "library": ["library", "central library", "books block"],
        "auditorium": ["auditorium", "peacock hall", "peacock", "seminar hall", "rose hall"],
        "admin_office": ["admin", "administration", "accounts", "registrar", "office"],
        "innovation_center": ["innovation", "incubation", "ciie", "startup"],
        "sports_complex": ["sports", "gym", "indoor stadium", "badminton"],
        "boys_hostel_aravali": ["aravali", "aravali hostel"],
        "boys_hostel_vindhya": ["vindhya", "vindhya hostel"],
        "girls_hostel_tulip": ["tulip", "tulip hostel", "girls hostel"],
        "food_court_central": ["food court", "central food court", "canteen", "main canteen", "satish canteen", "sateesh canteen"],
        "coffee_nescafe": ["nescafe", "coffee shop", "cafe"],
        "juice_center_pulp": ["juice", "pulp press", "milkshake"],
        "c_block_cafeteria": ["c-block cafeteria", "c block canteen", "kl adda", "panipuri", "naturals", "hidden cafe"],
        "atm_sbi": ["sbi atm", "atm machine"],
        "medical_center": ["medical center", "health center", "first aid"],
        "security_main_gate": ["main gate", "security office", "security gate"],
        "fire_assembly_point": ["fire assembly", "emergency assembly", "assembly point"],
        "police_help_desk": ["police", "police help desk", "police outpost"],
        "xerox_center": ["xerox", "print", "photocopy", "stationery"],
        "examination_cell": ["examination cell", "exam cell", "exam section"],
        "fed_block": ["fed block", "freshman engineering", "us pizza", "fed canteen"]
    }

    # 1. Check for specific location triggers
    matched_location_id = None
    for loc_id, keywords in location_mappings.items():
        for keyword in keywords:
            if keyword in query_clean:
                matched_location_id = loc_id
                break
        if matched_location_id:
            break

    # 2. Check for category filters
    matched_category = None
    for cat, keywords in category_keywords.items():
        for keyword in keywords:
            # Match word boundary/substring
            if keyword in query_clean:
                matched_category = cat
                break
        if matched_category:
            break

    # Action resolve
    # Case A: User wants the nearest item of a category (e.g. "take me to nearest washroom")
    if matched_category and ("nearest" in query_clean or "closest" in query_clean or "find" in query_clean or "where" in query_clean):
        # Find all locations in this category
        cat_locations = [loc for loc in db_locations if loc["category"] == matched_category]
        if not cat_locations:
            return {
                "message": f"I couldn't find any locations registered in the '{matched_category.upper()}' category.",
                "route": None
            }
            
        # Find the closest one
        closest_loc = None
        closest_route = None
        min_dist = float("inf")
        
        for loc in cat_locations:
            route = find_shortest_path(current_location_id, loc["id"])
            if route and route["distance_meters"] < min_dist:
                min_dist = route["distance_meters"]
                closest_loc = loc
                closest_route = route
                
        if closest_loc and closest_route:
            return {
                "message": f"📍 The closest **{closest_loc['name']}** is about **{closest_route['distance_meters']} meters** away. I've highlighted the shortest walking path on the map for you. Estimated walking time is **{closest_route['estimated_minutes']} minute(s)**.",
                "route": closest_route,
                "target_location": closest_loc
            }

    # Case B: User specifies a target location (e.g. "take me to Aravali hostel")
    if matched_location_id:
        target_loc = locations_by_id.get(matched_location_id)
        route = find_shortest_path(current_location_id, matched_location_id)
        if route:
            return {
                "message": f"🚶 Heading to **{target_loc['name']}**. Walking distance is **{route['distance_meters']} meters**, taking roughly **{route['estimated_minutes']} minute(s)**. Follow the route line displayed on the map.",
                "route": route,
                "target_location": target_loc
            }
        else:
            return {
                "message": f"I found the location **{target_loc['name']}**, but I could not compute a walkable route to it from your current position.",
                "route": None,
                "target_location": target_loc
            }

    # Case C: Just search/list category (e.g. "show all cafeterias")
    if matched_category:
        cat_locations = [loc for loc in db_locations if loc["category"] == matched_category]
        names = [f"• {loc['name']}" for loc in cat_locations]
        nl = "\n"
        return {
            "message": f"🏫 Here are all locations in the **{matched_category.upper()}** category:\n{nl.join(names)}\n\nClick on any marker on the map to see reviews and menus, or ask to navigate to one of them!",
            "route": None,
            "category_filter": matched_category
        }

    # Fallback response
    return {
        "message": "👋 I'm the KL-Edge Campus Assistant! I didn't quite catch your destination. You can ask me things like:\n"
                   "- *'Where is the nearest ATM?'*\n"
                   "- *'How do I reach Central Library?'*\n"
                   "- *'Take me to the nearest washroom.'*\n"
                   "- *'Show all cafeterias on the map.'*\n"
                   "- *'Navigate to ECE Department (C Block)'*",
        "route": None
    }

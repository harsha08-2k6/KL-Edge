import math
import heapq

# Define all nodes in the campus map (POIs + Junctions)
GRAPH_NODES = {
    # Points of Interest (POIs)
    "c_block": {"name": "C Block (ECE & CSE)", "coords": (16.4402, 80.6221)},
    "rd_block": {"name": "R&D Block (Research)", "coords": (16.4412, 80.6230)},
    "library": {"name": "Central Library", "coords": (16.4406, 80.6225)},
    "auditorium": {"name": "Peacock Hall (Auditorium)", "coords": (16.4404, 80.6216)},
    "admin_office": {"name": "Admin Block & Offices", "coords": (16.4398, 80.6212)},
    "innovation_center": {"name": "Innovation & Incubation Center", "coords": (16.4415, 80.6238)},
    "sports_complex": {"name": "Indoor Sports Complex", "coords": (16.4427, 80.6228)},
    "boys_hostel_aravali": {"name": "Aravali Boys Hostel", "coords": (16.4428, 80.6215)},
    "boys_hostel_vindhya": {"name": "Vindhya Boys Hostel", "coords": (16.4431, 80.6212)},
    "girls_hostel_tulip": {"name": "Tulip Girls Hostel", "coords": (16.4425, 80.6242)},
    "food_court_central": {"name": "Central Food Court", "coords": (16.4416, 80.6221)},
    "coffee_nescafe": {"name": "Nescafe Coffee Shop", "coords": (16.4408, 80.6228)},
    "juice_center_pulp": {"name": "Pulp Press Juice Center", "coords": (16.4411, 80.6218)},
    "c_block_cafeteria": {"name": "C-Block Cafeteria", "coords": (16.4401, 80.6220)},
    "atm_sbi": {"name": "SBI ATM (24/7)", "coords": (16.4399, 80.6213)},
    "medical_center": {"name": "Campus Medical Center", "coords": (16.4400, 80.6214)},
    "security_main_gate": {"name": "Security Office (Main Gate)", "coords": (16.4390, 80.6216)},
    "fire_assembly_point": {"name": "Fire Assembly Point", "coords": (16.4405, 80.6216)},
    "police_help_desk": {"name": "Police Help Desk", "coords": (16.4389, 80.6215)},
    "parking_student": {"name": "Student Parking Lot", "coords": (16.4392, 80.6217)},
    "parking_faculty": {"name": "Faculty Parking Lot", "coords": (16.4396, 80.6217)},
    "parking_bicycle": {"name": "Eco Bicycle Stands", "coords": (16.4401, 80.6219)},
    "xerox_center": {"name": "Student Xerox & Stationery", "coords": (16.4427, 80.6227)},
    "examination_cell": {"name": "Examination Cell", "coords": (16.4399, 80.6211)},
    "washroom_c_block_gf": {"name": "C-Block Washroom (GF)", "coords": (16.44015, 80.62205)},
    "washroom_library_1f": {"name": "Library Washroom (1F)", "coords": (16.44055, 80.62255)},
    "washroom_food_court": {"name": "Food Court Washroom", "coords": (16.44165, 80.62215)},
    "fed_block": {"name": "FED Block", "coords": (16.4411, 80.6216)},

    # Walkway Junctions (to navigate around buildings cleanly)
    "j_gate": {"name": "Main Gate Junction", "coords": (16.4391, 80.6216)},
    "j_admin": {"name": "Administration Circle", "coords": (16.4398, 80.6213)},
    "j_peacock": {"name": "Peacock Hall Lawns", "coords": (16.4403, 80.6215)},
    "j_c_block_entrance": {"name": "C-Block Plaza", "coords": (16.4401, 80.6221)},
    "j_library_front": {"name": "Library Plaza", "coords": (16.4405, 80.6224)},
    "j_central_lawn": {"name": "Central Lawn Path", "coords": (16.4405, 80.6215)},
    "j_food_court_junction": {"name": "Food Court Plaza", "coords": (16.4415, 80.6220)},
    "j_rd_block_front": {"name": "R&D Block Plaza", "coords": (16.4411, 80.6229)},
    "j_hostel_north": {"name": "Boys Hostel Entry Road", "coords": (16.4424, 80.6218)}
}

# Bidirectional edges representing pedestrian paths
GRAPH_EDGES = [
    ("security_main_gate", "j_gate"),
    ("police_help_desk", "j_gate"),
    ("parking_student", "j_gate"),
    
    ("j_gate", "j_admin"),
    ("j_admin", "admin_office"),
    ("j_admin", "examination_cell"),
    ("j_admin", "medical_center"),
    ("j_admin", "atm_sbi"),
    ("j_admin", "parking_faculty"),
    
    ("j_admin", "j_peacock"),
    ("j_peacock", "auditorium"),
    ("j_peacock", "j_central_lawn"),
    ("j_peacock", "j_c_block_entrance"),
    
    ("j_c_block_entrance", "c_block"),
    ("j_c_block_entrance", "c_block_cafeteria"),
    ("j_c_block_entrance", "washroom_c_block_gf"),
    ("j_c_block_entrance", "parking_bicycle"),
    
    ("j_c_block_entrance", "j_library_front"),
    ("j_library_front", "library"),
    ("j_library_front", "washroom_library_1f"),
    ("sports_complex", "xerox_center"),
    ("j_library_front", "coffee_nescafe"),
    
    ("j_library_front", "j_rd_block_front"),
    ("j_rd_block_front", "rd_block"),
    ("j_rd_block_front", "innovation_center"),
    
    ("j_central_lawn", "fire_assembly_point"),
    ("j_central_lawn", "j_library_front"),
    
    ("j_library_front", "j_food_court_junction"),
    ("j_food_court_junction", "food_court_central"),
    ("j_food_court_junction", "washroom_food_court"),
    ("j_food_court_junction", "juice_center_pulp"),
    
    ("j_food_court_junction", "j_hostel_north"),
    ("j_hostel_north", "boys_hostel_aravali"),
    ("j_hostel_north", "boys_hostel_vindhya"),
    
    ("j_hostel_north", "sports_complex"),
    ("sports_complex", "girls_hostel_tulip"),
    ("j_rd_block_front", "girls_hostel_tulip"),
    ("j_central_lawn", "fed_block"),
    ("j_food_court_junction", "fed_block")
]

def get_haversine_distance(coord1, coord2):
    """Calculate the great-circle distance between two points in meters."""
    R = 6371000.0  # Earth's radius in meters
    lat1, lon1 = math.radians(coord1[0]), math.radians(coord1[1])
    lat2, lon2 = math.radians(coord2[0]), math.radians(coord2[1])
    
    dlat = lat2 - lat1
    dlon = lon2 - lon1
    
    a = math.sin(dlat / 2)**2 + math.cos(lat1) * math.cos(lat2) * math.sin(dlon / 2)**2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    
    return R * c

# Build adjacency list with calculated weights (distances in meters)
ADJACENCY_LIST = {node: [] for node in GRAPH_NODES}
for u, v in GRAPH_EDGES:
    dist = get_haversine_distance(GRAPH_NODES[u]["coords"], GRAPH_NODES[v]["coords"])
    ADJACENCY_LIST[u].append((v, dist))
    ADJACENCY_LIST[v].append((u, dist))

def find_shortest_path(start_id, end_id):
    """Run Dijkstra's algorithm to find the shortest path between start_id and end_id."""
    if start_id not in GRAPH_NODES or end_id not in GRAPH_NODES:
        return None
        
    distances = {node: float("inf") for node in GRAPH_NODES}
    previous = {node: None for node in GRAPH_NODES}
    distances[start_id] = 0.0
    
    # Priority queue storing tuples: (distance, node_id)
    pq = [(0.0, start_id)]
    
    while pq:
        curr_dist, curr_node = heapq.heappop(pq)
        
        if curr_node == end_id:
            break
            
        if curr_dist > distances[curr_node]:
            continue
            
        for neighbor, weight in ADJACENCY_LIST[curr_node]:
            new_dist = curr_dist + weight
            if new_dist < distances[neighbor]:
                distances[neighbor] = new_dist
                previous[neighbor] = curr_node
                heapq.heappush(pq, (new_dist, neighbor))
                
    # Reconstruct the path
    path = []
    curr = end_id
    while curr is not None:
        path.append(curr)
        curr = previous[curr]
    path.reverse()
    
    if path[0] != start_id:
        return None  # Unreachable
        
    total_dist_meters = round(distances[end_id], 1)
    # Estimate time at 1.3 m/s (~80 meters per minute)
    est_time_minutes = max(1, round(total_dist_meters / 80.0))
    
    # Convert nodes list to details
    path_coords = [GRAPH_NODES[node_id]["coords"] for node_id in path]
    path_nodes = [{"id": nid, "name": GRAPH_NODES[nid]["name"], "coords": GRAPH_NODES[nid]["coords"]} for nid in path]
    
    # Generate human readable walking steps
    steps = []
    steps.append(f"Start from {GRAPH_NODES[start_id]['name']}.")
    
    for i in range(len(path) - 1):
        u, v = path[i], path[i+1]
        segment_dist = round(get_haversine_distance(GRAPH_NODES[u]["coords"], GRAPH_NODES[v]["coords"]))
        
        # Determine verbal directions
        u_name = GRAPH_NODES[u]["name"]
        v_name = GRAPH_NODES[v]["name"]
        
        # Don't announce minor junctions in detail unless necessary
        if "Junction" in v_name or "Circle" in v_name or "Plaza" in v_name or "Lawn" in v_name or "Pathway" in v_name or "Road" in v_name:
            steps.append(f"Walk {segment_dist} meters past {v_name}.")
        else:
            steps.append(f"Walk {segment_dist} meters towards {v_name}.")
            
    steps.append(f"Arrive at {GRAPH_NODES[end_id]['name']}.")
    
    return {
        "from": start_id,
        "to": end_id,
        "path_nodes": path_nodes,
        "path_coords": path_coords,
        "distance_meters": total_dist_meters,
        "estimated_minutes": est_time_minutes,
        "directions": steps
    }

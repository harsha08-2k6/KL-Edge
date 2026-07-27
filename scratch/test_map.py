import sys
import os

# Adjust path to find backend modules
sys.path.append(os.path.join(os.path.dirname(os.path.dirname(__file__)), "backend"))

from services.map_db import init_db, get_all_locations
from services.map_routing import find_shortest_path
from services.map_chat import parse_navigation_query

def run_tests():
    print("=== STARTING CAMPUS MAP TEST VALIDATION ===")
    
    # 1. Initialize DB
    print("\n[Test 1] Initializing SQLite database and seeding locations...")
    init_db()
    
    locations = get_all_locations()
    print(f"Success! Found {len(locations)} seeded locations in the database.")
    for loc in locations[:3]:
        print(f" - POI: {loc['name']} | Category: {loc['category']} | Coordinates: ({loc['latitude']}, {loc['longitude']})")
        
    # 2. Test Dijkstra routing
    print("\n[Test 2] Testing Dijkstra Routing: C Block to Central Library...")
    route = find_shortest_path("c_block", "library")
    if route:
        print(f"Success! Route found.")
        print(f" - Distance: {route['distance_meters']} meters")
        print(f" - Time: {route['estimated_minutes']} minute(s)")
        print(" - Walking Directions:")
        for step in route["directions"]:
            print(f"   {step}")
    else:
        print("FAIL: No route found between C Block and Library!")
        sys.exit(1)
        
    # 3. Test AI query parser (ATM)
    print("\n[Test 3] Testing AI query parser: 'take me to the nearest ATM'...")
    chat_res = parse_navigation_query("take me to the nearest ATM", current_location_id="c_block")
    print(f"Assistant Response: \"{chat_res['message']}\"")
    if chat_res.get("target_location") and chat_res["target_location"]["id"] == "atm_sbi":
        print("Success! Successfully routed to the SBI ATM.")
    else:
        print(f"FAIL: Expected target location 'atm_sbi', got {chat_res.get('target_location')}")
        sys.exit(1)
        
    # 4. Test AI query parser (Washroom)
    print("\n[Test 4] Testing AI query parser: 'Where is the nearest washroom?'...")
    chat_res_washroom = parse_navigation_query("Where is the nearest washroom?", current_location_id="c_block")
    print(f"Assistant Response: \"{chat_res_washroom['message']}\"")
    if chat_res_washroom.get("target_location") and chat_res_washroom["target_location"]["id"] == "washroom_c_block_gf":
        print("Success! Correctly identified the closest washroom to C-Block (washroom_c_block_gf).")
    else:
        print(f"FAIL: Expected target location 'washroom_c_block_gf', got {chat_res_washroom.get('target_location')}")
        sys.exit(1)

    print("\n=== ALL TEST CASES PASSED SUCCESSFULLY ===")

if __name__ == "__main__":
    run_tests()

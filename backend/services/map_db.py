import os
import sqlite3
import json
from datetime import datetime

DB_PATH = os.path.join(os.path.dirname(os.path.dirname(__file__)), "campus_map.db")

def get_db_connection():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_db_connection()
    cursor = conn.cursor()

    # Create locations table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS locations (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        category TEXT NOT NULL,
        description TEXT,
        latitude REAL NOT NULL,
        longitude REAL NOT NULL,
        opening_hours TEXT,
        departments TEXT,
        contact TEXT,
        menu TEXT,
        visitor_timings TEXT,
        warden_office TEXT,
        laundry_details TEXT,
        mess_details TEXT,
        price_range TEXT,
        peak_hours TEXT,
        rating REAL DEFAULT 0.0,
        rating_count INTEGER DEFAULT 0
    )
    """)

    # Create reviews table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS reviews (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        location_id TEXT NOT NULL,
        rating INTEGER NOT NULL,
        comment TEXT,
        student_name TEXT,
        timestamp TEXT NOT NULL,
        FOREIGN KEY (location_id) REFERENCES locations(id)
    )
    """)

    conn.commit()

    # Seed data if empty
    cursor.execute("SELECT COUNT(*) FROM locations")
    if cursor.fetchone()[0] == 0:
        seed_locations(conn)

    conn.close()

def seed_locations(conn):
    cursor = conn.cursor()
    
    # Large high-fidelity seed dataset
    seed_data = [
        {
            "id": "c_block",
            "name": "C Block (ECE & CSE)",
            "category": "academic",
            "description": "Primary academic block housing Electronics & Communication and Computer Science engineering classrooms, faculty cabins, and laboratories.",
            "latitude": 16.4402,
            "longitude": 80.6221,
            "opening_hours": "8:00 AM - 5:30 PM",
            "departments": "Electronics & Communication Engineering, Computer Science Engineering",
            "contact": "+91 8645 350200",
            "menu": None,
            "visitor_timings": None,
            "warden_office": None,
            "laundry_details": None,
            "mess_details": None,
            "price_range": None,
            "peak_hours": None,
            "rating": 4.2,
            "rating_count": 12
        },
        {
            "id": "rd_block",
            "name": "R&D Block (Research)",
            "category": "academic",
            "description": "Research and Skill Development center featuring specialized AI, IoT, and PhD research labs. Food facilities include Ground Floor samosa/puff stalls and 1st Floor Satish Canteen 2 & Nescafe kiosk.",
            "latitude": 16.4412,
            "longitude": 80.6230,
            "opening_hours": "8:00 AM - 8:00 PM",
            "departments": "Computer Science & Engineering (Research), Biotechnology, Center for Advanced Studies",
            "contact": "+91 8645 350205",
            "menu": None,
            "visitor_timings": None,
            "warden_office": None,
            "laundry_details": None,
            "mess_details": None,
            "price_range": None,
            "peak_hours": None,
            "rating": 4.5,
            "rating_count": 8
        },
        {
            "id": "library",
            "name": "Central Library",
            "category": "library",
            "description": "A state-of-the-art six-floor fully air-conditioned green building with RFID access, digital cataloging, and reading rooms for over 1500 students.",
            "latitude": 16.4406,
            "longitude": 80.6225,
            "opening_hours": "8:00 AM - 10:00 PM",
            "departments": "Reference Section, Digital Library, Archive, Periodicals Wing",
            "contact": "+91 8645 350220",
            "menu": None,
            "visitor_timings": None,
            "warden_office": None,
            "laundry_details": None,
            "mess_details": None,
            "price_range": None,
            "peak_hours": None,
            "rating": 4.7,
            "rating_count": 28
        },
        {
            "id": "auditorium",
            "name": "Peacock Hall (Auditorium)",
            "category": "academic",
            "description": "The main fully air-conditioned university auditorium, which hosts national seminars, guest lectures, cultural fests, and student conventions.",
            "latitude": 16.4404,
            "longitude": 80.6216,
            "opening_hours": "9:00 AM - 6:00 PM",
            "departments": "Student Affairs, Cultural Committee",
            "contact": "+91 8645 350230",
            "menu": None,
            "visitor_timings": None,
            "warden_office": None,
            "laundry_details": None,
            "mess_details": None,
            "price_range": None,
            "peak_hours": None,
            "rating": 4.4,
            "rating_count": 15
        },
        {
            "id": "admin_office",
            "name": "Admin Block & Offices",
            "category": "academic",
            "description": "University administrative building housing the Registrar's Office, Accounts Section, Admissions Desk, and central student help stations.",
            "latitude": 16.4398,
            "longitude": 80.6212,
            "opening_hours": "9:00 AM - 5:00 PM",
            "departments": "Admissions Cell, Accounts and Finance, HR, Public Relations",
            "contact": "+91 8645 350100",
            "menu": None,
            "visitor_timings": None,
            "warden_office": None,
            "laundry_details": None,
            "mess_details": None,
            "price_range": None,
            "peak_hours": None,
            "rating": 3.9,
            "rating_count": 5
        },
        {
            "id": "innovation_center",
            "name": "Innovation & Incubation Center",
            "category": "academic",
            "description": "CIIE block providing co-working spaces, mentoring programs, prototyping tools, and seed funds for student-led startups and research commercialization.",
            "latitude": 16.4415,
            "longitude": 80.6238,
            "opening_hours": "9:00 AM - 6:00 PM",
            "departments": "Entrepreneurship Development Cell, IPR Cell",
            "contact": "+91 8645 350250",
            "menu": None,
            "visitor_timings": None,
            "warden_office": None,
            "laundry_details": None,
            "mess_details": None,
            "price_range": None,
            "peak_hours": None,
            "rating": 4.6,
            "rating_count": 9
        },
        {
            "id": "sports_complex",
            "name": "Indoor Sports Complex",
            "category": "sports",
            "description": "Equipped with international-standard wooden badminton courts, table tennis tables, a modern gymnasium, yoga halls, and squash courts.",
            "latitude": 16.4427,
            "longitude": 80.6228,
            "opening_hours": "6:00 AM - 8:30 PM",
            "departments": "Physical Education Department",
            "contact": "+91 8645 350260",
            "menu": None,
            "visitor_timings": None,
            "warden_office": None,
            "laundry_details": None,
            "mess_details": None,
            "price_range": None,
            "peak_hours": None,
            "rating": 4.5,
            "rating_count": 21
        },
        {
            "id": "boys_hostel_aravali",
            "name": "Aravali Boys Hostel",
            "category": "hostel",
            "description": "Primary on-campus residence hall for boys, offering spacious, air-conditioned rooms, a common reading room, and sports fields.",
            "latitude": 16.4428,
            "longitude": 80.6215,
            "opening_hours": "24/7 (Security)",
            "departments": "Hostel Board",
            "contact": "+91 8645 350410",
            "menu": None,
            "visitor_timings": "4:30 PM - 6:30 PM",
            "warden_office": "Aravali Block Ground Floor Room 102",
            "laundry_details": "Steam Laundry services available (2 loads/week included)",
            "mess_details": "Aravali Deluxe Mess, serving South & North Indian menus",
            "price_range": None,
            "peak_hours": None,
            "rating": 4.1,
            "rating_count": 14
        },
        {
            "id": "boys_hostel_vindhya",
            "name": "Vindhya Boys Hostel",
            "category": "hostel",
            "description": "Premium multi-story boys' residence located adjacent to the cafeteria area, with full Wi-Fi and generator backup.",
            "latitude": 16.4431,
            "longitude": 80.6212,
            "opening_hours": "24/7 (Security)",
            "departments": "Hostel Board",
            "contact": "+91 8645 350415",
            "menu": None,
            "visitor_timings": "4:30 PM - 6:30 PM",
            "warden_office": "Vindhya Entrance Office",
            "laundry_details": "Central Laundry pickup point available",
            "mess_details": "Vindhya Mess (serving pure vegetarian options)",
            "price_range": None,
            "peak_hours": None,
            "rating": 4.0,
            "rating_count": 10
        },
        {
            "id": "girls_hostel_tulip",
            "name": "Tulip Girls Hostel",
            "category": "hostel",
            "description": "Fully secure residency for girls featuring modern amenities, an inside gym, in-house library, and strict smart-card biometric security.",
            "latitude": 16.4425,
            "longitude": 80.6242,
            "opening_hours": "24/7 (Security)",
            "departments": "Women's Hostel Committee",
            "contact": "+91 8645 350420",
            "menu": None,
            "visitor_timings": "4:30 PM - 6:30 PM",
            "warden_office": "Tulip Block A Lobby",
            "laundry_details": "Tulip Laundry Room, self-service washers and dryers available",
            "mess_details": "Tulip Multi-cuisine Mess (includes juice bar)",
            "price_range": None,
            "peak_hours": None,
            "rating": 4.3,
            "rating_count": 16
        },
        {
            "id": "food_court_central",
            "name": "Main Canteen (Sateesh Canteen)",
            "category": "food",
            "description": "Located opposite to S Block, on the other side of the library and SDC block road. This is the largest campus food venue offering multi-cuisine fast-food options, meals, and seating.",
            "latitude": 16.4416,
            "longitude": 80.6221,
            "opening_hours": "9:00 AM - 9:00 PM",
            "departments": None,
            "contact": None,
            "menu": json.dumps([
                {"item": "Veg Biryani", "price": 120},
                {"item": "Chicken Biryani", "price": 150},
                {"item": "Paneer Butter Masala + 2 Roti", "price": 110},
                {"item": "Masala Dosa", "price": 50},
                {"item": "Samosa (Plate of 2)", "price": 25},
                {"item": "Paneer Tikka Roll", "price": 90}
            ]),
            "visitor_timings": None,
            "warden_office": None,
            "laundry_details": None,
            "mess_details": None,
            "price_range": "$",
            "peak_hours": "12:30 PM - 2:00 PM",
            "rating": 4.3,
            "rating_count": 45
        },
        {
            "id": "coffee_nescafe",
            "name": "Nescafe Coffee Shop",
            "category": "food",
            "description": "Cozy open-air kiosk located near the Central Library. Serves specialty hot coffees, iced beverages, Maggi, and light baked goods.",
            "latitude": 16.4408,
            "longitude": 80.6228,
            "opening_hours": "8:30 AM - 8:30 PM",
            "departments": None,
            "contact": None,
            "menu": json.dumps([
                {"item": "Iced Frappe", "price": 70},
                {"item": "Hot Cappuccino", "price": 55},
                {"item": "Classic Lemon Tea", "price": 30},
                {"item": "Double Masala Maggi", "price": 45},
                {"item": "Cheese Maggi", "price": 55},
                {"item": "Chocolate Chip Cookie", "price": 25}
            ]),
            "visitor_timings": None,
            "warden_office": None,
            "laundry_details": None,
            "mess_details": None,
            "price_range": "$",
            "peak_hours": "4:00 PM - 6:00 PM",
            "rating": 4.4,
            "rating_count": 35
        },
        {
            "id": "juice_center_pulp",
            "name": "Pulp Press Juice Center",
            "category": "food",
            "description": "Healthy choice kiosk offering fresh cold-pressed fruit juices, organic milkshakes, protein shakes, and seasonal fruit bowls.",
            "latitude": 16.4411,
            "longitude": 80.6218,
            "opening_hours": "8:00 AM - 7:30 PM",
            "departments": None,
            "contact": None,
            "menu": json.dumps([
                {"item": "Fresh Watermelon Juice", "price": 40},
                {"item": "Citrus Sweet Lime Juice", "price": 50},
                {"item": "Almond Banana Smoothie", "price": 70},
                {"item": "Mango Thick Shake", "price": 65},
                {"item": "Mixed Fruit Salad with Honey", "price": 80}
            ]),
            "visitor_timings": None,
            "warden_office": None,
            "laundry_details": None,
            "mess_details": None,
            "price_range": "$",
            "peak_hours": "3:00 PM - 5:00 PM",
            "rating": 4.1,
            "rating_count": 18
        },
        {
            "id": "c_block_cafeteria",
            "name": "C-Block Cafeteria & Canteens",
            "category": "food",
            "description": "Quick canteens and cafes located across different floors of C-Block:\n• Lobby: Vending machines, samosa, puff\n• Ground Floor: KL Adda\n• 1st Floor: Normal canteen\n• 2nd Floor: Normal canteen (panipuri)\n• 3rd Floor: Naturals\n• 4th Floor: Canteen (puff)\n• 5th Floor: Hidden Cafe",
            "latitude": 16.4401,
            "longitude": 80.6220,
            "opening_hours": "7:30 AM - 5:30 PM",
            "departments": None,
            "contact": None,
            "menu": json.dumps([
                {"item": "Onion Ravva Dosa", "price": 45},
                {"item": "Idli Sambar (4 pcs)", "price": 30},
                {"item": "Samosa / Puff", "price": 20},
                {"item": "Panipuri (2F Canteen)", "price": 35},
                {"item": "Naturals Ice Cream", "price": 60},
                {"item": "Hidden Cafe Coffee", "price": 40},
                {"item": "Filter Coffee", "price": 15}
            ]),
            "visitor_timings": None,
            "warden_office": None,
            "laundry_details": None,
            "mess_details": None,
            "price_range": "$",
            "peak_hours": "12:30 PM - 1:30 PM",
            "rating": 4.0,
            "rating_count": 22
        },
        {
            "id": "atm_sbi",
            "name": "SBI ATM (24/7)",
            "category": "atm",
            "description": "State Bank of India cash point with withdrawal and cash deposit machines, centrally located near the Admin Block entrance.",
            "latitude": 16.4399,
            "longitude": 80.6213,
            "opening_hours": "24 Hours / 7 Days",
            "departments": None,
            "contact": None,
            "menu": None,
            "visitor_timings": None,
            "warden_office": None,
            "laundry_details": None,
            "mess_details": None,
            "price_range": None,
            "peak_hours": None,
            "rating": 4.5,
            "rating_count": 4
        },
        {
            "id": "medical_center",
            "name": "Campus Medical Center",
            "category": "medical",
            "description": "Fully functional healthcare clinic with diagnostic tools, observation beds, a pharmacist cabin, and a dedicated 24/7 emergency ambulance.",
            "latitude": 16.4400,
            "longitude": 80.6214,
            "opening_hours": "24 Hours (Emergency)",
            "departments": "University Medical Service",
            "contact": "+91 8645 350299 (Ambulance)",
            "menu": None,
            "visitor_timings": None,
            "warden_office": None,
            "laundry_details": None,
            "mess_details": None,
            "price_range": None,
            "peak_hours": None,
            "rating": 4.2,
            "rating_count": 6
        },
        {
            "id": "security_main_gate",
            "name": "Security Office (Main Gate)",
            "category": "emergency",
            "description": "Main gate security post responsible for ID verification, vehicle registration, and student curfew checkouts.",
            "latitude": 16.4390,
            "longitude": 80.6216,
            "opening_hours": "24 Hours",
            "departments": "Campus Security Services",
            "contact": "+91 8645 350211",
            "menu": None,
            "visitor_timings": None,
            "warden_office": None,
            "laundry_details": None,
            "mess_details": None,
            "price_range": None,
            "peak_hours": None,
            "rating": 4.0,
            "rating_count": 3
        },
        {
            "id": "fire_assembly_point",
            "name": "Fire Assembly Point",
            "category": "emergency",
            "description": "Designated safe muster evacuation assembly ground in the central grassy quadrangle.",
            "latitude": 16.4405,
            "longitude": 80.6216,
            "opening_hours": "24 Hours",
            "departments": "Disaster Management & Safety Group",
            "contact": None,
            "menu": None,
            "visitor_timings": None,
            "warden_office": None,
            "laundry_details": None,
            "mess_details": None,
            "price_range": None,
            "peak_hours": None,
            "rating": 5.0,
            "rating_count": 1
        },
        {
            "id": "police_help_desk",
            "name": "Police Help Desk",
            "category": "emergency",
            "description": "Local policing helpdesk outpost set up near the visitor reception block to ensure student assistance and verify security files.",
            "latitude": 16.4389,
            "longitude": 80.6215,
            "opening_hours": "9:00 AM - 5:00 PM",
            "departments": "Guntur Police Outpost Desk",
            "contact": "100 / +91 8645 350100 ext 55",
            "menu": None,
            "visitor_timings": None,
            "warden_office": None,
            "laundry_details": None,
            "mess_details": None,
            "price_range": None,
            "peak_hours": None,
            "rating": 4.3,
            "rating_count": 3
        },
        {
            "id": "parking_student",
            "name": "Student Parking Lot",
            "category": "parking",
            "description": "Spacious parking bays behind the entrance gate accommodating over 1000 student motorcycles and cars.",
            "latitude": 16.4392,
            "longitude": 80.6217,
            "opening_hours": "7:00 AM - 10:00 PM",
            "departments": "Transport & Security Section",
            "contact": None,
            "menu": None,
            "visitor_timings": None,
            "warden_office": None,
            "laundry_details": None,
            "mess_details": None,
            "price_range": None,
            "peak_hours": None,
            "rating": 3.7,
            "rating_count": 6
        },
        {
            "id": "parking_faculty",
            "name": "Faculty Parking Lot",
            "category": "parking",
            "description": "Reserved parking slots situated immediately behind C-Block for university faculty members and executives.",
            "latitude": 16.4396,
            "longitude": 80.6217,
            "opening_hours": "7:00 AM - 8:00 PM",
            "departments": "Transport & Security Section",
            "contact": None,
            "menu": None,
            "visitor_timings": None,
            "warden_office": None,
            "laundry_details": None,
            "mess_details": None,
            "price_range": None,
            "peak_hours": None,
            "rating": 4.1,
            "rating_count": 3
        },
        {
            "id": "parking_bicycle",
            "name": "Eco Bicycle Stands",
            "category": "parking",
            "description": "Multiple roof-covered cycle racks equipped with lock chains, promoting zero-emission transit within campus corridors.",
            "latitude": 16.4401,
            "longitude": 80.6219,
            "opening_hours": "24 Hours",
            "departments": None,
            "contact": None,
            "menu": None,
            "visitor_timings": None,
            "warden_office": None,
            "laundry_details": None,
            "mess_details": None,
            "price_range": None,
            "peak_hours": None,
            "rating": 4.6,
            "rating_count": 5
        },
        {
            "id": "xerox_center",
            "name": "Student Xerox & Stationery",
            "category": "services",
            "description": "Located inside the Indoor Sports Complex, this high-volume print shop offers copying, scanning, color printing, lab manual bindings, and regular course guides.",
            "latitude": 16.4427,
            "longitude": 80.6227,
            "opening_hours": "8:30 AM - 7:00 PM",
            "departments": None,
            "contact": "+91 8645 350221",
            "menu": None,
            "visitor_timings": None,
            "warden_office": None,
            "laundry_details": None,
            "mess_details": None,
            "price_range": None,
            "peak_hours": None,
            "rating": 4.2,
            "rating_count": 13
        },
        {
            "id": "examination_cell",
            "name": "Examination Cell (Exam Section)",
            "category": "academic",
            "description": "Main examination block where marks records are processed, hall tickets issued, and graduation certificates validated.",
            "latitude": 16.4399,
            "longitude": 80.6211,
            "opening_hours": "9:00 AM - 5:00 PM",
            "departments": "Office of the Controller of Examinations",
            "contact": "+91 8645 350109",
            "menu": None,
            "visitor_timings": None,
            "warden_office": None,
            "laundry_details": None,
            "mess_details": None,
            "price_range": None,
            "peak_hours": None,
            "rating": 3.5,
            "rating_count": 10
        },
        {
            "id": "washroom_c_block_gf",
            "name": "C-Block Washroom (GF)",
            "category": "washroom",
            "description": "Fully cleaned student washrooms located near Room C105, featuring wheelchair accessibility.",
            "latitude": 16.44015,
            "longitude": 80.62205,
            "opening_hours": "8:00 AM - 6:00 PM",
            "departments": None,
            "contact": None,
            "menu": None,
            "visitor_timings": None,
            "warden_office": None,
            "laundry_details": None,
            "mess_details": None,
            "price_range": None,
            "peak_hours": None,
            "rating": 3.8,
            "rating_count": 5
        },
        {
            "id": "washroom_library_1f",
            "name": "Library Washroom (1F)",
            "category": "washroom",
            "description": "Hygenic washrooms located on the first floor reading room wing of the Central Library.",
            "latitude": 16.44055,
            "longitude": 80.62255,
            "opening_hours": "8:00 AM - 10:00 PM",
            "departments": None,
            "contact": None,
            "menu": None,
            "visitor_timings": None,
            "warden_office": None,
            "laundry_details": None,
            "mess_details": None,
            "price_range": None,
            "peak_hours": None,
            "rating": 4.3,
            "rating_count": 6
        },
        {
            "id": "washroom_food_court",
            "name": "Food Court Washroom",
            "category": "washroom",
            "description": "Restrooms located immediately to the east of the central dining arena.",
            "latitude": 16.44165,
            "longitude": 80.62215,
            "opening_hours": "9:00 AM - 9:00 PM",
            "departments": None,
            "contact": None,
            "menu": None,
            "visitor_timings": None,
            "warden_office": None,
            "laundry_details": None,
            "mess_details": None,
            "price_range": None,
            "peak_hours": None,
            "rating": 3.5,
            "rating_count": 8
        },
        {
            "id": "fed_block",
            "name": "FED Block",
            "category": "academic",
            "description": "Freshman Engineering Department block. Food facilities include US Pizza on the Ground Floor and a Small Canteen on the 3rd Floor.",
            "latitude": 16.4411,
            "longitude": 80.6216,
            "opening_hours": "8:00 AM - 5:30 PM",
            "departments": "Freshman Engineering Department",
            "contact": None,
            "menu": None,
            "visitor_timings": None,
            "warden_office": None,
            "laundry_details": None,
            "mess_details": None,
            "price_range": None,
            "peak_hours": None,
            "rating": 4.0,
            "rating_count": 5
        }
    ]

    for item in seed_data:
        cursor.execute("""
        INSERT INTO locations (
            id, name, category, description, latitude, longitude,
            opening_hours, departments, contact, menu, visitor_timings,
            warden_office, laundry_details, mess_details, price_range, peak_hours,
            rating, rating_count
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            item["id"], item["name"], item["category"], item["description"], item["latitude"], item["longitude"],
            item["opening_hours"], item["departments"], item["contact"], item["menu"], item["visitor_timings"],
            item["warden_office"], item["laundry_details"], item["mess_details"], item["price_range"], item["peak_hours"],
            item["rating"], item["rating_count"]
        ))
        
        # Add some initial seed reviews
        cursor.execute("""
        INSERT INTO reviews (location_id, rating, comment, student_name, timestamp)
        VALUES (?, ?, ?, ?, ?)
        """, (
            item["id"],
            5 if item["rating"] >= 4.5 else 4,
            f"Great facility! Very clean and helpful for students.",
            "Siva Harsha",
            datetime.utcnow().isoformat()
        ))

    conn.commit()

def get_all_locations():
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM locations")
    rows = cursor.fetchall()
    
    locations = []
    for row in rows:
        loc = dict(row)
        if loc["menu"]:
            loc["menu"] = json.loads(loc["menu"])
        locations.append(loc)
        
    conn.close()
    return locations

def get_location_by_id(location_id):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM locations WHERE id = ?", (location_id,))
    row = cursor.fetchone()
    loc = dict(row) if row else None
    if loc and loc["menu"]:
        loc["menu"] = json.loads(loc["menu"])
    conn.close()
    return loc

def get_reviews_for_location(location_id):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM reviews WHERE location_id = ? ORDER BY timestamp DESC", (location_id,))
    rows = cursor.fetchall()
    reviews = [dict(row) for row in rows]
    conn.close()
    return reviews

def add_review(location_id, rating, comment, student_name="Student"):
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # Save the review
    timestamp = datetime.utcnow().isoformat()
    cursor.execute("""
    INSERT INTO reviews (location_id, rating, comment, student_name, timestamp)
    VALUES (?, ?, ?, ?, ?)
    """, (location_id, rating, comment, student_name, timestamp))
    
    # Recalculate average rating and rating_count for the location
    cursor.execute("SELECT AVG(rating), COUNT(*) FROM reviews WHERE location_id = ?", (location_id,))
    avg_rating, rating_count = cursor.fetchone()
    
    cursor.execute("""
    UPDATE locations
    SET rating = ?, rating_count = ?
    WHERE id = ?
    """, (round(avg_rating, 1), rating_count, location_id))
    
    conn.commit()
    conn.close()
    
    return {
        "status": "success",
        "rating": round(avg_rating, 1),
        "rating_count": rating_count
    }

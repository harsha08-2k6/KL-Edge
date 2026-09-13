import os
from supabase import create_client, Client
from dotenv import load_dotenv

load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL", "").strip()
SUPABASE_KEY = os.getenv("SUPABASE_KEY", "").strip()

# Initialize Supabase client
supabase: Client = None
init_error = None

if SUPABASE_URL and SUPABASE_KEY:
    try:
        supabase = create_client(SUPABASE_URL, SUPABASE_KEY)
    except Exception as e:
        init_error = str(e)
        print(f"Failed to initialize Supabase client: {e}")
else:
    init_error = f"Missing env vars. URL present: {bool(SUPABASE_URL)}, Key present: {bool(SUPABASE_KEY)}"

def get_supabase():
    return supabase

def get_init_error():
    return init_error

import base64
from datetime import datetime, timedelta
import json
import os
import re
import time
import uuid
from dataclasses import dataclass
from pathlib import Path
from typing import Dict, List, Optional
from urllib.parse import quote, urljoin, urlparse, parse_qsl

import httpx
from bs4 import BeautifulSoup
from dotenv import load_dotenv

try:
    from PIL import Image, ImageEnhance
except ImportError:
    pass

load_dotenv()


def save_debug_html(filename: str, html: str, url: str = "") -> None:
    try:
        debug_path = Path(__file__).resolve().parent / filename
        content = f"<!-- URL: {url} -->\n{html}" if url else html
        debug_path.write_text(content, encoding="utf8")
    except Exception:
        pass

try:
    import redis
    HAS_REDIS = True
except ImportError:
    HAS_REDIS = False

REDIS_URL = os.getenv("KV_URL") or os.getenv("REDIS_URL")

if REDIS_URL:
    REDIS_URL = REDIS_URL.strip()
    if "redis://" in REDIS_URL:
        idx = REDIS_URL.find("redis://")
        REDIS_URL = REDIS_URL[idx:].split()[0]
    elif "rediss://" in REDIS_URL:
        idx = REDIS_URL.find("rediss://")
        REDIS_URL = REDIS_URL[idx:].split()[0]
    elif "://" not in REDIS_URL:
        REDIS_URL = f"redis://{REDIS_URL}"

if HAS_REDIS and REDIS_URL and REDIS_URL.startswith(("redis://", "rediss://", "unix://")):
    try:
        redis_client = redis.Redis.from_url(REDIS_URL)
    except Exception as e:
        print(f"Error connecting to Redis: {e}", flush=True)
        redis_client = None
else:
    redis_client = None
    if REDIS_URL:
        print(f"Warning: Invalid REDIS_URL scheme. Must start with redis:// or rediss://. Found: {REDIS_URL[:20]}... Falling back to memory.", flush=True)


def selector_to_id(selector: str) -> str:
    if not selector:
        return ""
    selector = selector.strip()
    if selector.startswith("#"):
        return selector[1:]
    return ""


def extract_keywords(value: str) -> List[str]:
    tokens = re.findall(r"[A-Za-z0-9]+", value or "")
    ignored = {"select", "name", "id", "value", "option"}
    results = []
    for token in tokens:
        lowered = token.lower()
        if len(lowered) < 3 or lowered in ignored:
            continue
        results.append(lowered)
    return results


def merge_keywords(base: List[str], selector_value: str) -> List[str]:
    keywords = list(base)
    extra = extract_keywords(selector_value)
    for entry in extra:
        if entry not in keywords:
            keywords.append(entry)
    return keywords

DEFAULT_USER_AGENT = os.getenv(
    "ERP_USER_AGENT",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
)

# Hardcoded exactly to your login URL (ignores faulty .env files)
LOGIN_URL = "https://newerp.kluniversity.in/"
ATTENDANCE_URL = "https://newerp.kluniversity.in/index.php?r=studentattendance%2Fstudentdailyattendance%2Fsearchgetinput"
ATTENDANCE_COURSELIST_URL = "https://newerp.kluniversity.in/index.php?r=studentattendance%2Fstudentdailyattendance%2Fcourselist"
TIMETABLE_URL = (
    "https://newerp.kluniversity.in/index.php"
    "?r=timetables%2Funiversitymasteracademictimetableview"
    "%2Findexstudentindisearch"
)

_term_id_cache: Dict[str, Dict[str, str]] = {
    "latest": {"acad_id": "29", "sem_id": "1"}
}


def cache_term_ids(academic_year: str, semester_id: str, acad_id: str, sem_id: str):
    if not acad_id or not sem_id:
        return
    mapping = {"acad_id": str(acad_id), "sem_id": str(sem_id)}
    _term_id_cache["latest"] = mapping
    if academic_year and semester_id:
        key = f"{academic_year.strip().lower()}:{semester_id.strip().lower()}"
        _term_id_cache[key] = mapping
    if redis_client:
        try:
            if academic_year and semester_id:
                redis_client.setex(f"term_ids:{key}", 86400 * 30, json.dumps(mapping))
            redis_client.setex("term_ids:latest", 86400 * 30, json.dumps(mapping))
        except Exception:
            pass


def get_cached_term_ids(academic_year: str = "", semester_id: str = "") -> Optional[Dict[str, str]]:
    if academic_year and semester_id:
        key = f"{academic_year.strip().lower()}:{semester_id.strip().lower()}"
        if key in _term_id_cache:
            return _term_id_cache[key]
        if redis_client:
            try:
                raw = redis_client.get(f"term_ids:{key}")
                if raw:
                    data = json.loads(raw)
                    _term_id_cache[key] = data
                    return data
            except Exception:
                pass
    if "latest" in _term_id_cache:
        return _term_id_cache["latest"]
    if redis_client:
        try:
            raw = redis_client.get("term_ids:latest")
            if raw:
                data = json.loads(raw)
                _term_id_cache["latest"] = data
                return data
        except Exception:
            pass
    return {"acad_id": "29", "sem_id": "1"}

ALLOW_INSECURE = os.getenv("ERP_ALLOW_INSECURE", "true").lower() in {"1", "true", "yes"}
DEBUG_ENABLED = os.getenv("ERP_DEBUG", "true").lower() in {"1", "true", "yes"}

if ALLOW_INSECURE:
    import urllib3
    urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

CAPTCHA_SESSION_TTL_MS = int(os.getenv("ERP_CAPTCHA_SESSION_TTL_MS", "604800000")) # Default to 7 days to avoid unnecessary expirations
MAX_CAPTCHA_SESSIONS = int(os.getenv("ERP_MAX_CAPTCHA_SESSIONS", "5"))
DEFAULT_TIMEOUT_MS = int(os.getenv("ERP_TIMEOUT_MS", "45000"))

LOGIN_FIELD_IDS = {
    "erp_id": selector_to_id(os.getenv("ERP_ID_SELECTOR", "#loginFormUserNameID")),
    "password": selector_to_id(os.getenv("ERP_PASSWORD_SELECTOR", "#loginFormPasswordID")),
    "captcha": selector_to_id(os.getenv("ERP_CAPTCHA_SELECTOR", "#loginFormCaptcha"))
}

ACADEMIC_KEYWORDS = merge_keywords(
    ["academicyear", "academic", "year"],
    os.getenv("ERP_ACADEMIC_YEAR_SELECTOR", "")
)
SEMESTER_KEYWORDS = merge_keywords(
    ["semesterid", "semester", "term"],
    os.getenv("ERP_SEMESTER_SELECTOR", "")
)

FACULTY_PATH = Path(__file__).resolve().parent / "faculty.json"

MARKS_LINK_KEYWORDS = [
    "marks",
    "internal",
    "internals",
    "insem",
    "in sem",
    "qp",
    "qp wise",
    "qpwise",
    "summative",
    "sessional",
    "memo",
    "result",
    "courses",
    "evaluation"
]
SEATING_LINK_KEYWORDS = [
    "seating",
    "seat",
    "seating plan",
    "room",
    "room allotment",
    "exam",
    "hall",
    "ticket",
    "allocation"
]
CGPA_LINK_KEYWORDS = ["cgpa", "my cgpa", "cumulative gpa", "gpa"]

MARKS_CANDIDATE_PATHS = [
    # Course Internals - THE WORKING URL based on user's ERP navigation
    "index.php?r=studentinfo/studentendexamresult/getstudentinternalmarks",
    # Student info - CGPA results (backup)
    "index.php?r=studentinfo/studentendexamresult/searchgetmycgpa",
    # QP Wise Internal Marks
    "index.php?r=examsection/examstudentcourseinternalsummativeqpwisemarksinfo/index",
    # Student marks pages
    "index.php?r=studentmarks/marks/index",
    "index.php?r=studentmarks/marks/internal",
    "index.php?r=studentmarks/marks/view",
    "index.php?r=studentmarks/studentinternalmarks/index",
    "index.php?r=studentmarks/internals/index",
    "index.php?r=studentmarks/myinternals/index",
    "index.php?r=studentmarks/viewmarks/index",
    # Student Info - End Exam Results
    "index.php?r=studentinfo/studentendexamresult/index",
    "index.php?r=studentinfo/studentendexamresult/marks",
    "index.php?r=studentinfo/myresult/index",
    # Course internal marks
    "index.php?r=studentcourse/internalmarks/index",
    "index.php?r=studentcourse/courseinternals/index",
    # Exam section internal marks
    "index.php?r=examsection/examstudentinternalmarks/index",
    "index.php?r=examsection/studentinternalmarks",
]

SEATING_CANDIDATE_PATHS = [
    "index.php?r=examsection/exam-invigilator-student-room-allotment-info/stud_my_seating_plan",
    "index.php?r=studentexam/seatingplan/index",
    "index.php?r=examination/seatingplan/index",
    "index.php?r=studentexam/hallticket/index"
]

CGPA_CANDIDATE_PATHS = [
    "index.php?r=studentinfo/studentendexamresult/searchgetmycgpa",
    "index.php?r=studentresult/cgpa/index",
    "index.php?r=studentmarks/marks/cgpa",
    "index.php?r=studentinfo/studentendexamresult/index",
    "index.php?r=examsection/examstudentresult/index"
]


class AppError(Exception):
    def __init__(self, message: str, status_code: int = 500):
        super().__init__(message)
        self.message = message
        self.status_code = status_code


captcha_sessions_memory: Dict[str, Dict] = {}


def dedupe_cookies(jar) -> None:
    if jar is None:
        return
    raw_jar = getattr(jar, "jar", jar)
    if not hasattr(raw_jar, "clear") or not hasattr(raw_jar, "set_cookie"):
        return
    try:
        seen = {}
        for cookie in list(raw_jar):
            seen[cookie.name] = cookie
        raw_jar.clear()
        for cookie in seen.values():
            raw_jar.set_cookie(cookie)
    except Exception:
        pass


def serialize_cookies(jar) -> dict:
    if jar is None:
        return {}
    dedupe_cookies(jar)
    res = {}
    raw_jar = getattr(jar, "jar", jar)
    try:
        for cookie in list(raw_jar):
            res[cookie.name] = cookie.value
        return res
    except Exception:
        try:
            return dict(jar)
        except Exception:
            return {}


def deserialize_cookies(raw) -> httpx.Cookies:
    jar = httpx.Cookies()
    if not raw:
        return jar
    if isinstance(raw, dict):
        for k, v in raw.items():
            try:
                jar.set(str(k), str(v))
            except Exception:
                pass
    elif isinstance(raw, list):
        for entry in raw:
            if isinstance(entry, dict) and "name" in entry and "value" in entry:
                try:
                    jar.set(entry["name"], entry["value"], domain=entry.get("domain", ""))
                except Exception:
                    pass
    dedupe_cookies(jar)
    return jar


def safe_get_cookie(jar, name: str, default: str = "") -> str:
    if jar is None or not name:
        return default
    dedupe_cookies(jar)
    raw_jar = getattr(jar, "jar", jar)
    try:
        for cookie in list(raw_jar):
            if cookie.name == name:
                return cookie.value
    except Exception:
        pass
    return default


def has_cookie_name(jar, name: str) -> bool:
    return bool(safe_get_cookie(jar, name))


def dedupe_cookie(jar, name: str) -> None:
    dedupe_cookies(jar)


import sqlite3

def get_db_connection():
    db_path = Path(__file__).resolve().parent / "campus_map.db"
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    return conn

def save_captcha_session(session_id: str, data: Dict):
    if redis_client:
        try:
            redis_client.setex(f"captcha_session:{session_id}", CAPTCHA_SESSION_TTL_MS // 1000, json.dumps(data))
            return
        except Exception:
            pass
            
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("CREATE TABLE IF NOT EXISTS kv_cache (key TEXT PRIMARY KEY, value TEXT)")
        cursor.execute("INSERT OR REPLACE INTO kv_cache (key, value) VALUES (?, ?)", (f"captcha_session:{session_id}", json.dumps(data)))
        conn.commit()
        conn.close()
    except Exception as e:
        print(f"[captcha:save] SQLite error: {e}", flush=True)
    captcha_sessions_memory[session_id] = data

def get_captcha_session(session_id: str) -> Optional[Dict]:
    if redis_client:
        try:
            raw = redis_client.get(f"captcha_session:{session_id}")
            if raw:
                return json.loads(raw)
        except Exception:
            pass
            
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("CREATE TABLE IF NOT EXISTS kv_cache (key TEXT PRIMARY KEY, value TEXT)")
        cursor.execute("SELECT value FROM kv_cache WHERE key = ?", (f"captcha_session:{session_id}",))
        row = cursor.fetchone()
        conn.close()
        if row:
            return json.loads(row["value"])
    except Exception as e:
        pass
        
    return captcha_sessions_memory.get(session_id)


def touch_captcha_session(session: httpx.AsyncClient) -> None:
    session_id = getattr(session, "captcha_session_id", None)
    if not session_id:
        return
    captcha_session = get_captcha_session(session_id)
    if captcha_session:
        dedupe_cookies(session.cookies)
        captcha_session["cookies"] = serialize_cookies(session.cookies)
        captcha_session["created_at"] = time.time()
        save_captcha_session(session_id, captcha_session)

def reconstruct_session(cookies: Dict[str, str]) -> httpx.AsyncClient:
    session = httpx.AsyncClient(verify=not ALLOW_INSECURE, follow_redirects=True)
    session.headers.update({"User-Agent": DEFAULT_USER_AGENT})
    session.cookies = deserialize_cookies(cookies)
    ensure_device_cookie(session)
    return session


def build_headers(base_url: str, extra: Optional[Dict[str, str]] = None) -> Dict[str, str]:
    headers = {
        "User-Agent": DEFAULT_USER_AGENT,
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
        "Connection": "keep-alive",
        "Upgrade-Insecure-Requests": "1",
        "Referer": base_url
    }

    try:
        origin = urljoin(base_url, "/").rstrip("/")
        headers["Origin"] = origin
    except Exception:
        pass

    if extra:
        headers.update(extra)

    return headers


def create_session() -> httpx.AsyncClient:
    session = httpx.AsyncClient(verify=not ALLOW_INSECURE, follow_redirects=True)
    session.headers.update({"User-Agent": DEFAULT_USER_AGENT})
    ensure_device_cookie(session)
    return session


def get_timeout() -> float:
    return max(5.0, DEFAULT_TIMEOUT_MS / 1000.0)


_ocr_client = None

def get_ocr_client():
    global _ocr_client
    if _ocr_client is None:
        try:
            import ddddocr
            _ocr_client = ddddocr.DdddOcr(show_ad=False)
        except ImportError:
            raise AppError("ddddocr package is not installed. Please install it with 'pip install ddddocr' or complete CAPTCHA manually.", 501)
        except Exception as e:
            raise AppError(f"Failed to initialize CAPTCHA solver: {str(e)}. Please complete CAPTCHA manually.", 501)
    return _ocr_client


async def verify_session(session: httpx.AsyncClient) -> bool:
    try:
        test_response = await session.get(
            ATTENDANCE_URL,
            headers=build_headers(ATTENDANCE_URL),
            timeout=get_timeout()
        )
        if "site/login" in str(test_response.url).lower() or "site%2flogin" in str(test_response.url).lower():
            return False
        if looks_like_login_page(test_response.text or ""):
            return False
        return True
    except Exception:
        return False


async def refresh_login_captcha(session: httpx.AsyncClient) -> tuple[str, str]:
    login_response = await session.get(LOGIN_URL, headers=build_headers(LOGIN_URL), follow_redirects=True, timeout=get_timeout())
    dedupe_cookies(session.cookies)
    login_html = login_response.text or ""
    tok = extract_csrf_token(login_html)
    if tok:
        session.latest_csrf_token = tok
    
    captcha_url = extract_captcha_url(login_html, LOGIN_URL)
    if not captcha_url:
        raise AppError("Captcha URL not found on ERP login page.", 502)
        
    captcha_response = await session.get(captcha_url, headers=build_headers(LOGIN_URL), follow_redirects=True, timeout=get_timeout())
    dedupe_cookies(session.cookies)
    image_bytes = captcha_response.content or b""
    if not image_bytes:
        raise AppError("Captcha image was empty.", 502)
        
    try:
        import io
        img = Image.open(io.BytesIO(image_bytes))
        if img.mode != 'RGBA':
            img = img.convert('RGBA')
        bg = Image.new('RGBA', img.size, (255, 255, 255))
        out = Image.alpha_composite(bg, img).convert('RGB')
        
        # Increase contrast to help OCR
        enhancer = ImageEnhance.Contrast(out)
        out = enhancer.enhance(1.5)
        
        buf = io.BytesIO()
        out.save(buf, format='PNG')
        image_bytes = buf.getvalue()
    except Exception as e:
        pass
        
    ocr = get_ocr_client()
    solved_text = ocr.classification(image_bytes)
    
    solved_text = re.sub(r'[^a-zA-Z0-9]', '', solved_text)
    return solved_text, login_html


async def create_captcha_session() -> Dict[str, str]:

    prune_captcha_sessions()

    session = create_session()
    login_response = await request_page(session, LOGIN_URL, headers=build_headers(LOGIN_URL))
    login_html = login_response.text or ""

    captcha_url = extract_captcha_url(login_html, LOGIN_URL)
    if not captcha_url:
        if DEBUG_ENABLED:
            print("[erp:login] Captcha not found. HTML snippet:", login_html[:1000])
        raise AppError("Captcha not found on ERP login page. Site might be offline or blocking requests.", 502)

    captcha_response = await request_page(
        session,
        captcha_url,
        headers=build_headers(LOGIN_URL),
        
    )

    image_bytes = captcha_response.content or b""
    if not image_bytes:
        raise AppError("Captcha image was empty. The ERP might be rate-limiting.", 502)

    image_base64 = base64.b64encode(image_bytes).decode("ascii")
    session_id = str(uuid.uuid4())

    save_captcha_session(session_id, {
        "cookies": serialize_cookies(session.cookies),
        "login_html": login_html,
        "created_at": time.time(),
        "is_logged_in": False,
        "dashboard_html": ""
    })

    return {
        "sessionId": session_id,
        "image": f"data:image/png;base64,{image_base64}",
        "expiresAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime(time.time() + CAPTCHA_SESSION_TTL_MS / 1000))
    }


async def perform_login(payload: Dict[str, str]) -> httpx.AsyncClient:
    session_id = payload.get("captchaSessionId") or ""
    captcha_session = get_captcha_session(session_id)
    if not captcha_session:
        raise AppError("Captcha session expired. Refresh captcha and try again.", 410)

    session = reconstruct_session(captcha_session.get("cookies", {}))
    session.captcha_session_id = session_id

    # Check if already logged in to this session
    if captcha_session.get("is_logged_in", False):
        if await verify_session(session):
            return session
        else:
            if DEBUG_ENABLED:
                print("[erp:login] Saved session expired on ERP server, performing automatic re-login...", flush=True)
            captcha_session["is_logged_in"] = False
            captcha_session["cookies"] = {}
            save_captcha_session(session_id, captcha_session)
            session.cookies.clear()
            ensure_device_cookie(session)

    try:
        max_attempts = 5
        attempt = 0
        login_html = captcha_session.get("login_html", "")
        user_captcha = payload.get("captcha", "")
        
        while attempt < max_attempts:
            attempt += 1
            
            if attempt == 1 and user_captcha:
                captcha_code = user_captcha
            else:
                if DEBUG_ENABLED:
                    print(f"[erp:login] Auto-solving captcha, attempt {attempt}/{max_attempts}...", flush=True)
                try:
                    captcha_code, login_html = await refresh_login_captcha(session)
                    if DEBUG_ENABLED:
                        print(f"[erp:login] Solved captcha: '{captcha_code}'", flush=True)
                except Exception as e:
                    if DEBUG_ENABLED:
                        print(f"[erp:login] Failed to refresh/solve captcha: {e}", flush=True)
                    if attempt == max_attempts:
                        raise AppError(f"Failed to refresh/solve captcha: {str(e)}", 500)
                    continue

            login_form = extract_login_form(login_html, LOGIN_URL)
            temp_payload = {**payload, "captcha": captcha_code}
            login_data = build_login_form_data(login_form, temp_payload)

            if DEBUG_ENABLED:
                erp_id = payload.get("erpId", "") or ""
                masked_id = f"{erp_id[:2]}***{erp_id[-2:]}" if len(erp_id) >= 4 else "***"
                print(f"[erp:login] submit attempt {attempt}", {
                    "action": login_form.get("actionUrl"),
                    "method": login_form.get("method"),
                    "fields": list(login_data.keys()),
                    "erpId": masked_id,
                    "captcha": captcha_code
                }, flush=True)
            
            csrf_token = (login_form.get("hiddenFields") or {}).get("_csrf", "")
            await prepare_login_stakeholder(session, payload.get("erpId", ""), csrf_token)

            login_response = await submit_form(
                session,
                login_form,
                login_data,
                referer=LOGIN_URL
            )

            # Handle Yii2 PJAX X-Redirect
            redirect_url = login_response.headers.get("X-Redirect") or login_response.headers.get("X-Pjax-Url")
            if redirect_url:
                login_response = await request_page(session, urljoin(LOGIN_URL, redirect_url), headers=build_headers(LOGIN_URL))

            res_html = login_response.text or ""

            if DEBUG_ENABLED:
                print(f"[erp:login] response attempt {attempt}", {
                    "status": login_response.status_code,
                    "url": str(login_response.url),
                    "isLoginPage": looks_like_login_page(res_html)
                }, flush=True)

            has_app_redirect = False
            for resp in login_response.history:
                location = (resp.headers.get('Location') or resp.url).lower()
                if location and "site/login" not in location and "site%2flogin" not in location:
                    has_app_redirect = True

            # Allow the standard error detection to handle it so captchas can retry
            if has_app_redirect and looks_like_login_page(res_html) and attempt == max_attempts:
                raise AppError("Invalid credentials. Check username, password and captcha.", 401)
                
            if looks_like_login_failure(str(login_response.url), res_html, login_form):
                # Fallback: try a full form submit without PJAX headers
                if login_form.get("isAjax"):
                    if DEBUG_ENABLED:
                        print("[erp:login] retrying without PJAX headers", flush=True)
                    fallback_form = dict(login_form)
                    fallback_form["isAjax"] = False
                    fallback_form["pjaxContainer"] = ""
                    login_response = await submit_form(
                        session,
                        fallback_form,
                        login_data,
                        referer=LOGIN_URL
                    )
                    redirect_url = login_response.headers.get("X-Redirect") or login_response.headers.get("X-Pjax-Url")
                    if redirect_url:
                        login_response = await request_page(session, urljoin(LOGIN_URL, redirect_url), headers=build_headers(LOGIN_URL))
                    res_html = login_response.text or ""

                if not looks_like_login_failure(str(login_response.url), res_html, login_form):
                    captcha_session["is_logged_in"] = True
                    captcha_session["dashboard_html"] = res_html
                    captcha_session["cookies"] = serialize_cookies(session.cookies)
                    save_captcha_session(session_id, captcha_session)
                    login_csrf = extract_csrf_token(res_html) or get_csrf_from_session(session)
                    if login_csrf:
                        session.latest_csrf_token = login_csrf
                    return session

                # Inspect error type
                error_type = detect_login_error_type(res_html)
                error_msg = extract_login_error_message(res_html) or "Invalid credentials."
                
                if error_type == "credentials":
                    if not user_captcha and attempt < max_attempts:
                        if DEBUG_ENABLED:
                            print(f"[erp:login] Assuming captcha error instead of credentials during auto-sync. Retrying...", flush=True)
                        continue
                    if DEBUG_ENABLED:
                        print(f"[erp:login] Credentials error detected: {error_msg}. Aborting retry.", flush=True)
                        save_debug_html("last_login_failure.html", res_html, str(login_response.url))
                    raise AppError(error_msg, 401)

                if attempt == max_attempts:
                    if DEBUG_ENABLED:
                        print(f"[erp:login] Login failed after max attempts.", flush=True)
                        save_debug_html("last_login_failure.html", res_html, str(login_response.url))
                    raise AppError(error_msg, 401)
                continue

            captcha_session["is_logged_in"] = True
            captcha_session["dashboard_html"] = res_html
            captcha_session["cookies"] = serialize_cookies(session.cookies)
            save_captcha_session(session_id, captcha_session)
            login_csrf = extract_csrf_token(res_html) or get_csrf_from_session(session)
            if login_csrf:
                session.latest_csrf_token = login_csrf
            return session
            
    except AppError as e:
        raise e
    except Exception as e:
        if DEBUG_ENABLED:
            print(f"[erp:login] unexpected error: {e}", flush=True)
        raise AppError(f"Login failed: {str(e)}", 500)


def load_faculty() -> List[Dict[str, object]]:
    if FACULTY_PATH.exists():
        return json.loads(FACULTY_PATH.read_text(encoding="utf8"))
    return []


def check_session_expiry(session: httpx.AsyncClient, requested_url: str, response: httpx.Response) -> None:
    req_low = requested_url.lower()
    is_login_flow = (
        req_low == LOGIN_URL.lower()
        or req_low == LOGIN_URL.lower().rstrip("/")
        or "site/login" in req_low
        or "site%2flogin" in req_low
        or "site/captcha" in req_low
        or "site%2fcaptcha" in req_low
        or "get-stakeholder-id" in req_low
    )
    if not is_login_flow:
        res_url = str(response.url).lower()
        if "site/login" in res_url or "site%2flogin" in res_url or looks_like_login_page(response.text or ""):
            session_id = getattr(session, "captcha_session_id", None)
            if session_id:
                captcha_session = get_captcha_session(session_id)
                if captcha_session:
                    captcha_session["is_logged_in"] = False
                    save_captcha_session(session_id, captcha_session)
            raise AppError("ERP session expired. Please re-authenticate.", 410)
    touch_captcha_session(session)


async def request_page(
    session: httpx.AsyncClient,
    url: str,
    headers: Optional[Dict[str, str]] = None,
    stream: bool = False
) -> httpx.Response:
    try:
        response = await session.get(
            url,
            headers=headers or build_headers(url),
            follow_redirects=True,
            timeout=get_timeout()
        )
        dedupe_cookies(session.cookies)
        if response.is_redirect:
            loc = response.headers.get("Location")
            if loc:
                response = await session.get(
                    urljoin(str(response.url), loc),
                    headers=headers or build_headers(str(response.url)),
                    follow_redirects=True,
                    timeout=get_timeout()
                )
                dedupe_cookies(session.cookies)
        if response.status_code >= 400:
            response.raise_for_status()
        check_session_expiry(session, url, response)
        if response.text:
            tok = extract_csrf_token(response.text)
            if tok:
                session.latest_csrf_token = tok
        return response
    except httpx.RequestError as exc:
        if DEBUG_ENABLED:
            print(f"[erp:request] failed fetching {url}: {exc}", flush=True)
        raise AppError(f"ERP request failed: {exc}", 502) from exc


async def prepare_login_stakeholder(session: httpx.AsyncClient, erp_id: str, csrf_token: str) -> None:
    if not erp_id:
        return
    url = urljoin(LOGIN_URL, "index.php?r=site%2Fget-stakeholder-id")
    data = {"username": erp_id}
    headers_extra = {"X-Requested-With": "XMLHttpRequest"}
    if csrf_token:
        headers_extra["X-CSRF-Token"] = csrf_token
        data["_csrf"] = csrf_token

    try:
        response = await session.post(
            url,
            data=data,
            headers=build_headers(LOGIN_URL, headers_extra),
            follow_redirects=True,
            timeout=get_timeout()
        )
        dedupe_cookies(session.cookies)
        if response.status_code == 200:
            val = response.text.strip()
            if val == "1":
                raise AppError("Your account requires Multi-Factor Authentication (MFA). Please log in via the official KL ERP portal.", 401)
            elif val == "-1":
                raise AppError("Not a Valid User.", 401)
            elif val == "-3":
                raise AppError("Not a Registered MFA User.", 401)
    except AppError:
        raise
    except Exception as exc:
        if DEBUG_ENABLED:
            print(f"[erp:login] stakeholder check skipped/failed: {exc}", flush=True)


async def submit_form(session: httpx.AsyncClient, form: Dict[str, object], data: Dict[str, str], referer: str) -> httpx.Response:
    action_url = form.get("actionUrl") or ""
    url = urljoin(referer or LOGIN_URL, action_url)
    method = str(form.get("method") or "post").lower()
    
    headers_extra = {"Content-Type": "application/x-www-form-urlencoded"}
    if form.get("isAjax"):
        headers_extra["X-Requested-With"] = "XMLHttpRequest"
    pjax_container = form.get("pjaxContainer") or ""
    if pjax_container:
        headers_extra["X-PJAX"] = "true"
        headers_extra["X-PJAX-Container"] = f"#{pjax_container.lstrip('#')}"
    csrf_token = data.get("_csrf") or ""
    if csrf_token:
        headers_extra["X-CSRF-Token"] = csrf_token
        
    headers = build_headers(referer, headers_extra)

    try:
        if method == "get":
            parsed_url = urlparse(url)
            url_params = dict(parse_qsl(parsed_url.query))
            # Merge query parameters from url into data to avoid duplicate query string keys (like 'r')
            merged_data = {**data, **url_params}
            base_url_no_query = parsed_url._replace(query="").geturl()
            from urllib.parse import urlencode
            query_string = urlencode(merged_data, safe="/")
            full_url = f"{base_url_no_query}?{query_string}" if query_string else base_url_no_query
            response = await session.get(
                full_url,
                headers=headers,
                follow_redirects=True,
                timeout=get_timeout()
            )
        else:
            response = await session.post(
                url,
                data=data,
                headers=headers,
                follow_redirects=True,
                timeout=get_timeout()
            )

        dedupe_cookies(session.cookies)
        if response.is_redirect:
            loc = response.headers.get("Location")
            if loc:
                response = await session.get(
                    urljoin(str(response.url), loc),
                    headers=build_headers(str(response.url)),
                    follow_redirects=True,
                    timeout=get_timeout()
                )
                dedupe_cookies(session.cookies)
        if response.status_code >= 400:
            response.raise_for_status()
        check_session_expiry(session, url, response)
        if response.text:
            tok = extract_csrf_token(response.text)
            if tok:
                session.latest_csrf_token = tok
        return response
    except httpx.RequestError as exc:
        if DEBUG_ENABLED:
            print(f"[erp:http] submit_form failed for {url}: {exc}", flush=True)
        raise AppError(f"ERP request failed: {exc}", 502) from exc


def extract_captcha_url(html: str, base_url: str) -> str:
    soup = BeautifulSoup(html, "html.parser")
    images = soup.find_all("img")

    # 1. Look for explicit captcha keywords
    for image in images:
        src = image.get("src") or image.get("data-src") or image.get("data-original")
        if not src:
            continue
        hint = " ".join([
            str(image.get("id") or ""),
            " ".join(image.get("class") or []),
            str(image.get("alt") or ""),
            src
        ]).lower()
        if "captcha" in hint:
            return urljoin(base_url, src)

    # 2. Fallback: Find the last image inside the login form (Usually the captcha)
    for form in soup.find_all("form"):
        form_images = form.find_all("img")
        if form_images:
            for form_image in reversed(form_images):
                src = form_image.get("src")
                if src and "logo" not in src.lower():
                    return urljoin(base_url, src)

    return ""


def extract_login_form(html: str, base_url: str) -> Dict[str, object]:
    soup = BeautifulSoup(html, "html.parser")
    forms = soup.find_all("form")

    candidate = None
    for form in forms:
        if has_login_fields(form):
            candidate = form
            break

    form = candidate or (forms[0] if forms else None)
    if not form:
        return {
            "actionUrl": base_url,
            "method": "post",
            "usernameField": "username",
            "passwordField": "password",
            "captchaField": "captcha",
            "hiddenFields": {}
        }

    action = form.get("action") or base_url
    method = (form.get("method") or "post").lower()
    is_ajax = bool(form.has_attr("data-pjax") or form.has_attr("data-ajax"))
    pjax_container = find_pjax_container_id(soup, form) if is_ajax else ""

    username_field = find_input_name_by_id(form, LOGIN_FIELD_IDS["erp_id"]) or find_input_name_by_pattern(form, r"user|login|erp") or "username"
    password_field = find_input_name_by_id(form, LOGIN_FIELD_IDS["password"]) or find_input_name_by_pattern(form, r"pass") or "password"
    captcha_field = find_input_name_by_id(form, LOGIN_FIELD_IDS["captcha"]) or find_input_name_by_pattern(form, r"captcha") or "captcha"
    hidden_fields = extract_hidden_inputs(form)
    extra_fields = extract_extra_inputs(form, {
        username_field,
        password_field,
        captcha_field
    })

    if DEBUG_ENABLED:
        print("[erp:http] login form", {
            "action": action,
            "method": method,
            "usernameField": username_field,
            "passwordField": password_field,
            "captchaField": captcha_field,
            "hiddenFields": list(hidden_fields.keys()),
            "extraFields": list(extra_fields.keys()),
            "isAjax": is_ajax,
            "pjaxContainer": pjax_container
        }, flush=True)

    return {
        "actionUrl": urljoin(base_url, action),
        "method": method,
        "usernameField": username_field,
        "passwordField": password_field,
        "captchaField": captcha_field,
        "hiddenFields": hidden_fields,
        "extraFields": extra_fields,
        "isAjax": is_ajax,
        "pjaxContainer": pjax_container
    }


def build_login_form_data(form: Dict[str, object], payload: Dict[str, str]) -> Dict[str, str]:
    data = {}
    data.update(form.get("hiddenFields", {}))
    data.update(form.get("extraFields", {}))
    data[form.get("usernameField")] = payload.get("erpId", "")
    data[form.get("passwordField")] = payload.get("password", "")
    data[form.get("captchaField")] = (payload.get("captcha", "") or "").strip()
    return data


def looks_like_login_page(html: str) -> bool:
    if not html:
        return True
    soup = BeautifulSoup(html, "html.parser")
    if soup.select_one(".site-login") or soup.select_one("#login-form"):
        return True
    for form in soup.find_all("form"):
        if has_login_fields(form):
            return True
    if soup.find("input", {"type": "password"}):
        text = clean_text(soup.get_text(" ")).lower()
        if "login" in text or "sign in" in text:
            return True
    return False


def looks_like_login_failure(url: str, html: str, form: Dict[str, object]) -> bool:
    url_low = url.lower()
    if "site/login" in url_low or "site%2flogin" in url_low:
        return True

    if not html:
        return True

    lowered = html.lower()
    if "captcha" in lowered and "invalid" in lowered:
        return True
    if "login" in lowered and "failed" in lowered:
        return True

    if looks_like_login_page(html):
        return True

    return False


def detect_login_error_type(html: str) -> str:
    """
    Detect specific login error type: 'captcha', 'credentials', or 'unknown'
    Conservative approach: default to 'credentials' unless very strong evidence of captcha error
    """
    if not html:
        return "unknown"
    
    lowered = html.lower()
    
    # Strong evidence of captcha error: look for "verification code" or "captcha" with "incorrect"/"invalid"
    captcha_keywords = ["verification", "captcha", "security code", "verification code", "code"]
    error_keywords = ["incorrect", "invalid", "wrong", "mismatch", "expired"]
    
    has_captcha_kw = any(kw in lowered for kw in captcha_keywords)
    has_error_kw = any(kw in lowered for kw in error_keywords)
    
    if has_captcha_kw and has_error_kw:
        return "captcha"
        
    if re.search(r"verification code.*?(?:incorrect|invalid)", lowered, re.IGNORECASE):
        return "captcha"
    if re.search(r"captcha.*?incorrect.*?code", lowered, re.IGNORECASE):
        return "captcha"
    if "incorrect verification code" in lowered:
        return "captcha"
    if "invalid verification code" in lowered:
        return "captcha"
    
    # If no clear captcha error, default to credentials (most likely cause)
    # Only return unknown if HTML structure seems completely unexpected
    if looks_like_login_page(html):
        return "credentials"
    
    return "unknown"


def extract_login_error_message(html: str) -> str:
    soup = BeautifulSoup(html, "html.parser")
    selectors = [
        ".help-block",
        ".invalid-feedback",
        ".alert",
        ".alert-danger",
        ".error",
        ".error-message",
        ".error-msg",
        "[role='alert']",
        ".error-summary",
        ".text-danger"
    ]

    messages: List[str] = []
    ignored_texts = {"*", "login username", "username", "password", "captcha", "login"}
    for selector in selectors:
        for element in soup.select(selector):
            text = clean_text(element.get_text(" "))
            if text and len(text) > 1 and text.lower() not in ignored_texts:
                messages.append(text)

    if messages:
        return " ".join(list(dict.fromkeys(messages)))[:240]

    for script in soup(["script", "style"]):
        script.extract()

    body_text = clean_text(soup.get_text(" "))
    candidates = [
        line for line in body_text.split(" ")
        if re.search(r"captcha|password|invalid|incorrect|failed|login|credential|user", line, re.IGNORECASE)
    ]
    return " ".join(candidates[:2])[:240]


def contains_login_fields(html: str, form: Dict[str, object]) -> bool:
    fields = [form.get("usernameField"), form.get("passwordField"), form.get("captchaField")]
    for field in fields:
        if not field:
            continue
        if has_input_field(html, str(field)):
            return True
    return False


def has_input_field(html: str, name_or_id: str) -> bool:
    soup = BeautifulSoup(html, "html.parser")
    return soup.find("input", {"name": name_or_id}) is not None or soup.find("input", {"id": name_or_id}) is not None


def has_login_fields(form) -> bool:
    if find_input_name_by_id(form, LOGIN_FIELD_IDS["erp_id"]):
        return True
    return bool(find_input_name_by_pattern(form, r"user|login|erp"))


def extract_hidden_inputs(form) -> Dict[str, str]:
    hidden_fields: Dict[str, str] = {}
    for input_tag in form.find_all("input"):
        name = input_tag.get("name")
        if not name:
            continue
            
        input_type = (input_tag.get("type") or "").lower()
        # Exclude user-typable fields, grab all hidden state and submit buttons
        if input_type in ("text", "password", "file", "email", "search", "tel"):
            continue
            
        if input_type in ("checkbox", "radio") and not input_tag.has_attr("checked"):
            continue
            
        hidden_fields[name] = input_tag.get("value") or ""
        
    # Also look for modern <button type="submit"> tags
    for btn in form.find_all("button"):
        if (btn.get("type") or "").lower() == "submit" and btn.get("name"):
            hidden_fields[btn.get("name")] = btn.get("value") or btn.text.strip()
            
    return hidden_fields


def find_pjax_container_id(soup: BeautifulSoup, form) -> str:
    if form is None:
        return ""
    parent = form.find_parent(attrs={"data-pjax-container": True})
    if parent and parent.get("id"):
        return parent.get("id")
    container = soup.find(attrs={"data-pjax-container": True}) if soup else None
    if container and container.get("id"):
        return container.get("id")
    return ""


def extract_extra_inputs(form, exclude: set) -> Dict[str, str]:
    extras: Dict[str, str] = {}
    for input_tag in form.find_all(["input", "button"]):
        name = input_tag.get("name")
        if not name or name in exclude:
            continue

        input_type = (input_tag.get("type") or "").lower()
        if input_tag.name == "input" and input_type in ("button", "image"):
            continue

        if input_type in ("checkbox", "radio") and not input_tag.has_attr("checked"):
            continue

        if input_tag.name == "button":
            extras[name] = input_tag.get("value") or input_tag.text.strip() or ""
        else:
            extras[name] = input_tag.get("value") or ""

    return extras


def find_input_name_by_id(form, input_id: Optional[str]) -> str:
    if not input_id:
        return ""

    input_tag = form.find("input", {"id": input_id})
    if not input_tag:
        input_tag = form.find("input", {"name": input_id})

    if not input_tag:
        return ""

    return input_tag.get("name") or input_tag.get("id") or ""


def find_input_name_by_pattern(form, pattern: str) -> str:
    regex = re.compile(pattern, re.IGNORECASE)
    for input_tag in form.find_all("input"):
        name = input_tag.get("name") or ""
        input_id = input_tag.get("id") or ""
        combined = f"{name} {input_id}".strip()
        if regex.search(combined):
            return name or input_id
    return ""


def find_attendance_link(html: str, base_url: str) -> str:
    soup = BeautifulSoup(html, "html.parser")
    links = soup.find_all("a", href=True)
    
    # 1. Prefer links that contain both "attendance" and "daily"
    for a in links:
        text = a.get_text(strip=True).lower()
        href = a["href"].lower()
        if "javascript:" in href:
            continue
        if "attendance" in text or "attendance" in href:
            if "daily" in text or "daily" in href:
                return urljoin(base_url, a["href"])
                
    # 2. Fallback to any attendance link
    for a in links:
        text = a.get_text(strip=True).lower()
        href = a["href"].lower()
        if "javascript:" in href:
            continue
        if "attendance" in text or "attendance" in href:
            return urljoin(base_url, a["href"])
            
    return ""


def extract_attendance_form(html: str, base_url: str) -> Dict[str, object]:
    soup = BeautifulSoup(html, "html.parser")
    forms = soup.find_all("form")
    academic_select = find_select_name(soup, ACADEMIC_KEYWORDS)
    semester_select = find_select_name(soup, SEMESTER_KEYWORDS)

    selected_form = None
    for form in forms:
        if academic_select and has_select(form, academic_select):
            selected_form = form
            break
        if semester_select and has_select(form, semester_select):
            selected_form = form
            break

    form = selected_form or (forms[0] if forms else None)
    if not form:
        return {
            "html": "",
            "actionUrl": base_url,
            "method": "post",
            "academicSelect": academic_select,
            "semesterSelect": semester_select
        }

    action = form.get("action") or base_url
    method = (form.get("method") or "post").lower()

    # KLERP specific: Check form attributes for AJAX search URL first
    ajax_url = form.get("data-ajax-search-url") or ""

    # Look for AJAX URL in scripts that might intercept this form if not found in attributes
    if not ajax_url:
        scripts = soup.find_all("script")
        form_id = form.get("id", "")
        for script in scripts:
            script_text = script.string or ""
            if form_id and form_id in script_text and ".ajax" in script_text:
                # Try to find the URL in the AJAX call
                match = re.search(r"url\s*:\s*['\"]([^'\"]+)['\"]", script_text)
                if match:
                    ajax_url = match.group(1)
                    if DEBUG_ENABLED:
                        print(f"[erp:scraper] Detected AJAX interception for form {form_id}, URL: {ajax_url}")
                    break

    return {
        "html": str(form),
        "actionUrl": urljoin(base_url, ajax_url or action),
        "method": method,
        "academicSelect": academic_select,
        "semesterSelect": semester_select,
        "isAjax": bool(ajax_url)
    }


def build_attendance_form_data(form: Dict[str, object], payload: Dict[str, str]) -> Dict[str, str]:
    html = form.get("html") or ""
    soup = BeautifulSoup(html, "html.parser")

    data = extract_hidden_inputs(soup) if soup else {}

    academic_select = form.get("academicSelect")
    if academic_select:
        select_tag = soup.find("select", {"name": academic_select}) or soup.find("select", {"id": academic_select})
        data[academic_select] = find_option_value(select_tag, payload.get("academicYear", "")) or payload.get("academicYear", "")

    semester_select = form.get("semesterSelect")
    if semester_select:
        select_tag = soup.find("select", {"name": semester_select}) or soup.find("select", {"id": semester_select})
        data[semester_select] = find_option_value(select_tag, payload.get("semesterId", "")) or payload.get("semesterId", "")

    # Do not inject button parameters into courselist / DynamicModel submissions
    action_url = str(form.get("actionUrl", "")).lower()
    is_courselist = "courselist" in action_url or any("dynamicmodel" in k.lower() for k in data.keys())
    if not is_courselist and not form.get("isAjax"):
        if not any(k in data for k in ["yt0", "yt1", "Search", "search"]):
            data["yt0"] = "Search"
            data["search"] = "1"

    return data


def find_select_name(soup, keywords: List[str]) -> str:
    selects = soup.find_all("select")
    if not selects:
        return ""
    # Try high-priority keywords first (prioritize exact/specific tokens over generic ones)
    for kw in keywords:
        kw_low = kw.lower()
        for select_tag in selects:
            name = (select_tag.get("name") or select_tag.get("id") or "").lower()
            if kw_low in name:
                # Avoid confusing study_year or birth_year with academic_year
                if kw_low == "year" and any(bad in name for bad in ["study", "dob", "birth"]):
                    continue
                return select_tag.get("name") or select_tag.get("id") or ""
    return ""


def has_select(form, select_name: str) -> bool:
    return form.find("select", {"name": select_name}) is not None or form.find("select", {"id": select_name}) is not None


def find_option_value(select_tag, label: str) -> str:
    if not select_tag:
        return ""

    target = label.strip().lower() if label else ""
    valid_options = []
    
    for option in select_tag.find_all("option"):
        value = (option.get("value") or "").strip()
        text = clean_text(option.get_text(" "))
        
        if not value or "select" in text.lower() or value == "0":
            continue
            
        valid_options.append(value)
        text_lower = text.lower()
        val_lower = value.lower()
        
        # Exact match
        if target and (text_lower == target or val_lower == target):
            return value
            
        # Semester specific matching (Even/Odd/Summer/Term 3)
        is_even_target = "even" in target or target in ["2", "sem 2", "sem-2", "semester 2", "semester-2", "ii", "sem ii"]
        is_odd_target = "odd" in target or target in ["1", "sem 1", "sem-1", "semester 1", "semester-1", "i", "sem i"]
        is_summer_target = any(term in target for term in ["summer", "term 3", "term-3", "term3", "3"])
        
        if is_even_target:
            if "even" in text_lower or val_lower in ["2", "even"] or any(p in text_lower for p in ["sem 2", "sem-2", "semester 2", "semester-2", "sem ii", "sem-ii", "semester ii", "semester-ii"]):
                return value
        if is_odd_target:
            if "odd" in text_lower or val_lower in ["1", "odd"] or any(p in text_lower for p in ["sem 1", "sem-1", "semester 1", "semester-1", "sem i", "sem-i", "semester i", "semester-i"]):
                return value
        if is_summer_target:
            if "summer" in text_lower or val_lower in ["3", "summer"] or any(p in text_lower for p in ["term 3", "term-3", "term3", "summer term"]):
                return value
            
        # Smart partial match for years (e.g. "2025-2026" matches "2025-26")
        if target and len(target) >= 4:
            target_nums = re.findall(r"\d+", target)
            text_nums = re.findall(r"\d+", text_lower)
            if target_nums and text_nums and target_nums[0] == text_nums[0]:
                return value
            if target in text_lower or text_lower in target:
                return value

    # Smart Fallback: Automatically select the latest available option if no match found
    if valid_options:
        if DEBUG_ENABLED:
            print(f"[erp:scraper] No exact match for '{label}', falling back to latest option: {valid_options[-1]}")
        return valid_options[-1]
        
    return ""


def extract_attendance_table(html: str) -> str:
    soup = BeautifulSoup(html, "html.parser")
    tables = soup.find_all("table")
    for table in tables:
        parsed = parse_attendance_table(str(table))
        if parsed:
            return str(table)
    return str(tables[0]) if tables else ""


def parse_attendance_tables(html: str) -> List[Dict[str, object]]:
    soup = BeautifulSoup(html, "html.parser")
    
    # 1. Prioritize standard student daily attendance container table
    container_table = soup.select_one(".student-daily-attendance-index table")
    if container_table:
        parsed = parse_attendance_table(str(container_table))
        if parsed:
            return parsed

    rows: List[Dict[str, object]] = []
    for table in soup.find_all("table"):
        rows.extend(parse_attendance_table(str(table)))
    return rows


def parse_attendance_table(table_html: str) -> List[Dict[str, object]]:
    soup = BeautifulSoup(table_html, "html.parser")
    rows = soup.find_all("tr")
    if len(rows) < 2:
        return []

    header_cells = rows[0].find_all(["th", "td"])
    headers = [clean_text(cell.get_text(" ")).lower() for cell in header_cells]

    # Check if this is the consolidated table format
    is_consolidated = any("actual conducted" in h or "l actual" in h for h in headers)

    if is_consolidated:
        code_index = find_index(headers, ["coursecode", "code"])
        subject_index = find_index(headers, ["coursename", "course name", "coursedesc", "subject", "course", "name", "title"])
        percentage_index = find_index(headers, ["attendance percentage", "percentage", "%", "percent"])

        # Find component indices
        comp_indices = {}
        for comp in ["l", "t", "p", "s"]:
            comp_upper = comp.upper()
            cond_idx = -1
            for idx, h in enumerate(headers):
                tokens = re.sub(r"[^a-z0-9]+", " ", h).split()
                if tokens and tokens[0] == comp and ("conducted" in h or "held" in h):
                    cond_idx = idx
                    break
            att_idx = -1
            for idx, h in enumerate(headers):
                tokens = re.sub(r"[^a-z0-9]+", " ", h).split()
                if tokens and tokens[0] == comp and ("attended" in h or "present" in h):
                    att_idx = idx
                    break
            if cond_idx != -1 and att_idx != -1:
                comp_indices[comp_upper] = (cond_idx, att_idx)

        results: List[Dict[str, object]] = []
        for row in rows[1:]:
            cells = row.find_all(["td", "th"])
            if not cells:
                continue
            values = [clean_text(cell.get_text(" ")) for cell in cells]

            code_val = values[code_index].strip().upper() if code_index >= 0 and code_index < len(values) else ""
            subject_val = values[subject_index].strip() if subject_index >= 0 and subject_index < len(values) else values[0]
            pct_val = values[percentage_index].replace("%", "").strip() if percentage_index >= 0 and percentage_index < len(values) else ""
            pct = to_number(pct_val) if pct_val else None

            if not subject_val or "total" in subject_val.lower():
                continue

            if not code_val:
                code_val = re.sub(r'[^A-Z0-9]', '', subject_val.upper())[:8]

            if len(code_val) < 1:
                continue

            has_any_component = False
            for comp, (cond_idx, att_idx) in comp_indices.items():
                cond_val = values[cond_idx] if cond_idx < len(values) else ""
                att_val = values[att_idx] if att_idx < len(values) else ""

                conducted = to_number(cond_val)
                attended = to_number(att_val)

                if conducted is not None and conducted > 0:
                    has_any_component = True
                    comp_pct = round((attended / conducted) * 100, 2) if conducted > 0 else 0
                    results.append({
                        "subject": subject_val,
                        "courseCode": code_val,
                        "ltps": comp,
                        "conducted": int(conducted),
                        "attended": int(attended) if attended is not None else 0,
                        "percentage": comp_pct,
                        "finalPercentage": None
                    })

            if pct is not None:
                results.append({
                    "subject": subject_val,
                    "courseCode": code_val,
                    "ltps": "",
                    "conducted": None,
                    "attended": None,
                    "percentage": pct,
                    "finalPercentage": pct
                })

        return results

    else:
        # Standard ERP GridView / Table format parser
        thead_ths = soup.select("thead tr th")
        if thead_ths:
            headers = [clean_text(cell.get_text(" ")).lower() for cell in thead_ths]
            data_rows = soup.select("tbody tr") or rows[1:]
        else:
            header_cells = rows[0].find_all(["th", "td"])
            headers = [clean_text(cell.get_text(" ")).lower() for cell in header_cells]
            data_rows = rows[1:]

        code_index = find_index(headers, ["coursecode", "code", "course code"])
        subject_index = find_index(headers, ["coursedesc", "subject", "course name", "course description", "course", "name", "title"])
        ltps_index = find_index(headers, ["ltps", "type", "component"])
        section_index = find_index(headers, ["section", "sec"])
        conducted_index = find_index(headers, ["total conducted", "conducted", "held", "classes conducted"])
        attended_index = find_index(headers, ["total attended", "attended", "present", "classes attended"])
        absent_index = find_index(headers, ["total absent", "absent", "absences"])
        percentage_index = find_index(headers, ["percentage", "%", "percent", "attendance percentage"])

        results: List[Dict[str, object]] = []
        for row in data_rows:
            if row.get("class") and "filters" in row.get("class"):
                continue
            cells = row.find_all(["td", "th"], recursive=False) or row.find_all(["td", "th"])
            if not cells:
                continue
            values = [clean_text(cell.get_text(" ")) for cell in cells]
            row_text = " ".join(values).lower()
            if "no records found" in row_text or "no data" in row_text:
                continue

            code_val = values[code_index].strip().upper() if 0 <= code_index < len(values) else ""
            subject_val = values[subject_index].strip() if 0 <= subject_index < len(values) else values[0]
            ltps_val = values[ltps_index].strip().upper() if 0 <= ltps_index < len(values) else ""
            section_val = values[section_index].strip() if 0 <= section_index < len(values) else ""
            conducted = to_number(values[conducted_index]) if 0 <= conducted_index < len(values) else None
            attended = to_number(values[attended_index]) if 0 <= attended_index < len(values) else None
            absent = to_number(values[absent_index]) if 0 <= absent_index < len(values) else None
            pct = to_number(values[percentage_index].replace("%", "")) if 0 <= percentage_index < len(values) else None

            if not subject_val or "total" in subject_val.lower():
                continue

            if not code_val:
                code_val = re.sub(r'[^A-Z0-9]', '', subject_val.upper())[:8]

            if len(code_val) < 1:
                continue

            if conducted is not None and attended is not None and absent is None and conducted >= attended:
                absent = conducted - attended
            if conducted and conducted > 0 and pct is None and attended is not None:
                pct = round((attended / conducted) * 100, 2)

            results.append({
                "subject": subject_val,
                "courseCode": code_val,
                "ltps": ltps_val,
                "section": section_val,
                "conducted": int(conducted) if conducted is not None else None,
                "attended": int(attended) if attended is not None else None,
                "absent": int(absent) if absent is not None else None,
                "percentage": pct if pct is not None else 0,
                "finalPercentage": pct if not ltps_val else None
            })

        return results


async def sync_attendance(payload: Dict[str, str], session: Optional[httpx.AsyncClient] = None) -> List[Dict[str, object]]:
    start_time = time.time()
    session = session or await perform_login(payload)
    ensure_device_cookie(session)

    session_id = payload.get("captchaSessionId") or getattr(session, "captcha_session_id", "") or ""
    captcha_session = get_captcha_session(session_id)
    dashboard_html = captcha_session.get("dashboard_html", "") if captcha_session else ""
    csrf_token = getattr(session, "latest_csrf_token", "") or extract_csrf_token(dashboard_html) or get_csrf_from_session(session)

    acad_year = str(payload.get("academicYear") or "").strip()
    sem_id = str(payload.get("semesterId") or "").strip()

    # Fast Path: If resolved option IDs are cached or provided as digits, POST directly to courselist
    cached_ids = get_cached_term_ids(acad_year, sem_id) if (acad_year and sem_id) else get_cached_term_ids()
    acad_val = (acad_year if acad_year.isdigit() else (cached_ids.get("acad_id") if cached_ids else None))
    sem_val = (sem_id if sem_id.isdigit() else (cached_ids.get("sem_id") if cached_ids else None))

    if not (acad_val and sem_val):
        latest = get_cached_term_ids()
        if latest:
            acad_val = acad_val or latest.get("acad_id")
            sem_val = sem_val or latest.get("sem_id")

    if acad_val and sem_val and csrf_token:
        try:
            post_data = {
                "_csrf": csrf_token,
                "DynamicModel[academicyear]": acad_val,
                "DynamicModel[semesterid]": sem_val
            }
            headers = build_headers(ATTENDANCE_URL, {
                "Content-Type": "application/x-www-form-urlencoded",
                "X-Requested-With": "XMLHttpRequest",
                "X-CSRF-Token": csrf_token
            })
            resp = await session.post(ATTENDANCE_COURSELIST_URL, data=post_data, headers=headers, timeout=get_timeout())
            if resp.status_code == 200 and not looks_like_login_page(resp.text or ""):
                parsed = parse_attendance_tables(resp.text or "")
                if parsed:
                    merged = merge_attendance_rows(parsed)
                    duration = time.time() - start_time
                    print(f"[erp:attendance] Fast path courselist succeeded: {len(merged)} records in {duration:.3f}s", flush=True)
                    return merged
        except Exception as exc:
            if DEBUG_ENABLED:
                print(f"[erp:attendance] Fast path courselist failed, falling back to form resolution: {exc}", flush=True)

    # Standard Resolution Path: GET searchgetinput to resolve dynamic model IDs and CSRF
    attendance_url = find_attendance_link(dashboard_html, LOGIN_URL) if dashboard_html else ""
    attendance_url = attendance_url or ATTENDANCE_URL

    attendance_response = await request_page(session, attendance_url, headers=build_headers(attendance_url))
    attendance_html = attendance_response.text or ""

    parsed = parse_attendance_tables(attendance_html)
    if parsed:
        return merge_attendance_rows(parsed)

    csrf_token = getattr(session, "latest_csrf_token", "") or extract_csrf_token(attendance_html) or csrf_token

    attendance_form = extract_attendance_form(attendance_html, attendance_url)
    attendance_data = build_attendance_form_data(attendance_form, payload)

    resolved_acad = attendance_data.get("DynamicModel[academicyear]") or attendance_data.get(str(attendance_form.get("academicSelect", "")))
    resolved_sem = attendance_data.get("DynamicModel[semesterid]") or attendance_data.get(str(attendance_form.get("semesterSelect", "")))

    # If semester dropdown is dynamic, resolve via AJAX
    if not resolved_sem and resolved_acad:
        try:
            soup = BeautifulSoup(attendance_html, "html.parser")
            form_tag = soup.find("form")
            dep_options = await resolve_dependent_options(
                session, soup, form_tag, attendance_form.get("academicSelect", ""), resolved_acad, attendance_url
            )
            if dep_options:
                target_key = sem_id.lower() if sem_id else ""
                sem_val = dep_options.get(target_key) or list(dep_options.values())[0]
                attendance_data[attendance_form.get("semesterSelect", "DynamicModel[semesterid]")] = sem_val
                resolved_sem = sem_val
        except Exception as exc:
            if DEBUG_ENABLED:
                print(f"[erp:attendance] Dependent semester resolution failed: {exc}", flush=True)

    # Cache resolved term IDs for fast path on subsequent syncs
    if resolved_acad and resolved_sem:
        cache_term_ids(acad_year, sem_id, resolved_acad, resolved_sem)

    if not attendance_form.get("actionUrl") or "searchgetinput" in attendance_form.get("actionUrl", ""):
        attendance_form["actionUrl"] = ATTENDANCE_COURSELIST_URL

    attendance_form["isAjax"] = True
    if csrf_token:
        attendance_data["_csrf"] = csrf_token

    result_response = await submit_form(session, attendance_form, attendance_data, referer=attendance_url)
    result_html = result_response.text or ""

    if DEBUG_ENABLED:
        try:
            debug_path = Path(__file__).resolve().parent / "last_failure.html"
            debug_path.write_text(result_html, encoding="utf8")
        except Exception:
            pass

    rows = parse_attendance_tables(result_html)
    if not rows:
        lowered = result_html.lower()
        if any(phrase in lowered for phrase in ["no records found", "no data", "no results", "empty", "no attendance"]):
            return []
        with open("debug_502.html", "w", encoding="utf-8") as f:
            f.write(result_html)
        raise AppError("Could not find attendance table in ERP response.", 502)

    merged = merge_attendance_rows(rows)
    duration = time.time() - start_time
    print(f"[erp:attendance] Fetch success: {len(merged)} records in {duration:.3f}s", flush=True)
    return merged


def merge_attendance_rows(rows: List[Dict[str, object]]) -> List[Dict[str, object]]:
    seen = {}
    for row in rows:
        code = row.get("courseCode") or row.get("subject", "")
        ltps = (row.get("ltps") or "").upper()
        if code not in seen:
            seen[code] = {
                "subject": row["subject"],
                "courseCode": code,
                "section": row.get("section", "")
            }
        elif row.get("section") and not seen[code].get("section"):
            seen[code]["section"] = row["section"]

        if ltps in ("L", "T", "P", "S"):
            seen[code][ltps] = row.get("percentage", 0)
            seen[code][f"{ltps}_conducted"] = row.get("conducted")
            seen[code][f"{ltps}_attended"] = row.get("attended")
            if row.get("absent") is not None:
                seen[code][f"{ltps}_absent"] = row.get("absent")
        elif row.get("percentage") is not None:
            seen[code]["finalPercentage"] = row.get("percentage", 0)
            seen[code]["conducted"] = row.get("conducted")
            seen[code]["attended"] = row.get("attended")
            if row.get("absent") is not None:
                seen[code]["absent"] = row.get("absent")
    return list(seen.values())


async def sync_timetable(payload: Dict[str, str], session: Optional[httpx.AsyncClient] = None) -> Dict[str, object]:
    start_time = time.time()
    session = session or await perform_login(payload)
    ensure_device_cookie(session)
    
    session_id = payload.get("captchaSessionId") or getattr(session, "captcha_session_id", "") or ""
    captcha_session = get_captcha_session(session_id)
    dashboard_html = captcha_session.get("dashboard_html", "") if captcha_session else ""

    timetable_link = find_timetable_link(dashboard_html, LOGIN_URL) if dashboard_html else ""

    menu_url = await find_menu_link_by_keywords(session, [
        "timetable", "time table", "student timetable", "academic timetable",
        "my timetable", "master timetable", "class timetable", "class schedule", "schedule"
    ])
    
    candidate_paths = [
        "index.php?r=timetables/universitymasteracademictimetableview/indexstudentindisearch",
        "index.php?r=timetables/universitymasteracademictimetableview/indexstudent",
        "index.php?r=timetables/universitymasteracademictimetableview/indexsearch",
        "index.php?r=timetables/universitymasteracademictimetableview/index",
        "index.php?r=timetables/universitymasteracademictimetableview/search",
        "index.php?r=timetables/studenttimetable/index",
        "index.php?r=timetables/studenttimetable/search",
        "index.php?r=timetables/studenttimetable/indexstudent",
        "index.php?r=studentinfo/studenttimetable/index",
        "index.php?r=studentinfo/studenttimetable/searchgetinput",
    ]
    candidate_urls = [TIMETABLE_URL]
    if menu_url and menu_url not in candidate_urls:
        candidate_urls.append(menu_url)
    if timetable_link and timetable_link not in candidate_urls:
        candidate_urls.append(timetable_link)
    for path in candidate_paths:
        full_u = urljoin(LOGIN_URL, path)
        if full_u not in candidate_urls:
            candidate_urls.append(full_u)

    csrf_token = extract_csrf_token(dashboard_html) or get_csrf_from_session(session)

    seen_urls = set()
    last_html = ""
    last_url = ""
    for url in candidate_urls:
        if url in seen_urls:
            continue
        seen_urls.add(url)

        try:
            timetable, html = await fetch_timetable_from_url(session, url, payload, csrf_token)
            last_html = html
            last_url = url
            if timetable["grid"]:
                duration = time.time() - start_time
                grid_count = len(timetable["grid"])
                mapping_count = len(timetable.get("mappings", []))
                refreshed_at = f"{datetime.utcnow().isoformat()}Z"
                print(f"[erp:timetable] Source: LIVE | Refreshed at: {refreshed_at} | Fetch success: {grid_count} rows, {mapping_count} mappings in {duration:.3f}s from {url}", flush=True)
                return {
                    **timetable,
                    "academicYear": payload.get("academicYear"),
                    "semesterId": payload.get("semesterId"),
                    "status": "ok",
                    "source": "live",
                    "cached": False,
                    "refreshedAt": refreshed_at,
                    "sourceUrl": url,
                    "count": grid_count,
                    "mappingsCount": mapping_count,
                    "duration_seconds": round(duration, 3)
                }
        except Exception as exc:
            if DEBUG_ENABLED:
                print(f"[erp:timetable] failed for {url}: {exc}")
            continue

    if DEBUG_ENABLED and last_html:
        try:
            debug_path = Path(__file__).resolve().parent / "last_timetable_failure.html"
            debug_path.write_text(f"<!-- URL: {last_url} -->\n{last_html}", encoding="utf8")
            print(f"[erp:timetable] Timetable table missing. Saved response to {debug_path}")
        except Exception:
            pass

    duration = time.time() - start_time
    refreshed_at = f"{datetime.utcnow().isoformat()}Z"
    print(f"[erp:timetable] Source: LIVE | Fetch completed: empty timetable (0 rows) in {duration:.3f}s", flush=True)
    return {
        "grid": [],
        "mappings": [],
        "academicYear": payload.get("academicYear"),
        "semesterId": payload.get("semesterId"),
        "status": "empty",
        "source": "live",
        "cached": False,
        "refreshedAt": refreshed_at,
        "message": "ERP did not return timetable data for the selected academic year and semester.",
        "count": 0,
        "mappingsCount": 0,
        "duration_seconds": round(duration, 3)
    }


async def sync_marks(payload: Dict[str, str], session: Optional[httpx.AsyncClient] = None) -> List[Dict[str, object]]:
    session = session or await perform_login(payload)
    ensure_device_cookie(session)
    captcha_session = get_captcha_session(payload.get("captchaSessionId") or getattr(session, "captcha_session_id", "") or "")
    dashboard_html = captcha_session.get("dashboard_html", "") if captcha_session else ""
    
    # First, try to find the Course Internals link from the menu
    menu_url = await find_menu_link_by_keywords(session, ["course internals", "internals", "internal marks", "my internals"])
    if DEBUG_ENABLED:
        print(f"[erp:marks] Menu URL found: {menu_url}", flush=True)
    
    # Build candidate URLs - prioritize the working ones
    candidate_urls = []
    
    # 1. Start with menu URL if found
    if menu_url:
        candidate_urls.append(menu_url)
    
    # 2. Add working URL from user's navigation (Courses → Internals)
    candidate_urls.append(urljoin(LOGIN_URL, "index.php?r=studentinfo/studentendexamresult/getstudentinternalmarks"))
    
    # 3. Add other candidate paths
    for path in MARKS_CANDIDATE_PATHS:
        if "getstudentinternalmarks" not in path:
            candidate_urls.append(urljoin(LOGIN_URL, path))
    
    csrf_token = extract_csrf_token(dashboard_html) or get_csrf_from_session(session)
    last_html = ""
    last_url = ""
    all_marks = []

    for url in candidate_urls:
        try:
            html = await fetch_html_with_term_form(session, url, payload, csrf_token=csrf_token, xhr=True)
            last_html = html
            last_url = url

            marks = await parse_course_internals_page(html, payload, session)
            if marks:
                return marks
                
            marks = parse_component_rows(html, payload)
            if marks:
                return marks

            marks = parse_marks_tables(html, payload)
            if marks:
                return marks
        except Exception as exc:
            if DEBUG_ENABLED:
                print(f"[erp:marks] failed for {url}: {exc}")
            continue

    if DEBUG_ENABLED and last_html:
        debug_path = Path(__file__).resolve().parent / "last_marks_failure.html"
        debug_path.write_text(f"<!-- URL: {last_url} -->\n{last_html}", encoding="utf8")

    return []


async def sync_seating_plan(payload: Dict[str, str], session: Optional[httpx.AsyncClient] = None) -> List[Dict[str, object]]:
    start_time = time.time()
    session = session or await perform_login(payload)
    ensure_device_cookie(session)
    captcha_session = get_captcha_session(payload.get("captchaSessionId") or getattr(session, "captcha_session_id", "") or "")
    dashboard_html = captcha_session.get("dashboard_html", "") if captcha_session else ""
    
    # 1. Determine primary seating URL
    seating_url = await find_menu_link_by_keywords(session, ["seating plan", "exam seating", "seating", "room allotment", "hall ticket"])
    if not seating_url:
        seating_url = urljoin(LOGIN_URL, "index.php?r=examsection/exam-invigilator-student-room-allotment-info/stud_my_seating_plan")
    
    # Try requesting with per-page=100 first to get all entries in one page if supported
    target_url = seating_url
    sep = "&" if "?" in target_url else "?"
    if "per-page=" not in target_url:
        target_url = f"{target_url}{sep}per-page=100"

    all_entries: List[Dict[str, object]] = []
    seen_entry_keys = set()
    visited_urls = set()
    to_visit = [target_url]
    pages_fetched = 0
    last_html = ""

    while to_visit and len(visited_urls) < 10:
        current_url = to_visit.pop(0)
        if current_url in visited_urls:
            continue
        visited_urls.add(current_url)

        try:
            resp = await request_page(session, current_url, headers=build_headers(current_url))
            html = resp.text or ""
            last_html = html
            pages_fetched += 1
            
            plans = parse_seating_tables(html, payload)
            for plan in plans:
                key = (
                    str(plan.get("courseCode") or "").strip().upper(),
                    str(plan.get("examType") or "").strip().lower(),
                    str(plan.get("date") or "").strip(),
                    str(plan.get("examSlot") or plan.get("time") or "").strip().upper(),
                    str(plan.get("room") or "").strip().upper(),
                    str(plan.get("seat") or "").strip().upper()
                )
                if key not in seen_entry_keys:
                    seen_entry_keys.add(key)
                    all_entries.append(plan)

            # Check pagination links in html: ul.pagination a[href]
            soup = BeautifulSoup(html, "html.parser")
            for a in soup.select("ul.pagination a[href]"):
                href = a.get("href")
                if href and "page=" in href:
                    next_full_url = urljoin(current_url, href)
                    if next_full_url not in visited_urls and next_full_url not in to_visit:
                        to_visit.append(next_full_url)
        except Exception as exc:
            if DEBUG_ENABLED:
                print(f"[erp:seating] Page fetch error for {current_url}: {exc}", flush=True)
            continue

    duration = time.time() - start_time
    if all_entries:
        print(f"[erp:seating] Fetch success: {len(all_entries)} seating plan records retrieved across {pages_fetched} page(s) in {duration:.3f}s", flush=True)
        return all_entries

    if DEBUG_ENABLED and last_html:
        debug_path = Path(__file__).resolve().parent / "last_seating_failure.html"
        debug_path.write_text(f"<!-- URL: {target_url} -->\n{last_html}", encoding="utf8")

    print(f"[erp:seating] Fetch completed with 0 records in {duration:.3f}s", flush=True)
    return []


async def sync_cgpa(payload: Dict[str, str], session: Optional[httpx.AsyncClient] = None) -> Dict[str, object]:
    start_time = time.time()
    session = session or await perform_login(payload)
    ensure_device_cookie(session)
    
    overall_cgpa = None
    semesters = []
    subjects = []
    
    # 1. Primary confirmed working endpoint: searchgetmycgpa
    cgpa_url = urljoin(LOGIN_URL, "index.php?r=studentinfo%2Fstudentendexamresult%2Fsearchgetmycgpa")
    
    menu_url = await find_menu_link_by_keywords(session, ["my cgpa", "mycgpa", "cgpa"])
    if menu_url and "searchgetmycgpa" in menu_url:
        cgpa_url = menu_url

    try:
        response = await request_page(session, cgpa_url, headers=build_headers(cgpa_url))
        initial_html = response.text or ""
        parsed = parse_cgpa_html(initial_html, payload, is_overall_page=True)
        if parsed.get("value") is not None:
            overall_cgpa = parsed["value"]
        if parsed.get("semesters"):
            semesters.extend(parsed["semesters"])
        if parsed.get("subjects"):
            subjects.extend(parsed["subjects"])
            
        form = extract_term_form(initial_html, cgpa_url)
        if form.get("html") and (form.get("academicSelect") or form.get("semesterSelect")):
            try:
                form_data = build_attendance_form_data(form, payload)
                form_resp = await submit_form(session, form, form_data, referer=cgpa_url)
                form_html = form_resp.text or ""
                form_parsed = parse_cgpa_html(form_html, payload, is_overall_page=False)
                if overall_cgpa is None and form_parsed.get("value") is not None:
                    overall_cgpa = form_parsed["value"]
                if form_parsed.get("semesters"):
                    semesters.extend(form_parsed["semesters"])
                if form_parsed.get("subjects"):
                    subjects.extend(form_parsed["subjects"])
            except Exception as form_exc:
                if DEBUG_ENABLED:
                    print(f"[erp:cgpa] Term form submission failed: {form_exc}", flush=True)
    except Exception as exc:
        if DEBUG_ENABLED:
            print(f"[erp:cgpa] Primary route searchgetmycgpa failed: {exc}", flush=True)

    # 2. Fallback to candidate paths if still empty, skipping known 404 endpoints
    if overall_cgpa is None and not semesters and not subjects:
        captcha_session = get_captcha_session(payload.get("captchaSessionId") or getattr(session, "captcha_session_id", "") or "")
        dashboard_html = captcha_session.get("dashboard_html", "") if captcha_session else ""
        candidate_urls = collect_feature_urls(
            dashboard_html, 
            CGPA_LINK_KEYWORDS, 
            CGPA_CANDIDATE_PATHS
        )
        for url in candidate_urls:
            if "studentendexamresult/index" in url:
                continue
            try:
                html = await fetch_html_with_term_form(session, url, payload)
                parsed = parse_cgpa_html(html, payload, is_overall_page="cgpa" in url.lower())
                if parsed:
                    if parsed.get("value") is not None and overall_cgpa is None:
                        overall_cgpa = parsed.get("value")
                    if parsed.get("semesters"):
                        semesters.extend(parsed["semesters"])
                    if parsed.get("subjects"):
                        subjects.extend(parsed["subjects"])
                    if overall_cgpa is not None or semesters or subjects:
                        break
            except Exception:
                continue

    # Deduplicate Semesters
    seen_sems = {}
    for sem in semesters:
        sem_name = sem.get("semester", "")
        if sem_name not in seen_sems:
            seen_sems[sem_name] = sem
        else:
            existing = seen_sems[sem_name]
            if not existing.get("sgpa") and sem.get("sgpa"):
                existing["sgpa"] = sem.get("sgpa")
            if not existing.get("cgpa") and sem.get("cgpa"):
                existing["cgpa"] = sem.get("cgpa")
                
    unique_semesters = list(seen_sems.values())
            
    # Deduplicate Subjects
    seen_subs = {}
    for sub in subjects:
        code = sub.get("courseCode", "")
        if code not in seen_subs:
            seen_subs[code] = sub
            
    unique_subjects = list(seen_subs.values())
    duration = time.time() - start_time

    if overall_cgpa is not None or unique_semesters or unique_subjects:
        print(f"[erp:cgpa] Fetch success: CGPA={overall_cgpa}, {len(unique_semesters)} semesters, {len(unique_subjects)} courses in {duration:.3f}s", flush=True)
        return {
            "value": overall_cgpa,
            "semesters": unique_semesters,
            "subjects": unique_subjects,
            "count": len(unique_subjects),
            "duration_seconds": round(duration, 3)
        }

    print(f"[erp:cgpa] Fetch completed with empty result in {duration:.3f}s", flush=True)
    return {
        "value": None,
        "semesters": [],
        "subjects": [],
        "count": 0,
        "duration_seconds": round(duration, 3)
    }


async def fetch_feature_html(
    session: httpx.AsyncClient,
    dashboard_html: str,
    payload: Dict[str, str],
    keywords: List[str],
    candidate_paths: List[str]
) -> tuple:
    candidate_urls = collect_feature_urls(dashboard_html, keywords, candidate_paths)
    seen = set()
    last_html = ""
    last_url = ""

    for url in candidate_urls:
        if not url or url in seen:
            continue
        seen.add(url)
        try:
            html = await fetch_html_with_term_form(session, url, payload)
            last_html = html
            last_url = url
            if html and html_has_keywords(html, keywords):
                return html, url
        except Exception as exc:
            if DEBUG_ENABLED:
                print(f"[erp:feature] failed for {url}: {exc}")
            continue

    return last_html, last_url


def collect_feature_urls(dashboard_html: str, keywords: List[str], candidate_paths: List[str]) -> List[str]:
    base_url = LOGIN_URL
    candidate_urls = []
    link_url = find_link_by_keywords(dashboard_html, base_url, keywords)
    if link_url:
        candidate_urls.append(link_url)
    candidate_urls.extend(urljoin(base_url, path) for path in candidate_paths)

    seen = set()
    unique_urls = []
    for url in candidate_urls:
        if not url or url in seen:
            continue
        seen.add(url)
        unique_urls.append(url)
    return unique_urls


async def find_menu_link_by_keywords(session: httpx.AsyncClient, keywords: List[str]) -> str:
    menu_url = urljoin(LOGIN_URL, "menu-student.json")
    try:
        response = await request_page(session, menu_url, headers=build_headers(LOGIN_URL))
        data = response.json()
    except Exception:
        return ""

    link = search_menu_for_link(data, keywords)
    if not link:
        return ""
    return urljoin(LOGIN_URL, link)


def search_menu_for_link(node, keywords: List[str]) -> str:
    if node is None:
        return ""

    lowered_keywords = [keyword.lower() for keyword in keywords]

    if isinstance(node, dict):
        label = ""
        for key in ["label", "title", "name", "text"]:
            if key in node and isinstance(node[key], str):
                label = node[key]
                break

        if label and any(keyword in label.lower() for keyword in lowered_keywords):
            for url_key in ["url", "href", "link", "route", "path"]:
                if url_key in node and isinstance(node[url_key], str):
                    return node[url_key]

        for child_key in ["items", "children", "submenu", "nodes"]:
            if child_key in node:
                link = search_menu_for_link(node[child_key], keywords)
                if link:
                    return link

    if isinstance(node, list):
        for item in node:
            link = search_menu_for_link(item, keywords)
            if link:
                return link

    return ""


async def fetch_html_with_term_form(
    session: httpx.AsyncClient,
    url: str,
    payload: Dict[str, str],
    csrf_token: Optional[str] = None,
    xhr: bool = False
) -> str:
    headers_extra = {}
    if xhr:
        headers_extra["X-Requested-With"] = "XMLHttpRequest"
        headers_extra["Accept"] = "text/html, */*; q=0.01"
    if csrf_token:
        headers_extra["X-CSRF-Token"] = csrf_token

    response = await request_page(session, url, headers=build_headers(url, headers_extra))
    html = response.text or ""
    html = extract_html_from_json(html)

    form = extract_term_form(html, url)
    if form.get("html"):
        data = build_attendance_form_data(form, payload)
        result_response = await submit_form(session, form, data, referer=url)
        html = result_response.text or ""
        html = extract_html_from_json(html)

    return html


def extract_term_form(html: str, base_url: str) -> Dict[str, object]:
    soup = BeautifulSoup(html, "html.parser")
    forms = soup.find_all("form")
    academic_select = find_select_name(soup, ACADEMIC_KEYWORDS)
    semester_select = find_select_name(soup, SEMESTER_KEYWORDS)

    if not academic_select and not semester_select:
        return {"html": "", "actionUrl": base_url, "method": "post"}

    selected_form = None
    for form in forms:
        if academic_select and has_select(form, academic_select):
            selected_form = form
            break
        if semester_select and has_select(form, semester_select):
            selected_form = form
            break

    form = selected_form or (forms[0] if forms else None)
    if not form:
        return {"html": "", "actionUrl": base_url, "method": "post"}

    action = form.get("action") or base_url
    method = (form.get("method") or "post").lower()

    ajax_url = ""
    scripts = soup.find_all("script")
    form_id = form.get("id", "")
    for script in scripts:
        script_text = script.string or ""
        if form_id and form_id in script_text and ".ajax" in script_text:
            match = re.search(r"url\s*:\s*['\"]([^'\"]+)['\"]", script_text)
            if match:
                ajax_url = match.group(1)
                if DEBUG_ENABLED:
                    print(f"[erp:feature] Detected AJAX form for {form_id}, URL: {ajax_url}")
                break

    return {
        "html": str(form),
        "actionUrl": urljoin(base_url, ajax_url or action),
        "method": method,
        "academicSelect": academic_select,
        "semesterSelect": semester_select,
        "hiddenFields": extract_hidden_inputs(form),
        "isAjax": bool(ajax_url)
    }


def find_link_by_keywords(html: str, base_url: str, keywords: List[str]) -> str:
    if not html:
        return ""
    lowered_keywords = [keyword.lower() for keyword in keywords]
    soup = BeautifulSoup(html, "html.parser")
    for link in soup.find_all("a", href=True):
        href = (link.get("href", "") or "").strip()
        if not href or href.startswith("#"):
            continue
        if "javascript:" in href.lower():
            continue
        text = clean_text(link.get_text(" ")).lower()
        combined = f"{text} {href.lower()}"
        if any(keyword in combined for keyword in lowered_keywords):
            return urljoin(base_url, href)
    return ""


def html_has_keywords(html: str, keywords: List[str]) -> bool:
    if not html:
        return False
    lowered_keywords = [keyword.lower() for keyword in keywords]
    text = clean_text(BeautifulSoup(html, "html.parser").get_text(" ")).lower()
    return any(keyword in text for keyword in lowered_keywords)


def parse_marks_tables(html: str, payload: Dict[str, str]) -> List[Dict[str, object]]:
    soup = BeautifulSoup(html or "", "html.parser")
    tables = soup.find_all("table")

    for table in tables:
        headers, rows = parse_table(table)
        if not headers or not rows:
            continue

        if not looks_like_marks_headers(headers):
            continue

        rows = filter_rows_by_term(rows, headers, payload)
        parsed = parse_marks_rows(headers, rows, payload)
        if parsed:
            return parsed

    return []


async def parse_course_internals_page(html: str, payload: Dict[str, str], session: httpx.AsyncClient) -> List[Dict[str, object]]:
    soup = BeautifulSoup(html or "", "html.parser")
    tables = soup.find_all("table")
    csrf_token = extract_csrf_token(html)

    for table in tables:
        rows = table.find_all("tr")
        if len(rows) < 2:
            continue

        header_cells = rows[0].find_all(["th", "td"])
        headers = [clean_text(cell.get_text(" ")).lower() for cell in header_cells]

        # Relaxed header checks: just need to look like a course table
        if not any(k in h for h in headers for k in ["course", "subject", "code"]):
            continue

        year_index = find_index(headers, ["academic year", "academicyear", "year"])
        semester_index = find_index(headers, ["semester", "term"])
        code_index = find_index(headers, ["coursecode", "course code", "code", "subjectcode", "subject code"])
        subject_index = find_index(headers, ["course name", "course", "subject", "coursedesc", "title", "name"])
        component_index = find_index(headers, ["evaluation components", "evaluation component", "components", "evaluation", "options", "action", "view", "internals", "marks"])

        if code_index < 0 and subject_index < 0:
            continue

        results = []
        for row in rows[1:]:
            cells = row.find_all(["td", "th"])
            if not cells:
                continue

            values = [clean_text(cell.get_text(" ")) for cell in cells]
            if year_index >= 0 and not matches_year(row_value(values, year_index), payload.get("academicYear")):
                continue
            if semester_index >= 0 and not matches_semester(row_value(values, semester_index), payload.get("semesterId")):
                continue

            course_code = row_value(values, code_index)
            subject = row_value(values, subject_index) or row_value(values, 0)

            insem1 = None
            insem2 = None
            
            # The ERP table has evaluation components in a cell - find Semester in Exam-I and Semester in Exam-II links
            component_cell = cells[component_index] if component_index >= 0 and component_index < len(cells) else None
            
            if component_cell:
                # Find ALL links in the component cell that contain "semester in exam" or "in sem"
                links = component_cell.find_all("a")
                for link in links:
                    label = clean_text(link.get_text(" ")).lower()
                    href = link.get("href", "") or ""
                    
                    # Determine if this is insem1 or insem2
                    is_insem1 = "semester in exam-i" in label or "semester in exam 1" in label or "in sem 1" in label or "in sem-i" in label
                    is_insem2 = "semester in exam-ii" in label or "semester in exam 2" in label or "in sem 2" in label or "in sem-ii" in label or "exam-ii" in label
                    is_insem2 = is_insem2 or "exam ii" in label
                    is_insem1 = is_insem1 or "exam i" in label
                    
                    bucket = None
                    if is_insem2:
                        bucket = "insem2"
                    elif is_insem1:
                        bucket = "insem1"
                    
                    if bucket and href and "javascript" not in href.lower():
                        try:
                            # Make request to get the marks
                            full_url = urljoin(LOGIN_URL, href)
                            resp = await session.get(full_url, headers=build_headers(full_url, {"X-Requested-With": "XMLHttpRequest"}), timeout=get_timeout())
                            if resp.status_code == 200:
                                mark_html = resp.text
                                # Parse the returned HTML for marks
                                mark_val = parse_mark_from_component_html(mark_html)
                                if mark_val:
                                    if bucket == "insem1" and insem1 is None:
                                        insem1 = str(mark_val)
                                    elif bucket == "insem2" and insem2 is None:
                                        insem2 = str(mark_val)
                                    if DEBUG_ENABLED:
                                        print(f"[erp:marks] Got {bucket}={mark_val} for {course_code}", flush=True)
                        except Exception as e:
                            if DEBUG_ENABLED:
                                print(f"[erp:marks] Failed to fetch {bucket}: {e}", flush=True)
                            pass

            # Also check the component cell text directly for any marks info
            if component_cell and insem1 is None and insem2 is None:
                cell_text = clean_text(component_cell.get_text(" "))
                if insem1 is None:
                    m1 = re.search(r"(?:semester\s*in\s*exam\s*[-_]?\s*(?:1|i)\b|in\s*sem\s*1).*?(?:(?:marks|score|obtained|awarded|secured)[^0-9]*)?(\d+(?:\.\d+)?(?:/\d+(?:\.\d+)?)?)", cell_text, re.IGNORECASE)
                    if m1:
                        insem1 = m1.group(1)
                if insem2 is None:
                    m2 = re.search(r"(?:semester\s*in\s*exam\s*[-_]?\s*(?:2|ii)\b|in\s*sem\s*2).*?(?:(?:marks|score|obtained|awarded|secured)[^0-9]*)?(\d+(?:\.\d+)?(?:/\d+(?:\.\d+)?)?)", cell_text, re.IGNORECASE)
                    if m2:
                        insem2 = m2.group(1)

            if insem1 is None and insem2 is None:
                continue

            results.append({
                "courseCode": course_code,
                "subject": subject,
                "insem1": insem1,
                "insem2": insem2,
                "academicYear": row_value(values, year_index) or payload.get("academicYear"),
                "semester": row_value(values, semester_index) or payload.get("semesterId")
            })
            
            if DEBUG_ENABLED and (insem1 or insem2):
                print(f"[erp:marks] Found marks for {course_code}: insem1={insem1}, insem2={insem2}", flush=True)

        if results:
            return results

    return []


def parse_marks_rows(headers: List[str], rows: List[List[str]], payload: Dict[str, str]) -> List[Dict[str, object]]:
    code_index = find_index(headers, ["coursecode", "course code", "code", "subjectcode", "subject code"])
    subject_index = find_index(headers, ["coursedesc", "course", "subject", "name", "title"])
    year_index = find_index(headers, ["year", "academicyear", "academic year"])
    semester_index = find_index(headers, ["semester", "term"])

    insem1_index = find_mark_index(headers, [
        r"in\s*sem\s*1",
        r"in\s*semester\s*1",
        r"internal\s*1",
        r"mid\s*1",
        r"sessional\s*1",
        r"semester\s*in\s*exam\s*[-_]?\s*(1|i)\b",
        r"sem\s*in\s*exam\s*[-_]?\s*(1|i)\b",
        r"exam\s*[-_]?\s*(1|i)\b"
    ])
    insem2_index = find_mark_index(headers, [
        r"in\s*sem\s*2",
        r"in\s*semester\s*2",
        r"internal\s*2",
        r"mid\s*2",
        r"sessional\s*2",
        r"semester\s*in\s*exam\s*[-_]?\s*(2|ii)\b",
        r"sem\s*in\s*exam\s*[-_]?\s*(2|ii)\b",
        r"exam\s*[-_]?\s*(2|ii)\b"
    ])
    total_index = find_mark_index(headers, [r"total", r"overall", r"marks", r"score"])

    results: List[Dict[str, object]] = []
    for row in rows:
        if year_index >= 0 and not matches_year(row_value(row, year_index), payload.get("academicYear")):
            continue
        if semester_index >= 0 and not matches_semester(row_value(row, semester_index), payload.get("semesterId")):
            continue

        course_code = row_value(row, code_index)
        subject = row_value(row, subject_index) or row_value(row, 0)
        insem1 = row_value(row, insem1_index)
        insem2 = row_value(row, insem2_index)
        total = row_value(row, total_index)

        if not course_code and not subject:
            continue

        results.append({
            "courseCode": course_code,
            "subject": subject,
            "insem1": insem1,
            "insem2": insem2,
            "total": total,
            "academicYear": row_value(row, year_index) or payload.get("academicYear"),
            "semester": row_value(row, semester_index) or payload.get("semesterId")
        })

    return results


def parse_seating_tables(html: str, payload: Dict[str, str]) -> List[Dict[str, object]]:
    soup = BeautifulSoup(html or "", "html.parser")
    tables = soup.find_all("table")
    all_results: List[Dict[str, object]] = []

    for table in tables:
        headers, rows = parse_table(table)
        if not headers or not rows:
            continue

        if not looks_like_seating_headers(headers):
            continue

        parsed = parse_seating_rows(headers, rows, payload)
        if parsed:
            all_results.extend(parsed)

    return all_results


def parse_seating_rows(headers: List[str], rows: List[List[str]], payload: Dict[str, str]) -> List[Dict[str, object]]:
    ref_index = find_index(headers, ["ref", "refid", "ref id", "reference"])
    code_index = find_index(headers, ["coursecode", "course code", "code", "subjectcode", "subject code"])
    subject_index = find_index(headers, ["coursedesc", "course", "subject", "name", "title"])
    exam_type_index = find_index(headers, ["exam type", "type"])
    exam_slot_index = find_index(headers, ["exam slot", "slot", "session"])
    student_id_index = find_index(headers, ["student university id", "student id", "university id", "student"])
    room_index = find_index(headers, ["room", "roomno", "room no", "hall", "hall no", "hallno"])
    seat_index = find_index(headers, ["seat", "seatno", "seat no", "bench"])
    block_index = find_index(headers, ["block", "building"])
    date_index = find_index(headers, ["date", "examdate"])
    time_index = find_index(headers, ["time", "slot", "examtime"])
    created_index = find_index(headers, ["creation", "created", "created at", "created on"])
    year_index = find_index(headers, ["year", "academicyear", "academic year"])
    semester_index = find_index(headers, ["semester", "term"])

    results: List[Dict[str, object]] = []
    for row in rows:
        entry = {
            "refId": row_value(row, ref_index),
            "studentId": row_value(row, student_id_index),
            "courseCode": row_value(row, code_index),
            "subject": row_value(row, subject_index) or row_value(row, 0),
            "examType": row_value(row, exam_type_index),
            "examSlot": row_value(row, exam_slot_index),
            "room": row_value(row, room_index),
            "seat": row_value(row, seat_index),
            "block": row_value(row, block_index),
            "date": row_value(row, date_index),
            "time": row_value(row, time_index),
            "createdAt": row_value(row, created_index),
            "academicYear": row_value(row, year_index) or payload.get("academicYear"),
            "semester": row_value(row, semester_index) or payload.get("semesterId")
        }

        if not any([entry["courseCode"], entry["subject"], entry["room"], entry["seat"], entry["date"], entry["time"]]):
            continue
        results.append(entry)

    return results


def parse_component_rows(html: str, payload: Dict[str, str]) -> List[Dict[str, object]]:
    soup = BeautifulSoup(html or "", "html.parser")
    tables = soup.find_all("table")
    results = {}
    
    for table in tables:
        headers, rows = parse_table(table)
        if not headers or not rows:
            continue
            
        code_idx = find_index(headers, ["coursecode", "course code", "code", "subjectcode", "subject code"])
        subject_idx = find_index(headers, ["coursedesc", "course name", "subject", "title", "course"])
        comp_idx = find_index(headers, ["component", "evaluation", "type", "exam", "name", "description"])
        marks_idx = find_mark_index(headers, [r"marks\s*obtained", r"obtained", r"scored", r"score", r"marks", r"result", r"awarded", r"secured"])
        max_idx = find_mark_index(headers, [r"max\s*marks", r"maximum", r"out\s*of"])
        
        if (code_idx >= 0 or subject_idx >= 0) and comp_idx >= 0 and marks_idx >= 0:
            for row in filter_rows_by_term(rows, headers, payload):
                code = row_value(row, code_idx)
                subject = row_value(row, subject_idx)
                comp = row_value(row, comp_idx)
                marks = row_value(row, marks_idx)
                max_marks = row_value(row, max_idx) if max_idx >= 0 else None
                
                bucket = component_bucket(comp)
                if not bucket:
                    continue
                    
                key = code or subject
                if not key:
                    continue
                    
                if key not in results:
                    results[key] = {
                        "courseCode": code,
                        "subject": subject or code,
                        "insem1": None,
                        "insem2": None,
                        "total": None,
                        "academicYear": payload.get("academicYear"),
                        "semester": payload.get("semesterId")
                    }
                    
                val = format_mark_value(to_number(marks), to_number(max_marks)) if max_marks else marks
                if bucket == "insem1":
                    results[key]["insem1"] = val
                elif bucket == "insem2":
                    results[key]["insem2"] = val
                    
    return list(results.values())


def component_bucket(label: str) -> str:
    text = (label or "").lower()
    if "exam" not in text and "insem" not in text and "mid" not in text and "internal" not in text:
        return ""
    if re.search(r"\b(2|ii)\b", text):
        return "insem2"
    if re.search(r"\b(1|i)\b", text):
        return "insem1"
    if "exam-ii" in text or "exam ii" in text:
        return "insem2"
    if "exam-i" in text or "exam i" in text:
        return "insem1"
    return ""


async def fetch_component_mark(session: httpx.AsyncClient, url: str, csrf_token: Optional[str] = None):
    headers_extra = {"X-Requested-With": "XMLHttpRequest"}
    token = csrf_token or get_csrf_from_session(session)
    if token:
        headers_extra["X-CSRF-Token"] = token
    response = await request_page(session, url, headers=build_headers(url, headers_extra))
    html = response.text or ""
    html = extract_html_from_json(html)
    value = parse_mark_from_component_html(html)
    if value is None and DEBUG_ENABLED:
        debug_path = Path(__file__).resolve().parent / "last_marks_component_failure.html"
        debug_path.write_text(f"<!-- URL: {url} -->\n{html}", encoding="utf8")
    return value


def extract_html_from_json(html: str) -> str:
    try:
        data = json.loads(html)
    except Exception:
        return html

    if isinstance(data, dict):
        return data.get("content") or data.get("html") or data.get("data") or html
    return html


def extract_csrf_token(html: str) -> str:
    if not html:
        return ""
    soup = BeautifulSoup(html, "html.parser")
    meta = soup.find("meta", {"name": "csrf-token"})
    if meta and meta.get("content"):
        return meta.get("content")
    input_tag = soup.find("input", {"name": "_csrf"})
    if input_tag and input_tag.get("value"):
        return input_tag.get("value")
    # Regex fallback in case BeautifulSoup missed script/head or dynamic string
    m = re.search(r'name=["\']csrf-token["\']\s+content=["\']([^"\']+)["\']', html)
    if m:
        return m.group(1)
    m = re.search(r'name=["\']_csrf["\']\s+value=["\']([^"\']+)["\']', html)
    if m:
        return m.group(1)
    m = re.search(r'yii\.getCsrfToken\s*=\s*function\(\)\s*\{\s*return\s*["\']([^"\']+)["\']', html)
    if m:
        return m.group(1)
    return ""


def get_csrf_from_session(session: httpx.AsyncClient) -> str:
    if session is None:
        return ""
    latest = getattr(session, "latest_csrf_token", "")
    if latest:
        return latest
    token = safe_get_cookie(session.cookies, "_csrf") or safe_get_cookie(session.cookies, "csrf")
    return token or ""


def ensure_device_cookie(session: httpx.AsyncClient) -> None:
    if session is None:
        return
    if safe_get_cookie(session.cookies, "kl_erp_device_id"):
        return

    seed = os.urandom(32).hex()
    token = os.urandom(32).hex()
    raw_value = f"{seed}:2:{{i:0;s:16:\"kl_erp_device_id\";i:1;s:64:\"{token}\";}}"
    session.cookies.set("kl_erp_device_id", quote(raw_value, safe=""))
    dedupe_cookies(session.cookies)


def extract_component_url(link_tag) -> str:
    href = (link_tag.get("href") or "").strip()
    if href and not href.startswith("#") and "javascript:" not in href.lower():
        return urljoin(LOGIN_URL, href)

    value = (link_tag.get("value") or "").strip()
    if value and "?r=" in value and not value.startswith("#"):
        return urljoin(LOGIN_URL, value if "index.php" in value else "index.php" + value)

    for value in link_tag.attrs.values():
        if isinstance(value, list):
            text = " ".join(str(item) for item in value)
        else:
            text = str(value)

        url = extract_component_url_from_text(text)
        if url:
            return url

    # Fallback: check parent <select> for onchange URL
    if link_tag.name == "option":
        parent = link_tag.find_parent("select")
        if parent:
            onchange = parent.get("onchange") or parent.get("data-url") or ""
            url = extract_component_url_from_text(str(onchange))
            if url:
                sep = "&" if "?" in url else "?"
                return f"{url}{sep}val={value}"

    return ""


def extract_component_url_from_text(text: str) -> str:
    if not text:
        return ""

    # Match any typical ERP route that might fetch data
    match = re.search(r"(?:index\.php)?\?r=([^'\"\s>]+)", text, re.IGNORECASE)
    if match:
        route = match.group(1).replace("\\/", "/")
        return urljoin(LOGIN_URL, "index.php?r=" + route)

    return ""


def parse_mark_from_component_html(html: str):
    soup = BeautifulSoup(html or "", "html.parser")
    tables = soup.find_all("table")

    for table in tables:
        headers, rows = parse_table(table)
        if not headers or not rows:
            continue

        score_index = find_mark_index(headers, [
            r"(marks|score).*(obtained|secured|scored|score)",
            r"obtained",
            r"secured",
            r"score"
        ])
        total_index = find_mark_index(headers, [r"total\s*marks", r"total"])
        weighted_index = find_mark_index(headers, [r"weighted\s*marks", r"weighted"])
        max_index = find_mark_index(headers, [r"max\s*marks", r"max", r"maximum", r"out\s*of"])

        for row in rows:
            score = to_number(row_value(row, score_index)) if score_index >= 0 else None
            total = to_number(row_value(row, total_index)) if total_index >= 0 else None
            weighted = to_number(row_value(row, weighted_index)) if weighted_index >= 0 else None
            max_value = to_number(row_value(row, max_index)) if max_index >= 0 else None
            if total is not None and max_value is not None:
                return format_mark_value(total, max_value)
            if total is not None:
                return total
            if weighted is not None:
                return weighted
            if score is not None and max_value is not None:
                return format_mark_value(score, max_value)
            if score is not None:
                return score

    text = clean_text(soup.get_text(" "))
    match = re.search(r"(?:marks|score|obtained)\s*[:\-]?\s*(\d+(?:\.\d+)?(?:/\d+(?:\.\d+)?)?)", text, re.IGNORECASE)
    if match:
        val = match.group(1)
        if "/" in val:
            return val
        return float(val)

    raw = str(soup)
    match = re.search(r"show.*\(.*?(\d+(?:\.\d+)?).*?\)", raw, re.IGNORECASE)
    if match:
        return float(match.group(1))

    return None


def extract_marks_from_sub_html(html: str) -> Dict[str, str]:
    res = {}
    soup = BeautifulSoup(html or "", "html.parser")
    tables = soup.find_all("table")
    
    for table in tables:
        headers, rows = parse_table(table)
        if not headers or not rows:
            continue
        
        comp_idx = find_index(headers, ["component", "evaluation", "type", "exam", "name", "description", "particulars"])
        marks_idx = find_mark_index(headers, [r"marks\s*obtained", r"obtained", r"scored", r"score", r"marks", r"result", r"awarded", r"secured"])
        max_idx = find_mark_index(headers, [r"max\s*marks", r"maximum", r"out\s*of"])
        
        if comp_idx >= 0 and marks_idx >= 0:
            for row in rows:
                comp = row_value(row, comp_idx)
                marks = row_value(row, marks_idx)
                max_marks = row_value(row, max_idx) if max_idx >= 0 else None
                
                bucket = component_bucket(comp)
                if bucket:
                    val = format_mark_value(to_number(marks), to_number(max_marks)) if max_marks else marks
                    if val and bucket not in res:
                        res[bucket] = val

    text = clean_text(soup.get_text(" "))
    if "insem1" not in res:
        m1 = re.search(r"(?:semester\s*in\s*exam\s*[-_]?\s*(?:1|i)\b|in\s*sem\s*1).*?(?:(?:marks|score|obtained|awarded|secured)[^0-9]*)?(\d+(?:\.\d+)?(?:/\d+(?:\.\d+)?)?)", text, re.IGNORECASE)
        if m1: res["insem1"] = m1.group(1)
    if "insem2" not in res:
        m2 = re.search(r"(?:semester\s*in\s*exam\s*[-_]?\s*(?:2|ii)\b|in\s*sem\s*2).*?(?:(?:marks|score|obtained|awarded|secured)[^0-9]*)?(\d+(?:\.\d+)?(?:/\d+(?:\.\d+)?)?)", text, re.IGNORECASE)
        if m2: res["insem2"] = m2.group(1)
        
    return res


def format_mark_value(obtained: float, maximum: float) -> str:
    def fmt(value: float) -> str:
        if value is None:
            return ""
        if float(value).is_integer():
            return str(int(value))
        return f"{value:.2f}".rstrip("0").rstrip(".")

    return f"{fmt(obtained)}/{fmt(maximum)}"


def parse_cgpa_html(html: str, payload: Dict[str, str], is_overall_page: bool = False) -> Dict[str, object]:
    soup = BeautifulSoup(html or "", "html.parser")
    for script in soup(["script", "style"]):
        script.extract()
    tables = soup.find_all("table")
    cgpa_value = None
    text = clean_text(soup.get_text(" "))
    match = re.search(r"cgpa[^0-9]*(\d+(?:\.\d+)?)", text, re.IGNORECASE)
    if match:
        cgpa_value = float(match.group(1))
    
    def extract_grade_value(pattern: str, search_text: str) -> Optional[float]:
        for match in re.finditer(pattern, search_text, re.IGNORECASE):
            val = float(match.group(1))
            if 0.0 < val <= 10.0:
                return val
        return None

    sgpa_value = None
    sgpa_match = re.search(r"(?:sgpa|spi|sgpi|semester gpa)[^0-9]*(\d+(?:\.\d+)?)", text, re.IGNORECASE)
    if sgpa_match:
        sgpa_value = float(sgpa_match.group(1))
    cgpa_value = extract_grade_value(r"(?:overall\s*cgpa|cumulative\s*(?:grade\s*point\s*average|gpa)|final\s*cgpa|my\s*cgpa)\s*(?:[:=-]\s*)?(\d+(?:\.\d+)?)", text)
    if cgpa_value is None and is_overall_page:
        cleaned_cgpa = re.sub(r"minimum\s*cgpa\s*(?:[:=-]\s*)?\d+(?:\.\d+)?", "", text, flags=re.IGNORECASE)
        cgpa_value = extract_grade_value(r"\bcgpa\b\s*(?:[:=-]\s*)?(\d+(?:\.\d+)?)", cleaned_cgpa)

    cleaned_sgpa = re.sub(r"minimum\s*sgpa\s*(?:[:=-]\s*)?\d+(?:\.\d+)?", "", text, flags=re.IGNORECASE)
    sgpa_value = extract_grade_value(r"\b(?:sgpa|spi|sgpi|semester gpa)\b\s*(?:[:=-]\s*)?(\d+(?:\.\d+)?)", cleaned_sgpa)

    subjects = []
    semesters = []

    for table in tables:
        headers, rows = parse_table(table)
        if not headers or not rows:
            continue

        code_idx = find_index(headers, ["coursecode", "course code", "code", "subjectcode", "subject code", "sub code", "course_code"])
        name_idx = find_index(headers, ["coursedesc", "course desc", "course title", "subject title", "subject name", "course name", "sub name", "description", "title", "subject"])
        if name_idx == code_idx:
            name_idx = -1
        if name_idx < 0:
            for idx, h in enumerate(headers):
                if idx != code_idx and any(w in h.lower() for w in ["name", "title", "desc", "subject"]):
                    name_idx = idx
                    break
        grade_idx = find_index(headers, ["grade", "letter grade", "grade secured", "letter", "gr", "result"])
        points_idx = find_index(headers, ["points", "grade points", "gradepoint", "pt", "earned points", "secured points"])
        credits_idx = find_index(headers, ["credits", "credit", "cr", "credits earned", "credits registered"])

        if code_idx >= 0 and grade_idx >= 0:
            for row in rows:
                code = row_value(row, code_idx)
                name = row_value(row, name_idx) if name_idx >= 0 else ""
                grade = row_value(row, grade_idx)
                points = row_value(row, points_idx) if points_idx >= 0 else ""
                credit = row_value(row, credits_idx) if credits_idx >= 0 else ""
                if code and grade and grade.lower() not in ["grade", "letter grade", "gr"]:
                    subjects.append({
                        "courseCode": code,
                        "subject": name or code,
                        "grade": grade,
                        "points": points,
                        "credits": credit
                    })

        # Look for semester CGPA
        sem_idx = find_index(headers, ["semester", "term", "sem", "reg sem"])
        sgpa_idx = find_index(headers, ["sgpa", "spi", "semester gpa", "sgpi"])
        cgpa_idx = find_index(headers, ["cgpa", "cpi", "cumulative gpa", "cgpi"])
        
        if sem_idx >= 0 and (sgpa_idx >= 0 or cgpa_idx >= 0) and not (code_idx >= 0 and grade_idx >= 0):
            for row in rows:
                sem = row_value(row, sem_idx)
                sgpa = row_value(row, sgpa_idx) if sgpa_idx >= 0 else ""
                cgpa_text = row_value(row, cgpa_idx) if cgpa_idx >= 0 else ""
                if sem and sem.lower() not in ["semester", "term", "sem", "reg sem"] and (sgpa or cgpa_text):
                    semesters.append({
                        "semester": sem,
                        "sgpa": sgpa,
                        "cgpa": cgpa_text
                    })

    if cgpa_value is None and semesters:
        valid_cgpas = [to_number(s["cgpa"]) for s in semesters if s.get("cgpa") and to_number(s["cgpa"]) is not None and 0.0 < to_number(s["cgpa"]) <= 10.0]
        if valid_cgpas:
            cgpa_value = valid_cgpas[-1]

    if not semesters and (sgpa_value is not None or cgpa_value is not None):
        semesters.append({
            "semester": payload.get("semesterId") or "Selected Semester",
            "sgpa": sgpa_value if sgpa_value is not None else "",
            "cgpa": cgpa_value if cgpa_value is not None else ""
        })

    if not subjects and not semesters and cgpa_value is None:
        return {}

    return {
        "value": cgpa_value,
        "semesters": semesters,
        "subjects": subjects
    }



def parse_table(table) -> tuple:
    rows = table.find_all("tr")
    if len(rows) < 2:
        return [], []

    header_cells = rows[0].find_all(["th", "td"])
    headers = [clean_text(cell.get_text(" ")).lower() for cell in header_cells]
    data_rows = []

    for row in rows[1:]:
        cells = [clean_text(cell.get_text(" ")) for cell in row.find_all(["td", "th"])]
        if not cells:
            continue
        data_rows.append(cells)

    return headers, data_rows


def looks_like_marks_headers(headers: List[str]) -> bool:
    header_text = " ".join(headers)
    return any(keyword in header_text for keyword in ["insem", "internal", "sessional", "marks", "mid"])


def looks_like_seating_headers(headers: List[str]) -> bool:
    header_text = " ".join(headers)
    return any(keyword in header_text for keyword in ["seat", "room", "hall", "exam"]) and any(
        keyword in header_text for keyword in ["course", "subject"]
    )


def filter_rows_by_term(rows: List[List[str]], headers: List[str], payload: Dict[str, str]) -> List[List[str]]:
    year_index = find_index(headers, ["year", "academicyear", "academic year"])
    semester_index = find_index(headers, ["semester", "term"])

    if year_index < 0 and semester_index < 0:
        return rows

    filtered = []
    for row in rows:
        year_ok = True
        semester_ok = True
        if year_index >= 0:
            year_ok = matches_year(row_value(row, year_index), payload.get("academicYear"))
        if semester_index >= 0:
            semester_ok = matches_semester(row_value(row, semester_index), payload.get("semesterId"))
        if year_ok and semester_ok:
            filtered.append(row)

    return filtered


def find_mark_index(headers: List[str], patterns: List[str]) -> int:
    for index, header in enumerate(headers):
        for pattern in patterns:
            if re.search(pattern, header, re.IGNORECASE):
                return index
    return -1


def row_value(row: List[str], index: int) -> str:
    if index < 0 or index >= len(row):
        return ""
    return row[index]


def matches_year(value: str, target: Optional[str]) -> bool:
    if not target:
        return True
    value = (value or "").strip()
    if not value:
        return False

    target_nums = re.findall(r"\d+", target)
    value_nums = re.findall(r"\d+", value)
    if target_nums and value_nums and target_nums[0] == value_nums[0]:
        return True

    lowered_target = target.lower()
    lowered_value = value.lower()
    return lowered_target in lowered_value or lowered_value in lowered_target


def matches_semester(value: str, target: Optional[str]) -> bool:
    if not target:
        return True
    value = (value or "").strip().lower()
    if not value:
        return False

    target = target.lower()
    if "even" in target:
        return "even" in value
    if "odd" in target:
        return "odd" in value
    if "summer" in target:
        return "summer" in value
    if "term" in target:
        return "term" in value
    return target in value or value in target


def matches_academic_year_by_date(date_text: str, academic_year: Optional[str]) -> bool:
    if not academic_year:
        return True
    year = parse_year_from_date(date_text)
    if year is None:
        return False
    years = re.findall(r"\d{4}", academic_year)
    if len(years) >= 2:
        start_year = int(years[0])
        end_year = int(years[1])
        return year in {start_year, end_year}
    if years:
        return year == int(years[0])
    return False


def matches_semester_by_date(date_text: str, semester: Optional[str]) -> bool:
    if not semester:
        return True
    month = parse_month_from_date(date_text)
    if month is None:
        return False
    lowered = semester.lower()
    # Heuristic mapping: odd -> Jul-Dec, even -> Jan-Jun, summer/term3 -> May-Jul.
    if "odd" in lowered:
        return month >= 7
    if "even" in lowered:
        return month <= 6
    if "summer" in lowered or "term" in lowered:
        return 5 <= month <= 7
    return True


def parse_year_from_date(date_text: str) -> Optional[int]:
    if not date_text:
        return None
    match = re.search(r"(\d{4})", date_text)
    if match:
        return int(match.group(1))
    return None


def parse_month_from_date(date_text: str) -> Optional[int]:
    if not date_text:
        return None
    match = re.search(r"(\d{4})[-/](\d{2})[-/](\d{2})", date_text)
    if match:
        return int(match.group(2))
    match = re.search(r"(\d{2})[-/](\d{2})[-/](\d{4})", date_text)
    if match:
        return int(match.group(2))
    return None


async def resolve_dependent_options(
    session: httpx.AsyncClient,
    soup: BeautifulSoup,
    form_tag,
    academic_select_name: str,
    selected_academic_year: str,
    base_url: str
) -> Dict[str, str]:
    """
    If the semester dropdown is dynamically populated via AJAX upon selecting
    the academic year, locate the dependency endpoint and fetch the semester options.
    Returns a dict mapping lowercase option text and value to the option value.
    """
    options_map = {}
    if not academic_select_name or not selected_academic_year:
        return options_map

    acad_tag = soup.find("select", {"name": academic_select_name}) or soup.find("select", {"id": academic_select_name})
    dep_url = ""
    dep_method = "post"

    if acad_tag:
        data_url = acad_tag.get("data-url") or acad_tag.get("data-ajax-url") or acad_tag.get("data-depdrop-url") or ""
        onchange = acad_tag.get("onchange") or ""
        if data_url:
            dep_url = data_url
        elif onchange:
            m = re.search(r"(?:\$|\.ajax|\.get|\.post)\s*\(?\s*['\"]([^'\"]*(?:semester|getsem|get-sem|dropdown|search)[^'\"]*)['\"]", onchange, re.IGNORECASE)
            if m:
                dep_url = m.group(1)
                dep_method = "get" if ".get" in onchange.lower() else "post"
            else:
                m2 = re.search(r"url\s*:\s*['\"]([^'\"]+)['\"]", onchange)
                if m2:
                    dep_url = m2.group(1)

    if not dep_url:
        acad_id = acad_tag.get("id") if acad_tag else ""
        scripts = soup.find_all("script")
        for script in scripts:
            script_text = script.string or ""
            if acad_id and acad_id in script_text and ("depdrop" in script_text.lower() or ".change" in script_text.lower() or ".ajax" in script_text.lower()):
                m = re.search(r"url\s*:\s*['\"]([^'\"]*(?:semester|getsem|get-sem|dropdown|timetable)[^'\"]*)['\"]", script_text, re.IGNORECASE)
                if m:
                    dep_url = m.group(1)
                    if re.search(r"type\s*:\s*['\"]get['\"]", script_text, re.IGNORECASE):
                        dep_method = "get"
                    break

    if dep_url:
        target_url = urljoin(base_url, dep_url)
        params_or_data = {
            academic_select_name: selected_academic_year,
            "academic_year": selected_academic_year,
            "id": selected_academic_year,
            "depdrop_parents": [selected_academic_year],
            "depdrop_all_params": {academic_select_name: selected_academic_year}
        }
        csrf_token = extract_csrf_token(str(soup)) or get_csrf_from_session(session)
        headers_extra = {"X-Requested-With": "XMLHttpRequest"}
        if csrf_token:
            headers_extra["X-CSRF-Token"] = csrf_token
            params_or_data["_csrf"] = csrf_token

        try:
            if dep_method == "get":
                res = await session.get(target_url, params=params_or_data, headers=build_headers(base_url, headers_extra), timeout=get_timeout())
            else:
                res = await session.post(target_url, data=params_or_data, headers=build_headers(base_url, headers_extra), timeout=get_timeout())
            
            res_text = res.text or ""
            try:
                data = res.json()
                if isinstance(data, dict) and "output" in data and isinstance(data["output"], list):
                    for item in data["output"]:
                        val = str(item.get("id", "")).strip()
                        name = clean_text(str(item.get("name", "")))
                        if val and name:
                            options_map[val.lower()] = val
                            options_map[name.lower()] = val
            except Exception:
                pass

            opt_soup = BeautifulSoup(res_text, "html.parser")
            for opt in opt_soup.find_all("option"):
                val = (opt.get("value") or "").strip()
                txt = clean_text(opt.get_text(" ")).lower()
                if val and val != "0" and "select" not in txt:
                    options_map[val.lower()] = val
                    options_map[txt] = val
        except Exception as exc:
            if DEBUG_ENABLED:
                print(f"[erp:timetable] Error resolving dependent options: {exc}", flush=True)

    return options_map


def build_timetable_form_data(
    form: Dict[str, object],
    payload: Dict[str, str],
    resolved_options: Optional[Dict[str, str]] = None
) -> Dict[str, str]:
    html = form.get("html") or ""
    soup = BeautifulSoup(html, "html.parser")

    data = extract_hidden_inputs(soup) if soup else {}
    if form.get("hiddenFields"):
        data.update(form["hiddenFields"])

    academic_select = form.get("academicSelect")
    matched_year = ""
    if academic_select:
        select_tag = soup.find("select", {"name": academic_select}) or soup.find("select", {"id": academic_select})
        matched_year = find_option_value(select_tag, payload.get("academicYear", ""))
        if not matched_year and select_tag:
            cached_ids = get_cached_term_ids(payload.get("academicYear", ""), payload.get("semesterId", ""))
            if cached_ids and cached_ids.get("acad_id"):
                for opt in select_tag.find_all("option"):
                    if opt.get("value") == cached_ids["acad_id"]:
                        matched_year = cached_ids["acad_id"]
                        break
        data[academic_select] = matched_year or payload.get("academicYear", "")

    semester_select = form.get("semesterSelect")
    matched_sem = ""
    if semester_select:
        select_tag = soup.find("select", {"name": semester_select}) or soup.find("select", {"id": semester_select})
        matched_sem = find_option_value(select_tag, payload.get("semesterId", ""))
        
        # Check resolved dependent options if select_tag had no match
        if not matched_sem and resolved_options:
            target_sem = (payload.get("semesterId") or "").strip().lower()
            if target_sem in resolved_options:
                matched_sem = resolved_options[target_sem]
            else:
                for opt_text, opt_val in resolved_options.items():
                    if "even" in target_sem and ("even" in opt_text or opt_val == "2" or "sem 2" in opt_text):
                        matched_sem = opt_val
                        break
                    if "odd" in target_sem and ("odd" in opt_text or opt_val == "1" or "sem 1" in opt_text):
                        matched_sem = opt_val
                        break
                    if "summer" in target_sem and ("summer" in opt_text or opt_val == "3"):
                        matched_sem = opt_val
                        break
        if not matched_sem and select_tag:
            cached_ids = get_cached_term_ids(payload.get("academicYear", ""), payload.get("semesterId", ""))
            if cached_ids and cached_ids.get("sem_id"):
                for opt in select_tag.find_all("option"):
                    if opt.get("value") == cached_ids["sem_id"]:
                        matched_sem = cached_ids["sem_id"]
                        break

        data[semester_select] = matched_sem or payload.get("semesterId", "")

    # Ensure search trigger button is included
    if not form.get("isAjax"):
        if not any(k in data for k in ["yt0", "yt1", "Search", "search"]):
            data["yt0"] = "Search"
            data["search"] = "1"

    return data


async def fetch_timetable_from_url(
    session: httpx.AsyncClient,
    url: str,
    payload: Dict[str, str],
    csrf_token: Optional[str] = None
) -> tuple:
    # 1. Request the timetable page using the existing session
    print(f"[erp:timetable] Step 1: Requesting timetable page with existing session: {url}", flush=True)
    response = await request_page(session, url, headers=build_headers(url))
    html = response.text or ""
    html = extract_html_from_json(html)

    # Check if login page was returned (session expired or invalid)
    if looks_like_login_page(html):
        print(f"[erp:timetable] Warning: Received login page instead of timetable. Session may have expired.", flush=True)
        return {"grid": [], "mappings": []}, html

    # Check if timetable grid is already present on page without form submission
    timetable = parse_timetable_html(html)
    if timetable["grid"]:
        print(f"[erp:timetable] Direct timetable records found on initial page load: {len(timetable['grid'])} rows, {len(timetable.get('mappings', []))} mappings.", flush=True)
        return timetable, html

    # 2. Inspect its HTML for the academic-year and semester form fields
    form = extract_timetable_form(html, url)
    soup = BeautifulSoup(html, "html.parser")
    form_tag = BeautifulSoup(form.get("html") or "", "html.parser").find("form")

    academic_select = form.get("academicSelect") or ""
    semester_select = form.get("semesterSelect") or ""
    action_url = form.get("actionUrl") or url
    method = form.get("method") or "post"

    print(f"[erp:timetable] Step 2: Inspected HTML form - action='{action_url}', method='{method}', academicSelect='{academic_select}', semesterSelect='{semester_select}'", flush=True)

    acad_tag = soup.find("select", {"name": academic_select}) or soup.find("select", {"id": academic_select}) if academic_select else None
    if acad_tag:
        acad_opts = [(opt.get("value", "").strip(), clean_text(opt.get_text(" "))) for opt in acad_tag.find_all("option") if (opt.get("value") or "").strip()]
        print(f"[erp:timetable] Available Academic Year options ({len(acad_opts)}): {acad_opts}", flush=True)

    sem_tag = soup.find("select", {"name": semester_select}) or soup.find("select", {"id": semester_select}) if semester_select else None
    if sem_tag:
        sem_opts = [(opt.get("value", "").strip(), clean_text(opt.get_text(" "))) for opt in sem_tag.find_all("option") if (opt.get("value") or "").strip()]
        print(f"[erp:timetable] Available Semester options ({len(sem_opts)}): {sem_opts}", flush=True)

    # 3. Submit the required filters if the page needs a separate form request
    selected_year = ""
    if form.get("html") and form_tag:
        resolved_options = {}
        valid_sem_opts = [
            opt for opt in (sem_tag.find_all("option") if sem_tag else [])
            if (opt.get("value") or "").strip() and "select" not in opt.get_text("").lower() and opt.get("value") != "0"
        ]
        
        if academic_select and acad_tag:
            selected_year = find_option_value(acad_tag, payload.get("academicYear", "")) or payload.get("academicYear", "")

        if len(valid_sem_opts) <= 1 and selected_year:
            print(f"[erp:timetable] Dynamic semester resolution required for academic year '{selected_year}'", flush=True)
            resolved_options = await resolve_dependent_options(
                session, soup, form_tag, academic_select, selected_year, url
            )
            if resolved_options:
                print(f"[erp:timetable] Resolved dynamic semester options: {resolved_options}", flush=True)

        data = build_timetable_form_data(form, payload, resolved_options)
        csrf = csrf_token or extract_csrf_token(html) or get_csrf_from_session(session)
        if csrf and "_csrf" not in data:
            data["_csrf"] = csrf

        print(f"[erp:timetable] Step 3: Submitting timetable filter form to '{action_url}' with data: {data}", flush=True)
        result_response = await submit_form(session, form, data, referer=url)
        res_html = result_response.text or ""
        res_html = extract_html_from_json(res_html)

        # 4. Parse the returned timetable records
        timetable = parse_timetable_html(res_html)
        if timetable["grid"]:
            print(f"[erp:timetable] Step 4: Successfully parsed {len(timetable['grid'])} rows and {len(timetable.get('mappings', []))} mappings from form response.", flush=True)
            return timetable, res_html

    # 4b. Fallback: Direct search parameter submission if form submission did not return grid
    year_val = selected_year or payload.get("academicYear", "")
    sem_val = payload.get("semesterId", "")
    csrf = csrf_token or get_csrf_from_session(session)
    
    cached_ids = get_cached_term_ids(payload.get("academicYear", ""), payload.get("semesterId", ""))
    acad_id_num = cached_ids.get("acad_id", "") if cached_ids else ""
    sem_id_num = cached_ids.get("sem_id", "") if cached_ids else ""
    
    fallback_payloads = [
        {
            "Universitymasteracademictimetableview[academic_year]": year_val,
            "Universitymasteracademictimetableview[semester]": sem_val,
            "yt0": "Search",
            "search": "1"
        },
        {
            "Universitymasteracademictimetableview[academic_year]": acad_id_num or year_val,
            "Universitymasteracademictimetableview[semester]": sem_id_num or sem_val,
            "yt0": "Search",
            "search": "1"
        },
        {
            "Timetable[academic_year]": year_val,
            "Timetable[semester]": sem_val,
            "yt0": "Search",
            "search": "1"
        },
        {
            "academic_year": year_val,
            "semester": sem_val,
            "search": "1"
        }
    ]
    
    for fb_data in fallback_payloads:
        if csrf:
            fb_data["_csrf"] = csrf
        try:
            print(f"[erp:timetable] Trying fallback parameter submission to {url} with fields {list(fb_data.keys())}", flush=True)
            fb_res = await session.post(
                url,
                data=fb_data,
                headers=build_headers(url, {"X-Requested-With": "XMLHttpRequest"}),
                timeout=get_timeout()
            )
            fb_html = extract_html_from_json(fb_res.text or "")
            timetable = parse_timetable_html(fb_html)
            if timetable["grid"]:
                print(f"[erp:timetable] Step 4: Successfully parsed {len(timetable['grid'])} rows from fallback parameter submission.", flush=True)
                return timetable, fb_html

            fb_res_get = await session.get(
                url,
                params=fb_data,
                headers=build_headers(url),
                timeout=get_timeout()
            )
            fb_html_get = extract_html_from_json(fb_res_get.text or "")
            timetable = parse_timetable_html(fb_html_get)
            if timetable["grid"]:
                print(f"[erp:timetable] Step 4: Successfully parsed {len(timetable['grid'])} rows from fallback GET parameter submission.", flush=True)
                return timetable, fb_html_get
        except Exception:
            pass

    return {"grid": [], "mappings": []}, html


def find_timetable_link(html: str, base_url: str) -> str:
    soup = BeautifulSoup(html or "", "html.parser")
    for link in soup.find_all("a", href=True):
        text = link.get_text(" ", strip=True).lower()
        href = link["href"].lower()
        if "javascript:" in href:
            continue
        if "timetable" in text or "timetable" in href:
            return urljoin(base_url, link["href"])
    return ""


def extract_timetable_form(html: str, base_url: str) -> Dict[str, object]:
    soup = BeautifulSoup(html or "", "html.parser")
    forms = soup.find_all("form")

    # Filter out irrelevant forms (color picker, settings theme)
    valid_forms = []
    for f in forms:
        f_classes = " ".join(f.get("class", [])).lower() if isinstance(f.get("class", []), list) else str(f.get("class", "")).lower()
        f_id = (f.get("id") or "").lower()
        if "color-picker" in f_classes or "color-picker" in f_id or "settings" in f_id:
            continue
        valid_forms.append(f)

    academic_select = find_select_name(soup, ACADEMIC_KEYWORDS)
    semester_select = find_select_name(soup, SEMESTER_KEYWORDS)

    form = None
    for candidate in valid_forms:
        form_text = candidate.get_text(" ", strip=True).lower()
        if academic_select and has_select(candidate, academic_select):
            form = candidate
            break
        if semester_select and has_select(candidate, semester_select):
            form = candidate
            break
        if "timetable" in form_text or "academic" in form_text or "semester" in form_text:
            form = candidate
            break

    form = form or (valid_forms[0] if valid_forms else None)
    if not form:
        return {
            "html": "",
            "actionUrl": base_url,
            "method": "post",
            "academicSelect": academic_select,
            "semesterSelect": semester_select,
            "hiddenFields": {}
        }

    action = form.get("action") or base_url
    method = (form.get("method") or "post").lower()

    # Check for AJAX URL
    ajax_url = form.get("data-ajax-search-url") or ""
    if not ajax_url:
        scripts = soup.find_all("script")
        form_id = form.get("id", "")
        for script in scripts:
            script_text = script.string or ""
            if form_id and form_id in script_text and ".ajax" in script_text:
                match = re.search(r"url\s*:\s*['\"]([^'\"]+)['\"]", script_text)
                if match:
                    ajax_url = match.group(1)
                    break

    pjax_container = form.get("data-pjax-container") or ""
    if not pjax_container:
        parent_pjax = form.find_parent(attrs={"data-pjax-container": True})
        if parent_pjax:
            pjax_container = parent_pjax.get("id", "")

    return {
        "html": str(form),
        "actionUrl": urljoin(base_url, ajax_url or action),
        "method": method,
        "academicSelect": academic_select or find_select_name(form, ACADEMIC_KEYWORDS),
        "semesterSelect": semester_select or find_select_name(form, SEMESTER_KEYWORDS),
        "hiddenFields": extract_hidden_inputs(form),
        "isAjax": bool(ajax_url),
        "pjaxContainer": pjax_container
    }


def parse_timetable_html(html: str) -> Dict[str, object]:
    soup = BeautifulSoup(html or "", "html.parser")
    table = find_timetable_table(soup)
    if not table:
        return {"grid": [], "mappings": []}
        
    rows = table.find_all("tr")
    grid = []
    mappings_by_code: Dict[str, Dict[str, str]] = {}
    other_mappings: List[Dict[str, str]] = []
    
    for row in rows:
        cells = [clean_text(c.get_text(" ")) for c in row.find_all(["td", "th"])]
        if cells and any(cells):
            grid.append(cells)
        
        # Extract course, room, faculty, type mappings from every cell
        for cell in cells:
            if not cell or cell in {"-", "--", "NA", "N/A", "Nil", "nil", "Day", "Hour", "Time", "Slot"}:
                continue

            norm_cell = cell.lower().strip()
            if any(norm_cell == d for d in ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday", "mon", "tue", "wed", "thu", "fri", "sat", "sun"]):
                continue
            if any(kw in norm_cell for kw in ["day / hour", "day/hour", "day / time", "day/time", "period", "s.no", "s no", "serial"]):
                continue
            if re.search(r"\b\d{1,2}:\d{2}\s*[-–]\s*\d{1,2}:\d{2}\b", cell):
                continue

            # 1. Check for standard KL Course Code (e.g. 23CS06EF, 23CS2101, 24SC1205)
            code_match = re.search(r"\b(\d{2}[A-Z]{2,6}[0-9A-Z]{3,6}|\d{2}[A-Z]{2,8}\d{2,4}[A-Z]?)\b", cell)
            code = code_match.group(1).upper() if code_match else ""

            # 2. Classroom extraction (e.g. -RoomNo-M103, / C301, Room 301)
            room = ""
            m_room = re.search(r"[-–]?\s*RoomNo[-:\s]*([A-Za-z0-9\-]+)", cell, re.IGNORECASE)
            if m_room:
                room = m_room.group(1).strip()
            elif "/" in cell:
                m_slash = re.search(r"/\s*([A-Za-z0-9\-]+)$", cell)
                if m_slash:
                    room = m_slash.group(1).strip()
            else:
                m_word = re.search(r"\b(?:Room|Hall|Lab)\s*[:\-]?\s*([A-Za-z0-9\-]+)", cell, re.IGNORECASE)
                if m_word:
                    room = m_word.group(1).strip()

            # 3. Faculty extraction (e.g. (Dr. Sharma), Prof. Rao, Mr. XYZ)
            faculty = ""
            m_paren = re.search(r"\(([^)]+)\)", cell)
            if m_paren:
                paren_val = m_paren.group(1).strip()
                if not re.match(r"^\d{1,2}:\d{2}", paren_val):
                    faculty = paren_val
            if not faculty:
                m_fac = re.search(r"\b(?:Dr\.|Prof\.|Mr\.|Ms\.|Mrs\.)\s+[A-Za-z\s.]+", cell, re.IGNORECASE)
                if m_fac:
                    faculty = m_fac.group(0).strip()

            # 4. Class Type (L = Lecture, T = Tutorial, P = Practical, S = Skill)
            class_type = ""
            m_type = re.search(r"(?:^|\s)-\s*([LTPS])\s*-(?:\s|$)", cell, re.IGNORECASE)
            if m_type:
                class_type = m_type.group(1).upper()

            # 5. Subject title extraction by stripping known tokens
            cleaned = cell
            if code:
                cleaned = re.sub(r"\b" + re.escape(code) + r"\b", "", cleaned)
            if m_room:
                cleaned = re.sub(r"[-–]?\s*RoomNo[-:\s]*[A-Za-z0-9\-]+", "", cleaned, flags=re.IGNORECASE)
            if faculty:
                cleaned = re.sub(r"\b" + re.escape(faculty) + r"\b", "", cleaned)
            if m_type:
                cleaned = re.sub(r"(?:^|\s)-\s*[LTPS]\s*-(?:\s|$)", " ", cleaned, flags=re.IGNORECASE)
            if room:
                cleaned = re.sub(r"/\s*" + re.escape(room) + r"$", "", cleaned)
            cleaned = re.sub(r"[\(\)]", "", cleaned)
            cleaned = re.sub(r"^\s*-\s*|\s*-\s*$", "", cleaned).strip()
            cleaned = re.sub(r"\s+", " ", cleaned)

            subj = cleaned if len(cleaned) >= 2 and not re.match(r"^\d+$", cleaned) else (code or cell)

            if code:
                if code not in mappings_by_code:
                    mappings_by_code[code] = {
                        "courseCode": code,
                        "code": code,
                        "subject": subj or code,
                        "faculty": faculty,
                        "classroom": room,
                        "type": class_type,
                        "value": cell
                    }
                else:
                    existing = mappings_by_code[code]
                    if not existing.get("faculty") and faculty:
                        existing["faculty"] = faculty
                    if not existing.get("classroom") and room:
                        existing["classroom"] = room
                    if not existing.get("type") and class_type:
                        existing["type"] = class_type
                    if existing.get("subject") == code and subj and subj != code:
                        existing["subject"] = subj
            elif faculty or (subj and len(subj) >= 4 and subj != cell):
                entry = {
                    "courseCode": "",
                    "code": "",
                    "subject": subj,
                    "faculty": faculty,
                    "classroom": room,
                    "type": class_type,
                    "value": cell
                }
                if entry not in other_mappings:
                    other_mappings.append(entry)

    # Also parse secondary legend / course details table if present
    for other_table in soup.find_all("table"):
        if other_table == table:
            continue
        table_text = clean_text(other_table.get_text(" ")).lower()
        if any(kw in table_text for kw in ["faculty", "staff", "instructor", "course code", "subject code", "course title"]):
            for r in other_table.find_all("tr"):
                cols = [clean_text(c.get_text(" ")) for c in r.find_all(["td", "th"])]
                if len(cols) >= 2:
                    code_cand = ""
                    faculty_cand = ""
                    subject_cand = ""
                    room_cand = ""
                    for c in cols:
                        if re.search(r"\b(\d{2}[A-Z]{2,6}[0-9A-Z]{3,6}|\d{2}[A-Z]{2,8}\d{2,4}[A-Z]?)\b", c.strip()):
                            m_c = re.search(r"\b(\d{2}[A-Z]{2,6}[0-9A-Z]{3,6}|\d{2}[A-Z]{2,8}\d{2,4}[A-Z]?)\b", c.strip())
                            code_cand = m_c.group(1).upper()
                        elif re.search(r"^(?:Dr\.|Prof\.|Mr\.|Ms\.|Mrs\.)\s+[A-Za-z\s.]+$", c.strip(), re.IGNORECASE):
                            faculty_cand = c.strip()
                        elif re.search(r"^[A-Z0-9]{2,6}$", c.strip()) and not room_cand and not code_cand:
                            room_cand = c.strip()
                        elif len(c) > 4 and not code_cand and not faculty_cand:
                            subject_cand = c.strip()
                    
                    if code_cand:
                        if code_cand not in mappings_by_code:
                            mappings_by_code[code_cand] = {
                                "courseCode": code_cand,
                                "code": code_cand,
                                "subject": subject_cand or code_cand,
                                "faculty": faculty_cand,
                                "classroom": room_cand,
                                "type": "",
                                "value": " ".join(cols)
                            }
                        else:
                            if faculty_cand:
                                mappings_by_code[code_cand]["faculty"] = faculty_cand
                            if subject_cand and mappings_by_code[code_cand].get("subject") == code_cand:
                                mappings_by_code[code_cand]["subject"] = subject_cand
                            if room_cand and not mappings_by_code[code_cand].get("classroom"):
                                mappings_by_code[code_cand]["classroom"] = room_cand
                    elif faculty_cand and subject_cand:
                        entry = {
                            "courseCode": "",
                            "code": "",
                            "subject": subject_cand,
                            "faculty": faculty_cand,
                            "classroom": room_cand,
                            "type": "",
                            "value": " ".join(cols)
                        }
                        if entry not in other_mappings:
                            other_mappings.append(entry)

    all_mappings = list(mappings_by_code.values()) + other_mappings
    return {
        "grid": grid,
        "mappings": all_mappings
    }


def find_timetable_table(soup: BeautifulSoup):
    tables = soup.find_all("table")
    if not tables:
        return None

    day_names = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]
    short_day_names = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"]
    slot_keywords = ["slot", "period", "lecture", "class", "time", "hour", "timing", "day", "room"]

    def score_table(table) -> int:
        rows = table.find_all("tr")
        if not rows:
            return -100

        cells_per_row = [len(row.find_all(["td", "th"])) for row in rows]
        max_cells = max(cells_per_row) if cells_per_row else 0
        text = clean_text(table.get_text(" ")).lower()

        day_hits = sum(1 for day in day_names if re.search(r'\b' + day + r'\b', text))
        short_day_hits = sum(1 for day in short_day_names if re.search(r'\b' + day + r'\b', text))
        total_day_hits = max(day_hits, short_day_hits)

        slot_hits = sum(1 for keyword in slot_keywords if keyword in text)
        time_hits = len(re.findall(r"\b\d{1,2}:\d{2}\s*(?:am|pm)?\b", text, re.IGNORECASE))

        score = 0
        score += total_day_hits * 10
        score += min(len(rows), 12)
        score += min(max_cells, 12)
        score += min(slot_hits * 2, 8)
        score += min(time_hits, 8)

        if len(rows) < 2:
            score -= 15
        if max_cells < 2:
            score -= 15
        if total_day_hits == 0 and time_hits == 0 and slot_hits == 0:
            score -= 12

        return score

    scored_tables = sorted(((score_table(table), table) for table in tables), key=lambda item: item[0], reverse=True)
    best_score, best_table = scored_tables[0]

    if best_score < 4:
        return None

    return best_table


def find_index(headers: List[str], candidates: List[str]) -> int:
    for index, header in enumerate(headers):
        if any(header == candidate for candidate in candidates):
            return index

    for index, header in enumerate(headers):
        normalized = re.sub(r"[^a-z0-9%]+", " ", header).strip()
        tokens = normalized.split()
        if any(any(candidate in token for token in tokens) for candidate in candidates if len(candidate) > 1):
            return index

    return -1


def to_number(value: str) -> Optional[float]:
    match = re.search(r"\d+(?:\.\d+)?", value or "")
    return float(match.group(0)) if match else None


def clean_text(value: str) -> str:
    return re.sub(r"\s+", " ", value or "").strip()


def close_captcha_session(session_id: str) -> None:
    if redis_client:
        redis_client.delete(f"captcha_session:{session_id}")
    else:
        captcha_sessions_memory.pop(session_id, None)


def prune_captcha_sessions() -> None:
    if redis_client:
        return
    now = time.time()
    expired = [
        session_id
        for session_id, entry in captcha_sessions_memory.items()
        if now - entry.get("created_at", 0) >= CAPTCHA_SESSION_TTL_MS / 1000
    ]
    for session_id in expired:
        close_captcha_session(session_id)

    # Prune only pending (unlogged-in) sessions to avoid terminating active logged-in sync sessions
    pending_sessions = [
        (session_id, entry)
        for session_id, entry in captcha_sessions_memory.items()
        if not entry.get("is_logged_in", False)
    ]
    while len(pending_sessions) >= MAX_CAPTCHA_SESSIONS:
        oldest = min(pending_sessions, key=lambda item: item[1].get("created_at", 0))
        close_captcha_session(oldest[0])
        pending_sessions.remove(oldest)

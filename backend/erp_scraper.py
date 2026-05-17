import base64
import json
import os
import re
import time
import uuid
from dataclasses import dataclass
from pathlib import Path
from typing import Dict, List, Optional
from urllib.parse import quote, urljoin

import requests
from bs4 import BeautifulSoup
from dotenv import load_dotenv

load_dotenv()

try:
    import redis
    HAS_REDIS = True
except ImportError:
    HAS_REDIS = False

REDIS_URL = os.getenv("KV_URL") or os.getenv("REDIS_URL")
redis_client = redis.Redis.from_url(REDIS_URL) if HAS_REDIS and REDIS_URL else None


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

ALLOW_INSECURE = os.getenv("ERP_ALLOW_INSECURE", "true").lower() in {"1", "true", "yes"}
DEBUG_ENABLED = os.getenv("ERP_DEBUG", "true").lower() in {"1", "true", "yes"}

if ALLOW_INSECURE:
    import urllib3
    urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

CAPTCHA_SESSION_TTL_MS = int(os.getenv("ERP_CAPTCHA_SESSION_TTL_MS", "600000"))
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

FACULTY_PATH_SHARED = Path(__file__).resolve().parents[1] / "shared" / "faculty.json"
FACULTY_PATH_LOCAL = Path(__file__).resolve().parent / "faculty.json"

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
CGPA_LINK_KEYWORDS = ["cgpa", "my cgpa", "gpa", "grade", "result", "cumulative", "sem end exam"]

MARKS_CANDIDATE_PATHS = [
    "index.php?r=examsection/examstudentcourseinternalsummativeqpwisemarksinfo/index",
    "index.php?r=examsection/examstudentcourseinternalsummativeqpwisemarksinfo/index_student",
    "index.php?r=examsection/examstudentcourseinternalsummativeqpwisemarksinfo/index_student_marks",
    "index.php?r=studentinfo/studentendexamresult/getstudentinternalmarks",
    "index.php?r=studentmarks/marks/index",
    "index.php?r=studentmarks/marks/internal",
    "index.php?r=studentmarks/marks/view",
    "index.php?r=studentcourse/internalmarks/index"
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
    "index.php?r=studentresult/result/index",
    "index.php?r=studentmarks/marks/cgpa"
]


class AppError(Exception):
    def __init__(self, message: str, status_code: int = 500):
        super().__init__(message)
        self.message = message
        self.status_code = status_code


captcha_sessions_memory: Dict[str, Dict] = {}

def save_captcha_session(session_id: str, data: Dict):
    if redis_client:
        redis_client.setex(f"captcha_session:{session_id}", CAPTCHA_SESSION_TTL_MS // 1000, json.dumps(data))
    else:
        captcha_sessions_memory[session_id] = data

def get_captcha_session(session_id: str) -> Optional[Dict]:
    if redis_client:
        raw = redis_client.get(f"captcha_session:{session_id}")
        if raw:
            return json.loads(raw)
        return None
    return captcha_sessions_memory.get(session_id)

def reconstruct_session(cookies: Dict[str, str]) -> requests.Session:
    session = requests.Session()
    session.headers.update({"User-Agent": DEFAULT_USER_AGENT})
    session.cookies.update(cookies)
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


def create_session() -> requests.Session:
    session = requests.Session()
    session.headers.update({"User-Agent": DEFAULT_USER_AGENT})
    ensure_device_cookie(session)
    return session


def get_timeout() -> float:
    return max(5.0, DEFAULT_TIMEOUT_MS / 1000.0)


def create_captcha_session() -> Dict[str, str]:

    prune_captcha_sessions()

    session = create_session()
    login_response = request_page(session, LOGIN_URL, headers=build_headers(LOGIN_URL))
    login_html = login_response.text or ""

    captcha_url = extract_captcha_url(login_html, LOGIN_URL)
    if not captcha_url:
        if DEBUG_ENABLED:
            print("[erp:login] Captcha not found. HTML snippet:", login_html[:1000])
        raise AppError("Captcha not found on ERP login page. Site might be offline or blocking requests.", 502)

    captcha_response = request_page(
        session,
        captcha_url,
        headers=build_headers(LOGIN_URL),
        stream=True
    )

    image_bytes = captcha_response.content or b""
    if not image_bytes:
        raise AppError("Captcha image was empty. The ERP might be rate-limiting.", 502)

    image_base64 = base64.b64encode(image_bytes).decode("ascii")
    session_id = str(uuid.uuid4())

    save_captcha_session(session_id, {
        "cookies": session.cookies.get_dict(),
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


def perform_login(payload: Dict[str, str]) -> requests.Session:
    session_id = payload.get("captchaSessionId") or ""
    captcha_session = get_captcha_session(session_id)
    if not captcha_session:
        raise AppError("Captcha session expired. Refresh captcha and try again.", 410)

    session = reconstruct_session(captcha_session.get("cookies", {}))

    # Check if already logged in to this session
    if captcha_session.get("is_logged_in", False):
        return session

    try:
        login_form = extract_login_form(captcha_session.get("login_html", ""), LOGIN_URL)
        login_data = build_login_form_data(login_form, payload)

        login_response = submit_form(
            session,
            login_form,
            login_data,
            referer=LOGIN_URL
        )

        login_html = login_response.text or ""
        if looks_like_login_failure(login_html, login_form):
            message = extract_login_error_message(login_html)
            clean_message = message or "ERP login failed. Refresh captcha and check ERP ID, password, and captcha."
            raise AppError(clean_message, 401)

        captcha_session["is_logged_in"] = True
        captcha_session["dashboard_html"] = login_html
        captcha_session["cookies"] = session.cookies.get_dict()
        save_captcha_session(session_id, captcha_session)
        
        return session
    except AppError as e:
        raise e
    except Exception as e:
        if DEBUG_ENABLED:
            print("[erp:login] unexpected error", e)
        raise AppError(f"Login failed: {str(e)}", 500)


def load_faculty() -> List[Dict[str, object]]:
    if FACULTY_PATH_LOCAL.exists():
        return json.loads(FACULTY_PATH_LOCAL.read_text(encoding="utf8"))
    if FACULTY_PATH_SHARED.exists():
        return json.loads(FACULTY_PATH_SHARED.read_text(encoding="utf8"))
    return []


def request_page(session: requests.Session, url: str, headers: Optional[Dict[str, str]] = None, stream: bool = False) -> requests.Response:
    try:
        response = session.get(
            url,
            headers=headers,
            timeout=get_timeout(),
            verify=not ALLOW_INSECURE,
            stream=stream
        )
        response.raise_for_status()
        return response
    except requests.RequestException as exc:
        if DEBUG_ENABLED:
            print(f"[erp:http] request_page failed for {url}: {exc}")
        raise AppError(f"ERP request failed: {exc}", 502) from exc


def submit_form(session: requests.Session, form: Dict[str, object], data: Dict[str, str], referer: str) -> requests.Response:
    url = form.get("actionUrl")
    method = form.get("method", "post")
    
    headers_extra = {"Content-Type": "application/x-www-form-urlencoded"}
    if form.get("isAjax"):
        headers_extra["X-Requested-With"] = "XMLHttpRequest"
        
    headers = build_headers(referer, headers_extra)

    try:
        if method == "get":
            response = session.get(
                url,
                params=data,
                headers=build_headers(referer),
                timeout=get_timeout(),
                verify=not ALLOW_INSECURE
            )
        else:
            response = session.post(
                url,
                data=data,
                headers=headers,
                timeout=get_timeout(),
                verify=not ALLOW_INSECURE
            )

        response.raise_for_status()
        return response
    except requests.RequestException as exc:
        if DEBUG_ENABLED:
            print(f"[erp:http] submit_form failed for {url}: {exc}")
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

    username_field = find_input_name_by_id(form, LOGIN_FIELD_IDS["erp_id"]) or find_input_name_by_pattern(form, r"user|login|erp") or "username"
    password_field = find_input_name_by_id(form, LOGIN_FIELD_IDS["password"]) or find_input_name_by_pattern(form, r"pass") or "password"
    captcha_field = find_input_name_by_id(form, LOGIN_FIELD_IDS["captcha"]) or find_input_name_by_pattern(form, r"captcha") or "captcha"
    hidden_fields = extract_hidden_inputs(form)

    if DEBUG_ENABLED:
        print("[erp:http] login form", {
            "action": action,
            "method": method,
            "usernameField": username_field,
            "passwordField": password_field,
            "captchaField": captcha_field,
            "hiddenFields": list(hidden_fields.keys())
        })

    return {
        "actionUrl": urljoin(base_url, action),
        "method": method,
        "usernameField": username_field,
        "passwordField": password_field,
        "captchaField": captcha_field,
        "hiddenFields": hidden_fields
    }


def build_login_form_data(form: Dict[str, object], payload: Dict[str, str]) -> Dict[str, str]:
    return {
        **form.get("hiddenFields", {}),
        form.get("usernameField"): payload.get("erpId", ""),
        form.get("passwordField"): payload.get("password", ""),
        form.get("captchaField"): payload.get("captcha", "")
    }


def looks_like_login_failure(html: str, form: Dict[str, object]) -> bool:
    if not html:
        return True

    lowered = html.lower()
    if "captcha" in lowered and "invalid" in lowered:
        return True
    if "login" in lowered and "failed" in lowered:
        return True
    if re.search(r"type=['\"]password['\"]", html, re.IGNORECASE):
        return True
    if contains_login_fields(html, form):
        return True

    return False


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
    for selector in selectors:
        for element in soup.select(selector):
            text = clean_text(element.get_text(" "))
            if text and len(text) > 1 and text != "*":
                messages.append(text)

    if messages:
        return " ".join(list(dict.fromkeys(messages)))[:240]

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

    # KLERP specific: Look for AJAX URL in scripts that might intercept this form
    ajax_url = ""
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

    # Ensure a submit button trigger is included in the payload if NOT an AJAX request
    # AJAX requests in KLERP often don't include the button name
    if not form.get("isAjax"):
        if not any(k in data for k in ["yt0", "yt1", "Search", "search"]):
            data["yt0"] = "Search"
            data["search"] = "1"

    return data


def find_select_name(soup, keywords: List[str]) -> str:
    for select_tag in soup.find_all("select"):
        name = select_tag.get("name") or select_tag.get("id") or ""
        lowered = name.lower()
        if any(keyword in lowered for keyword in keywords):
            return name
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
        
        # Exact match
        if target and (text.lower() == target or value.lower() == target):
            return value
            
        # Semester specific matching (Even/Odd)
        if target and ("even" in target and "even" in text.lower()):
            return value
        if target and ("odd" in target and "odd" in text.lower()):
            return value
            
        # Smart partial match for years (e.g. "2025-2026" matches "2025-26")
        if target and len(target) >= 4:
            target_nums = re.findall(r"\d+", target)
            text_nums = re.findall(r"\d+", text.lower())
            if target_nums and text_nums and target_nums[0] == text_nums[0]:
                return value
            if target in text.lower() or text.lower() in target:
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

    code_index = find_index(headers, ["coursecode", "code"])
    subject_index = find_index(headers, ["coursedesc", "subject", "course", "name", "title"])
    ltps_index = find_index(headers, ["ltps", "type", "component"])
    conducted_index = find_index(headers, ["conducted", "total conducted", "held"])
    attended_index = find_index(headers, ["attended", "total attended", "present"])
    percentage_index = find_index(headers, ["percentage", "%", "percent"])

    results: List[Dict[str, object]] = []
    for row in rows[1:]:
        cells = row.find_all(["td", "th"])
        if not cells:
            continue
        values = [clean_text(cell.get_text(" ")) for cell in cells]

        code_val = values[code_index].strip().upper() if code_index >= 0 and code_index < len(values) else ""
        subject_val = values[subject_index].strip() if subject_index >= 0 and subject_index < len(values) else values[0]
        ltps_val = values[ltps_index].strip().upper() if ltps_index >= 0 and ltps_index < len(values) else ""
        conducted = to_number(values[conducted_index]) if conducted_index >= 0 and conducted_index < len(values) else None
        attended = to_number(values[attended_index]) if attended_index >= 0 and attended_index < len(values) else None
        pct = to_number(values[percentage_index].replace("%", "")) if percentage_index >= 0 and percentage_index < len(values) else None

        if not subject_val or "total" in subject_val.lower() or not code_val or len(code_val) < 3:
            continue

        results.append({
            "subject": subject_val,
            "courseCode": code_val,
            "ltps": ltps_val,
            "conducted": int(conducted) if conducted is not None else None,
            "attended": int(attended) if attended is not None else None,
            "percentage": pct or 0,
            "finalPercentage": pct if not ltps_val else None
        })

    return results


def sync_attendance(payload: Dict[str, str]) -> List[Dict[str, object]]:
    session = perform_login(payload)

    session_id = payload.get("captchaSessionId") or ""
    captcha_session = get_captcha_session(session_id)
    dashboard_html = captcha_session.get("dashboard_html", "") if captcha_session else ""

    attendance_url = find_attendance_link(dashboard_html, LOGIN_URL) if dashboard_html else ""
    attendance_url = attendance_url or ATTENDANCE_URL

    attendance_response = request_page(session, attendance_url, headers=build_headers(attendance_url))
    attendance_html = attendance_response.text or ""

    parsed = parse_attendance_tables(attendance_html)
    if parsed:
        return merge_attendance_rows(parsed)

    attendance_form = extract_attendance_form(attendance_html, attendance_url)
    attendance_data = build_attendance_form_data(attendance_form, payload)
    result_response = submit_form(session, attendance_form, attendance_data, referer=attendance_url)
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
        if "no records found" in lowered or "no data" in lowered:
            return []
        raise AppError("Could not find attendance table in ERP response.", 502)

    return merge_attendance_rows(rows)


def merge_attendance_rows(rows: List[Dict[str, object]]) -> List[Dict[str, object]]:
    seen = {}
    for row in rows:
        code = row.get("courseCode") or row.get("subject", "")
        ltps = row.get("ltps", "").upper()
        if code not in seen:
            seen[code] = {"subject": row["subject"], "courseCode": code}
        if ltps in ("L", "T", "P", "S"):
            seen[code][ltps] = row.get("percentage", 0)
            seen[code][f"{ltps}_conducted"] = row.get("conducted")
            seen[code][f"{ltps}_attended"] = row.get("attended")
        elif row.get("percentage") is not None:
            seen[code]["finalPercentage"] = row.get("percentage", 0)
    return list(seen.values())


def sync_timetable(payload: Dict[str, str]) -> Dict[str, object]:
    session_id = payload.get("captchaSessionId") or ""
    captcha_session = get_captcha_session(session_id)
    if not captcha_session:
        raise AppError("Captcha session expired.", 410)

    dashboard_html = captcha_session.get("dashboard_html", "")
    timetable_link = find_timetable_link(dashboard_html, LOGIN_URL) if dashboard_html else ""

    session = reconstruct_session(captcha_session.get("cookies", {}))

    candidate_paths = [
        "index.php?r=timetables/universitymasteracademictimetableview/indexstudentindisearch",
        "index.php?r=timetables/universitymasteracademictimetableview/indexstudent",
        "index.php?r=timetables/universitymasteracademictimetableview/index",
        "index.php?r=timetables/universitymasteracademictimetableview/indexsearch",
        "index.php?r=timetables/studenttimetable/index",
    ]
    candidate_urls = []
    if timetable_link:
        candidate_urls.append(timetable_link)
    candidate_urls.extend(urljoin(LOGIN_URL, path) for path in candidate_paths)

    seen_urls = set()
    last_html = ""
    last_url = ""
    for url in candidate_urls:
        if url in seen_urls:
            continue
        seen_urls.add(url)

        try:
            timetable, html = fetch_timetable_from_url(session, url, payload)
            last_html = html
            last_url = url
            if timetable["grid"]:
                return {**timetable, "status": "ok", "sourceUrl": url}
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

    return {
        "grid": [],
        "mappings": [],
        "status": "empty",
        "message": "ERP did not return timetable data for the selected academic year and semester."
    }


def sync_marks(payload: Dict[str, str]) -> List[Dict[str, object]]:
    session = perform_login(payload)
    ensure_device_cookie(session)
    captcha_session = get_captcha_session(payload.get("captchaSessionId") or "")
    dashboard_html = captcha_session.get("dashboard_html", "") if captcha_session else ""
    candidate_urls = collect_feature_urls(dashboard_html, MARKS_LINK_KEYWORDS, MARKS_CANDIDATE_PATHS)
    menu_url = find_menu_link_by_keywords(session, ["internals", "internal", "course internals"])
    if menu_url:
        candidate_urls = [menu_url, *candidate_urls]
    csrf_token = extract_csrf_token(dashboard_html) or get_csrf_from_session(session)
    last_html = ""
    last_url = ""

    for url in candidate_urls:
        try:
            html = fetch_html_with_term_form(session, url, payload, csrf_token=csrf_token, xhr=True)
            last_html = html
            last_url = url

            marks = parse_course_internals_page(html, payload, session)
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


def sync_seating_plan(payload: Dict[str, str]) -> List[Dict[str, object]]:
    session = perform_login(payload)
    captcha_session = get_captcha_session(payload.get("captchaSessionId") or "")
    dashboard_html = captcha_session.get("dashboard_html", "") if captcha_session else ""
    html, url = fetch_feature_html(
        session,
        dashboard_html,
        payload,
        SEATING_LINK_KEYWORDS,
        SEATING_CANDIDATE_PATHS
    )
    plans = parse_seating_tables(html, payload)
    if plans:
        return plans

    if DEBUG_ENABLED and html:
        debug_path = Path(__file__).resolve().parent / "last_seating_failure.html"
        debug_path.write_text(f"<!-- URL: {url} -->\n{html}", encoding="utf8")

    return []


def sync_cgpa(payload: Dict[str, str]) -> Dict[str, object]:
    session = perform_login(payload)
    captcha_session = get_captcha_session(payload.get("captchaSessionId") or "")
    dashboard_html = captcha_session.get("dashboard_html", "") if captcha_session else ""
    html, url = fetch_feature_html(
        session,
        dashboard_html,
        payload,
        CGPA_LINK_KEYWORDS,
        CGPA_CANDIDATE_PATHS
    )
    cgpa = parse_cgpa_html(html, payload)
    if cgpa:
        return cgpa

    if DEBUG_ENABLED and html:
        debug_path = Path(__file__).resolve().parent / "last_cgpa_failure.html"
        debug_path.write_text(f"<!-- URL: {url} -->\n{html}", encoding="utf8")

    return {}


def fetch_feature_html(
    session: requests.Session,
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
            html = fetch_html_with_term_form(session, url, payload)
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


def find_menu_link_by_keywords(session: requests.Session, keywords: List[str]) -> str:
    menu_url = urljoin(LOGIN_URL, "menu-student.json")
    try:
        response = request_page(session, menu_url, headers=build_headers(LOGIN_URL))
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


def fetch_html_with_term_form(
    session: requests.Session,
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

    response = request_page(session, url, headers=build_headers(url, headers_extra))
    html = response.text or ""
    html = extract_html_from_json(html)

    form = extract_term_form(html, url)
    if form.get("html"):
        data = build_attendance_form_data(form, payload)
        result_response = submit_form(session, form, data, referer=url)
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


def parse_course_internals_page(html: str, payload: Dict[str, str], session: requests.Session) -> List[Dict[str, object]]:
    soup = BeautifulSoup(html or "", "html.parser")
    tables = soup.find_all("table")
    csrf_token = extract_csrf_token(html)

    for table in tables:
        rows = table.find_all("tr")
        if len(rows) < 2:
            continue

        header_cells = rows[0].find_all(["th", "td"])
        headers = [clean_text(cell.get_text(" ")).lower() for cell in header_cells]

        if not any("academic" in header for header in headers):
            continue
        if not any("semester" in header for header in headers):
            continue
        if not any("course" in header for header in headers):
            continue
        if not any("evaluation" in header or "component" in header for header in headers):
            continue

        year_index = find_index(headers, ["academic year", "academicyear", "year"])
        semester_index = find_index(headers, ["semester", "term"])
        code_index = find_index(headers, ["coursecode", "course code", "code", "subjectcode", "subject code"])
        subject_index = find_index(headers, ["course name", "course", "subject", "coursedesc", "title", "name"])
        component_index = find_index(headers, ["evaluation components", "evaluation component", "components", "evaluation"])

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

            if component_index < 0 or component_index >= len(cells):
                continue

            component_cell = cells[component_index]
            insem1 = None
            insem2 = None
            for link in component_cell.find_all("a"):
                label = clean_text(link.get_text(" "))
                bucket = component_bucket(label)
                if not bucket:
                    continue
                url = extract_component_url(link)
                if not url:
                    continue
                value = fetch_component_mark(session, url, csrf_token)
                if bucket == "insem1" and value is not None:
                    insem1 = value
                if bucket == "insem2" and value is not None:
                    insem2 = value

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
        r"sessional\s*1"
    ])
    insem2_index = find_mark_index(headers, [
        r"in\s*sem\s*2",
        r"in\s*semester\s*2",
        r"internal\s*2",
        r"mid\s*2",
        r"sessional\s*2"
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

    for table in tables:
        headers, rows = parse_table(table)
        if not headers or not rows:
            continue

        if not looks_like_seating_headers(headers):
            continue

        rows = filter_rows_by_term(rows, headers, payload)
        parsed = parse_seating_rows(headers, rows, payload)
        if parsed:
            return parsed

    return []


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
        if year_index >= 0 and not matches_year(row_value(row, year_index), payload.get("academicYear")):
            continue
        if semester_index >= 0 and not matches_semester(row_value(row, semester_index), payload.get("semesterId")):
            continue
        if year_index < 0 and semester_index < 0 and date_index >= 0:
            exam_date = row_value(row, date_index)
            if payload.get("academicYear") and not matches_academic_year_by_date(exam_date, payload.get("academicYear")):
                continue
            if payload.get("semesterId") and not matches_semester_by_date(exam_date, payload.get("semesterId")):
                continue

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


def component_bucket(label: str) -> str:
    text = (label or "").lower()
    if "exam" not in text:
        return ""
    if re.search(r"\b(2|ii)\b", text):
        return "insem2"
    if re.search(r"\b(1|i)\b", text):
        return "insem1"
    return ""


def fetch_component_mark(session: requests.Session, url: str, csrf_token: Optional[str] = None):
    headers_extra = {"X-Requested-With": "XMLHttpRequest"}
    token = csrf_token or get_csrf_from_session(session)
    if token:
        headers_extra["X-CSRF-Token"] = token
    response = request_page(session, url, headers=build_headers(url, headers_extra))
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
    soup = BeautifulSoup(html or "", "html.parser")
    meta = soup.find("meta", {"name": "csrf-token"})
    if meta and meta.get("content"):
        return meta.get("content")
    input_tag = soup.find("input", {"name": "_csrf"})
    if input_tag and input_tag.get("value"):
        return input_tag.get("value")
    return ""


def get_csrf_from_session(session: requests.Session) -> str:
    if session is None:
        return ""
    token = session.cookies.get("_csrf") or session.cookies.get("csrf")
    return token or ""


def ensure_device_cookie(session: requests.Session) -> None:
    if session is None:
        return
    if session.cookies.get("kl_erp_device_id"):
        return

    seed = os.urandom(32).hex()
    token = os.urandom(32).hex()
    raw_value = f"{seed}:2:{{i:0;s:16:\"kl_erp_device_id\";i:1;s:64:\"{token}\";}}"
    session.cookies.set("kl_erp_device_id", quote(raw_value, safe=""))


def extract_component_url(link_tag) -> str:
    href = (link_tag.get("href") or "").strip()
    if href and not href.startswith("#") and "javascript:" not in href.lower():
        return urljoin(LOGIN_URL, href)

    for value in link_tag.attrs.values():
        if isinstance(value, list):
            text = " ".join(str(item) for item in value)
        else:
            text = str(value)

        url = extract_component_url_from_text(text)
        if url:
            return url

    return ""


def extract_component_url_from_text(text: str) -> str:
    if not text:
        return ""

    match = re.search(r"index\.php\?r=[^'\"\s]*index_student_marks[^'\"\s]*", text)
    if match:
        return urljoin(LOGIN_URL, match.group(0))

    match = re.search(r"index_student_marks[^'\"\s]*", text)
    if match:
        return urljoin(LOGIN_URL, match.group(0))

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
    match = re.search(r"(marks|score)\s*[:\-]?\s*(\d+(?:\.\d+)?)", text, re.IGNORECASE)
    if match:
        return float(match.group(2))

    return None


def format_mark_value(obtained: float, maximum: float) -> str:
    def fmt(value: float) -> str:
        if value is None:
            return ""
        if float(value).is_integer():
            return str(int(value))
        return f"{value:.2f}".rstrip("0").rstrip(".")

    return f"{fmt(obtained)}/{fmt(maximum)}"


def parse_cgpa_html(html: str, payload: Dict[str, str]) -> Dict[str, object]:
    soup = BeautifulSoup(html or "", "html.parser")
    tables = soup.find_all("table")
    cgpa_value = None
    text = clean_text(soup.get_text(" "))
    match = re.search(r"cgpa[^0-9]*(\d+(?:\.\d+)?)", text, re.IGNORECASE)
    if match:
        cgpa_value = float(match.group(1))

    for table in tables:
        headers, rows = parse_table(table)
        if not headers or not rows:
            continue

        year_index = find_index(headers, ["reg academic year", "academic year", "academicyear", "year"])
        semester_index = find_index(headers, ["reg sem", "semester", "term"])
        if year_index < 0 and semester_index < 0:
            continue

        rows = filter_rows_by_term(rows, headers, payload)
        if rows:
            if cgpa_value is None:
                return {}
            return {
                "value": cgpa_value,
                "semester": row_value(rows[0], semester_index) or payload.get("semesterId"),
                "academicYear": row_value(rows[0], year_index) or payload.get("academicYear")
            }

    if cgpa_value is not None:
        return {
            "value": cgpa_value,
            "semester": payload.get("semesterId"),
            "academicYear": payload.get("academicYear")
        }

    return {}


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


def fetch_timetable_from_url(session: requests.Session, url: str, payload: Dict[str, str]) -> tuple:
    response = request_page(session, url, headers=build_headers(url))
    html = response.text or ""

    timetable = parse_timetable_html(html)
    if timetable["grid"]:
        return timetable, html

    form = extract_timetable_form(html, url)
    if form.get("html"):
        data = build_attendance_form_data(form, payload)
        result_response = submit_form(session, form, data, referer=url)
        html = result_response.text or ""
        timetable = parse_timetable_html(html)
        if timetable["grid"]:
            return timetable, html

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
    soup = BeautifulSoup(html, "html.parser")
    forms = soup.find_all("form")
    academic_select = find_select_name(soup, ACADEMIC_KEYWORDS)
    semester_select = find_select_name(soup, SEMESTER_KEYWORDS)

    form = None
    for candidate in forms:
        form_text = candidate.get_text(" ", strip=True).lower()
        if "timetable" in form_text or "academic" in form_text or "semester" in form_text:
            form = candidate
            break

    form = form or (forms[0] if forms else None)
    if not form:
        return {"html": "", "actionUrl": base_url, "method": "post"}

    action = form.get("action") or base_url
    method = (form.get("method") or "post").lower()
    return {
        "html": str(form),
        "actionUrl": urljoin(base_url, action),
        "method": method,
        "academicSelect": academic_select,
        "semesterSelect": semester_select
    }


def parse_timetable_html(html: str) -> Dict[str, object]:
    soup = BeautifulSoup(html, "html.parser")
    table = find_timetable_table(soup)
    if not table:
        return {"grid": [], "mappings": []}
        
    rows = table.find_all("tr")
    grid = []
    mappings = [] # List of {subject: "...", faculty: "..."}
    
    for row in rows:
        cells = [clean_text(c.get_text(" ")) for c in row.find_all(["td", "th"])]
        grid.append(cells)
        
        # Try to find subject-faculty mappings in the cell text
        # Usually format is "SUBJECT_NAME (FACULTY_NAME) [ROOM]"
        for cell in cells:
            match = re.search(r"([A-Z0-9\s\-]{5,})\s*\(([^)]+)\)", cell)
            if match:
                subject = match.group(1).strip()
                faculty = match.group(2).strip()
                if {"subject": subject, "faculty": faculty} not in mappings:
                    mappings.append({"subject": subject, "faculty": faculty})
        
    return {
        "grid": grid,
        "mappings": mappings
    }


def find_timetable_table(soup: BeautifulSoup):
    tables = soup.find_all("table")
    for table in tables:
        text = clean_text(table.get_text(" ")).lower()
        if any(day.lower() in text for day in ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]):
            return table
    return tables[0] if tables else None


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

    while len(captcha_sessions_memory) >= MAX_CAPTCHA_SESSIONS:
        oldest = min(captcha_sessions_memory.items(), key=lambda item: item[1].get("created_at", 0))
        close_captcha_session(oldest[0])

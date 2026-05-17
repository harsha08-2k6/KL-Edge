import base64
import json
import os
import re
import time
import uuid
from dataclasses import dataclass
from pathlib import Path
from typing import Dict, List, Optional
from urllib.parse import urljoin

import requests
from bs4 import BeautifulSoup
from dotenv import load_dotenv

load_dotenv()


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

FACULTY_PATH = Path(__file__).resolve().parents[1] / "shared" / "faculty.json"


class AppError(Exception):
    def __init__(self, message: str, status_code: int = 500):
        super().__init__(message)
        self.message = message
        self.status_code = status_code


@dataclass
class CaptchaSession:
    session: requests.Session
    login_html: str
    created_at: float


captcha_sessions: Dict[str, CaptchaSession] = {}


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

    captcha_sessions[session_id] = CaptchaSession(
        session=session,
        login_html=login_html,
        created_at=time.time()
    )

    return {
        "sessionId": session_id,
        "image": f"data:image/png;base64,{image_base64}",
        "expiresAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime(time.time() + CAPTCHA_SESSION_TTL_MS / 1000))
    }


def perform_login(payload: Dict[str, str]) -> requests.Session:
    session_id = payload.get("captchaSessionId") or ""
    captcha_session = captcha_sessions.get(session_id)
    if not captcha_session:
        raise AppError("Captcha session expired. Refresh captcha and try again.", 410)

    # Check if already logged in to this session
    if getattr(captcha_session, "is_logged_in", False):
        return captcha_session.session

    try:
        login_form = extract_login_form(captcha_session.login_html, LOGIN_URL)
        login_data = build_login_form_data(login_form, payload)

        login_response = submit_form(
            captcha_session.session,
            login_form,
            login_data,
            referer=LOGIN_URL
        )

        login_html = login_response.text or ""
        if looks_like_login_failure(login_html, login_form):
            message = extract_login_error_message(login_html)
            clean_message = message or "ERP login failed. Refresh captcha and check ERP ID, password, and captcha."
            raise AppError(clean_message, 401)

        captcha_session.is_logged_in = True
        # Store the login HTML to find dashboard links later if needed
        captcha_session.dashboard_html = login_html
        return captcha_session.session
    except AppError as e:
        raise e
    except Exception as e:
        if DEBUG_ENABLED:
            print("[erp:login] unexpected error", e)
        raise AppError(f"Login failed: {str(e)}", 500)

    try:
        login_form = extract_login_form(captcha_session.login_html, LOGIN_URL)
        login_data = build_login_form_data(login_form, payload)

        login_response = submit_form(
            captcha_session.session,
            login_form,
            login_data,
            referer=LOGIN_URL
        )

        login_html = login_response.text or ""
        if looks_like_login_failure(login_html, login_form):
            message = extract_login_error_message(login_html)
            clean_message = message or "ERP login failed. Refresh captcha and check ERP ID, password, and captcha."
            if DEBUG_ENABLED:
                print("[erp:login] failed", {"message": clean_message})
            raise AppError(clean_message, 401)

        # Dynamically search the dashboard HTML for the Attendance link
        dynamic_attendance_url = find_attendance_link(login_html, LOGIN_URL)
        final_attendance_url = dynamic_attendance_url or ATTENDANCE_URL

        if not final_attendance_url:
            raise AppError("Could not find the Attendance link on the dashboard.", 404)

        attendance_response = request_page(
            captcha_session.session,
            final_attendance_url,
            headers=build_headers(final_attendance_url)
        )
        attendance_html = attendance_response.text or ""

        # Smart optimization: Check if the table is already on the page BEFORE submitting the form
        initial_table = extract_attendance_table(attendance_html)
        parsed_initial = parse_attendance_table(initial_table) if initial_table else []
        if parsed_initial:
            return parsed_initial
            
        attendance_form = extract_attendance_form(attendance_html, final_attendance_url)
        attendance_data = build_attendance_form_data(attendance_form, payload)

        result_response = submit_form(
            captcha_session.session,
            attendance_form,
            attendance_data,
            referer=final_attendance_url
        )
        result_html = result_response.text or ""

        table_html = extract_attendance_table(result_html)
        if not table_html:
            # Check for common "No data" messages before throwing the generic "no table" error
            lowered_result = result_html.lower()
            if "no records found" in lowered_result or "no data found" in lowered_result or "not found" in lowered_result:
                 return [] # Return empty list instead of erroring if it's just a "no data" case
                 
            if DEBUG_ENABLED:
                # Save the failure HTML for debugging if possible
                try:
                    debug_path = Path(__file__).resolve().parent / "last_failure.html"
                    debug_path.write_text(result_html, encoding="utf8")
                    print(f"[erp:scraper] Attendance table missing. Saved response to {debug_path}")
                except Exception:
                    pass
            
            raise AppError("Could not find attendance table in ERP response. This might happen if the ERP layout changed or if there is no attendance data for the selected semester.", 502)

        return parse_attendance_table(table_html)
    except Exception as e:
        raise e


def load_faculty() -> List[Dict[str, object]]:
    if not FACULTY_PATH.exists():
        return []

    return json.loads(FACULTY_PATH.read_text(encoding="utf8"))


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
            if text:
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
    captcha_session = captcha_sessions.get(session_id)
    dashboard_html = getattr(captcha_session, "dashboard_html", "") if captcha_session else ""

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
    captcha_session = captcha_sessions.get(session_id)
    if not captcha_session:
        raise AppError("Captcha session expired.", 410)

    url = f"{LOGIN_URL}index.php?r=timetables/universitymasteracademictimetableview/indexstudentindisearch"
    response = request_page(
        captcha_session.session,
        url,
        headers=build_headers(url)
    )
    
    html = response.text
    soup = BeautifulSoup(html, "html.parser")
    table = soup.find("table")
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
    if session_id in captcha_sessions:
        del captcha_sessions[session_id]


def prune_captcha_sessions() -> None:
    now = time.time()
    expired = [
        session_id
        for session_id, entry in captcha_sessions.items()
        if now - entry.created_at >= CAPTCHA_SESSION_TTL_MS / 1000
    ]
    for session_id in expired:
        close_captcha_session(session_id)

    while len(captcha_sessions) >= MAX_CAPTCHA_SESSIONS:
        oldest = min(captcha_sessions.items(), key=lambda item: item[1].created_at)
        close_captcha_session(oldest[0])

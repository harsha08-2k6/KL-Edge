import os
import requests
from bs4 import BeautifulSoup
from datetime import datetime
import re

LMS_BASE_URL = os.getenv("LMS_URL", "https://lms.kluniversity.in")

class LmsError(Exception):
    pass

def authenticate_lms(username, password):
    """
    Authenticates with the KL University LMS (Moodle) and returns a session cookie token.
    """
    session = requests.Session()
    login_url = f"{LMS_BASE_URL}/login/index.php"

    # Step 1: Get the login page to extract the login token
    try:
        response = session.get(login_url, timeout=10)
        response.raise_for_status()
    except Exception as e:
        raise LmsError(f"Failed to reach LMS login page: {str(e)}")

    soup = BeautifulSoup(response.text, 'html.parser')
    
    # Extract logintoken
    logintoken_input = soup.find('input', {'name': 'logintoken'})
    if not logintoken_input:
        raise LmsError("Login token not found on LMS login page. The site structure may have changed.")
    
    logintoken = logintoken_input.get('value')

    # Step 2: Post credentials to log in
    payload = {
        'username': username,
        'password': password,
        'logintoken': logintoken
    }

    try:
        post_response = session.post(login_url, data=payload, timeout=10)
        post_response.raise_for_status()
    except Exception as e:
        raise LmsError(f"Failed to authenticate with LMS: {str(e)}")

    # Check if login was successful by looking for a logout link or a specific cookie
    if 'MoodleSession' not in session.cookies:
        raise LmsError("Authentication failed: Invalid username or password, or LMS blocked the request.")

    # Convert cookies to a string format we can return as a "token" to the frontend
    moodle_cookie = session.cookies.get('MoodleSession')
    
    return {
        "lmsToken": moodle_cookie,
        "message": "Successfully connected to LMS"
    }

def get_lms_assignments(session_token):
    """
    Fetches assignments from the LMS using the provided session token.
    Uses the Moodle 'my' dashboard page to extract assignments.
    """
    if not session_token:
        raise LmsError("No LMS session token provided.")

    cookies = {'MoodleSession': session_token}
    my_url = f"{LMS_BASE_URL}/my/"

    try:
        response = requests.get(my_url, cookies=cookies, timeout=15)
        response.raise_for_status()
    except Exception as e:
        raise LmsError(f"Failed to fetch LMS dashboard: {str(e)}")

    # If we are redirected to login, the token expired
    if "login/index.php" in response.url:
        raise LmsError("LMS Session expired. Please disconnect and reconnect.")

    # Moodle normally loads assignments via AJAX in modern versions.
    # We must extract the sesskey and make a POST request to the AJAX endpoint.
    
    # 1. Extract sesskey from the HTML
    sesskey_match = re.search(r'"sesskey":"([^"]+)"', response.text)
    if not sesskey_match:
        sesskey_match = re.search(r'sesskey=([a-zA-Z0-9]+)', response.text)
        
    assignments = []
    
    if sesskey_match:
        sesskey = sesskey_match.group(1)
        ajax_url = f"{LMS_BASE_URL}/lib/ajax/service.php?sesskey={sesskey}&info=core_calendar_get_action_events_by_timesort"
        
        import time
        now_ts = int(time.time()) - (86400 * 3) # Include slightly overdue assignments from last 3 days
        
        payload = [{
            "index": 0,
            "methodname": "core_calendar_get_action_events_by_timesort",
            "args": {
                "limitnum": 30,
                "timesortfrom": now_ts
            }
        }]
        
        try:
            ajax_res = requests.post(ajax_url, json=payload, cookies=cookies, timeout=15)
            ajax_res.raise_for_status()
            data = ajax_res.json()
            
            if data and isinstance(data, list) and not data[0].get('error'):
                events = data[0].get('data', {}).get('events', [])
                for ev in events:
                    course_name = ev.get('course', {}).get('fullname', 'General')
                    title = ev.get('name', 'Unknown Assignment')
                    link = ev.get('url', LMS_BASE_URL)
                    
                    # Extract timestamp and format
                    ts = ev.get('timesort')
                    if ts:
                        due_date_iso = datetime.fromtimestamp(ts).isoformat()
                    else:
                        due_date_iso = datetime.now().isoformat()
                        
                    raw_time = ev.get('formattedtime', '')
                    due_date_str = BeautifulSoup(raw_time, "html.parser").text.strip()
                    
                    assignments.append({
                        "id": str(ev.get('id', len(assignments) + 1)),
                        "course": course_name,
                        "title": title,
                        "dueDate": due_date_iso,
                        "dueDateText": due_date_str,
                        "status": "pending",
                        "lmsLink": link
                    })
                
                # If we got assignments via AJAX, return them immediately
                if assignments:
                    return assignments
                    
        except Exception as e:
            # Fall back to HTML parsing if AJAX fails
            pass

    # 2. Fallback: Parse HTML if AJAX didn't work (for older Moodle versions or custom themes)
    soup = BeautifulSoup(response.text, 'html.parser')
    
    # Try to find standard timeline or upcoming events blocks
    event_list_items = soup.select('.event-list-item, .event, .timeline-event, .activity')
    
    for item in event_list_items:
        # Extract title
        title_tag = item.select_one('.name, .event-name, a.text-truncate, .instancename')
        title = title_tag.text.strip() if title_tag else "Unknown Assignment"
        
        # Clean up title (remove "is due" or "Assignment" text often appended by Moodle screenreaders)
        title = re.sub(r' is due$', '', title, flags=re.IGNORECASE)
        
        # Extract course name
        course_tag = item.select_one('.course-name, .text-muted.text-truncate, .course-title')
        course = course_tag.text.strip() if course_tag else "General"
        
        # Extract link
        link_tag = item.select_one('a')
        link = link_tag['href'] if link_tag and link_tag.has_attr('href') else LMS_BASE_URL
        
        # Extract due date
        date_tag = item.select_one('.date, .time, .text-right, time')
        due_date_iso = datetime.now().isoformat() # Fallback
        due_date_str = ""

        if date_tag:
            due_date_str = date_tag.text.strip()
            if date_tag.has_attr('data-timestamp'):
                try:
                    ts = int(date_tag['data-timestamp'])
                    due_date_iso = datetime.fromtimestamp(ts).isoformat()
                except:
                    pass
            elif date_tag.has_attr('datetime'):
                due_date_iso = date_tag['datetime']
            elif date_tag.name == 'time' and date_tag.has_attr('title'):
                due_date_str = date_tag['title']
        
        assignments.append({
            "id": str(len(assignments) + 1),
            "course": course,
            "title": title,
            "dueDate": due_date_iso,
            "dueDateText": due_date_str,
            "status": "pending",
            "lmsLink": link
        })

    return assignments

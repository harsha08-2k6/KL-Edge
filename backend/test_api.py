import requests

res = requests.get('http://localhost:8000/api/captcha')
data = res.json()

payload = {
    'erpId': '12345',
    'password': 'wrongpassword',
    'captcha': 'wrongcaptcha',
    'academicYear': '2025',
    'semesterId': '2',
    'captchaSessionId': data.get('sessionId')
}
res = requests.post('http://localhost:8000/api/sync', json=payload)
print("Sync status:", res.status_code)
print("Sync response:", res.text)

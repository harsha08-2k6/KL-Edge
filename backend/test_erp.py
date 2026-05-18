import requests

s = requests.Session()
# Get CSRF
r1 = s.get("https://newerp.kluniversity.in/index.php?r=site%2Flogin")
from bs4 import BeautifulSoup
soup = BeautifulSoup(r1.text, "html.parser")
csrf = soup.find("meta", {"name": "csrf-token"})["content"]

# Test stakeholder
r2 = s.post(
    "https://newerp.kluniversity.in/index.php?r=site%2Fget-stakeholder-id",
    data={"username": "2400030361"},
    headers={"X-CSRF-Token": csrf, "X-Requested-With": "XMLHttpRequest"}
)
print("Stakeholder:", r2.text)

# Test login
r3 = s.post(
    "https://newerp.kluniversity.in/index.php?r=site%2Flogin",
    data={
        "_csrf": csrf,
        "LoginForm[username]": "2400030361",
        "LoginForm[password]": "fake",
        "LoginForm[captcha]": "fake",
        "LoginForm[qr_code]": ""
    },
    headers={"X-Requested-With": "XMLHttpRequest", "X-PJAX": "true"}
)
print("Login Headers:", r3.headers)
print("Login URL:", r3.url)

import requests

res = requests.post("https://newerp.kluniversity.in/index.php?r=site%2Fget-stakeholder-id", data={"username":"12345"})
print("Response:", res.status_code, res.text)

import erp_scraper
try:
    erp_scraper.perform_login({'erpId':'123','password':'abc','captcha':'xyz'})
except Exception as e:
    print(repr(e))

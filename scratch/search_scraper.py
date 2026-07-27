with open("backend/erp_scraper.py", "r", encoding="utf8") as f:
    lines = f.readlines()

for i, line in enumerate(lines):
    if "session.get(" in line or "session.post(" in line:
        print(f"Line {i+1}: {line.strip()}")
        # print context
        start = max(0, i - 1)
        end = min(len(lines), i + 2)
        for j in range(start, end):
            print(f"  {j+1}: {lines[j].strip()}")
        print("-" * 40)

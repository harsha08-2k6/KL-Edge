from bs4 import BeautifulSoup

def debug_tables():
    with open("backend/last_failure.html", "r", encoding="utf-8") as f:
        html = f.read()
    
    soup = BeautifulSoup(html, "html.parser")
    tables = soup.find_all("table")
    
    print(f"Found {len(tables)} tables")
    for i, table in enumerate(tables):
        rows = table.find_all("tr")
        if not rows: continue
        
        headers = [c.get_text(" ").strip() for c in rows[0].find_all(["th", "td"])]
        print(f"\nTable {i} Headers: {headers}")
        
        if len(rows) > 1:
            first_row = [c.get_text(" ").strip() for c in rows[1].find_all("td")]
            print(f"Table {i} First Row: {first_row}")

if __name__ == "__main__":
    debug_tables()

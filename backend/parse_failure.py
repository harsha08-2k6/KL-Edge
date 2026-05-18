import sys
from bs4 import BeautifulSoup
html = open('last_failure.html', 'r', encoding='utf8').read()
soup = BeautifulSoup(html, 'html.parser')
print('Title:', soup.title.string if soup.title else 'No Title')
forms = soup.find_all('form')
print(len(forms), 'forms')
for i, f in enumerate(forms):
    print(f.get('id'), f.get('action'), f.get('class'))

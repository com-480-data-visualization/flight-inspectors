"""
Viz1 — Grouped bar chart: incidents & fatalities by manufacturer per year
Generates: public/data/crashes_by_manufacturer.json

Output schema:
  [{ year, key, name, incidents, fatalities }, ...]
  - key: lowercase internal identifier
  - name: display name
"""

import csv
import json
import os
from collections import defaultdict

DISPLAY_NAMES = {
    'boeing':     'Boeing',
    'airbus':     'Airbus',
    'douglas':    'Douglas',
    'lockheed':   'Lockheed',
    'de':         'De Havilland',
    'antonov':    'Antonov',
    'ilyushin':   'Ilyushin',
    'fokker':     'Fokker',
    'mcdonnell':  'McDonnell Douglas',
    'tupolev':    'Tupolev',
    'convair':    'Convair',
    'embraer':    'Embraer',
    'cessna':     'Cessna',
    'bell':       'Bell',
    'atr':        'ATR',
    'beechcraft': 'Beechcraft',
    'yakovlev':   'Yakovlev',
    'avro':       'Avro',
    'sikorsky':   'Sikorsky',
    'let':        'LET',
}

rows = list(csv.DictReader(open(
    os.path.join(os.path.dirname(__file__), '..', 'crashes_cleaned.csv')
)))

data = defaultdict(lambda: defaultdict(lambda: {'incidents': 0, 'fatalities': 0}))

for r in rows:
    try:
        y   = int(r['Year'])
        mfr = r['AC mfr'].strip().lower()
        fat = float(r['Fatalities']) if r['Fatalities'] else 0
        if mfr not in DISPLAY_NAMES:
            continue
        data[y][mfr]['incidents']  += 1
        data[y][mfr]['fatalities'] += fat
    except (ValueError, KeyError):
        pass

out = []
for y in range(1919, 2025):
    for mfr, name in DISPLAY_NAMES.items():
        d = data[y].get(mfr, {'incidents': 0, 'fatalities': 0})
        if d['incidents'] > 0 or d['fatalities'] > 0:
            out.append({
                'year':       y,
                'key':        mfr,
                'name':       name,
                'incidents':  d['incidents'],
                'fatalities': int(d['fatalities']),
            })

dest = os.path.join(os.path.dirname(__file__), '..', '..', 'public', 'data',
                    'crashes_by_manufacturer.json')
os.makedirs(os.path.dirname(dest), exist_ok=True)
with open(dest, 'w') as f:
    json.dump(out, f)

print(f'Written {len(out)} records → {dest}')

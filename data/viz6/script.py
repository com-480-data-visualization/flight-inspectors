"""
Viz5 — Poisson flight risk modeller
Generates: public/data/crashes_for_poisson.json

Requires geo_utils.py in the same directory.
Dependencies: geonamescache, pycountry-convert
  pip install geonamescache pycountry-convert

CSV columns used (exact names from crashes_cleaned.csv):
  Year, AC mfr, Operator, Departure, Arrival, Fatalities

Output schema:
  {
    "manufacturers": ["Boeing", ...],   // sorted by total incidents desc
    "airlines":      ["Aeroflot", ...],
    "departures":    ["London", ...],   // city names, sorted by total desc
    "arrivals":      ["New York", ...],
    "decades":       ["1920s", "1930s", ...],
    "combinations":  [
      {
        "decade":        "1970s",
        "manufacturer":  "Boeing",
        "airline":       "Pan American World Airways",
        "departure":     "New York",
        "arrival":       "London",
        "incidents":     3,
        "fatalities":    210
      }, ...
    ],
    "meta": { "yearMin", "yearMax", "totalIncidents", "totalFatalities" }
  }

The front-end filters `combinations` on all five dimensions at once and
sums `incidents` / `fatalities` over the matching decade range to get λ.
"""

import csv
import json
import os
import sys
import re
from collections import defaultdict

# geo_utils.py lives alongside this script
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
sys.path.insert(0, ROOT)
from data.geo_utils import city_to_country, city_to_alpha2, alpha2_to_continent, decade_label, resolve_city

# ---------------------------------------------------------------------------
# Manufacturer normalisation  (same keys as Viz1)
# ---------------------------------------------------------------------------
MFR_DISPLAY = {
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

MFR_KEYWORDS = [
    ('boeing',       'boeing'),
    ('airbus',       'airbus'),
    ('mcdonnell',    'mcdonnell'),
    ('douglas',      'douglas'),
    ('lockheed',     'lockheed'),
    ('de havilland', 'de'),
    ('dehavilland',  'de'),
    ('antonov',      'antonov'),
    ('ilyushin',     'ilyushin'),
    ('fokker',       'fokker'),
    ('tupolev',      'tupolev'),
    ('convair',      'convair'),
    ('embraer',      'embraer'),
    ('cessna',       'cessna'),
    ('bell ',        'bell'),
    ('atr',          'atr'),
    ('beechcraft',   'beechcraft'),
    ('yakovlev',     'yakovlev'),
    ('avro',         'avro'),
    ('sikorsky',     'sikorsky'),
    ('let ',         'let'),
]

def normalise_mfr(raw: str) -> str | None:
    s = raw.strip().lower()
    for keyword, key in MFR_KEYWORDS:
        if keyword in s:
            return key
    return None

# ---------------------------------------------------------------------------
# Read CSV — exact column names from crashes_cleaned.csv
# ---------------------------------------------------------------------------
CSV_PATH = os.path.join(os.path.dirname(__file__), '..', 'crashes_cleaned.csv')
rows = list(csv.DictReader(open(CSV_PATH, encoding='utf-8', errors='replace')))
print(f"Loaded {len(rows)} rows")

# Buckets: (decade, mfr_display, airline, dep_city, arr_city) → {incidents, fatalities}
combos: dict[tuple, dict] = defaultdict(lambda: {'incidents': 0, 'fatalities': 0})

# Track all unique values for dropdown lists (with total incident counts)
mfr_totals:  dict[str, int] = defaultdict(int)
airl_totals: dict[str, int] = defaultdict(int)
dep_totals:  dict[str, int] = defaultdict(int)
arr_totals:  dict[str, int] = defaultdict(int)

skipped = 0
resolved_cities = 0
unresolved_cities: dict[str, int] = defaultdict(int)

def title_case_airline(name: str) -> str:
    # Standard title case, but keep "US" as uppercase
    titled = name.strip().title()
    titled = re.sub(r'\bUs\b', 'US', titled)
    return titled

for r in rows:
    try:
        year = int(r['Year'])
    except (ValueError, KeyError):
        skipped += 1
        continue

    dec = decade_label(year)

    # Manufacturer
    mfr_raw = r.get('AC mfr', '').strip()
    mfr_key = normalise_mfr(mfr_raw)
    mfr_display = MFR_DISPLAY[mfr_key] if mfr_key else 'Other'

    # Airline / Operator
    airline = title_case_airline(r.get('Operator', '').strip() or 'Unknown')
    # Trim very long operator strings (e.g. military descriptions)
    if len(airline) > 60:
        airline = airline[:57] + '…'

    # Fatalities
    try:
        fat = float(r.get('Fatalities', '') or 0)
    except ValueError:
        fat = 0.0

    # Departure city
    dep_raw = r.get('Departure', '').strip()
    arr_raw = r.get('Arrival',   '').strip()

    # Resolve to canonical city name (geonamescache name field) for display
    dep_city = 'Unknown'
    arr_city = 'Unknown'

    if dep_raw:
        dep_hit = resolve_city(dep_raw)
        if dep_hit:
            dep_city = dep_hit['name']
            resolved_cities += 1
        else:
            unresolved_cities[dep_raw] += 1

    if arr_raw:
        arr_hit = resolve_city(arr_raw)
        if arr_hit:
            arr_city = arr_hit['name']
            resolved_cities += 1
        else:
            unresolved_cities[arr_raw] += 1

    key = (dec, mfr_display, airline, dep_city, arr_city)
    combos[key]['incidents']  += 1
    combos[key]['fatalities'] += fat

    mfr_totals[mfr_display]  += 1
    airl_totals[airline]     += 1
    if dep_city != 'Unknown': dep_totals[dep_city] += 1
    if arr_city != 'Unknown': arr_totals[arr_city] += 1

print(f"Skipped {skipped} rows")
print(f"Resolved city lookups: {resolved_cities}")
print(f"Top 10 unresolved: {sorted(unresolved_cities.items(), key=lambda x: -x[1])[:10]}")

# ---------------------------------------------------------------------------
# Build output
# ---------------------------------------------------------------------------
combination_list = []
for (dec, mfr, airl, dep, arr), counts in combos.items():
    combination_list.append({
        'decade':       dec,
        'manufacturer': mfr,
        'airline':      airl,
        'departure':    dep,
        'arrival':      arr,
        'incidents':    counts['incidents'],
        'fatalities':   int(counts['fatalities']),
    })

combination_list.sort(key=lambda x: x['decade'])

# Sorted dropdown lists (by total incidents, descending)
def sorted_keys(d: dict[str, int], min_count: int = 1) -> list[str]:
    # return [k for k, _ in sorted(d.items(), key=lambda x: -x[1]) if _ >= min_count]
    return sorted(k for k, v in d.items() if v >= min_count)

all_decades = sorted({c['decade'] for c in combination_list})

total_incidents  = sum(c['incidents']  for c in combination_list)
total_fatalities = sum(c['fatalities'] for c in combination_list)

out = {
    'manufacturers': sorted_keys(mfr_totals),
    'airlines':      sorted_keys(airl_totals),
    'departures':    sorted_keys(dep_totals),
    'arrivals':      sorted_keys(arr_totals),
    'decades':       all_decades,
    'combinations':  combination_list,
    'meta': {
        'yearMin':         min(int(r['Year']) for r in rows if r.get('Year', '').isdigit()),
        'yearMax':         max(int(r['Year']) for r in rows if r.get('Year', '').isdigit()),
        'totalIncidents':  total_incidents,
        'totalFatalities': total_fatalities,
    },
}

dest = os.path.join(
    os.path.dirname(__file__), '..', '..', 'public', 'data', 'crashes_for_poisson.json'
)
os.makedirs(os.path.dirname(dest), exist_ok=True)
with open(dest, 'w') as f:
    json.dump(out, f, separators=(',', ':'))

print(f'\nWritten {len(combination_list)} combinations → {dest}')
print(f'Manufacturers: {len(mfr_totals)}  Airlines: {len(airl_totals)}  '
      f'Departures: {len(dep_totals)}  Arrivals: {len(arr_totals)}')
print(f'Total incidents: {total_incidents}  Fatalities: {total_fatalities}')

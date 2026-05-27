from typing import Optional

"""
Viz5 — Poisson flight risk modeller
Generates: public/data/crashes_for_poisson.json

Output schema:
  {
    "byYear": [{ "year", "incidents", "fatalities" }, ...],
    "byManufacturer": [{ "key", "name", "incidents", "fatalities", "years" }, ...],
    "byAirline": [{ "name", "incidents", "fatalities", "years" }, ...],
    "byOrigin": [{ "country", "incidents", "fatalities", "years" }, ...],
    "byDestination": [{ "country", "incidents", "fatalities", "years" }, ...],
    "combinations": [
      {
        "year", "manufacturer", "airline", "origin", "destination",
        "incidents", "fatalities"
      }, ...
    ],
    "meta": { "yearMin", "yearMax", "totalIncidents", "totalFatalities" }
  }

The `combinations` array is the key payload: each entry represents one
(year × manufacturer × airline × origin × destination) bucket so the
front-end can filter on any combination of dimensions reactively.

CSV columns expected (subset of Plane Crash Info / Aviation Safety Network
exports; gracefully skipped if absent):
  Year, AC mfr, Operator, Departure airport country,
  Destination airport country, Fatalities
"""

import csv
import json
import os
import re
from collections import defaultdict

# ---------------------------------------------------------------------------
# Manufacturer normalisation (same keys as Viz1)
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

# Keyword → normalised key  (checked as substrings of lowercased AC mfr)
MFR_KEYWORDS = [
    ('boeing',             'boeing'),
    ('airbus',             'airbus'),
    ('mcdonnell',          'mcdonnell'),
    ('douglas',            'douglas'),
    ('lockheed',           'lockheed'),
    ('de havilland',       'de'),
    ('dehavilland',        'de'),
    ('antonov',            'antonov'),
    ('ilyushin',           'ilyushin'),
    ('fokker',             'fokker'),
    ('tupolev',            'tupolev'),
    ('convair',            'convair'),
    ('embraer',            'embraer'),
    ('cessna',             'cessna'),
    ('bell',               'bell'),
    ('atr',                'atr'),
    ('beechcraft',         'beechcraft'),
    ('yakovlev',           'yakovlev'),
    ('avro',               'avro'),
    ('sikorsky',           'sikorsky'),
    ('let',                'let'),
]

def normalise_mfr(raw: str) -> Optional[str]:
    s = raw.strip().lower()
    for keyword, key in MFR_KEYWORDS:
        if keyword in s:
            return key
    return None

# ---------------------------------------------------------------------------
# Airline normalisation — keep top operators verbatim, bucket the rest
# ---------------------------------------------------------------------------
TOP_AIRLINES = {
    'aeroflot', 'air france', 'american airlines', 'british airways',
    'delta air lines', 'eastern air lines', 'indian airlines',
    'japan airlines', 'korean air', 'lufthansa',
    'pan american world airways', 'sabena', 'singapore airlines',
    'turkish airlines', 'united airlines', 'continental airlines',
    'northwest airlines', 'us airways', 'southwest airlines',
    'iberia', 'alitalia', 'sas', 'olympic airways', 'thai airways',
    'cathay pacific', 'qantas', 'air india', 'pakistan international airlines',
    'iran air', 'egyptair', 'austrian airlines', 'swissair', 'tap air portugal',
    'lot polish airlines', 'finnair', 'aer lingus', 'china airlines',
    'china southern airlines', 'air china', 'vietnam airlines',
}

def normalise_airline(raw: str) -> str:
    s = raw.strip().lower()
    s = re.sub(r'\s+', ' ', s)
    if not s:
        return 'Unknown'
    for name in TOP_AIRLINES:
        if name in s:
            # Return title-cased canonical name
            return name.title().replace('Sas', 'SAS').replace('Tap ', 'TAP ')
    return 'Other'

# ---------------------------------------------------------------------------
# Country normalisation — many CSV variants for the same country
# ---------------------------------------------------------------------------
COUNTRY_ALIASES = {
    'usa': 'United States', 'u.s.': 'United States', 'us': 'United States',
    'united states of america': 'United States',
    'ussr': 'Russia', 'soviet union': 'Russia', 'russian federation': 'Russia',
    'u.k.': 'United Kingdom', 'great britain': 'United Kingdom',
    'uk': 'United Kingdom', 'england': 'United Kingdom',
    'west germany': 'Germany', 'east germany': 'Germany',
    'federal republic of germany': 'Germany',
    'people\'s republic of china': 'China',
    'republic of china': 'China',
    "côte d'ivoire": 'Ivory Coast',
    'democratic republic of the congo': 'DR Congo',
    'zaire': 'DR Congo',
}

def normalise_country(raw: str) -> str:
    if not raw or not raw.strip():
        return 'Unknown'
    s = raw.strip().lower()
    if s in COUNTRY_ALIASES:
        return COUNTRY_ALIASES[s]
    return raw.strip().title()

# ---------------------------------------------------------------------------
# CSV column name candidates (different datasets use different headers)
# ---------------------------------------------------------------------------
def pick_col(header: list[str], candidates: list[str]) -> Optional[str]:
    hl = [h.strip().lower() for h in header]
    for c in candidates:
        if c.lower() in hl:
            return header[hl.index(c.lower())]
    return None

# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
CSV_PATH = os.path.join(os.path.dirname(__file__), '..', 'crashes_cleaned.csv')
rows = list(csv.DictReader(open(CSV_PATH, encoding='utf-8', errors='replace')))

if not rows:
    raise SystemExit('No rows found in crashes_cleaned.csv')

header = list(rows[0].keys())

COL_YEAR    = pick_col(header, ['Year', 'year', 'DATE', 'date'])
COL_MFR     = pick_col(header, ['AC mfr', 'AC_mfr', 'Manufacturer', 'manufacturer'])
COL_FAT     = pick_col(header, ['Fatalities', 'fatalities', 'Fatal', 'fatal', 'Deaths'])
COL_AIRLINE = pick_col(header, ['Operator', 'operator', 'Airline', 'airline', 'Carrier'])
COL_ORIG    = pick_col(header, [
    'Departure airport country', 'departure airport country',
    'Origin country', 'origin_country', 'From country',
    'Departure Country', 'departure_country', 'Departure'
])
COL_DEST    = pick_col(header, [
    'Destination airport country', 'destination airport country',
    'Dest country', 'dest_country', 'To country',
    'Destination Country', 'destination_country', 'Arrival'
])

print(f'Columns detected:')
print(f'  year={COL_YEAR}  mfr={COL_MFR}  fatalities={COL_FAT}')
print(f'  airline={COL_AIRLINE}  origin={COL_ORIG}  dest={COL_DEST}')

YEAR_MIN, YEAR_MAX = 1919, 2024

# Structure: combinations[year][mfr_key][airline][origin][dest] → {incidents, fatalities}
combos: dict = defaultdict(
    lambda: defaultdict(
        lambda: defaultdict(
            lambda: defaultdict(
                lambda: defaultdict(lambda: {'incidents': 0, 'fatalities': 0})
            )
        )
    )
)

skipped = 0
for r in rows:
    try:
        year = int(r[COL_YEAR]) if COL_YEAR else None
        if year is None or year < YEAR_MIN or year > YEAR_MAX:
            skipped += 1
            continue

        mfr_raw = r[COL_MFR].strip() if COL_MFR else ''
        mfr_key = normalise_mfr(mfr_raw) or 'other'

        fat_raw = r[COL_FAT].strip() if COL_FAT else ''
        fat = float(fat_raw) if fat_raw else 0.0

        airline = normalise_airline(r[COL_AIRLINE].strip() if COL_AIRLINE else '')
        origin  = normalise_country(r[COL_ORIG].strip()    if COL_ORIG    else '')
        dest    = normalise_country(r[COL_DEST].strip()    if COL_DEST    else '')

        bucket = combos[year][mfr_key][airline][origin][dest]
        bucket['incidents']  += 1
        bucket['fatalities'] += fat

    except (ValueError, KeyError, TypeError):
        skipped += 1

print(f'Skipped {skipped} rows (bad year / parse error)')

# ---------------------------------------------------------------------------
# Flatten to list of combination records
# ---------------------------------------------------------------------------
combination_list = []
for year, mfr_d in combos.items():
    for mfr_key, airline_d in mfr_d.items():
        for airline, orig_d in airline_d.items():
            for origin, dest_d in orig_d.items():
                for dest, counts in dest_d.items():
                    combination_list.append({
                        'year':         year,
                        'manufacturer': mfr_key,
                        'airline':      airline,
                        'origin':       origin,
                        'destination':  dest,
                        'incidents':    counts['incidents'],
                        'fatalities':   int(counts['fatalities']),
                    })

combination_list.sort(key=lambda x: x['year'])

# ---------------------------------------------------------------------------
# Marginals
# ---------------------------------------------------------------------------
by_year: dict[int, dict] = defaultdict(lambda: {'incidents': 0, 'fatalities': 0})
by_mfr:  dict[str, dict] = defaultdict(lambda: {'incidents': 0, 'fatalities': 0, 'years': set()})
by_airl: dict[str, dict] = defaultdict(lambda: {'incidents': 0, 'fatalities': 0, 'years': set()})
by_orig: dict[str, dict] = defaultdict(lambda: {'incidents': 0, 'fatalities': 0, 'years': set()})
by_dest: dict[str, dict] = defaultdict(lambda: {'incidents': 0, 'fatalities': 0, 'years': set()})

for c in combination_list:
    y = c['year']
    by_year[y]['incidents']  += c['incidents']
    by_year[y]['fatalities'] += c['fatalities']
    for d, key in [
        (by_mfr,  c['manufacturer']),
        (by_airl, c['airline']),
        (by_orig, c['origin']),
        (by_dest, c['destination']),
    ]:
        d[key]['incidents']  += c['incidents']
        d[key]['fatalities'] += c['fatalities']
        d[key]['years'].add(y)

total_incidents  = sum(v['incidents']  for v in by_year.values())
total_fatalities = sum(v['fatalities'] for v in by_year.values())

def top(d: dict, n: int = 30) -> list:
    return sorted(d.items(), key=lambda kv: -kv[1]['incidents'])[:n]

out = {
    'byYear': [
        {'year': y, 'incidents': v['incidents'], 'fatalities': v['fatalities']}
        for y, v in sorted(by_year.items())
    ],
    'byManufacturer': [
        {
            'key':        k,
            'name':       MFR_DISPLAY.get(k, k.title()),
            'incidents':  v['incidents'],
            'fatalities': v['fatalities'],
            'years':      len(v['years']),
        }
        for k, v in top(by_mfr)
    ],
    'byAirline': [
        {
            'name':       k,
            'incidents':  v['incidents'],
            'fatalities': v['fatalities'],
            'years':      len(v['years']),
        }
        for k, v in top(by_airl)
    ],
    'byOrigin': [
        {
            'country':    k,
            'incidents':  v['incidents'],
            'fatalities': v['fatalities'],
            'years':      len(v['years']),
        }
        for k, v in top(by_orig, 40)
        if k not in ('Unknown', '')
    ],
    'byDestination': [
        {
            'country':    k,
            'incidents':  v['incidents'],
            'fatalities': v['fatalities'],
            'years':      len(v['years']),
        }
        for k, v in top(by_dest, 40)
        if k not in ('Unknown', '')
    ],
    'combinations': combination_list,
    'meta': {
        'yearMin':         YEAR_MIN,
        'yearMax':         YEAR_MAX,
        'totalIncidents':  total_incidents,
        'totalFatalities': total_fatalities,
    },
}

dest_path = os.path.join(
    os.path.dirname(__file__), '..', '..', 'public', 'data', 'crashes_for_poisson.json'
)
os.makedirs(os.path.dirname(dest_path), exist_ok=True)
with open(dest_path, 'w') as f:
    json.dump(out, f, separators=(',', ':'))

print(f'Written {len(combination_list)} combination records → {dest_path}')
print(f'Total incidents: {total_incidents}  |  Total fatalities: {total_fatalities}')
print(f'Manufacturers: {len(by_mfr)}  |  Airlines: {len(by_airl)}  |  '
      f'Origins: {len(by_orig)}  |  Destinations: {len(by_dest)}')

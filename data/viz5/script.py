"""
Viz6 — Directed chord diagram: crash flows between origin and destination
Generates: public/data/crashes_for_chord.json

Requires geo_utils.py in the same directory.
Dependencies: geonamescache, pycountry-convert
  pip install geonamescache pycountry-convert

CSV columns used (exact names from crashes_cleaned.csv):
  Departure, Arrival, Fatalities

City → country and country → continent are resolved via geonamescache +
pycountry-convert.  When multiple cities share a name the highest-population
city wins (London → United Kingdom, Paris → France, etc.).

Output schema:
  {
    "cities":     [{ "id", "city", "country", "continent",
                     "departures", "arrivals" }, ...],
    "countries":  [{ "id", "country", "continent",
                     "departures", "arrivals" }, ...],
    "continents": [{ "id", "continent", "departures", "arrivals" }, ...],
    "flows": {
      "city":      [{ "from", "to", "count", "fatalities" }, ...],
      "country":   [...],
      "continent": [...]
    }
  }
"""

import csv
import json
import os
import sys
from collections import defaultdict

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
sys.path.insert(0, ROOT)
from data.geo_utils import resolve_city, city_to_country, city_to_alpha2, alpha2_to_continent, ALPHA2_TO_COUNTRY

# ---------------------------------------------------------------------------
# Thresholds — raise to reduce clutter, lower to show more nodes
# ---------------------------------------------------------------------------
MIN_CITY_FLOW      = 3    # minimum crashes on a city→city route to include it
MIN_CITY_NODE      = 5    # minimum total involvement for a city node
MIN_COUNTRY_FLOW   = 5
MIN_COUNTRY_NODE   = 10

# ---------------------------------------------------------------------------
# Read CSV
# ---------------------------------------------------------------------------
CSV_PATH = os.path.join(os.path.dirname(__file__), '..', 'crashes_cleaned.csv')
rows = list(csv.DictReader(open(CSV_PATH, encoding='utf-8', errors='replace')))
print(f"Loaded {len(rows)} rows")

# city_flows[(dep_city_name, dep_alpha2, arr_city_name, arr_alpha2)] → {count, fatalities}
city_flows: dict[tuple, dict] = defaultdict(lambda: {'count': 0, 'fatalities': 0})

skipped = 0
unresolved: dict[str, int] = defaultdict(int)

for r in rows:
    dep_raw = r.get('Departure', '').strip()
    arr_raw = r.get('Arrival',   '').strip()
    if not dep_raw or not arr_raw:
        skipped += 1
        continue

    try:
        fat = float(r.get('Fatalities', '') or 0)
    except ValueError:
        fat = 0.0

    dep_hit = resolve_city(dep_raw)
    arr_hit = resolve_city(arr_raw)

    if not dep_hit:
        unresolved[dep_raw] += 1
        skipped += 1
        continue
    if not arr_hit:
        unresolved[arr_raw] += 1
        skipped += 1
        continue

    dep_name  = dep_hit['name']
    dep_a2    = dep_hit['countrycode']
    arr_name  = arr_hit['name']
    arr_a2    = arr_hit['countrycode']

    # Skip self-loops at city level (same city both ends)
    if dep_name == arr_name:
        skipped += 1
        continue

    key = (dep_name, dep_a2, arr_name, arr_a2)
    city_flows[key]['count']      += 1
    city_flows[key]['fatalities'] += fat

print(f"Skipped {skipped} rows")
print(f"Top 10 unresolved: {sorted(unresolved.items(), key=lambda x: -x[1])[:10]}")
print(f"Unique city→city routes: {len(city_flows)}")

# ---------------------------------------------------------------------------
# Aggregate to country and continent flows
# ---------------------------------------------------------------------------
country_flows:   dict[tuple, dict] = defaultdict(lambda: {'count': 0, 'fatalities': 0})
continent_flows: dict[tuple, dict] = defaultdict(lambda: {'count': 0, 'fatalities': 0})

city_a2_map: dict[str, str] = {}   # city_name → alpha2

for (dep_name, dep_a2, arr_name, arr_a2), counts in city_flows.items():
    city_a2_map[dep_name] = dep_a2
    city_a2_map[arr_name] = arr_a2

    dep_country  = ALPHA2_TO_COUNTRY.get(dep_a2, dep_a2)
    arr_country  = ALPHA2_TO_COUNTRY.get(arr_a2, arr_a2)
    dep_continent = alpha2_to_continent(dep_a2)
    arr_continent = alpha2_to_continent(arr_a2)

    if dep_country != arr_country:   # skip within-country at country level
        country_flows[(dep_country, arr_country, dep_continent, arr_continent)]['count']      += counts['count']
        country_flows[(dep_country, arr_country, dep_continent, arr_continent)]['fatalities'] += counts['fatalities']

    if dep_continent != arr_continent:
        continent_flows[(dep_continent, arr_continent)]['count']      += counts['count']
        continent_flows[(dep_continent, arr_continent)]['fatalities'] += counts['fatalities']

# ---------------------------------------------------------------------------
# Build node lists with marginal totals, apply thresholds
# ---------------------------------------------------------------------------

# ── City nodes ──
city_dep: dict[str, int] = defaultdict(int)
city_arr: dict[str, int] = defaultdict(int)
for (dep_name, _, arr_name, _), counts in city_flows.items():
    city_dep[dep_name] += counts['count']
    city_arr[arr_name] += counts['count']

city_nodes = []
for city in sorted(set(city_dep) | set(city_arr)):
    total = city_dep.get(city, 0) + city_arr.get(city, 0)
    if total < MIN_CITY_NODE:
        continue
    a2        = city_a2_map.get(city, '')
    country   = ALPHA2_TO_COUNTRY.get(a2, 'Unknown')
    continent = alpha2_to_continent(a2)
    if country == 'Unknown':
        continue
    city_nodes.append({
        'id':         city,
        'city':       city,
        'country':    country,
        'continent':  continent,
        'departures': city_dep.get(city, 0),
        'arrivals':   city_arr.get(city, 0),
    })

valid_cities = {n['id'] for n in city_nodes}

city_flow_list = [
    {
        'from':       dep,
        'to':         arr,
        'count':      v['count'],
        'fatalities': int(v['fatalities']),
    }
    for (dep, _, arr, _), v in city_flows.items()
    if dep in valid_cities and arr in valid_cities and v['count'] >= MIN_CITY_FLOW
]

# ── Country nodes ──
country_dep: dict[str, int] = defaultdict(int)
country_arr: dict[str, int] = defaultdict(int)
country_continent_map: dict[str, str] = {}
for (fc, tc, fc_cont, tc_cont), counts in country_flows.items():
    country_dep[fc] += counts['count']
    country_arr[tc] += counts['count']
    country_continent_map[fc] = fc_cont
    country_continent_map[tc] = tc_cont

country_nodes = []
for country in sorted(set(country_dep) | set(country_arr)):
    total = country_dep.get(country, 0) + country_arr.get(country, 0)
    if total < MIN_COUNTRY_NODE or country == 'Unknown':
        continue
    country_nodes.append({
        'id':         country,
        'country':    country,
        'continent':  country_continent_map.get(country, 'Unknown'),
        'departures': country_dep.get(country, 0),
        'arrivals':   country_arr.get(country, 0),
    })

valid_countries = {n['id'] for n in country_nodes}

country_flow_list = [
    {
        'from':       fc,
        'to':         tc,
        'count':      v['count'],
        'fatalities': int(v['fatalities']),
    }
    for (fc, tc, _, _), v in country_flows.items()
    if fc in valid_countries and tc in valid_countries and v['count'] >= MIN_COUNTRY_FLOW
]

# ── Continent nodes ──
cont_dep: dict[str, int] = defaultdict(int)
cont_arr: dict[str, int] = defaultdict(int)
for (fc, tc), counts in continent_flows.items():
    cont_dep[fc] += counts['count']
    cont_arr[tc] += counts['count']

continent_nodes = [
    {
        'id':         cont,
        'continent':  cont,
        'departures': cont_dep.get(cont, 0),
        'arrivals':   cont_arr.get(cont, 0),
    }
    for cont in sorted(set(cont_dep) | set(cont_arr))
    if cont != 'Unknown'
]

valid_continents = {n['id'] for n in continent_nodes}

continent_flow_list = [
    {
        'from':       fc,
        'to':         tc,
        'count':      v['count'],
        'fatalities': int(v['fatalities']),
    }
    for (fc, tc), v in continent_flows.items()
    if fc in valid_continents and tc in valid_continents
]

# ---------------------------------------------------------------------------
# Output
# ---------------------------------------------------------------------------
out = {
    'cities':     city_nodes,
    'countries':  country_nodes,
    'continents': continent_nodes,
    'flows': {
        'city':      sorted(city_flow_list,      key=lambda x: -x['count']),
        'country':   sorted(country_flow_list,   key=lambda x: -x['count']),
        'continent': sorted(continent_flow_list, key=lambda x: -x['count']),
    },
}

dest = os.path.join(
    os.path.dirname(__file__), '..', '..', 'public', 'data', 'crashes_for_chord.json'
)
os.makedirs(os.path.dirname(dest), exist_ok=True)
with open(dest, 'w') as f:
    json.dump(out, f, separators=(',', ':'))

print(f'\nWritten → {dest}')
print(f'  Cities:     {len(city_nodes)} nodes, {len(city_flow_list)} flows')
print(f'  Countries:  {len(country_nodes)} nodes, {len(country_flow_list)} flows')
print(f'  Continents: {len(continent_nodes)} nodes, {len(continent_flow_list)} flows')

"""
Viz4 - Globe: flight routes that ended in a crash
Generates: public/data/crashed_routes.json

Strategy:
  1. Build a city -> (lat, lon) index from OpenFlights `airports.dat`.
     - Key: city name lowercased & punctuation-stripped
     - On collisions, prefer the entry whose name contains "International"
       (likely the main commercial airport), else first seen.
  2. For each crash row that has both Departure and Arrival resolvable in
     the index, emit one record. Drop rows that don't resolve.

Output schema:
  [{ year, operator, ac_type, fatalities, aboard, dep, arr,
     depCity, arrCity }, ...]
    - dep, arr: [lon, lat]
"""

import csv
import json
import os
import re
import sys

# Re-use the country resolver from the Viz3 pipeline so we can fall back to a
# country-centroid X marker when the precise city of a crash isn't in the
# OpenFlights airport index. (Loaded by file path to avoid clashing with our
# own module name.)
import importlib.util
_viz3_path = os.path.join(os.path.dirname(__file__), '..', 'viz3', 'script.py')
_spec = importlib.util.spec_from_file_location('viz3_script', _viz3_path)
_viz3 = importlib.util.module_from_spec(_spec)  # type: ignore[arg-type]
_spec.loader.exec_module(_viz3)  # type: ignore[union-attr]
resolve_country = _viz3.resolve_country

CSV_PATH      = os.path.join(os.path.dirname(__file__), '..', 'crashes_cleaned.csv')
AIRPORTS_PATH = os.path.join(os.path.dirname(__file__), '..', 'airports.dat')
DEST          = os.path.join(os.path.dirname(__file__), '..', '..', 'public',
                             'data', 'crashed_routes.json')


def norm_city(s: str) -> str:
    """Normalise a city string to a lookup key."""
    if not s:
        return ''
    s = s.lower().strip()
    # Strip trailing country/state qualifier: "Paris, France" -> "Paris"
    s = s.split(',')[0].strip()
    # Strip parenthesised stuff
    s = re.sub(r'\([^)]*\)', '', s)
    # Collapse whitespace, strip punctuation except spaces/hyphens
    s = re.sub(r"[^\w\s\-]", '', s)
    s = re.sub(r'\s+', ' ', s).strip()
    return s


def build_index() -> dict:
    """Return {normalised-city: (lon, lat)} index.

    Resolution rules:
      1. Collect all candidate airports per normalised city.
      2. Pick the (city, country) cluster with the most airports
         - large hub cities like London-UK, Paris-FR, Washington-US
           win against same-named small towns.
      3. Within that cluster, prefer the one with "International" in its
         name; else first by line order.
    """
    from collections import defaultdict

    # candidates[city_key][country] = list of (name, lon, lat)
    candidates: dict[str, dict[str, list]] = defaultdict(lambda: defaultdict(list))

    with open(AIRPORTS_PATH, encoding='utf-8', newline='') as f:
        reader = csv.reader(f)
        for row in reader:
            if len(row) < 8:
                continue
            try:
                name = row[1].strip().strip('"')
                city = row[2].strip().strip('"')
                country = row[3].strip().strip('"')
                lat = float(row[6])
                lon = float(row[7])
            except (ValueError, IndexError):
                continue
            key = norm_city(city)
            if not key:
                continue
            candidates[key][country].append((name, lon, lat))

    index: dict[str, tuple[float, float]] = {}
    for city_key, by_country in candidates.items():
        # Pick the country with the most airports (tie-break: largest absolute count alphabetical)
        best_country = max(by_country.items(), key=lambda kv: (len(kv[1]), kv[0]))[0]
        cluster = by_country[best_country]
        # Within the cluster, prefer "international", else first
        intl = [c for c in cluster if 'international' in c[0].lower()]
        chosen = intl[0] if intl else cluster[0]
        _, lon, lat = chosen
        index[city_key] = (lon, lat)
    return index


# Manual overrides for ambiguous popular cities that the auto-heuristic gets wrong
MANUAL_OVERRIDES = {
    'london':     (-0.461941, 51.4706),   # London Heathrow, UK
    'paris':      (2.55,      49.0128),   # Paris CDG, FR
    'washington': (-77.4558,  38.9445),   # Washington Dulles, US
    'rome':       (12.2389,   41.8003),   # Rome Fiumicino, IT
    'moscow':     (37.4146,   55.9726),   # Sheremetyevo, RU
    'beijing':    (116.5849,  40.0801),   # Beijing Capital, CN
    'tokyo':      (140.3863,  35.7647),   # Narita, JP
    'cairo':      (31.4056,   30.1219),   # Cairo Intl, EG
    'istanbul':   (28.8146,   41.2756),   # Istanbul Airport, TR
    'frankfurt':  (8.5706,    50.0333),   # Frankfurt am Main, DE
    'manchester': (-2.27495,  53.3537),   # Manchester UK
    'birmingham': (-1.74803,  52.4539),   # Birmingham UK
    'glasgow':    (-4.43306,  55.8719),   # Glasgow Scotland
    'edinburgh':  (-3.3725,   55.95),
    'alexandria': (29.8964,   31.1839),   # Alexandria Egypt
    'barcelona':  (2.0785,    41.2971),   # Barcelona Spain
    'hanover':    (9.685,     52.4611),   # Hannover DE
    'hannover':   (9.685,     52.4611),
    'sydney':     (151.177,  -33.9461),
    'melbourne':  (144.843,  -37.6733),
    'toronto':    (-79.6306,  43.6772),
    'montreal':   (-73.7408,  45.4706),
    'vancouver':  (-123.184,  49.1939),
    'mexico city':(-99.0721,  19.4363),
    'sao paulo':  (-46.4731, -23.4356),
    'rio de janeiro':(-43.2506,-22.91),
    'buenos aires':(-58.5358,-34.8222),
    'lima':       (-77.1144, -12.0219),
    'bogota':     (-74.1469,  4.70159),
    'caracas':    (-66.9911, 10.6013),
    'santiago':   (-70.7858, -33.3928),
    'johannesburg':(28.246,  -26.1339),
    'cape town':  (18.6017, -33.9648),
    'nairobi':    (36.9275,  -1.31924),
    'lagos':      (3.3212,    6.5774),
    'dubai':      (55.3644,  25.2528),
    'singapore':  (103.994,   1.35019),
    'bangkok':    (100.747,  13.6811),
    'hong kong':  (113.915,  22.3089),
    'shanghai':   (121.808,  31.1434),
    'seoul':      (126.451,  37.4691),   # Incheon
    'osaka':      (135.244,  34.4273),   # Kansai
    'sydney, australia':(151.177,-33.9461),
    'new york':   (-73.7789, 40.6398),  # JFK
    'chicago':    (-87.9048, 41.9786),  # ORD
    'los angeles':(-118.408, 33.9425),  # LAX
    'san francisco':(-122.375,37.6189),
    'miami':      (-80.2906, 25.7959),
    'boston':     (-71.0052, 42.3656),
    'atlanta':    (-84.4281, 33.6367),
    'dallas':     (-97.0382, 32.8969),
    'denver':     (-104.673, 39.8617),
    'seattle':    (-122.309, 47.4489),
    'houston':    (-95.3414, 29.9844),
    'phoenix':    (-112.012, 33.4343),
    'minneapolis':(-93.2168, 44.8819),
    'detroit':    (-83.3534, 42.2124),
}


def main():
    idx = build_index()
    idx.update(MANUAL_OVERRIDES)
    print(f'City index size: {len(idx)} unique cities')

    rows = list(csv.DictReader(open(CSV_PATH, encoding='utf-8')))
    out = []
    skipped = 0

    for r in rows:
        dep_raw = (r.get('Departure') or '').strip()
        arr_raw = (r.get('Arrival') or '').strip()
        if not dep_raw or not arr_raw or dep_raw in ('?', '-') or arr_raw in ('?', '-'):
            skipped += 1
            continue
        try:
            year = int(r['Year'])
        except (ValueError, KeyError):
            skipped += 1
            continue

        dep_key = norm_city(dep_raw)
        arr_key = norm_city(arr_raw)
        dep = idx.get(dep_key)
        arr = idx.get(arr_key)
        if not dep or not arr:
            skipped += 1
            continue
        # Skip same-point "routes" (probably erroneous geocoding)
        if dep == arr:
            skipped += 1
            continue

        # Try to geocode the crash Location.
        # 1) Look up the first chunk (the specific city) in the airport index.
        # 2) If that fails, resolve the *country* of the location text so the
        #    client can show an approximate X at the country's centroid.
        #    The great-circle midpoint is no longer used as a fallback — it
        #    misleads (e.g. London→Singapore midpoint is in Central Asia even
        #    when the crash text clearly says "Myanmar").
        loc_raw = (r.get('Location') or '').strip()
        loc_coords = None
        loc_iso = None
        if loc_raw and loc_raw != '?':
            first = loc_raw.split(',')[0].strip()
            cleaned = re.sub(r'^(near|off|over|above)\s+', '', first.lower()).strip()
            cleaned = re.sub(r'\([^)]*\)', '', cleaned).strip()
            # Skip ocean / generic descriptors for the city geocode
            if cleaned and not any(w in cleaned for w in (
                'ocean', 'sea', 'channel', 'gulf', 'strait', 'bay ',
                'mountains', 'desert', 'jungle', 'forest',
            )):
                ck = norm_city(cleaned)
                if ck and ck in idx and idx[ck] != dep and idx[ck] != arr:
                    loc_coords = idx[ck]

            # Country fallback (always attempt — gives us the approx marker)
            country = resolve_country(loc_raw)
            if country is not None:
                loc_iso = country[0]

        try:
            fat = int(float(r['Fatalities'])) if r['Fatalities'] else 0
        except ValueError:
            fat = 0
        try:
            ab = int(float(r['Aboard'])) if r['Aboard'] else 0
        except ValueError:
            ab = 0

        rec = {
            'year':       year,
            'operator':   (r.get('Operator') or '').strip()[:80],
            'ac_type':    (r.get('AC Type') or '').strip()[:80],
            'fatalities': fat,
            'aboard':     ab,
            'dep':        [round(dep[0], 4), round(dep[1], 4)],
            'arr':        [round(arr[0], 4), round(arr[1], 4)],
            'depCity':    dep_raw[:60],
            'arrCity':    arr_raw[:60],
            'location':   loc_raw[:100],
        }
        if loc_coords is not None:
            rec['loc'] = [round(loc_coords[0], 4), round(loc_coords[1], 4)]
        if loc_iso is not None:
            rec['locIso'] = loc_iso
        out.append(rec)

    os.makedirs(os.path.dirname(DEST), exist_ok=True)
    with open(DEST, 'w', encoding='utf-8') as f:
        json.dump(out, f, ensure_ascii=False)

    print(f'Resolved routes: {len(out)}   Skipped: {skipped}')
    print(f'Written {len(out)} records -> {DEST}')


if __name__ == '__main__':
    main()

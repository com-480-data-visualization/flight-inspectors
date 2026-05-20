"""
Viz2 — Bubble chart: incidents & fatalities by airline per year
Generates: public/data/crashes_by_airline.json

Output schema:
  [{ year, key, name, incidents, fatalities }, ...]
  - Only the top 30 civil airlines by total incident count are included.
  - Military, private, air-taxi and unknown operators are excluded.
"""

import csv
import json
import os
from collections import defaultdict

EXCLUDE = {'military', 'private', 'air taxi', '?', 'us aerial mail service', 'aeropostale'}

rows = list(csv.DictReader(open(
    os.path.join(os.path.dirname(__file__), '..', 'crashes_cleaned.csv')
)))

# Accumulate totals to find top 30
op_totals = defaultdict(lambda: {'incidents': 0, 'fatalities': 0})
data      = defaultdict(lambda: defaultdict(lambda: {'incidents': 0, 'fatalities': 0}))

for r in rows:
    op = r['Operator'].strip().lower()
    if not op or op in EXCLUDE:
        continue
    try:
        y   = int(r['Year'])
        fat = float(r['Fatalities']) if r['Fatalities'] else 0
    except (ValueError, KeyError):
        continue
    data[y][op]['incidents']        += 1
    data[y][op]['fatalities']       += fat
    op_totals[op]['incidents']      += 1
    op_totals[op]['fatalities']     += fat

top_ops = {
    op for op, _ in
    sorted(op_totals.items(), key=lambda x: -x[1]['incidents'])[:30]
}

# Title-case display names
display = {op: op.title() for op in top_ops}

years = sorted(set(int(r['Year']) for r in rows if r['Year'].isdigit()))

out = []
for y in range(min(years), max(years) + 1):
    for op in top_ops:
        d = data[y].get(op, {'incidents': 0, 'fatalities': 0})
        if d['incidents'] > 0 or d['fatalities'] > 0:
            out.append({
                'year':       y,
                'key':        op,
                'name':       display[op],
                'incidents':  d['incidents'],
                'fatalities': int(d['fatalities']),
            })

dest = os.path.join(os.path.dirname(__file__), '..', '..', 'public', 'data',
                    'crashes_by_airline.json')
os.makedirs(os.path.dirname(dest), exist_ok=True)
with open(dest, 'w') as f:
    json.dump(out, f)

print(f'Written {len(out)} records → {dest}')
